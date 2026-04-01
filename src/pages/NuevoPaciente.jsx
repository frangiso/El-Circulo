import { useEffect, useState } from 'react'
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { sumarDiasHabiles, registrarLog, OBRAS_SOCIALES_DEFAULT } from '../../utils/helpers'

export default function NuevoPaciente() {
  const navigate = useNavigate()
  const { currentUser, userProfile } = useAuth()
  const [kines, setKines] = useState([])
  const [obrasSociales, setObrasSociales] = useState(OBRAS_SOCIALES_DEFAULT)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nombre: '', apellido: '', dni: '', telefono: '',
    obraSocial: '', nroAfiliado: '', diagnostico: '',
    sesionesTotal: '', fechaInicioPlan: '', kinesiologoRef: '',
    observaciones: ''
  })

  useEffect(() => {
    // Cargar kinesiologos
    getDocs(collection(db, 'usuarios')).then(snap => {
      setKines(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.rol === 'kinesiologo' || u.rol === 'dueno'))
    })
    // Cargar obras sociales guardadas
    getDocs(collection(db, 'obrasSociales')).then(snap => {
      const custom = snap.docs.map(d => d.data().nombre)
      setObrasSociales([...new Set([...OBRAS_SOCIALES_DEFAULT, ...custom])].sort())
    })
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const fechaVenc = form.fechaInicioPlan
    ? sumarDiasHabiles(form.fechaInicioPlan, 45)
    : null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre || !form.apellido) return alert('Nombre y apellido son obligatorios')
    setLoading(true)

    try {
      // Si la obra social es nueva, guardarla
      if (form.obraSocial && !OBRAS_SOCIALES_DEFAULT.includes(form.obraSocial)) {
        await addDoc(collection(db, 'obrasSociales'), { nombre: form.obraSocial })
      }

      const plan = form.sesionesTotal ? {
        sesionesTotal: parseInt(form.sesionesTotal),
        sesionesUsadas: 0,
        fechaInicio: form.fechaInicioPlan || null,
        fechaVencimiento: fechaVenc ? fechaVenc.toISOString().split('T')[0] : null,
        kinesiologoRef: form.kinesiologoRef || null
      } : null

      await addDoc(collection(db, 'pacientes'), {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        dni: form.dni.trim(),
        telefono: form.telefono.trim(),
        obraSocial: form.obraSocial.trim(),
        nroAfiliado: form.nroAfiliado.trim(),
        diagnostico: form.diagnostico.trim(),
        observaciones: form.observaciones.trim(),
        plan,
        creadoPor: currentUser.uid,
        creadoEn: serverTimestamp()
      })

      await registrarLog(
        currentUser.uid,
        `${userProfile.apellido} ${userProfile.nombre}`,
        'Nuevo paciente',
        `${form.apellido} ${form.nombre} — ${form.obraSocial}`
      )

      navigate('/pacientes')
    } catch (err) {
      console.error(err)
      alert('Error al guardar el paciente')
    }
    setLoading(false)
  }

  return (
    <div style={{maxWidth:'700px'}}>
      <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px'}}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>← Volver</button>
        <h1 style={{fontSize:'20px', fontWeight:'600'}}>Nuevo paciente</h1>
      </div>

      <div className="alert alert-blue">Completá los datos del paciente. El plan se puede cargar ahora o después desde la ficha.</div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-title">Datos personales</div>
          <div className="form-grid">
            <div className="form-field">
              <label>Nombre *</label>
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)} required />
            </div>
            <div className="form-field">
              <label>Apellido *</label>
              <input value={form.apellido} onChange={e => set('apellido', e.target.value)} required />
            </div>
            <div className="form-field">
              <label>DNI</label>
              <input value={form.dni} onChange={e => set('dni', e.target.value)} placeholder="Ej: 35767629" />
            </div>
            <div className="form-field">
              <label>Teléfono / Celular</label>
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="Ej: 2664 234729" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Obra social</div>
          <div className="form-grid">
            <div className="form-field">
              <label>Obra social</label>
              <input list="obras-list" value={form.obraSocial} onChange={e => set('obraSocial', e.target.value)} placeholder="Seleccioná o escribí una nueva..." />
              <datalist id="obras-list">
                {obrasSociales.map(os => <option key={os} value={os} />)}
              </datalist>
              <span className="hint">Si escribís una nueva, se guarda automáticamente</span>
            </div>
            <div className="form-field">
              <label>N° de afiliado</label>
              <input value={form.nroAfiliado} onChange={e => set('nroAfiliado', e.target.value)} placeholder="Ej: 1000111896" />
            </div>
            <div className="form-field full">
              <label>Diagnóstico</label>
              <input value={form.diagnostico} onChange={e => set('diagnostico', e.target.value)} placeholder="Ej: Cervicalgia, Lumbalgia..." />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Plan de sesiones (opcional)</div>
          <div className="form-grid">
            <div className="form-field">
              <label>Total sesiones autorizadas</label>
              <input type="number" min="1" value={form.sesionesTotal} onChange={e => set('sesionesTotal', e.target.value)} placeholder="Ej: 10" />
            </div>
            <div className="form-field">
              <label>Fecha de inicio del plan</label>
              <input type="date" value={form.fechaInicioPlan} onChange={e => set('fechaInicioPlan', e.target.value)} />
            </div>
            <div className="form-field full">
              <label>Kinesiológo referente</label>
              <select value={form.kinesiologoRef} onChange={e => set('kinesiologoRef', e.target.value)}>
                <option value="">Sin asignar</option>
                {kines.map(k => <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
              </select>
            </div>
          </div>
          {fechaVenc && (
            <div className="alert alert-blue" style={{marginTop:'12px', marginBottom:0}}>
              Vencimiento calculado: {fechaVenc.toLocaleDateString('es-AR')} (45 días hábiles desde el inicio)
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Observaciones</div>
          <div className="form-field">
            <label>Notas adicionales</label>
            <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} placeholder="Ej: Viene lunes y miércoles, movilidad reducida..." />
          </div>
        </div>

        <div className="row-end">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Guardar paciente'}</button>
        </div>
      </form>
    </div>
  )
}
