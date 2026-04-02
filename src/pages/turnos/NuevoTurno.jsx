import { useEffect, useState } from 'react'
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCache } from '../../context/AppCache'
import { calcVenc, diasHabilesRestantes, estadoPlan, escribirLog, hoy } from '../../utils/helpers'

const ILupa = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>

export default function NuevoTurno() {
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const { getKines, getPacientes, invalidarPacs } = useCache()
  const [kines, setKines]   = useState([])
  const [pacs, setPacs]     = useState([])
  const [busq, setBusq]     = useState('')
  const [pacSel, setPacSel] = useState(null)
  const [showDL, setShowDL] = useState(false)
  const [load, setLoad]     = useState(false)
  const [f, setF] = useState({ fecha:hoy(), hora:'09:00', kineId:'', nroSes:'', totSes:'', fechaIni:'' })

  useEffect(() => {
    Promise.all([getKines(), getPacientes()]).then(([k,p])=>{ setKines(k); setPacs(p) })
  }, [])

  const set = (k,v) => setF(p=>({...p,[k]:v}))

  // Filtrado en memoria — sin Firestore
  const sugs = busq.length<2 ? [] : pacs.filter(p=>{
    return `${p.apellido} ${p.nombre} ${p.dni}`.toLowerCase().includes(busq.toLowerCase())
  }).slice(0,8)

  function selec(p) {
    setPacSel(p); setBusq(`${p.apellido} ${p.nombre}`); setShowDL(false)
    if (p.plan) setF(prev=>({...prev, totSes:p.plan.sesionesTotal||'', fechaIni:p.plan.fechaInicio||'', nroSes:(p.plan.sesionesUsadas||0)+1}))
  }

  const venc = f.fechaIni ? calcVenc(f.fechaIni) : null
  const dias = venc ? diasHabilesRestantes(venc) : null
  const est  = pacSel?.plan ? estadoPlan(pacSel.plan) : null

  async function guardar(e) {
    e.preventDefault()
    if (!pacSel) return alert('Seleccioná un paciente')
    if (!f.kineId) return alert('Seleccioná un kinesiológo')
    setLoad(true)
    try {
      const kine = kines.find(k=>k.id===f.kineId)
      // Datos desnormalizados en el turno — nunca hay que leer paciente para mostrar turnos
      await addDoc(collection(db,'turnos'),{
        fecha:f.fecha, hora:f.hora,
        pacienteId:pacSel.id, pacienteNombre:pacSel.nombre,
        pacienteApellido:pacSel.apellido, pacienteDni:pacSel.dni||'',
        obraSocial:pacSel.obraSocial||'',
        kinesiologoId:f.kineId, kinesiologoNombre:`${kine.apellido} ${kine.nombre}`,
        nroSesion:parseInt(f.nroSes)||null,
        creadoPor:user.uid, creadoPorNombre:`${perfil.apellido} ${perfil.nombre}`,
        ts:serverTimestamp()
      })
      if (f.fechaIni||f.totSes) {
        await updateDoc(doc(db,'pacientes',pacSel.id),{
          plan:{ sesionesTotal:parseInt(f.totSes)||pacSel.plan?.sesionesTotal,
            sesionesUsadas:parseInt(f.nroSes)||(pacSel.plan?.sesionesUsadas||0)+1,
            fechaInicio:f.fechaIni||pacSel.plan?.fechaInicio,
            fechaVencimiento:venc||pacSel.plan?.fechaVencimiento },
          archivado:false
        })
        invalidarPacs()
      }
      await escribirLog(user.uid,`${perfil.apellido} ${perfil.nombre}`,'Nuevo turno',`${pacSel.apellido} ${pacSel.nombre} — ${f.hora}hs — ${kine.apellido} ${kine.nombre}`)
      navigate('/turnos')
    } catch(err){ console.error(err); alert('Error al guardar el turno') }
    setLoad(false)
  }

  return (
    <div style={{maxWidth:700}}>
      <div className="row" style={{marginBottom:20}}>
        <button className="btn bs bsm" onClick={()=>navigate(-1)}>← Volver</button>
        <div className="ptitle">Nuevo turno</div>
      </div>
      <form onSubmit={guardar}>
        <div className="card">
          <div className="card-title">Datos del turno</div>
          <div className="fg">
            {/* Buscador con lupa */}
            <div className="ff full" style={{position:'relative'}}>
              <label>Paciente *</label>
              <div className="sw">
                <ILupa/>
                <input className="si" value={busq}
                  onChange={e=>{setBusq(e.target.value);setShowDL(true);if(!e.target.value)setPacSel(null)}}
                  onFocus={()=>setShowDL(true)} placeholder="Escribí 2+ letras para buscar..." autoComplete="off"/>
              </div>
              {showDL&&sugs.length>0&&(
                <div className="dl">
                  {sugs.map(p=>(
                    <div key={p.id} className="di" onClick={()=>selec(p)}>
                      <strong>{p.apellido} {p.nombre}</strong>
                      <span className="cgr" style={{marginLeft:8}}>DNI {p.dni}</span>
                      {p.obraSocial&&<span className="badge bb" style={{marginLeft:8}}>{p.obraSocial}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="ff"><label>Fecha *</label><input type="date" value={f.fecha} onChange={e=>set('fecha',e.target.value)} required/></div>
            <div className="ff"><label>Hora *</label><input type="time" value={f.hora} onChange={e=>set('hora',e.target.value)} required/></div>
            <div className="ff"><label>Kinesiológo *</label>
              <select value={f.kineId} onChange={e=>set('kineId',e.target.value)} required>
                <option value="">Seleccioná...</option>
                {kines.map(k=><option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
              </select>
            </div>
            <div className="ff"><label>N° de sesión</label><input type="number" min="1" value={f.nroSes} onChange={e=>set('nroSes',e.target.value)} placeholder="Ej: 5"/></div>
          </div>
        </div>

        {est==='vencido'&&<div className="al alr">⚠ El plan de este paciente está vencido.</div>}
        {venc&&<div className={`al ${dias<=0?'alr':dias<=10?'ala':'alb'}`}>
          Plan: {f.totSes} sesiones · Vence: {venc} · {dias} días hábiles restantes
        </div>}

        <div className="card">
          <div className="card-title">Plan del paciente</div>
          <div className="fg">
            <div className="ff"><label>Total sesiones autorizadas</label><input type="number" min="1" value={f.totSes} onChange={e=>set('totSes',e.target.value)} placeholder="Ej: 10"/></div>
            <div className="ff"><label>Fecha de inicio del plan</label><input type="date" value={f.fechaIni} onChange={e=>set('fechaIni',e.target.value)}/></div>
          </div>
          <div className="hint" style={{marginTop:8}}>El vencimiento se calcula a 45 días hábiles desde el inicio.</div>
        </div>

        <div className="re">
          <button type="button" className="btn bs" onClick={()=>navigate(-1)}>Cancelar</button>
          <button type="submit" className="btn bp" disabled={load}>{load?'Guardando...':'Guardar turno'}</button>
        </div>
      </form>
    </div>
  )
}
