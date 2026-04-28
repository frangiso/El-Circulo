import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useCache } from '../../context/AppCache'
import { mesActual, labelMes, getMeses, fmtMonto, escribirLog, fmtFecha } from '../../utils/helpers'

const ILupa = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)

export default function Caja() {
  const { user, perfil } = useAuth()
  const { getKines } = useCache()
  const [mes, setMes]         = useState(mesActual())
  const [docC, setDocC]       = useState(null)
  const [kines, setKines]     = useState([])
  const [tab, setTab]         = useState('movimientos')
  const [carg, setCarg]       = useState(false)
  const [cargado, setCargado] = useState(false)
  const [modal, setModal]     = useState(false)
  const [fMov, setFM]         = useState({ tipo: 'entrada-efectivo', desc: '', importe: '', kineId: '' })
  const [saving, setSaving]   = useState(false)
  const [filtroDia, setFiltroDia] = useState('')

  useEffect(() => { getKines().then(setKines) }, [])

  function onMesChange(m) { setMes(m); setDocC(null); setCargado(false); setFiltroDia('') }

  async function cargarCaja() {
    setCarg(true)
    const snap = await getDoc(doc(db, 'caja', 'caja_' + mes))
    setDocC(snap.exists() ? { id: snap.id, ...snap.data() } : null)
    setCargado(true)
    setCarg(false)
  }

  const movs     = docC?.movimientos || []
  const saldoI   = docC?.saldoInicial || 0
  const entradas = movs.filter(m => m.tipo === 'entrada-efectivo' || m.tipo === 'entrada-transferencia').reduce((a,m) => a + m.importe, 0)
  const salidas  = movs.filter(m => m.tipo === 'salida').reduce((a,m) => a + m.importe, 0)
  const saldoF   = saldoI + entradas - salidas
  const efectivo = movs.filter(m => m.tipo === 'entrada-efectivo').reduce((a,m) => a + m.importe, 0)
  const transf   = movs.filter(m => m.tipo === 'entrada-transferencia').reduce((a,m) => a + m.importe, 0)
  const movsVis  = !filtroDia ? movs : movs.filter(m => m.fecha === filtroDia)

  function saldoFila(idx) {
    let s = saldoI
    for (let i = 0; i <= idx; i++) {
      const m = movs[i]
      if (m.tipo === 'entrada-efectivo' || m.tipo === 'entrada-transferencia') s += m.importe
      else if (m.tipo === 'salida') s -= m.importe
    }
    return s
  }

  const resumenK = kines.map(k => {
    const ms = movs.filter(m => m.kineId === k.id && (m.tipo === 'entrada-efectivo' || m.tipo === 'entrada-transferencia'))
    return { ...k, ses: ms.length, total: ms.reduce((a,m) => a + m.importe, 0) }
  }).filter(k => k.ses > 0)

  const setF = (k, v) => setFM(p => ({ ...p, [k]: v }))

  async function guardarMov(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const kine = kines.find(k => k.id === fMov.kineId)
      const mov = {
        tipo: fMov.tipo,
        descripcion: fMov.desc,
        importe: parseFloat(fMov.importe),
        kineId: fMov.kineId || null,
        profesionalNombre: kine ? kine.apellido + ' ' + kine.nombre : null,
        cargadoPor: user.uid,
        cargadoPorNombre: perfil.apellido + ' ' + perfil.nombre,
        fecha: new Date().toISOString().split('T')[0],
        hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      }
      const ref = doc(db, 'caja', 'caja_' + mes)
      if (!docC) {
        const esIni = fMov.tipo === 'saldoInicial'
        const data = { mes, saldoInicial: esIni ? parseFloat(fMov.importe) : 0, movimientos: esIni ? [] : [mov], creadoEn: serverTimestamp() }
        await setDoc(ref, data)
        setDocC(data)
      } else if (fMov.tipo === 'saldoInicial') {
        await updateDoc(ref, { saldoInicial: parseFloat(fMov.importe) })
        setDocC(p => ({ ...p, saldoInicial: parseFloat(fMov.importe) }))
      } else {
        await updateDoc(ref, { movimientos: arrayUnion(mov) })
        setDocC(p => ({ ...p, movimientos: [...(p.movimientos || []), mov] }))
      }
      await escribirLog(user.uid, perfil.apellido + ' ' + perfil.nombre, 'Movimiento caja', fMov.tipo + ' $' + fMov.importe + ' — ' + fMov.desc)
      setFM({ tipo: 'entrada-efectivo', desc: '', importe: '', kineId: '' })
      setModal(false)
    } catch(err) { console.error(err); alert('Error al guardar') }
    setSaving(false)
  }

  return (
    <div>
      <div className="ph">
        <div className="ptitle">Control de caja</div>
        {cargado && <button className="btn bp" onClick={() => setModal(true)}>+ Movimiento</button>}
      </div>

      <div className="filtros" style={{ marginBottom: 16 }}>
        <select value={mes} onChange={e => onMesChange(e.target.value)}>
          {getMeses(12).map(m => <option key={m} value={m}>{labelMes(m)}</option>)}
        </select>
        <button className="btn bp" onClick={cargarCaja} disabled={carg}>
          {carg ? 'Cargando...' : cargado ? 'Actualizar' : 'Ver caja'}
        </button>
      </div>

      {!cargado ? (
        <div className="card">
          <div className="empty-search">
            <ILupa />
            <p>Elegí el mes y hacé clic en "Ver caja"</p>
            <span>Se carga solo cuando lo pedís</span>
          </div>
        </div>
      ) : carg ? (
        <div className="sc"><div className="sp" /></div>
      ) : (
        <div>
          <div className="mets" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(5,1fr)' }}>
            <div className="met"><div className="met-l">Saldo inicial</div><div className="met-v">{fmtMonto(saldoI)}</div></div>
            <div className="met"><div className="met-l">Entradas efectivo</div><div className="met-v cve">+{fmtMonto(efectivo)}</div></div>
            <div className="met"><div className="met-l">Entradas transf.</div><div className="met-v caz">+{fmtMonto(transf)}</div></div>
            <div className="met"><div className="met-l">Total salidas</div><div className="met-v cro">-{fmtMonto(salidas)}</div></div>
            <div className="met"><div className="met-l">Debe haber en caja</div><div className="met-v caz">{fmtMonto(saldoF)}</div></div>
          </div>

          <div className="tabs">
            <button className={'tab ' + (tab === 'movimientos' ? 'on' : '')} onClick={() => setTab('movimientos')}>Movimientos</button>
            <button className={'tab ' + (tab === 'resumen' ? 'on' : '')} onClick={() => setTab('resumen')}>Por profesional</button>
          </div>

          {tab === 'movimientos' && (
            <div>
              <div className="filtros">
                <div className="sw" style={{ minWidth: 200 }}>
                  <ILupa />
                  <input className="si" type="date" value={filtroDia} onChange={e => setFiltroDia(e.target.value)} style={{ paddingLeft: 33 }} />
                </div>
                {filtroDia && <button className="btn bs bsm" onClick={() => setFiltroDia('')}>Ver todo el mes</button>}
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="tw">
                  <table>
                    <thead>
                      <tr><th>Fecha/Hora</th><th>Tipo</th><th>Profesional</th><th>Detalle</th><th>Importe</th><th>Saldo</th><th>Por</th></tr>
                    </thead>
                    <tbody>
                      {!filtroDia && saldoI > 0 && (
                        <tr>
                          <td className="cgr">—</td>
                          <td><span className="badge bb">Saldo inicial</span></td>
                          <td>—</td><td>—</td>
                          <td className="cve fw6">{fmtMonto(saldoI)}</td>
                          <td className="fw6">{fmtMonto(saldoI)}</td>
                          <td className="cgr">Sistema</td>
                        </tr>
                      )}
                      {movsVis.length === 0 && (
                        <tr><td colSpan="7" className="emt">{filtroDia ? 'No hay movimientos para este día' : 'Sin movimientos este mes'}</td></tr>
                      )}
                      {movsVis.map((m, i) => {
                        const esEntrada = m.tipo === 'entrada-efectivo' || m.tipo === 'entrada-transferencia'
                        return (
                          <tr key={i}>
                            <td className="cgr" style={{ fontSize: 12 }}>{fmtFecha(m.fecha)} {m.hora}</td>
                            <td>
                              {m.tipo === 'entrada-efectivo' && <span className="badge bg">Efectivo</span>}
                              {m.tipo === 'entrada-transferencia' && <span className="badge bb">Transferencia</span>}
                              {m.tipo === 'salida' && <span className="badge br">Salida</span>}
                            </td>
                            <td>{m.profesionalNombre || '—'}</td>
                            <td>{m.descripcion}</td>
                            <td className={esEntrada ? 'cve fw6' : 'cro fw6'}>{esEntrada ? '+' : '-'}{fmtMonto(m.importe)}</td>
                            <td className="fw6">{fmtMonto(saldoFila(movs.indexOf(m)))}</td>
                            <td className="cgr" style={{ fontSize: 11 }}>{m.cargadoPorNombre}</td>
                          </tr>
                        )
                      })}
                      {!filtroDia && (
                        <tr className="ttr">
                          <td colSpan="4">Total del mes</td>
                          <td><span className="cve">+{fmtMonto(entradas)}</span> / <span className="cro">-{fmtMonto(salidas)}</span></td>
                          <td className="caz">{fmtMonto(saldoF)}</td>
                          <td />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'resumen' && (
            <div>
              <div className="mets" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 14 }}>
                <div className="met"><div className="met-l">Entradas efectivo</div><div className="met-v cve">{fmtMonto(efectivo)}</div></div>
                <div className="met"><div className="met-l">Entradas transferencia</div><div className="met-v caz">{fmtMonto(transf)}</div></div>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="tw">
                  <table>
                    <thead><tr><th>Profesional</th><th>Sesiones</th><th>Total facturado</th></tr></thead>
                    <tbody>
                      {resumenK.length === 0 && <tr><td colSpan="3" className="emt">Sin datos este mes</td></tr>}
                      {resumenK.map(k => (
                        <tr key={k.id}>
                          <td className="fw6">{k.apellido} {k.nombre}</td>
                          <td>{k.ses}</td>
                          <td className="cve fw6">{fmtMonto(k.total)}</td>
                        </tr>
                      ))}
                      {resumenK.length > 0 && (
                        <tr className="ttr">
                          <td>Total</td>
                          <td>{resumenK.reduce((a,k) => a + k.ses, 0)}</td>
                          <td className="caz">{fmtMonto(resumenK.reduce((a,k) => a + k.total, 0))}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {modal && (
        <div className="mo" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="mc">
            <div className="mt">Nuevo movimiento</div>
            <form onSubmit={guardarMov}>
              <div className="ff" style={{ marginBottom: 12 }}>
                <label>Tipo</label>
                <select value={fMov.tipo} onChange={e => setF('tipo', e.target.value)}>
                  <option value="entrada-efectivo">Entrada en efectivo</option>
                  <option value="entrada-transferencia">Entrada por transferencia</option>
                  <option value="salida">Salida</option>
                  <option value="saldoInicial">Saldo inicial del mes</option>
                </select>
              </div>
              <div className="ff" style={{ marginBottom: 12 }}>
                <label>Descripción *</label>
                <input value={fMov.desc} onChange={e => setF('desc', e.target.value)} placeholder="Ej: Pago sesión García" required />
              </div>
              <div className="ff" style={{ marginBottom: 12 }}>
                <label>Importe *</label>
                <input type="number" min="0" step="0.01" value={fMov.importe} onChange={e => setF('importe', e.target.value)} placeholder="Ej: 8500" required />
              </div>
              {(fMov.tipo === 'entrada-efectivo' || fMov.tipo === 'entrada-transferencia') && (
                <div className="ff" style={{ marginBottom: 12 }}>
                  <label>Profesional (opcional)</label>
                  <select value={fMov.kineId} onChange={e => setF('kineId', e.target.value)}>
                    <option value="">Sin profesional</option>
                    {kines.map(k => <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
                  </select>
                </div>
              )}
              <div className="re" style={{ marginTop: 18 }}>
                <button type="button" className="btn bs" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn bp" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
