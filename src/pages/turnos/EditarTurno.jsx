import { useEffect, useState } from 'react'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCache } from '../../context/AppCache'
import { escribirLog } from '../../utils/helpers'

export default function EditarTurno() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const { getKines } = useCache()
  const [turno, setTurno] = useState(null)
  const [kines, setKines] = useState([])
  const [f, setF] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      getDoc(doc(db, 'turnos', id)),
      getKines()
    ]).then(([snap, k]) => {
      if (!snap.exists()) { navigate('/turnos'); return }
      const d = snap.data()
      setTurno({ id: snap.id, ...d })
      setKines(k)
      setF({
        fecha: d.fecha || '',
        hora: d.hora || '',
        kineId: d.kinesiologoId || '',
        nroSesion: d.nroSesion || ''
      })
    })
  }, [id])

  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  async function guardar(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const kine = kines.find(k => k.id === f.kineId)
      await updateDoc(doc(db, 'turnos', id), {
        fecha: f.fecha,
        hora: f.hora,
        kinesiologoId: f.kineId,
        kinesiologoNombre: kine ? kine.apellido + ' ' + kine.nombre : turno.kinesiologoNombre,
        nroSesion: parseInt(f.nroSesion) || turno.nroSesion,
        editadoEn: serverTimestamp(),
        editadoPor: perfil.apellido + ' ' + perfil.nombre
      })
      await escribirLog(user.uid, perfil.apellido + ' ' + perfil.nombre,
        'Edición turno',
        turno.pacienteApellido + ' ' + turno.pacienteNombre + ' — nuevo kine: ' + (kine ? kine.apellido + ' ' + kine.nombre : '—'))
      navigate('/turnos')
    } catch (err) {
      console.error(err); alert('Error al guardar')
    }
    setLoading(false)
  }

  if (!turno || !f) return <div className="sc"><div className="sp" /></div>

  return (
    <div style={{ maxWidth: 600 }}>
      <div className="row" style={{ marginBottom: 20 }}>
        <button className="btn bs bsm" onClick={() => navigate(-1)}>← Volver</button>
        <div className="ptitle">Editar turno</div>
      </div>

      <div className="al alb">
        Paciente: <strong>{turno.pacienteApellido} {turno.pacienteNombre}</strong>
      </div>

      <form onSubmit={guardar}>
        <div className="card">
          <div className="card-title">Datos del turno</div>
          <div className="fg">
            <div className="ff">
              <label>Fecha *</label>
              <input type="date" value={f.fecha} onChange={e => set('fecha', e.target.value)} required />
            </div>
            <div className="ff">
              <label>Hora * (HH:MM)</label>
              <input type="text" value={f.hora}
                onChange={e => set('hora', e.target.value)}
                placeholder="08:00" required />
            </div>
            <div className="ff full">
              <label>Kinesiológo *</label>
              <select value={f.kineId} onChange={e => set('kineId', e.target.value)} required>
                <option value="">Seleccioná...</option>
                {kines.map(k => <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
              </select>
            </div>
            <div className="ff">
              <label>N° de sesión</label>
              <input type="number" min="1" value={f.nroSesion} onChange={e => set('nroSesion', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="re">
          <button type="button" className="btn bs" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" className="btn bp" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
