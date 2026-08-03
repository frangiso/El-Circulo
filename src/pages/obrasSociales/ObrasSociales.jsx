import { useEffect, useState } from 'react'
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useCache } from '../../context/AppCache'
import { escribirLog, OBRAS_BASE } from '../../utils/helpers'

export default function ObrasSociales() {
  const { user, perfil } = useAuth()
  const { invalidarObras } = useCache()
  const [obras, setObras] = useState([])
  const [carg, setCarg] = useState(true)
  const [eliminando, setEliminando] = useState(null)

  async function cargar() {
    setCarg(true)
    const snap = await getDocs(collection(db, 'obrasSociales'))
    setObras(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setCarg(false)
  }

  useEffect(() => { cargar() }, [])

  async function eliminar(o) {
    if (!window.confirm(`¿Eliminar la obra social "${o.nombre}"?`)) return
    setEliminando(o.id)
    try {
      await deleteDoc(doc(db, 'obrasSociales', o.id))
      await escribirLog(user.uid, `${perfil.apellido} ${perfil.nombre}`, 'Eliminó obra social', o.nombre)
      invalidarObras()
      await cargar()
    } catch (err) { console.error(err); alert('Error al eliminar') }
    setEliminando(null)
  }

  if (carg) return <div className="sc"><div className="sp" /></div>

  return (
    <div>
      <div className="ph"><div className="ptitle">Obras sociales</div></div>

      <div className="card">
        <div className="card-title">Base del sistema ({OBRAS_BASE.length})</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {OBRAS_BASE.map(o => <span key={o} className="badge bk">{o}</span>)}
        </div>
        <div className="hint" style={{ marginTop: 8 }}>Estas obras sociales vienen incluidas en el sistema y no se pueden eliminar.</div>
      </div>

      <div className="card">
        <div className="card-title">Agregadas manualmente ({obras.length})</div>
        <div className="tw">
          <table>
            <thead><tr><th>Nombre</th><th>Acciones</th></tr></thead>
            <tbody>
              {obras.length === 0 && <tr><td colSpan="2" className="emt">Sin obras sociales agregadas</td></tr>}
              {obras.map(o => (
                <tr key={o.id}>
                  <td className="fw6">{o.nombre}</td>
                  <td>
                    <button className="btn bd bsm" disabled={eliminando === o.id} onClick={() => eliminar(o)}>
                      {eliminando === o.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
