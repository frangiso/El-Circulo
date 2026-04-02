import { useEffect, useState } from 'react'
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCache } from '../../context/AppCache'
import { calcVenc, estadoPlan, escribirLog, OBRAS_BASE } from '../../utils/helpers'

const INIT = { nombre:'',apellido:'',dni:'',telefono:'',obraSocial:'',nroAfiliado:'',diagnostico:'',sesionesTotal:'',sesionesUsadas:0,fechaInicio:'',kinesiologoRef:'',observaciones:'' }

function Form({ inicial, titulo, onGuardar, saving, eraArch }) {
  const { getKines, getObras } = useCache()
  const [kines, setKines] = useState([])
  const [obras, setObras] = useState(OBRAS_BASE)
  const [f, setF] = useState(inicial)
  const set = (k,v) => setF(p=>({...p,[k]:v}))
  const venc = f.fechaInicio ? calcVenc(f.fechaInicio) : null

  useEffect(() => {
    Promise.all([getKines(), getObras()]).then(([k,o])=>{ setKines(k); setObras(o) })
  }, [])

  return (
    <form onSubmit={e=>{e.preventDefault();onGuardar(f)}}>
      <div className="card">
        <div className="card-title">Datos personales</div>
        <div className="fg">
          <div className="ff"><label>Nombre *</label><input value={f.nombre} onChange={e=>set('nombre',e.target.value)} required/></div>
          <div className="ff"><label>Apellido *</label><input value={f.apellido} onChange={e=>set('apellido',e.target.value)} required/></div>
          <div className="ff"><label>DNI</label><input value={f.dni} onChange={e=>set('dni',e.target.value)}/></div>
          <div className="ff"><label>Teléfono</label><input value={f.telefono} onChange={e=>set('telefono',e.target.value)}/></div>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Obra social</div>
        <div className="fg">
          <div className="ff">
            <label>Obra social</label>
            <input list="obs-dl" value={f.obraSocial} onChange={e=>set('obraSocial',e.target.value)} placeholder="Seleccioná o escribí una nueva..."/>
            <datalist id="obs-dl">{obras.map(o=><option key={o} value={o}/>)}</datalist>
            <span className="hint">Si escribís una nueva se guarda automáticamente</span>
          </div>
          <div className="ff"><label>N° de afiliado</label><input value={f.nroAfiliado} onChange={e=>set('nroAfiliado',e.target.value)}/></div>
          <div className="ff full"><label>Diagnóstico</label><input value={f.diagnostico} onChange={e=>set('diagnostico',e.target.value)}/></div>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Plan de sesiones {eraArch&&<span style={{color:'var(--na)',fontSize:12,fontWeight:400}}>(cargá uno nuevo para reactivar)</span>}</div>
        <div className="fg">
          <div className="ff"><label>Total sesiones autorizadas</label><input type="number" min="1" value={f.sesionesTotal} onChange={e=>set('sesionesTotal',e.target.value)}/></div>
          {eraArch&&<div className="ff"><label>Sesiones ya realizadas</label><input type="number" min="0" value={f.sesionesUsadas} onChange={e=>set('sesionesUsadas',e.target.value)}/></div>}
          <div className="ff"><label>Fecha de inicio del plan</label><input type="date" value={f.fechaInicio} onChange={e=>set('fechaInicio',e.target.value)}/></div>
          <div className="ff full"><label>Kinesiológo referente</label>
            <select value={f.kinesiologoRef} onChange={e=>set('kinesiologoRef',e.target.value)}>
              <option value="">Sin asignar</option>
              {kines.map(k=><option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
            </select>
          </div>
        </div>
        {venc&&<div className="al alb" style={{marginTop:10,marginBottom:0}}>Vencimiento calculado: {venc} (45 días hábiles)</div>}
      </div>
      <div className="card">
        <div className="card-title">Observaciones</div>
        <div className="ff"><label>Notas adicionales</label><textarea value={f.observaciones} onChange={e=>set('observaciones',e.target.value)}/></div>
      </div>
      <div className="re">
        <button type="button" className="btn bs" onClick={()=>history.back()}>Cancelar</button>
        <button type="submit" className="btn bp" disabled={saving}>{saving?'Guardando...':titulo}</button>
      </div>
    </form>
  )
}

export function NuevoPaciente() {
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const { getObras, invalidarPacs, invalidarObras } = useCache()
  const [saving, setSaving] = useState(false)

  async function guardar(f) {
    setSaving(true)
    try {
      if (f.obraSocial && !OBRAS_BASE.includes(f.obraSocial)) {
        await addDoc(collection(db,'obrasSociales'),{nombre:f.obraSocial})
        invalidarObras()
      }
      const venc = f.fechaInicio ? calcVenc(f.fechaInicio) : null
      const plan = f.sesionesTotal ? {
        sesionesTotal:parseInt(f.sesionesTotal), sesionesUsadas:0,
        fechaInicio:f.fechaInicio||null, fechaVencimiento:venc,
        kinesiologoRef:f.kinesiologoRef||null
      } : null
      await addDoc(collection(db,'pacientes'),{
        nombre:f.nombre.trim(), apellido:f.apellido.trim(),
        dni:f.dni.trim(), telefono:f.telefono.trim(),
        obraSocial:f.obraSocial.trim(), nroAfiliado:f.nroAfiliado.trim(),
        diagnostico:f.diagnostico.trim(), observaciones:f.observaciones.trim(),
        plan, archivado:false, creadoPor:user.uid, creadoEn:serverTimestamp()
      })
      invalidarPacs()
      await escribirLog(user.uid,`${perfil.apellido} ${perfil.nombre}`,'Nuevo paciente',`${f.apellido} ${f.nombre} — ${f.obraSocial}`)
      navigate('/pacientes')
    } catch(err){ console.error(err); alert('Error al guardar') }
    setSaving(false)
  }

  return (
    <div style={{maxWidth:700}}>
      <div className="row" style={{marginBottom:20}}>
        <button className="btn bs bsm" onClick={()=>navigate(-1)}>← Volver</button>
        <div className="ptitle">Nuevo paciente</div>
      </div>
      <div className="al alb">El plan se puede cargar ahora o después desde la ficha.</div>
      <Form inicial={INIT} titulo="Guardar paciente" onGuardar={guardar} saving={saving} eraArch={false}/>
    </div>
  )
}

export function EditarPaciente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const { invalidarPacs, invalidarObras } = useCache()
  const [inicial, setInicial] = useState(null)
  const [eraArch, setEraArch] = useState(false)
  const [saving, setSaving]   = useState(false)

  useEffect(()=>{
    getDoc(doc(db,'pacientes',id)).then(s=>{
      if(!s.exists()){navigate('/pacientes');return}
      const d=s.data(); setEraArch(d.archivado===true)
      setInicial({
        nombre:d.nombre||'',apellido:d.apellido||'',dni:d.dni||'',telefono:d.telefono||'',
        obraSocial:d.obraSocial||'',nroAfiliado:d.nroAfiliado||'',
        diagnostico:d.diagnostico||'',observaciones:d.observaciones||'',
        sesionesTotal:d.plan?.sesionesTotal||'',sesionesUsadas:d.plan?.sesionesUsadas||0,
        fechaInicio:d.plan?.fechaInicio||'',kinesiologoRef:d.plan?.kinesiologoRef||''
      })
    })
  },[id])

  async function guardar(f) {
    setSaving(true)
    try {
      if (f.obraSocial&&!OBRAS_BASE.includes(f.obraSocial)){
        await addDoc(collection(db,'obrasSociales'),{nombre:f.obraSocial}); invalidarObras()
      }
      const venc = f.fechaInicio ? calcVenc(f.fechaInicio) : null
      const plan = f.sesionesTotal ? {
        sesionesTotal:parseInt(f.sesionesTotal), sesionesUsadas:parseInt(f.sesionesUsadas)||0,
        fechaInicio:f.fechaInicio||null, fechaVencimiento:venc,
        kinesiologoRef:f.kinesiologoRef||null
      } : null
      const nuevoEst = plan ? estadoPlan(plan) : 'sin-plan'
      await updateDoc(doc(db,'pacientes',id),{
        nombre:f.nombre.trim(),apellido:f.apellido.trim(),dni:f.dni.trim(),telefono:f.telefono.trim(),
        obraSocial:f.obraSocial.trim(),nroAfiliado:f.nroAfiliado.trim(),
        diagnostico:f.diagnostico.trim(),observaciones:f.observaciones.trim(),
        plan, archivado:nuevoEst==='vencido', actualizadoEn:serverTimestamp()
      })
      invalidarPacs()
      const acc = eraArch&&nuevoEst!=='vencido' ? 'Reactivó paciente' : 'Edición paciente'
      await escribirLog(user.uid,`${perfil.apellido} ${perfil.nombre}`,acc,`${f.apellido} ${f.nombre}`)
      navigate(`/pacientes/${id}`)
    } catch(err){console.error(err);alert('Error al guardar')}
    setSaving(false)
  }

  if(!inicial) return <div className="sc"><div className="sp"/></div>

  return (
    <div style={{maxWidth:700}}>
      <div className="row" style={{marginBottom:20}}>
        <button className="btn bs bsm" onClick={()=>navigate(-1)}>← Volver</button>
        <div className="ptitle">{eraArch?'Reactivar paciente':'Editar paciente'}</div>
      </div>
      {eraArch&&<div className="al ala">Paciente archivado. Cargá un plan nuevo con fecha válida para reactivarlo.</div>}
      <Form inicial={inicial} titulo="Guardar cambios" onGuardar={guardar} saving={saving} eraArch={eraArch}/>
    </div>
  )
}

export default NuevoPaciente
