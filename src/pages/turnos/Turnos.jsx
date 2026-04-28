import { useState, useEffect, useRef } from 'react'
import { collection, query, where, getDocs, orderBy, doc, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { useCache } from '../../context/AppCache'
import { estadoPlan, diasHabilesRestantes, hoy } from '../../utils/helpers'

const ILupa = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)

const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const DIAS_FULL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

function fmtFechaCor(s) {
  const [y,m,d] = s.split('-'); return `${d}/${m}`
}

function getLunesDeSemana(fechaRef) {
  const d = new Date(fechaRef + 'T00:00:00')
  const dia = d.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function getSemana(lunes) {
  const dias = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(lunes + 'T00:00:00')
    d.setDate(d.getDate() + i)
    dias.push(d.toISOString().split('T')[0])
  }
  return dias
}

function PlanBadge({ p }) {
  if (!p || !p.plan) return <span className="badge bk">Sin plan</span>
  const e = estadoPlan(p.plan)
  if (e === 'vencido') return <span className="badge br">Venc.</span>
  if (e === 'por-vencer') return <span className="badge ba">{diasHabilesRestantes(p.plan.fechaVencimiento)}d</span>
  return <span className="badge bg">Ok</span>
}

function AsistenciaBtn({ turno, onCambio }) {
  const [loading, setLoading] = useState(false)
  const est = turno.asistencia || 'pendiente'
  async function marcar(v) { if (loading) return; setLoading(true); await onCambio(turno, v); setLoading(false) }
  if (est === 'asistio') return (
    <div className="row" style={{ gap: 4 }}>
      <span className="badge bg">Asistió</span>
      <button className="btn bs bsm" style={{ fontSize: 11, padding: '3px 7px' }} onClick={() => marcar('pendiente')} disabled={loading}>✕</button>
    </div>
  )
  if (est === 'falto') return (
    <div className="row" style={{ gap: 4 }}>
      <span className="badge br">Faltó</span>
      <button className="btn bs bsm" style={{ fontSize: 11, padding: '3px 7px' }} onClick={() => marcar('pendiente')} disabled={loading}>✕</button>
    </div>
  )
  return (
    <div className="row" style={{ gap: 4 }}>
      <button className="btn bsuc bsm" onClick={() => marcar('asistio')} disabled={loading}>✓</button>
      <button className="btn bd bsm" onClick={() => marcar('falto')} disabled={loading}>✗</button>
    </div>
  )
}


function KineSelector({ turno, kines, onCambio }) {
  const [editando, setEditando] = useState(false)
  const [loading, setLoading] = useState(false)

  async function cambiar(kineId) {
    if (!kineId || kineId === turno.kinesiologoId) { setEditando(false); return }
    setLoading(true)
    await onCambio(turno, kineId)
    setEditando(false)
    setLoading(false)
  }

  if (editando) return (
    <select autoFocus defaultValue={turno.kinesiologoId}
      onChange={e => cambiar(e.target.value)}
      onBlur={() => setEditando(false)}
      disabled={loading}
      style={{ fontSize: 12, padding: '3px 6px', border: '1px solid var(--az)', borderRadius: 6, background: '#fff' }}>
      <option value="">Seleccioná...</option>
      {kines.map(k => <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
    </select>
  )

  return (
    <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
      <span style={{ fontSize: 12 }}>{turno.kinesiologoNombre}</span>
      <button className="btn bs bsm" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => setEditando(true)}>✎</button>
    </div>
  )
}

export default function Turnos() {
  const navigate = useNavigate()
  const { getKines, getPacientes, invalidarPacs } = useCache()
  const [vista, setVista]       = useState('dia') // 'dia' | 'semana'
  const [turnos, setTurnos]     = useState([])
  const [mapaP, setMapaP]       = useState({})
  const [kines, setKines]       = useState([])
  const [kineFiltro, setKF]     = useState('')
  const [fecha, setFecha]       = useState(hoy())
  const [lunes, setLunes]       = useState(getLunesDeSemana(hoy()))
  const [busqNombre, setBN]     = useState('')
  const [buscado, setBuscado]   = useState(false)
  const [cargando, setCargando] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    Promise.all([getKines(), getPacientes()]).then(([k, pacs]) => {
      setKines(k)
      const m = {}; pacs.forEach(p => { m[p.id] = p }); setMapaP(m)
    })
  }, [])

  // ── Vista día ─────────────────────────────────────────────
  async function buscarDia(f) {
    setCargando(true); setBuscado(true)
    const snap = await getDocs(query(
      collection(db, 'turnos'), where('fecha', '==', f), orderBy('hora')
    ))
    setTurnos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setCargando(false)
  }

  function onFechaChange(f) {
    setFecha(f); clearTimeout(timer.current)
    timer.current = setTimeout(() => buscarDia(f), 400)
  }

  // ── Vista semana — 1 sola query para los 7 días ───────────
  async function buscarSemana(l) {
    setCargando(true); setBuscado(true)
    const semana = getSemana(l)
    const snap = await getDocs(query(
      collection(db, 'turnos'),
      where('fecha', '>=', semana[0]),
      where('fecha', '<=', semana[6]),
      orderBy('fecha'),
      orderBy('hora')
    ))
    setTurnos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setCargando(false)
  }

  function semanaAnterior() {
    const d = new Date(lunes + 'T00:00:00'); d.setDate(d.getDate() - 7)
    const nl = d.toISOString().split('T')[0]; setLunes(nl); buscarSemana(nl)
  }
  function semanaSiguiente() {
    const d = new Date(lunes + 'T00:00:00'); d.setDate(d.getDate() + 7)
    const nl = d.toISOString().split('T')[0]; setLunes(nl); buscarSemana(nl)
  }

  function cambiarVista(v) {
    setVista(v); setTurnos([]); setBuscado(false); setBN('')
    if (v === 'semana') {
      const nl = getLunesDeSemana(fecha); setLunes(nl); buscarSemana(nl)
    }
  }

  // ── Asistencia con batch ──────────────────────────────────
  async function cambiarAsistencia(turno, nuevoEst) {
    try {
      const pac = mapaP[turno.pacienteId]
      const batch = writeBatch(db)
      batch.update(doc(db, 'turnos', turno.id), { asistencia: nuevoEst, asistenciaTs: serverTimestamp() })
      if (nuevoEst === 'asistio' && pac?.plan) {
        const n = (pac.plan.sesionesUsadas || 0) + 1
        batch.update(doc(db, 'pacientes', turno.pacienteId), { 'plan.sesionesUsadas': n })
        await batch.commit()
        setMapaP(p => ({ ...p, [turno.pacienteId]: { ...pac, plan: { ...pac.plan, sesionesUsadas: n } } }))
        invalidarPacs()
      } else if (nuevoEst === 'pendiente' && turno.asistencia === 'asistio' && pac?.plan) {
        const n = Math.max(0, (pac.plan.sesionesUsadas || 0) - 1)
        batch.update(doc(db, 'pacientes', turno.pacienteId), { 'plan.sesionesUsadas': n })
        await batch.commit()
        setMapaP(p => ({ ...p, [turno.pacienteId]: { ...pac, plan: { ...pac.plan, sesionesUsadas: n } } }))
        invalidarPacs()
      } else {
        await batch.commit()
      }
      setTurnos(prev => prev.map(t => t.id === turno.id ? { ...t, asistencia: nuevoEst } : t))
    } catch (err) { console.error(err); alert('Error al actualizar') }
  }


  async function cambiarKine(turno, kineId) {
    try {
      const kine = kines.find(k => k.id === kineId)
      if (!kine) return
      const batch = writeBatch(db)
      batch.update(doc(db, 'turnos', turno.id), {
        kinesiologoId: kineId,
        kinesiologoNombre: kine.apellido + ' ' + kine.nombre
      })
      await batch.commit()
      setTurnos(prev => prev.map(t => t.id === turno.id
        ? { ...t, kinesiologoId: kineId, kinesiologoNombre: kine.apellido + ' ' + kine.nombre }
        : t
      ))
    } catch (err) { console.error(err); alert('Error al cambiar kinesiológo') }
  }

  // ── Datos para vista día ──────────────────────────────────
  const filtrados = turnos.filter(t => {
    const nom = (t.pacienteApellido + ' ' + t.pacienteNombre).toLowerCase()
    return nom.includes(busqNombre.toLowerCase()) && (kineFiltro ? t.kinesiologoId === kineFiltro : true)
  })
  const asistieron = turnos.filter(t => t.asistencia === 'asistio').length
  const faltaron   = turnos.filter(t => t.asistencia === 'falto').length
  const pendientes = turnos.filter(t => !t.asistencia || t.asistencia === 'pendiente').length

  // ── Datos para vista semana ───────────────────────────────
  const semana = getSemana(lunes)
  // Horas únicas presentes en la semana, ordenadas
  const horasSet = [...new Set(turnos.map(t => t.hora))].sort()
  // Mapa: fecha → hora → [turnos]
  const gridData = {}
  turnos.forEach(t => {
    if (!gridData[t.fecha]) gridData[t.fecha] = {}
    if (!gridData[t.fecha][t.hora]) gridData[t.fecha][t.hora] = []
    gridData[t.fecha][t.hora].push(t)
  })

  // ── Render vista semana ───────────────────────────────────
  function renderSemana() {
    const hoy2 = hoy()
    return (
      <div>
        {/* Navegación semana */}
        <div className="row" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
          <button className="btn bs bsm" onClick={semanaAnterior}>← Semana anterior</button>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {fmtFechaCor(semana[0])} — {fmtFechaCor(semana[6])}
          </span>
          <button className="btn bs bsm" onClick={semanaSiguiente}>Semana siguiente →</button>
        </div>

        {cargando ? (
          <div className="sc"><div className="sp" /></div>
        ) : horasSet.length === 0 ? (
          <div className="card">
            <div className="emt">No hay turnos esta semana</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 60, padding: '8px 6px', background: '#f8f8f8', border: '1px solid #eee', textAlign: 'center', fontSize: 11 }}>Hora</th>
                  {semana.map((f, i) => (
                    <th key={f} style={{
                      padding: '8px 6px', background: f === hoy2 ? 'var(--azc)' : '#f8f8f8',
                      border: '1px solid #eee', textAlign: 'center', fontSize: 11,
                      color: f === hoy2 ? 'var(--az)' : 'inherit', minWidth: 110
                    }}>
                      <div style={{ fontWeight: 700 }}>{DIAS[i]}</div>
                      <div style={{ fontWeight: 400, opacity: .7 }}>{fmtFechaCor(f)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {horasSet.map(hora => (
                  <tr key={hora}>
                    <td style={{ padding: '6px', border: '1px solid #eee', textAlign: 'center', fontWeight: 700, color: '#666', background: '#fafafa', fontSize: 12 }}>
                      {hora}
                    </td>
                    {semana.map(f => {
                      const celdaTurnos = (gridData[f]?.[hora] || [])
                        .filter(t => kineFiltro ? t.kinesiologoId === kineFiltro : true)
                      const esHoy = f === hoy2
                      return (
                        <td key={f} style={{
                          padding: '4px 5px', border: '1px solid #eee',
                          verticalAlign: 'top', background: esHoy ? '#fafeff' : 'white',
                          minHeight: 40
                        }}>
                          {celdaTurnos.map(t => {
                            const pac = mapaP[t.pacienteId]
                            const estP = pac?.plan ? estadoPlan(pac.plan) : null
                            const colorFila = t.asistencia === 'asistio' ? '#f0fff4' : t.asistencia === 'falto' ? '#fff5f5' : estP === 'vencido' ? '#fff8f8' : 'white'
                            return (
                              <div key={t.id} style={{
                                background: colorFila, borderRadius: 5,
                                padding: '4px 6px', marginBottom: 3,
                                border: '1px solid #e8e8e8', cursor: 'pointer'
                              }}>
                                <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--az)' }}
                                  onClick={() => navigate('/pacientes/' + t.pacienteId)}>
                                  {t.pacienteApellido} {t.pacienteNombre}
                                </div>
                                <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}><KineSelector turno={t} kines={kines} onCambio={cambiarKine}/></div>
                                {estP === 'vencido' && <div style={{ fontSize: 10, color: 'var(--ro)' }}>⚠ Vencido</div>}
                                {estP === 'por-vencer' && <div style={{ fontSize: 10, color: 'var(--na)' }}>⚠ {diasHabilesRestantes(pac.plan.fechaVencimiento)}d</div>}
                                <div style={{ marginTop: 3 }}>
                                  <AsistenciaBtn turno={t} onCambio={cambiarAsistencia} />
                                </div>
                              </div>
                            )
                          })}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ── Render vista día ──────────────────────────────────────
  function renderDia() {
    return (
      <div>
        <div className="filtros">
          <div className="sw" style={{ flex: 1, minWidth: 180 }}>
            <ILupa />
            <input className="si" placeholder="Filtrar por nombre..." value={busqNombre} onChange={e => setBN(e.target.value)} />
          </div>
          <input type="date" value={fecha} onChange={e => onFechaChange(e.target.value)} />
          <select value={kineFiltro} onChange={e => setKF(e.target.value)}>
            <option value="">Todos los kinesiológos</option>
            {kines.map(k => <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
          </select>
          <button className="btn bp bsm" onClick={() => buscarDia(fecha)}>Buscar</button>
        </div>

        {buscado && turnos.length > 0 && (
          <div className="mets" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 14 }}>
            <div className="met"><div className="met-l">Asistieron</div><div className="met-v cve">{asistieron}</div></div>
            <div className="met"><div className="met-l">Faltaron</div><div className="met-v cro">{faltaron}</div></div>
            <div className="met"><div className="met-l">Sin confirmar</div><div className="met-v cgr">{pendientes}</div></div>
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {cargando ? (
            <div className="sc"><div className="sp" /></div>
          ) : !buscado ? (
            <div className="empty-search">
              <ILupa />
              <p>Elegí una fecha para ver los turnos</p>
              <span>o hacé clic en "Buscar" para cargar el día de hoy</span>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="emt">No hay turnos para esta fecha</div>
          ) : (
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Hora</th><th>Paciente</th><th>Obra social</th>
                    <th>Kinesiológo</th><th>Sesión</th><th>Plan</th>
                    <th>Asistencia</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(t => {
                    const pac = mapaP[t.pacienteId]
                    const estP = pac?.plan ? estadoPlan(pac.plan) : null
                    return (
                      <tr key={t.id} style={{ background: estP === 'vencido' ? '#fff8f8' : estP === 'por-vencer' ? '#fffbf0' : 'inherit' }}>
                        <td className="fw6">{t.hora}</td>
                        <td>
                          <div style={{ cursor: 'pointer', color: 'var(--az)' }} onClick={() => navigate('/pacientes/' + t.pacienteId)}>
                            {t.pacienteApellido} {t.pacienteNombre}
                          </div>
                          {estP === 'vencido' && <div style={{ fontSize: 11, color: 'var(--ro)', marginTop: 2 }}>⚠ Plan vencido</div>}
                          {estP === 'por-vencer' && <div style={{ fontSize: 11, color: 'var(--na)', marginTop: 2 }}>⚠ Vence en {diasHabilesRestantes(pac.plan.fechaVencimiento)}d</div>}
                        </td>
                        <td>{t.obraSocial ? <span className="badge bb">{t.obraSocial}</span> : '—'}</td>
                        <td><KineSelector turno={t} kines={kines} onCambio={cambiarKine}/></td>
                        <td>{t.nroSesion ? t.nroSesion + '/' + (pac?.plan?.sesionesTotal || '?') : '—'}</td>
                        <td><PlanBadge p={pac} /></td>
                        <td><AsistenciaBtn turno={t} onCambio={cambiarAsistencia} /></td>
                        <td>
                          <button className="btn bs bsm" style={{ fontSize: 11 }} onClick={() => navigate('/turnos/' + t.id + '/editar')}>
                            Editar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="ph">
        <div className="ptitle">Turnos</div>
        <button className="btn bp" onClick={() => navigate('/turnos/nuevo')}>+ Nuevo turno</button>
      </div>

      {/* Toggle vista día / semana */}
      <div className="row" style={{ marginBottom: 14, justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 0, border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
          <button
            onClick={() => cambiarVista('dia')}
            style={{
              padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: vista === 'dia' ? 'var(--az)' : '#fff', color: vista === 'dia' ? '#fff' : '#666'
            }}
          >
            Vista día
          </button>
          <button
            onClick={() => cambiarVista('semana')}
            style={{
              padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
              borderLeft: '1px solid #ddd',
              background: vista === 'semana' ? 'var(--az)' : '#fff', color: vista === 'semana' ? '#fff' : '#666'
            }}
          >
            Vista semana
          </button>
        </div>

        {/* Filtro kine visible en ambas vistas */}
        {vista === 'semana' && (
          <select value={kineFiltro} onChange={e => setKF(e.target.value)}
            style={{ padding: '7px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }}>
            <option value="">Todos los kinesiológos</option>
            {kines.map(k => <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
          </select>
        )}
      </div>

      {vista === 'dia' ? renderDia() : renderSemana()}
    </div>
