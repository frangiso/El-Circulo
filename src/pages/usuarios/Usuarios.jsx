import { useEffect, useState } from 'react'
import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { registrarLog, ROLES } from '../../utils/helpers'

const ROLES_OPCIONES = ['dueno', 'kinesiologo', 'secretaria']

export default function Usuarios() {
  const { currentUser, userProfile } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const snap = await getDocs(collection(db, 'usuarios'))
    setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => {
      if (a.estado === 'pendiente' && b.estado !== 'pendiente') return -1
      if (b.estado === 'pendiente' && a.estado !== 'pendiente') return 1
      return (a.apellido||'').localeCompare(b.apellido||'')
    }))
    setLoading(false)
  }

  async function aprobar(u) {
    setSaving(true)
    await updateDoc(doc(db, 'usuarios', u.id), { estado: 'activo', rol: u.rol || 'secretaria', aprobadoEn: serverTimestamp() })
    await registrarLog(currentUser.uid, `${userProfile.apellido} ${userProfile.nombre}`, 'Aprobación usuario', `Aprobó a ${u.apellido} ${u.nombre} como ${u.rol || 'secretaria'}`)
    cargar()
    setSaving(false)
  }

  async function rechazar(u) {
    if (!confirm(`¿Rechazar la cuenta de ${u.apellido} ${u.nombre}?`)) return
    await updateDoc(doc(db, 'usuarios', u.id), { estado: 'rechazado' })
    await registrarLog(currentUser.uid, `${userProfile.apellido} ${userProfile.nombre}`, 'Rechazo usuario', `Rechazó a ${u.apellido} ${u.nombre}`)
    cargar()
  }

  async function guardarEdicion() {
    if (!editando) return
    setSaving(true)
    await updateDoc(doc(db, 'usuarios', editando.id), { rol: editando.rol, estado: editando.estado })
    await registrarLog(currentUser.uid, `${userProfile.apellido} ${userProfile.nombre}`, 'Edición usuario', `Modificó rol/estado de ${editando.apellido} ${editando.nombre}`)
    setEditando(null)
    cargar()
    setSaving(false)
  }

  const pendientes = usuarios.filter(u => u.estado === 'pendiente')
  const activos = usuarios.filter(u => u.estado !== 'pendiente')

  const badgeRol = (rol) => {
    if (rol === 'dueno') return <span className="badge badge-purple">Dueño</span>
    if (rol === 'kinesiologo') return <span className="badge badge-blue">Kinesiológo</span>
    if (rol === 'secretaria') return <span className="badge badge-gray">Secretaria</span>
    return <span className="badge badge-amber">Sin rol</span>
  }

  const badgeEstado = (estado) => {
    if (estado === 'activo') return <span className="badge badge-green">Activo</span>
    if (estado === 'pendiente') return <span className="badge badge-amber">Pendiente</span>
    if (estado === 'rechazado') return <span className="badge badge-red">Rechazado</span>
    return <span className="badge badge-gray">{estado}</span>
  }

  return (
    <div>
      <h1 style={{fontSize:'20px', fontWeight:'600', marginBottom:'20px'}}>Usuarios</h1>

      {pendientes.length > 0 && (
        <div className="alert alert-amber">{pendientes.length} usuario{pendientes.length > 1 ? 's' : ''} pendiente{pendientes.length > 1 ? 's' : ''} de aprobación</div>
      )}

      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card" style={{padding:0, overflow:'hidden'}}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.apellido}</strong> {u.nombre}</td>
                    <td style={{color:'#888', fontSize:'12px'}}>{u.email}</td>
                    <td>{badgeRol(u.rol)}</td>
                    <td>{badgeEstado(u.estado)}</td>
                    <td>
                      {u.estado === 'pendiente' ? (
                        <div style={{display:'flex', gap:'6px', alignItems:'center'}}>
                          <select
                            style={{fontSize:'12px', padding:'4px 8px', border:'1px solid #ddd', borderRadius:'6px'}}
                            defaultValue="secretaria"
                            onChange={e => u._rolTemp = e.target.value}
                          >
                            {ROLES_OPCIONES.map(r => <option key={r} value={r}>{ROLES[r]}</option>)}
                          </select>
                          <button className="btn btn-success btn-sm" disabled={saving}
                            onClick={() => aprobar({ ...u, rol: u._rolTemp || 'secretaria' })}>
                            Aprobar
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => rechazar(u)}>Rechazar</button>
                        </div>
                      ) : u.id !== currentUser.uid ? (
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditando({...u})}>Editar</button>
                      ) : (
                        <span style={{fontSize:'12px', color:'#999'}}>Tu cuenta</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal edición */}
      {editando && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200}}>
          <div style={{background:'#fff', borderRadius:'12px', padding:'24px', width:'100%', maxWidth:'380px', margin:'16px'}}>
            <div style={{fontSize:'16px', fontWeight:'600', marginBottom:'16px'}}>Editar usuario</div>
            <div style={{fontSize:'14px', marginBottom:'14px'}}>{editando.apellido} {editando.nombre}</div>
            <div className="form-field" style={{marginBottom:'12px'}}>
              <label>Rol</label>
              <select value={editando.rol} onChange={e => setEditando(u => ({...u, rol: e.target.value}))}>
                {ROLES_OPCIONES.map(r => <option key={r} value={r}>{ROLES[r]}</option>)}
              </select>
            </div>
            <div className="form-field" style={{marginBottom:'18px'}}>
              <label>Estado</label>
              <select value={editando.estado} onChange={e => setEditando(u => ({...u, estado: e.target.value}))}>
                <option value="activo">Activo</option>
                <option value="rechazado">Desactivado</option>
              </select>
            </div>
            <div className="row-end">
              <button className="btn btn-secondary" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarEdicion} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
