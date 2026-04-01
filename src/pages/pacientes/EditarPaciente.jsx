import { useEffect, useState } from 'react'
import { doc, getDoc, updateDoc, getDocs, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { sumarDiasHabiles, registrarLog, OBRAS_SOCIALES_DEFAULT } from '../../utils/helpers'

export default function EditarPaciente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser, userProfile } = useAuth()
  const [kines, setKines] = useState([])
  const [obrasSociales, setObrasSociales] = useState(OBRAS_SOCIALES_DEFAULT)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(null)

  useEffect(() => {
    async function cargar() {
      const snap = await getDoc(doc(db, 'pacientes', id))
      if (!snap.exists()) { navigate('/pacientes'); return }
      const d = snap.data()
      setForm({
        nombre: d.nombre || '', apellido: d.apellido || '', dni: d.dni || '',
        telefono: d.telefono || '', obraSocial: d.obraSocial || '',
        nroAfiliado: d.nroAfiliado || '', diagnostico: d.diagnostico || '',
        observaciones: d.observaciones || '', sesionesTotal: d.plan?.sesionesTotal || '',
        sesionesUsadas: d.plan?.sesionesUsadas || 0,
        fechaInicioPlan: d.plan?.fechaInicio || '', kinesiologoRef: d.plan?.kinesiologoRef || ''
      })
      getDocs(collection(db, 'usuarios')).then(s =>
        setKines(s.docs.map(x => ({ id: x.id, ...x.data() })).filter(u => ['kinesiologo','dueno'].includes(u.rol)))
      )
      getDocs(collection(db, 'obrasSociales')).then(s => {
        const custom = s.docs.map(x => x.data().nombre)
        setObrasSociales([...new Set([...OBRAS_SOCIALES_DEFAULT, ...custom])].sort())
      })
    }
    cargar()
  }, [id])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  const fechaVenc = form?.fechaInicioPlan ? sumarDiasHabiles(form.fechaInicioPlan, 45) : null

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      if (form.obraSocial && !OBRAS_SOCIALES_DEFAULT.includes(form.obraSocial))
        await addDoc(collection(db, 'obrasSociales'), { nombre: form.obraSocial })

      const plan = form.sesionesTotal ? {
        sesionesTotal: parseInt(form.sesionesTotal),
        sesionesUsadas: parseInt(form.sesionesUsadas) || 0,
        fechaInicio: form.fechaInicioPlan || null,
        fechaVencimiento: fechaVenc ? fechaVenc.toISOString().split('T')[0] : null,
        kinesiologoRef: form.kinesiologoRef || null
      } : null

      await updateDoc(doc(db, 'pacientes', id), {
        nombre: form.nombre.trim(), apellido: form.apellido.trim(), dni: form.dni.trim(),
        telefono: form.telefono.trim(), obraSocial: form.obraSocial.trim(),
        nroAfiliado: form.nroAfiliado.trim(), diagnostico: form.diagnostico.trim(),
        observaciones: form.observaciones.trim(), plan, actualizadoEn: serverTimestamp()
      })
      await registrarLog(currentUser.uid, `${userProfile.apellido} ${userProfile.nombre}`,
        'Edición paciente', `Modificó datos de ${form.apellido} ${form.nombre}`)
      navigate(`/pacientes/${id}`)
    } catch (err) { console.error(err); alert('Error al guardar') }
    setLoading(false)
  }

  if (!form) return <div className="loading-center"><div className="spinner" /></div>

  return (
    <div style={{maxWidth:'700px'}}>
      <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px'}}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>← Volver</button>
        <h1 style={{fontSize:'20px', fontWeight:'600'}}>Editar paciente</h1>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-title">Datos personales</div>
          <div className="form-grid">
            <div className="form-field"><label>Nombre *</label><input value={form.nombre} onChange={e => set('nombre', e.target.value)} required /></div>
            <div className="form-field"><label>Apellido *</label><input value={form.apellido} onChange={e => set('apellido', e.target.value)} required /></div>
            <div className="form-field"><label>DNI</label><input value={form.dni} onChange={e => set('dni', e.target.value)} /></div>
            <div className="form-field"><label>Teléfono</label><input value={form.telefono} onChange={e => set('telefono', e.target.value)} /></div>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Obra social</div>
          <div className="form-grid">
            <div className="form-field">
              <label>Obra social</label>
              <input list="obras-edit" value={form.obraSocial} onChange={e => set('obraSocial', e.target.value)} placeholder="Seleccioná o escribí una nueva..." />
              <datalist id="obras-edit">{obrasSociales.map(os => <option key={os} value={os} />)}</datalist>
            </div>
            <div className="form-field"><label>N° de afiliado</label><input value={form.nroAfiliado} onChange={e => set('nroAfiliado', e.target.value)} /></div>
            <div className="form-field full"><label>Diagnóstico</label><input value={form.diagnostico} onChange={e => set('diagnostico', e.target.value)} /></div>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Plan de sesiones</div>
          <div className="form-grid">
            <div className="form-field"><label>Total sesiones autorizadas</label><input type="number" min="1" value={form.sesionesTotal} onChange={e => set('sesionesTotal', e.target.value)} /></div>
            <div className="form-field"><label>Sesiones ya realizadas</label><input type="number" min="0" value={form.sesionesUsadas} onChange={e => set('sesionesUsadas', e.target.value)} /></div>
            <div className="form-field"><label>Fecha de inicio del plan</label><input type="date" value={form.fechaInicioPlan} onChange={e => set('fechaInicioPlan', e.target.value)} /></div>
            <div className="form-field"><label>Kinesiológo referente</label>
              <select value={form.kinesiologoRef} onChange={e => set('kinesiologoRef', e.target.value)}>
                <option value="">Sin asignar</option>
                {kines.map(k => <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
              </select>
            </div>
          </div>
          {fechaVenc && <div className="alert alert-blue" style={{marginTop:'12px', marginBottom:0}}>Vencimiento: {fechaVenc.toLocaleDateString('es-AR')} (45 días hábiles)</div>}
        </div>
        <div className="card">
          <div className="card-title">Observaciones</div>
          <div className="form-field"><label>Notas</label><textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} /></div>
        </div>
        <div className="row-end">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </form>
    </div>
  )
}
