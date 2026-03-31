import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy, where, limit } from 'firebase/firestore'
import { db } from '../../firebase'

const ACCIONES_COLORES = {
  'Nuevo turno': 'badge-green',
  'Nuevo paciente': 'badge-blue',
  'Edición paciente': 'badge-amber',
  'Entrada caja': 'badge-green',
  'Salida caja': 'badge-red',
  'Aprobación usuario': 'badge-blue',
  'Rechazo usuario': 'badge-red',
  'Edición usuario': 'badge-amber',
}

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroAccion, setFiltroAccion] = useState('')
  const [filtroFecha, setFiltroFecha] = useState('')

  useEffect(() => {
    async function cargar() {
      const [logsSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(500))),
        getDocs(collection(db, 'usuarios'))
      ])
      setLogs(logsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setUsuarios(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }
    cargar()
  }, [])

  const accionesUnicas = [...new Set(logs.map(l => l.accion))].sort()

  const filtrados = logs.filter(l => {
    const matchU = filtroUsuario ? l.userId === filtroUsuario : true
    const matchA = filtroAccion ? l.accion === filtroAccion : true
    const matchF = filtroFecha ? (l.timestamp?.toDate?.()?.toISOString().startsWith(filtroFecha)) : true
    return matchU && matchA && matchF
  })

  function formatFechaHora(ts) {
    if (!ts?.toDate) return '—'
    return ts.toDate().toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' })
  }

  return (
    <div>
      <h1 style={{fontSize:'20px', fontWeight:'600', marginBottom:'20px'}}>Registro de actividad</h1>

      <div className="filtros">
        <input type="date" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} />
        <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)}>
          <option value="">Todos los usuarios</option>
          {usuarios.map(u => <option key={u.id} value={u.id}>{u.apellido} {u.nombre}</option>)}
        </select>
        <select value={filtroAccion} onChange={e => setFiltroAccion(e.target.value)}>
          <option value="">Todas las acciones</option>
          {accionesUnicas.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {(filtroUsuario || filtroAccion || filtroFecha) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setFiltroUsuario(''); setFiltroAccion(''); setFiltroFecha('') }}>
            Limpiar filtros
          </button>
        )}
      </div>

      <div style={{fontSize:'12px', color:'#888', marginBottom:'10px'}}>{filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}</div>

      <div className="card" style={{padding:0, overflow:'hidden'}}>
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : filtrados.length === 0 ? (
          <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>Sin registros para los filtros seleccionados</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr>
              </thead>
              <tbody>
                {filtrados.map(l => (
                  <tr key={l.id}>
                    <td style={{color:'#888', whiteSpace:'nowrap', fontSize:'12px'}}>{formatFechaHora(l.timestamp)}</td>
                    <td style={{fontWeight:'500'}}>{l.userName}</td>
                    <td><span className={`badge ${ACCIONES_COLORES[l.accion] || 'badge-gray'}`}>{l.accion}</span></td>
                    <td style={{fontSize:'12px', color:'#555'}}>{l.detalle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
