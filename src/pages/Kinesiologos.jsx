import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useCache } from '../../context/AppCache'
import { escribirLog } from '../../utils/helpers'

export default function Kinesiologos() {
  const { user, perfil } = useAuth()
  const { invalidarUsers } = useCache()
  const [kines, setKines] = useState([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [f, setF] = useState({ nombre: '', apellido: '', especialidad: '', telefono: '' })
  const [saving, setSaving] = useState(false)

  async function cargar() {
    const snap = await getDocs(collection(db, 'kinesiologos'))
    setKines(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  useEffect(() => { cargar() }, [])

  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  function abrirNuevo() {
    setEditando(null)
    setF({ nombre: '', apellido: '', especialidad: '', telefono: '' })
    setModal(true)
  }

  function abrirEditar(k) {
    setEditando(k)
    setF({ nombre: k.nombre, apellido: k.apellido, especialidad: k.especialidad || '', telefono: k.telefono || '' })
    setModal(true)
  }

  async function guardar(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editando) {
        await updateDoc(doc(db, 'kinesiologos', editando.id), {
          ...f, actualizadoEn: serverTimestamp()
        })
        await escribirLog(user.uid, perfil.apellido+' '+perfil.nombre, 'Edición kinesiológo', f.apellido+' '+f.nombre)
      } else {
        await addDoc(collection(db, 'kinesiologos'), {
          ...f, activo: true, creadoEn: serverTimestamp()
        })
        await escribirLog(user.uid, perfil.apellido+' '+perfil.nombre, 'Nuevo kinesiológo', f.apellido+' '+f.nombre)
      }
      invalidarUsers()
      await cargar()
      setModal(false)
    } catch (err) { console.error(err); alert('Error al guardar') }
    setSaving(false)
  }

  async function toggleActivo(k) {
    await updateDoc(doc(db, 'kinesiologos', k.id), { activo: !k.activo })
    await escribirLog(user.uid, perfil.apellido+' '+perfil.nombre,
      k.activo ? 'Desactivó kinesiológo' : 'Activó kinesiológo', k.apellido+' '+k.nombre)
    cargar()
  }

  const activos   = kines.filter(k => k.activo !== false)
  const inactivos = kines.filter(k => k.activo === false)

  return (
    <div>
      <div className="ph">
        <div className="ptitle">Kinesiológos</div>
        <button className="btn bp" onClick={abrirNuevo}>+ Nuevo kinesiológo</button>
      </div>

      <div className="card">
        <div className="card-title">Activos ({activos.length})</div>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Apellido y nombre</th><th>Especialidad</th><th>Teléfono</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {activos.length === 0 && <tr><td colSpan="4" className="emt">Sin kinesiológos cargados</td></tr>}
              {activos.map(k => (
                <tr key={k.id}>
                  <td className="fw6">{k.apellido} {k.nombre}</td>
                  <td>{k.especialidad || '—'}</td>
                  <td>{k.telefono || '—'}</td>
                  <td>
                    <div className="row">
                      <button className="btn bs bsm" onClick={() => abrirEditar(k)}>Editar</button>
                      <button className="btn bd bsm" onClick={() => toggleActivo(k)}>Desactivar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {inactivos.length > 0 && (
        <div className="card">
          <div className="card-title cgr">Inactivos ({inactivos.length})</div>
          <div className="tw">
            <table>
              <thead><tr><th>Apellido y nombre</th><th>Especialidad</th><th>Acciones</th></tr></thead>
              <tbody>
                {inactivos.map(k => (
                  <tr key={k.id} style={{ opacity: 0.6 }}>
                    <td>{k.apellido} {k.nombre}</td>
                    <td>{k.especialidad || '—'}</td>
                    <td><button className="btn bsuc bsm" onClick={() => toggleActivo(k)}>Activar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div className="mo" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="mc">
            <div className="mt">{editando ? 'Editar kinesiológo' : 'Nuevo kinesiológo'}</div>
            <form onSubmit={guardar}>
              <div className="fg" style={{ marginBottom: 12 }}>
                <div className="ff"><label>Nombre *</label><input value={f.nombre} onChange={e => set('nombre', e.target.value)} required /></div>
                <div className="ff"><label>Apellido *</label><input value={f.apellido} onChange={e => set('apellido', e.target.value)} required /></div>
                <div className="ff"><label>Especialidad</label><input value={f.especialidad} onChange={e => set('especialidad', e.target.value)} placeholder="Ej: Traumatología" /></div>
                <div className="ff"><label>Teléfono</label><input value={f.telefono} onChange={e => set('telefono', e.target.value)} /></div>
              </div>
              <div className="re">
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
