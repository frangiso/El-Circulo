import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { useCache } from '../../context/AppCache'

const ILupa = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>

export default function Logs() {
  const { getUsuarios } = useCache()
  const [logs, setLogs]     = useState([])
  const [users, setUsers]   = useState([])
  const [carg, setCarg]     = useState(true)
  const [busq, setBusq]     = useState('')
  const [buscado, setBuscado] = useState(false)
  const [filtroU, setFU]    = useState('')
  const [filtroA, setFA]    = useState('')
  const [filtroF, setFF]    = useState('')

  useEffect(() => {
    Promise.all([
      getDocs(query(collection(db, 'logs'), orderBy('ts', 'desc'), limit(100))),
      getUsuarios()
    ]).then(([snap, u]) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setUsers(u); setCarg(false)
    })
  }, [])

  const acciones = [...new Set(logs.map(l => l.accion))].sort()

  // Filtrado en memoria — sin Firestore
  const vis = logs.filter(l => {
    const mU = filtroU ? l.uid === filtroU : true
    const mA = filtroA ? l.accion === filtroA : true
    const mF = filtroF ? l.ts?.toDate?.().toISOString().startsWith(filtroF) : true
    const mB = busq ? `${l.nombre} ${l.detalle} ${l.accion}`.toLowerCase().includes(busq.toLowerCase()) : true
    return mU && mA && mF && mB
  })

  function bLog(a) {
    const v = ['Nuevo turno', 'Nuevo paciente', 'Aprobó usuario', 'Reactivó paciente', 'Reactivó usuario']
    const r = ['Rechazó usuario', 'Desactivó usuario', 'Borrado automático']
    const am = ['Edición paciente', 'Cambió rol', 'Movimiento caja']
    if (v.includes(a)) return <span className="badge bg">{a}</span>
    if (r.includes(a)) return <span className="badge br">{a}</span>
    if (am.includes(a)) return <span className="badge ba">{a}</span>
    return <span className="badge bk">{a}</span>
  }

  const hayFiltro = busq || filtroU || filtroA || filtroF

  return (
    <div>
      <div className="ph"><div className="ptitle">Registro de actividad</div></div>

      <div className="filtros">
        <div className="sw" style={{ flex: 1, minWidth: 200 }}>
          <ILupa />
          <input className="si" placeholder="Buscar en actividad..." value={busq}
            onChange={e => { setBusq(e.target.value); setBuscado(!!e.target.value) }} />
        </div>
        <input type="date" value={filtroF} onChange={e => setFF(e.target.value)} />
        <select value={filtroU} onChange={e => setFU(e.target.value)}>
          <option value="">Todos los usuarios</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.apellido} {u.nombre}</option>)}
        </select>
        <select value={filtroA} onChange={e => setFA(e.target.value)}>
          <option value="">Todas las acciones</option>
          {acciones.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {hayFiltro && <button className="btn bs bsm" onClick={() => { setBusq(''); setFU(''); setFA(''); setFF(''); setBuscado(false) }}>Limpiar</button>}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {carg
          ? <div className="sc"><div className="sp" /></div>
          : vis.length === 0
          ? <div className="empty-search"><ILupa /><p>No se encontraron registros</p><span>Cambiá los filtros para ver resultados</span></div>
          : <div className="tw"><table>
              <thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead>
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
            </table>}
      </div>
      <div style={{ fontSize: 12, color: '#aaa', marginTop: 8, textAlign: 'right' }}>Últimos 100 registros</div>
    </div>
  )
}
