import { useState, useEffect, Fragment } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { useCache } from '../../context/AppCache'
import { mesActual, labelMes, getMeses, fmtFecha, hoy } from '../../utils/helpers'

const ILupa = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)

// Antes de las 14:00 se considera turno de mañana, de ahí en más, de tarde.
// La hora guardada debería venir siempre en formato 24hs (ver horaActual() en helpers),
// pero hay turnos viejos guardados en 12hs con a.m./p.m. (algunos navegadores/dispositivos
// devuelven eso con toLocaleTimeString aunque se les pida 'es-AR') — se contempla también
// ese formato para no romper reportes de fechas pasadas.
function esManana(hora) {
  if (!hora) return true
  const s = hora.trim().toLowerCase()
  const m = s.match(/(\d{1,2}):(\d{2})/)
  if (!m) return true
  let h = parseInt(m[1], 10)
  if (isNaN(h)) return true
  if (/p\.?\s?m\.?/.test(s) && h !== 12) h += 12
  if (/a\.?\s?m\.?/.test(s) && h === 12) h = 0
  return h < 14
}

// La hora que importa para mañana/tarde es cuándo se marcó la asistencia realmente,
// no la hora agendada del turno (pueden diferir si se carga la asistencia más tarde)
function horaEfectiva(t) {
  return t.horaAsistencia || t.hora
}

export default function Reportes() {
  const { getKines, getPacientes } = useCache()
  const [vista, setVista]   = useState('mes') // 'mes' | 'dia'
  const [mes, setMes]       = useState(mesActual())
  const [fechaDia, setFechaDia] = useState(hoy())
  const [kines, setKines]   = useState([])
  const [totalP, setTP]     = useState(0)
  const [turnos, setT]      = useState([])
  const [carg, setCarg]     = useState(false)
  const [cargado, setCargado] = useState(false)
  const [busqK, setBK]      = useState('')
  const [expandido, setExpandido] = useState(null)

  // Carga kines desde colección 'kinesiologos' (carga manual) via AppCache
  useEffect(() => {
    Promise.all([getKines(), getPacientes()]).then(([k, p]) => {
      setKines(k)
      setTP(p.length)
    })
  }, [])

  async function cargarReporte() {
    setCarg(true)
    let snap
    if (vista === 'dia') {
      snap = await getDocs(query(collection(db, 'turnos'), where('fecha', '==', fechaDia)))
    } else {
      const parts = mes.split('-')
      const y = parts[0], m = parts[1]
      // 1 sola query — todos los turnos del mes con asistencia registrada
      snap = await getDocs(query(
        collection(db, 'turnos'),
        where('fecha', '>=', y + '-' + m + '-01'),
        where('fecha', '<=', y + '-' + m + '-31')
      ))
    }
    setT(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setCargado(true)
    setCarg(false)
  }

  function resetVista() { setCargado(false); setT([]); setBK(''); setExpandido(null) }
  function cambiarVista(v) { setVista(v); resetVista() }
  function onMesChange(m) { setMes(m); resetVista() }
  function onDiaChange(f) { setFechaDia(f); resetVista() }

  // Todos los turnos del período — incluye los cargados desde ficha de paciente
  // y los cargados desde panel de turnos con asistencia marcada
  const turnosConAsistencia = turnos.filter(t => t.asistencia === 'asistio')

  // Agrupar por kinesiologoId — funciona con kines de colección 'kinesiologos'
  // Y también con kines de 'usuarios' (los viejos) por si quedaron registros
  // Para eso armamos el mapa desde los turnos mismos
  const mapaKines = {}
  turnosConAsistencia.forEach(t => {
    const kId = t.kinesiologoId || 'sin-asignar'
    const kNombre = t.kinesiologoNombre || 'Sin asignar'
    if (!mapaKines[kId]) {
      mapaKines[kId] = { id: kId, nombre: kNombre, sesiones: 0, manana: 0, tarde: 0, pacientes: new Map() }
    }
    mapaKines[kId].sesiones++
    if (esManana(horaEfectiva(t))) mapaKines[kId].manana++
    else mapaKines[kId].tarde++
    if (t.pacienteId) {
      const nombrePac = `${t.pacienteApellido || ''} ${t.pacienteNombre || ''}`.trim() || 'Sin nombre'
      if (!mapaKines[kId].pacientes.has(t.pacienteId)) {
        mapaKines[kId].pacientes.set(t.pacienteId, { nombre: nombrePac, fechas: [] })
      }
      mapaKines[kId].pacientes.get(t.pacienteId).fechas.push(t.fecha)
    }
  })

  // Convertir a array y ordenar por sesiones
  const porKine = Object.values(mapaKines)
    .map(k => ({
      ...k,
      pacs: k.pacientes.size,
      pacientesLista: [...k.pacientes.values()]
        .map(p => ({ nombre: p.nombre, fechas: [...p.fechas].sort() }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
    }))
    .sort((a, b) => b.sesiones - a.sesiones)

  // También mostrar kines activos con 0 sesiones en el período
  const kinesConCero = kines.filter(k => !mapaKines[k.id]).map(k => ({
    id: k.id,
    nombre: k.apellido + ' ' + k.nombre,
    sesiones: 0, manana: 0, tarde: 0,
    pacs: 0,
    pacientesLista: []
  }))

  const todosKines = [...porKine, ...kinesConCero]

  // Filtrado en memoria por nombre
  const kinesVis = !busqK ? todosKines : todosKines.filter(k =>
    k.nombre.toLowerCase().includes(busqK.toLowerCase())
  )

  const total = porKine.reduce((a, k) => a + k.sesiones, 0)
  const totalTurnos = turnos.length
  const totalFaltas = turnos.filter(t => t.asistencia === 'falto').length
  const totalPendientes = turnos.filter(t => !t.asistencia || t.asistencia === 'pendiente').length

  const tituloPeriodo = vista === 'dia' ? fmtFecha(fechaDia) : labelMes(mes)

  // Detalle de turnos del día, ordenados por la hora real de asistencia (o la agendada si no asistió)
  const detalleDia = [...turnos].sort((a,b) => (horaEfectiva(a)||'').localeCompare(horaEfectiva(b)||''))

  return (
    <div>
      <div className="ph">
        <div className="ptitle">Reportes</div>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={'tab ' + (vista === 'mes' ? 'on' : '')} onClick={() => cambiarVista('mes')}>Por mes</button>
        <button className={'tab ' + (vista === 'dia' ? 'on' : '')} onClick={() => cambiarVista('dia')}>Por día</button>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        {vista === 'mes' ? (
          <select value={mes} onChange={e => onMesChange(e.target.value)}
            style={{ padding: '8px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }}>
            {getMeses(12).map(m => (
              <option key={m} value={m}>{labelMes(m)}</option>
            ))}
          </select>
        ) : (
          <input type="date" value={fechaDia} onChange={e => onDiaChange(e.target.value)}
            style={{ padding: '8px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }} />
        )}
        <button className="btn bp" onClick={cargarReporte} disabled={carg}>
          {carg ? 'Cargando...' : 'Ver reporte'}
        </button>
      </div>

      <div className="mets m3">
        <div className="met"><div className="met-l">Sesiones confirmadas</div><div className="met-v cve">{total}</div></div>
        <div className="met"><div className="met-l">Pacientes activos</div><div className="met-v">{totalP}</div></div>
        <div className="met"><div className="met-l">Kinesiológos</div><div className="met-v">{kines.length}</div></div>
      </div>

      {!cargado ? (
        <div className="card">
          <div className="empty-search">
            <ILupa />
            <p>Elegí {vista === 'dia' ? 'la fecha' : 'el mes'} y hacé clic en "Ver reporte"</p>
            <span>Se cargan los datos solo cuando los pedís</span>
          </div>
        </div>
      ) : carg ? (
        <div className="sc"><div className="sp" /></div>
      ) : (
        <div>
          {/* Resumen general del período */}
          <div className="mets m3" style={{ marginBottom: 16 }}>
            <div className="met"><div className="met-l">Turnos del período</div><div className="met-v">{totalTurnos}</div></div>
            <div className="met"><div className="met-l">Asistencias</div><div className="met-v cve">{total}</div></div>
            <div className="met"><div className="met-l">Faltas</div><div className="met-v cro">{totalFaltas}</div></div>
          </div>

          {/* Sesiones por kinesiológo */}
          <div className="card">
            <div className="card-title">Sesiones por kinesiológo — {tituloPeriodo}</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
              Incluye sesiones registradas desde turnos y desde fichas de pacientes. Mañana: hasta las 13:59 — Tarde: de 14:00 en adelante, según la hora real en que se marcó la asistencia (no la hora agendada del turno).
            </div>
            <div className="filtros">
              <div className="sw" style={{ flex: 1, minWidth: 200 }}>
                <ILupa />
                <input className="si" placeholder="Filtrar kinesiológo..."
                  value={busqK} onChange={e => setBK(e.target.value)} />
              </div>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Kinesiológo</th>
                    <th>Mañana</th>
                    <th>Tarde</th>
                    <th>Total sesiones</th>
                    <th>Pacientes atendidos</th>
                    <th>% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {kinesVis.length === 0 && (
                    <tr><td colSpan="6" className="emt">Sin datos en este período</td></tr>
                  )}
                  {kinesVis.map(k => (
                    <Fragment key={k.id}>
                      <tr style={{ opacity: k.sesiones === 0 ? 0.5 : 1 }}>
                        <td className="fw6">{k.nombre}</td>
                        <td>{k.manana || '—'}</td>
                        <td>{k.tarde || '—'}</td>
                        <td>
                          {k.sesiones > 0
                            ? <span style={{ fontWeight: 700, color: 'var(--ve)' }}>{k.sesiones}</span>
                            : <span style={{ color: '#aaa' }}>0</span>
                          }
                        </td>
                        <td>
                          {k.pacs || '—'}
                          {k.pacs > 0 && (
                            <button className="btn bs bsm" style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px' }}
                              onClick={() => setExpandido(expandido === k.id ? null : k.id)}>
                              {expandido === k.id ? 'Ocultar' : 'Ver'}
                            </button>
                          )}
                        </td>
                        <td>{total > 0 && k.sesiones > 0 ? ((k.sesiones / total) * 100).toFixed(1) + '%' : '—'}</td>
                      </tr>
                      {expandido === k.id && (
                        <tr>
                          <td colSpan="6" style={{ background: '#f9f9f9', fontSize: 12, padding: '10px 14px', color: '#444' }}>
                            {k.pacientesLista.map((p, i) => (
                              <div key={i} style={{ padding: '2px 0' }}>
                                <span className="fw6">{p.nombre}</span>
                                {' — '}
                                {p.fechas.map(fmtFecha).join(', ')}
                              </div>
                            ))}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {porKine.length > 0 && (
                    <tr className="ttr">
                      <td>Total</td>
                      <td>{porKine.reduce((a,k)=>a+k.manana,0)}</td>
                      <td>{porKine.reduce((a,k)=>a+k.tarde,0)}</td>
                      <td>{total}</td>
                      <td>—</td>
                      <td>100%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detalle de turnos del día */}
          {vista === 'dia' && (
            <div className="card">
              <div className="card-title">Detalle del día — {tituloPeriodo} ({detalleDia.length})</div>
              {detalleDia.length === 0 ? (
                <div className="emt">Sin turnos este día</div>
              ) : (
                <div className="tw">
                  <table>
                    <thead>
                      <tr><th>Hora</th><th>Turno</th><th>Paciente</th><th>Kinesiológo</th><th>Obra social</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {detalleDia.map(t => (
                        <tr key={t.id}>
                          <td>
                            {horaEfectiva(t) || '—'}
                            {t.horaAsistencia && t.hora && t.horaAsistencia !== t.hora && (
                              <div style={{ fontSize: 10, color: '#888' }}>Turno: {t.hora}</div>
                            )}
                          </td>
                          <td>{esManana(horaEfectiva(t)) ? <span className="badge ba">Mañana</span> : <span className="badge bb">Tarde</span>}</td>
                          <td className="fw6">{t.pacienteApellido} {t.pacienteNombre}</td>
                          <td>{t.kinesiologoNombre || '—'}</td>
                          <td>{t.obraSocial ? <span className="badge bb">{t.obraSocial}</span> : '—'}</td>
                          <td>
                            {t.asistencia === 'asistio' && <span className="badge bg">Asistió</span>}
                            {t.asistencia === 'falto' && <span className="badge br">Faltó</span>}
                            {(!t.asistencia || t.asistencia === 'pendiente') && <span className="badge bk">Pendiente</span>}
                            {t.pagado === true && <span className="badge bg" style={{ marginLeft: 4 }}>Pagó</span>}
                            {t.pagado === false && <span className="badge ba" style={{ marginLeft: 4 }}>Debe</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Detalle por paciente si hay pocos */}
          {totalPendientes > 0 && (
            <div className="al ala">
              {totalPendientes} turno{totalPendientes > 1 ? 's' : ''} del período sin confirmar asistencia
            </div>
          )}
        </div>
      )}
    </div>
  )
}
