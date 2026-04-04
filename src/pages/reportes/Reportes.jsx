import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { useCache } from '../../context/AppCache'
import { mesActual, labelMes, getMeses } from '../../utils/helpers'

const ILupa = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
)

export default function Reportes() {
  const { getUsuarios, getPacientes } = useCache()
  const [mes, setMes]       = useState(mesActual())
  const [kines, setKines]   = useState([])
  const [secs, setSecs]     = useState([])
  const [totalP, setTP]     = useState(0)
  const [turnos, setT]      = useState([])
  const [carg, setCarg]     = useState(false)
  const [cargado, setCargado] = useState(false)
  const [busqK, setBK]      = useState('')

  // Usuarios y pacientes desde caché — sin leer turnos todavía
  useEffect(() => {
    Promise.all([getUsuarios(), getPacientes()]).then(([u, p]) => {
      setKines(u.filter(x => x.rol === 'kinesiologo' || x.rol === 'dueno'))
      setSecs(u.filter(x => x.rol === 'secretaria'))
      setTP(p.length)
    })
  }, [])

  // Lee turnos solo cuando el usuario hace clic en Buscar
  async function cargarReporte() {
    setCarg(true)
    const parts = mes.split('-')
    const y = parts[0], m = parts[1]
    const snap = await getDocs(query(
      collection(db, 'turnos'),
      where('fecha', '>=', y + '-' + m + '-01'),
      where('fecha', '<=', y + '-' + m + '-31')
    ))
    setT(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setCargado(true)
    setCarg(false)
  }

  // Cuando cambia el mes, resetear resultados
  function onMesChange(m) {
    setMes(m)
    setCargado(false)
    setT([])
    setBK('')
  }

  const porKine = kines.map(k => {
    const ts = turnos.filter(t => t.kinesiologoId === k.id)
    return { ...k, sesiones: ts.length, pacs: new Set(ts.map(t => t.pacienteId)).size }
  }).sort((a, b) => b.sesiones - a.sesiones)

  const porSec = secs.map(s => ({
    ...s, turnos: turnos.filter(t => t.creadoPor === s.id).length
  })).sort((a, b) => b.turnos - a.turnos)

  const total = porKine.reduce((a, k) => a + k.sesiones, 0)

  const kinesVis = !busqK ? porKine : porKine.filter(k =>
    (k.apellido + ' ' + k.nombre).toLowerCase().includes(busqK.toLowerCase())
  )

  return (
    <div>
      <div className="ph">
        <div className="ptitle">Reportes</div>
        <div className="row">
          <select value={mes} onChange={e => onMesChange(e.target.value)}
            style={{ padding: '8px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }}>
            {getMeses(12).map(m => (
              <option key={m} value={m}>{labelMes(m)}</option>
            ))}
          </select>
          <button className="btn bp" onClick={cargarReporte} disabled={carg}>
            {carg ? 'Cargando...' : 'Ver reporte'}
          </button>
        </div>
      </div>

      <div className="mets m3">
        <div className="met"><div className="met-l">Sesiones en {labelMes(mes)}</div><div className="met-v">{total}</div></div>
        <div className="met"><div className="met-l">Pacientes activos</div><div className="met-v">{totalP}</div></div>
        <div className="met"><div className="met-l">Kinesiológos</div><div className="met-v">{kines.length}</div></div>
      </div>

      {!cargado ? (
        <div className="card">
          <div className="empty-search">
            <ILupa />
            <p>Elegí el mes y hacé clic en "Ver reporte"</p>
            <span>Se cargan los datos solo cuando los pedís</span>
          </div>
        </div>
      ) : carg ? (
        <div className="sc"><div className="sp" /></div>
      ) : (
        <div>
          <div className="card">
            <div className="card-title">Sesiones por kinesiológo — {labelMes(mes)}</div>
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
                  <tr><th>Kinesiológo</th><th>Sesiones</th><th>Pacientes atendidos</th><th>% del total</th></tr>
                </thead>
                <tbody>
                  {kinesVis.length === 0 && (
                    <tr><td colSpan="4" className="emt">Sin datos</td></tr>
                  )}
                  {kinesVis.map(k => (
                    <tr key={k.id}>
                      <td className="fw6">{k.apellido} {k.nombre}</td>
                      <td>{k.sesiones}</td>
                      <td>{k.pacs}</td>
                      <td>{total > 0 ? ((k.sesiones / total) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                  {kinesVis.length > 0 && (
                    <tr className="ttr">
                      <td>Total</td><td>{total}</td><td>—</td><td>100%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Turnos cargados por secretaria — {labelMes(mes)}</div>
            <div className="tw">
              <table>
                <thead>
                  <tr><th>Secretaria</th><th>Turnos cargados</th></tr>
                </thead>
                <tbody>
                  {porSec.length === 0 && (
                    <tr><td colSpan="2" className="emt">Sin datos</td></tr>
                  )}
                  {porSec.map(s => (
                    <tr key={s.id}>
                      <td>{s.apellido} {s.nombre}</td>
                      <td>{s.turnos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
