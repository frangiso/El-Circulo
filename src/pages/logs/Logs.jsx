import { useState, useEffect } from 'react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { useCache } from '../../context/AppCache'

const ILupa = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
)

export default function Logs() {
  const { getUsuarios } = useCache()
  const [logs, setLogs]     = useState([])
  const [users, setUsers]   = useState([])
  const [carg, setCarg]     = useState(false)
  const [cargado, setCargado] = useState(false)
  const [busq, setBusq]     = useState('')
  const [filtroU, setFU]    = useState('')
  const [filtroA, setFA]    = useState('')
  const [filtroF, setFF]    = useState('')

  // Usuarios desde caché al montar (sin leer logs todavía)
  useEffect(() => {
    getUsuarios().then(setUsers)
  }, [])

  // Lee logs solo cuando el usuario hace clic en Buscar
  async function cargarLogs() {
    setCarg(true)
    const snap = await getDocs(query(collection(db, 'logs'), orderBy('ts', 'desc'), limit(100)))
    setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setCargado(true)
    setCarg(false)
  }

  const acciones = [...new Set(logs.map(l => l.accion))].sort()

  const vis = logs.filter(l => {
    const mU = filtroU ? l.uid === filtroU : true
    const mA = filtroA ? l.accion === filtroA : true
    const mF = filtroF ? (l.ts?.toDate?.().toISOString().startsWith(filtroF)) : true
    const mB = busq ? (l.nombre + ' ' + l.detalle + ' ' + l.accion).toLowerCase().includes(busq.toLowerCase()) : true
    return mU && mA && mF && mB
  })

  function bLog(a) {
    const v = ['Nuevo turno','Nuevo paciente','Aprobó usuario','Reactivó paciente','Reactivó usuario']
    const r = ['Rechazó usuario','Desactivó usuario','Borrado automático']
    const am = ['Edición paciente','Cambió rol','Movimiento caja']
    if (v.includes(a)) return <span className="badge bg">{a}</span>
    if (r.includes(a)) return <span className="badge br">{a}</span>
    if (am.includes(a)) return <span className="badge ba">{a}</span>
    return <span className="badge bk">{a}</span>
  }

  const hayFiltro = busq || filtroU || filtroA || filtroF

  function limpiar() {
    setBusq(''); setFU(''); setFA(''); setFF('')
  }

  function renderContenido() {
    if (!cargado) {
      return (
        <div className="empty-search">
          <ILupa />
          <p>Hacé clic en "Cargar actividad" para ver los registros</p>
          <span>Se muestran los últimos 100 eventos del sistema</span>
        </div>
      )
    }
    if (carg) return <div className="sc"><div className="sp" /></div>
    if (vis.length === 0) {
      return (
        <div className="empty-search">
          <ILupa />
          <p>No se encontraron registros</p>
          <span>Cambiá los filtros para ver resultados</span>
        </div>
      )
    }
    return (
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Fecha y hora</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {vis.map(l => (
              <tr key={l.id}>
                <td className="cgr" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                  {l.ts?.toDate?.().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) || '—'}
                </td>
                <td className="fw6">{l.nombre}</td>
                <td>{bLog(l.accion)}</td>
                <td className="cgr" style={{ fontSize: 13 }}>{l.detalle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div>
      <div className="ph">
        <div className="ptitle">Registro de actividad</div>
        <button className="btn bp" onClick={cargarLogs} disabled={carg}>
          {carg ? 'Cargando...' : cargado ? 'Actualizar' : 'Cargar actividad'}
        </button>
      </div>

      <div className="filtros">
        <div className="sw" style={{ flex: 1, minWidth: 200 }}>
          <ILupa />
          <input className="si" placeholder="Buscar en actividad..."
            value={busq} onChange={e => setBusq(e.target.value)} />
        </div>
        <input type="date" value={filtroF} onChange={e => setFF(e.target.value)} />
        <select value={filtroU} onChange={e => setFU(e.target.value)}>
          <option value="">Todos los usuarios</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.apellido} {u.nombre}</option>
          ))}
        </select>
        <select value={filtroA} onChange={e => setFA(e.target.value)}>
          <option value="">Todas las acciones</option>
          {acciones.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        {hayFiltro && (
          <button className="btn bs bsm" onClick={limpiar}>Limpiar</button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {renderContenido()}
      </div>

      {cargado && (
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 8, textAlign: 'right' }}>
          Últimos 100 registros
        </div>
      )}
    </div>
  )
}
