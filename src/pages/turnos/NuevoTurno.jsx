import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { sumarDiasHabiles, diasHabilesRestantes, estadoPlan, registrarLog } from '../../utils/helpers'

export default function NuevoTurno() {
  const navigate = useNavigate()
  const { currentUser, userProfile } = useAuth()
  const [kines, setKines] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [pacienteSelec, setPacienteSelec] = useState(null)
  const [mostrarLista, setMostrarLista] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    hora: '09:00',
    kinesiologoId: '',
    nroSesion: '',
    sesionesTotal: '',
    fechaInicioPlan: ''
  })

  useEffect(() => {
    getDocs(query(collection(db, 'usuarios'), where('rol', 'in', ['kinesiologo', 'dueno']), where('estado', '==', 'activo')))
      .then(snap => setKines(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    getDocs(collection(db, 'pacientes'))
      .then(snap => setPacientes(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const pacientesFiltrados = pacientes.filter(p => {
    const txt = `${p.apellido} ${p.nombre} ${p.dni}`.toLowerCase()
    return txt.includes(busqueda.toLowerCase())
  }).slice(0, 8)

  function seleccionarPaciente(p) {
    setPacienteSelec(p)
    setBusqueda(`${p.apellido} ${p.nombre}`)
    setMostrarLista(false)
    if (p.plan) {
      setForm(f => ({
        ...f,
        sesionesTotal: p.plan.sesionesTotal || '',
        fechaInicioPlan: p.plan.fechaInicio || '',
        nroSesion: (p.plan.sesionesUsadas || 0) + 1
      }))
    }
  }

  const fechaVenc = form.fechaInicioPlan && form.sesionesTotal
    ? sumarDiasHabiles(form.fechaInicioPlan, 45)
    : null
  const diasRestantes = fechaVenc ? diasHabilesRestantes(fechaVenc) : null
  const estPlan = pacienteSelec?.plan ? estadoPlan(
    pacienteSelec.plan.sesionesUsadas || 0,
    pacienteSelec.plan.sesionesTotal,
    pacienteSelec.plan.fechaVencimiento
  ) : null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!pacienteSelec) return alert('Seleccioná un paciente')
    if (!form.kinesiologoId) return alert('Seleccioná un kinesiológo')
    setLoading(true)

    const kine = kines.find(k => k.id === form.kinesiologoId)
    const fechaVencFinal = form.fechaInicioPlan ? sumarDiasHabiles(form.fechaInicioPlan, 45).toISOString().split('T')[0] : null

    try {
      // Crear turno
      await addDoc(collection(db, 'turnos'), {
        fecha: form.fecha,
        hora: form.hora,
        pacienteId: pacienteSelec.id,
        pacienteNombre: pacienteSelec.nombre,
        pacienteApellido: pacienteSelec.apellido,
        pacienteDni: pacienteSelec.dni,
        obraSocial: pacienteSelec.obraSocial || '',
        kinesiologoId: form.kinesiologoId,
        kinesiologoNombre: `${kine.apellido} ${kine.nombre}`,
        nroSesion: parseInt(form.nroSesion) || null,
        creadoPor: currentUser.uid,
        creadoPorNombre: `${userProfile.apellido} ${userProfile.nombre}`,
        timestamp: serverTimestamp()
      })

      // Actualizar plan del paciente
      if (form.fechaInicioPlan || form.sesionesTotal) {
        await updateDoc(doc(db, 'pacientes', pacienteSelec.id), {
          plan: {
            sesionesTotal: parseInt(form.sesionesTotal) || pacienteSelec.plan?.sesionesTotal,
            sesionesUsadas: parseInt(form.nroSesion) || (pacienteSelec.plan?.sesionesUsadas || 0) + 1,
            fechaInicio: form.fechaInicioPlan || pacienteSelec.plan?.fechaInicio,
            fechaVencimiento: fechaVencFinal || pacienteSelec.plan?.fechaVencimiento
          }
        })
      }

      await registrarLog(
        currentUser.uid,
        `${userProfile.apellido} ${userProfile.nombre}`,
        'Nuevo turno',
        `${pacienteSelec.apellido} ${pacienteSelec.nombre} — ${form.hora}hs — ${kine.apellido} ${kine.nombre}`
      )

      navigate('/turnos')
    } catch (err) {
      console.error(err)
      alert('Error al guardar el turno')
    }
    setLoading(false)
  }

  return (
    <div style={{maxWidth:'700px'}}>
      <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px'}}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>← Volver</button>
        <h1 style={{fontSize:'20px', fontWeight:'600'}}>Nuevo turno</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-title">Datos del turno</div>
          <div className="form-grid">
            <div className="form-field full" style={{position:'relative'}}>
              <label>Paciente *</label>
              <input
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setMostrarLista(true); if (!e.target.value) setPacienteSelec(null) }}
                onFocus={() => setMostrarLista(true)}
                placeholder="Buscar por nombre o DNI..."
                autoComplete="off"
              />
              {mostrarLista && busqueda && pacientesFiltrados.length > 0 && (
                <div style={{position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid #ddd', borderRadius:'7px', zIndex:100, boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}>
                  {pacientesFiltrados.map(p => (
                    <div key={p.id} onClick={() => seleccionarPaciente(p)}
                      style={{padding:'9px 12px', cursor:'pointer', fontSize:'13px', borderBottom:'1px solid #f0f0f0'}}
                      onMouseEnter={e => e.currentTarget.style.background='#f8f8f8'}
                      onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                      <strong>{p.apellido} {p.nombre}</strong>
                      <span style={{color:'#888', marginLeft:'8px'}}>DNI {p.dni}</span>
                      <span style={{color:'#888', marginLeft:'8px'}}>{p.obraSocial}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="form-field">
              <label>Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} required />
            </div>
            <div className="form-field">
              <label>Hora *</label>
              <input type="time" value={form.hora} onChange={e => set('hora', e.target.value)} required />
            </div>
            <div className="form-field">
              <label>Kinesiológo *</label>
              <select value={form.kinesiologoId} onChange={e => set('kinesiologoId', e.target.value)} required>
                <option value="">Seleccioná...</option>
                {kines.map(k => <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>N° de sesión</label>
              <input type="number" min="1" value={form.nroSesion} onChange={e => set('nroSesion', e.target.value)} placeholder="Ej: 5" />
            </div>
          </div>
        </div>

        {estPlan === 'vencido' && (
          <div className="alert alert-red">⚠ El plan de este paciente está vencido. Verificá antes de continuar.</div>
        )}
        {pacienteSelec && fechaVenc && (
          <div className={`alert ${diasRestantes <= 0 ? 'alert-red' : diasRestantes <= 10 ? 'alert-amber' : 'alert-blue'}`}>
            Plan: {form.sesionesTotal} sesiones · Inicio: {form.fechaInicioPlan} · Vence: {fechaVenc.toLocaleDateString('es-AR')} · {diasRestantes} días hábiles restantes
          </div>
        )}

        <div className="card">
          <div className="card-title">Plan del paciente</div>
          <div className="form-grid">
            <div className="form-field">
              <label>Total sesiones autorizadas</label>
              <input type="number" min="1" value={form.sesionesTotal} onChange={e => set('sesionesTotal', e.target.value)} placeholder="Ej: 10" />
            </div>
            <div className="form-field">
              <label>Fecha de inicio del plan</label>
              <input type="date" value={form.fechaInicioPlan} onChange={e => set('fechaInicioPlan', e.target.value)} />
            </div>
          </div>
          <div className="hint" style={{marginTop:'8px', fontSize:'11px', color:'#999'}}>El vencimiento se calcula automáticamente a los 45 días hábiles desde el inicio.</div>
        </div>

        <div className="row-end">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Guardar turno'}</button>
        </div>
      </form>
    </div>
  )
}
