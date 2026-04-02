import { useEffect, useState } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useCache } from '../../context/AppCache'
import { escribirLog, ROLES } from '../../utils/helpers'

const ILupa = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>

export default function Usuarios() {
  const { user, perfil } = useAuth()
  const { getUsuarios, invalidarUsers } = useCache()
  const [todos, setTodos]   = useState([])
  const [carg, setCarg]     = useState(true)
  const [busq, setBusq]     = useState('')
  const [buscado, setBuscado] = useState(false)

  async function cargar() {
    setCarg(true)
    const u = await getUsuarios(true)
    setTodos(u); setCarg(false)
  }

  useEffect(() => { cargar() }, [])

  async function upd(id, data, logAcc, logDet) {
    await updateDoc(doc(db, 'usuarios', id), { ...data, actualizadoEn: serverTimestamp() })
    await escribirLog(user.uid, `${perfil.apellido} ${perfil.nombre}`, logAcc, logDet)
    invalidarUsers(); cargar()
  }

  const pend  = todos.filter(u => u.estado === 'pendiente')
  const activ = todos.filter(u => u.estado === 'activo')
  const inact = todos.filter(u => u.estado === 'inactivo')

  // Filtrado en memoria con lupa
  const activVis = !buscado ? activ : activ.filter(u =>
    `${u.apellido} ${u.nombre} ${u.email}`.toLowerCase().includes(busq.toLowerCase())
  )

  const bR = (r) => { const m={dueno:'ba',kinesiologo:'bb',secretaria:'bk'}; return <span className={`badge ${m[r]||'bk'}`}>{ROLES[r]||r}</span> }
  const bE = (e) => { const m={activo:'bg',pendiente:'ba',inactivo:'br'}; const l={activo:'Activo',pendiente:'Pendiente',inactivo:'Inactivo'}; return <span className={`badge ${m[e]||'bk'}`}>{l[e]||e}</span> }

  if (carg) return <div className="sc"><div className="sp" /></div>

  return (
    <div>
      <div className="ph"><div className="ptitle">Gestión de usuarios</div></div>

      {pend.length > 0 && <div className="al ala">{pend.length} usuario{pend.length > 1 ? 's' : ''} pendiente{pend.length > 1 ? 's' : ''} de aprobación</div>}

      {pend.length > 0 && (
        <div className="card">
          <div className="card-title">Pendientes de aprobación</div>
          <div className="tw"><table>
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol solicitado</th><th>Asignar rol</th><th>Acciones</th></tr></thead>
            <tbody>
              {pend.map(u => (
                <tr key={u.id}>
                  <td className="fw6">{u.apellido} {u.nombre}</td>
                  <td className="cgr">{u.email}</td>
                  <td>{bR(u.rol)}</td>
                  <td>
                    <select defaultValue={u.rol} id={`r-${u.id}`} style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 12 }}>
                      <option value="secretaria">Secretaria</option>
                      <option value="kinesiologo">Kinesiológo</option>
                      <option value="dueno">Dueño</option>
                    </select>
                  </td>
                  <td>
                    <div className="row">
                      <button className="btn bsuc bsm" onClick={() => upd(u.id, { estado: 'activo', rol: document.getElementById(`r-${u.id}`).value }, 'Aprobó usuario', `${u.apellido} ${u.nombre}`)}>Aprobar</button>
                      <button className="btn bd bsm" onClick={() => upd(u.id, { estado: 'rechazado' }, 'Rechazó usuario', `${u.apellido} ${u.nombre}`)}>Rechazar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Usuarios activos ({activ.length})</div>
        <div className="filtros">
          <div className="sw" style={{ flex: 1, minWidth: 200 }}>
            <ILupa />
            <input className="si" placeholder="Buscar usuario..." value={busq}
              onChange={e => { setBusq(e.target.value); setBuscado(!!e.target.value) }} />
          </div>
        </div>
        <div className="tw"><table>
          <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {activVis.length === 0 && <tr><td colSpan="5" className="emt">{buscado ? 'No se encontraron usuarios' : 'Sin usuarios activos'}</td></tr>}
            {activVis.map(u => (
              <tr key={u.id}>
                <td className="fw6">{u.apellido} {u.nombre}</td>
                <td className="cgr" style={{ fontSize: 12 }}>{u.email}</td>
                <td>
                  <select value={u.rol} onChange={e => upd(u.id, { rol: e.target.value }, 'Cambió rol', `${u.apellido} ${u.nombre} → ${e.target.value}`)}
                    style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 12, background: '#fff' }}>
                    <option value="secretaria">Secretaria</option>
                    <option value="kinesiologo">Kinesiológo</option>
                    <option value="dueno">Dueño</option>
                  </select>
                </td>
                <td>{bE(u.estado)}</td>
                <td>{u.id !== user.uid && <button className="btn bd bsm" onClick={() => upd(u.id, { estado: 'inactivo' }, 'Desactivó usuario', `${u.apellido} ${u.nombre}`)}>Desactivar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {inact.length > 0 && (
        <div className="card">
          <div className="card-title cgr">Usuarios inactivos ({inact.length})</div>
          <div className="tw"><table>
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Acciones</th></tr></thead>
            <tbody>
              {inact.map(u => (
                <tr key={u.id} style={{ opacity: .7 }}>
                  <td>{u.apellido} {u.nombre}</td>
                  <td className="cgr" style={{ fontSize: 12 }}>{u.email}</td>
                  <td>{bR(u.rol)}</td>
                  <td><button className="btn bsuc bsm" onClick={() => upd(u.id, { estado: 'activo' }, 'Reactivó usuario', `${u.apellido} ${u.nombre}`)}>Reactivar</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  )
}
