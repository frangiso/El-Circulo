import { useEffect, useState } from 'react'
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate, useParams } from 'react-router-dom'
import { useCache } from '../../context/AppCache'
import { estadoPlan, diasHabilesRestantes, fmtFecha } from '../../utils/helpers'

export default function FichaPaciente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { invalidarPacs } = useCache()
  const [pac, setPac]       = useState(null)
  const [turnos, setTurnos] = useState([])
  const [carg, setCarg]     = useState(true)

  useEffect(()=>{
    async function cargar(){
      const snap = await getDoc(doc(db,'pacientes',id))
      if(!snap.exists()){navigate('/pacientes');return}
      const p={id:snap.id,...snap.data()}
      // Archivar automáticamente si el plan venció
      if(!p.archivado&&p.plan&&estadoPlan(p.plan)==='vencido'){
        await updateDoc(doc(db,'pacientes',id),{archivado:true,fechaArchivado:new Date().toISOString().split('T')[0]})
        p.archivado=true; invalidarPacs()
      }
      setPac(p)
      const ts=await getDocs(query(collection(db,'turnos'),where('pacienteId','==',id),orderBy('fecha','desc')))
      setTurnos(ts.docs.map(d=>({id:d.id,...d.data()})))
      setCarg(false)
    }
    cargar()
  },[id])

  if(carg) return <div className="sc"><div className="sp"/></div>
  if(!pac) return null

  const {plan}=pac
  const est=plan?estadoPlan(plan):'sin-plan'
  const arch=pac.archivado===true
  const dias=plan?.fechaVencimiento?diasHabilesRestantes(plan.fechaVencimiento):null
  const ini=((pac.nombre?.[0]||'')+(pac.apellido?.[0]||'')).toUpperCase()

  return (
    <div>
      <div className="row" style={{marginBottom:20}}>
        <button className="btn bs bsm" onClick={()=>navigate('/pacientes')}>← Volver</button>
        <div className="ptitle" style={{flex:1}}>Ficha de paciente</div>
        <button className="btn bs bsm" onClick={()=>navigate(`/pacientes/${id}/editar`)}>{arch?'Reactivar / Editar':'Editar'}</button>
        {!arch&&<button className="btn bp bsm" onClick={()=>navigate('/turnos/nuevo')}>+ Turno</button>}
      </div>

      {arch&&<div className="al ala">Paciente archivado — plan vencido. Hacé clic en "Reactivar / Editar" para cargarlo de nuevo.</div>}
      {est==='por-vencer'&&!arch&&<div className="al ala">⚠ El plan vence en {dias} días hábiles.</div>}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
        <div className="card">
          <div className="row" style={{marginBottom:14}}>
            <div className="av avl" style={{opacity:arch?.5:1}}>{ini}</div>
            <div>
              <div style={{fontSize:16,fontWeight:700}}>{pac.apellido} {pac.nombre}</div>
              <div style={{fontSize:12,color:'#888'}}>DNI {pac.dni||'—'}</div>
              {arch&&<span className="badge bk" style={{marginTop:4}}>Archivado</span>}
            </div>
          </div>
          <div className="div"/>
          <table style={{width:'100%',fontSize:13}}>
            <tbody>
              <tr><td style={{color:'#888',padding:'4px 0',width:'40%'}}>Teléfono</td><td style={{padding:'4px 0'}}>{pac.telefono||'—'}</td></tr>
              <tr><td style={{color:'#888',padding:'4px 0'}}>Obra social</td><td style={{padding:'4px 0'}}>{pac.obraSocial?<span className="badge bb">{pac.obraSocial}</span>:'—'}</td></tr>
              <tr><td style={{color:'#888',padding:'4px 0'}}>N° afiliado</td><td style={{padding:'4px 0'}}>{pac.nroAfiliado||'—'}</td></tr>
              <tr><td style={{color:'#888',padding:'4px 0'}}>Diagnóstico</td><td style={{padding:'4px 0'}}>{pac.diagnostico||'—'}</td></tr>
              {pac.observaciones&&<tr><td style={{color:'#888',padding:'4px 0'}}>Obs.</td><td style={{padding:'4px 0'}}>{pac.observaciones}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-title">Estado del plan</div>
          {!plan?<div style={{color:'#888',fontSize:13}}>Sin plan cargado. <button className="btn bs bsm" onClick={()=>navigate(`/pacientes/${id}/editar`)}>Cargar plan</button></div>:(
            <>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                <div className="met"><div className="met-l">Sesiones</div><div style={{fontSize:20,fontWeight:700,color:'#185FA5'}}>{plan.sesionesUsadas||0}/{plan.sesionesTotal}</div></div>
                <div className="met"><div className="met-l">Días hábiles</div><div style={{fontSize:20,fontWeight:700,color:dias<=0?'var(--ro)':dias<=10?'var(--na)':'var(--ve)'}}>{dias??'—'}</div></div>
              </div>
              <table style={{width:'100%',fontSize:13}}>
                <tbody>
                  <tr><td style={{color:'#888',padding:'4px 0',width:'40%'}}>Inicio plan</td><td style={{padding:'4px 0'}}>{fmtFecha(plan.fechaInicio)}</td></tr>
                  <tr><td style={{color:'#888',padding:'4px 0'}}>Vencimiento</td><td style={{padding:'4px 0'}}>{fmtFecha(plan.fechaVencimiento)}</td></tr>
                  <tr><td style={{color:'#888',padding:'4px 0'}}>Estado</td><td style={{padding:'4px 0'}}>
                    {est==='vencido'?<span className="badge br">Archivado</span>:est==='por-vencer'?<span className="badge ba">Por vencer</span>:<span className="badge bg">Vigente</span>}
                  </td></tr>
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Historial de sesiones ({turnos.length})</div>
        {turnos.length===0?<div className="emt">Sin turnos registrados</div>:(
          <div className="tw"><table>
            <thead><tr><th>Fecha</th><th>Hora</th><th>Kinesiológo</th><th>Sesión N°</th></tr></thead>
            <tbody>{turnos.map(t=><tr key={t.id}><td>{fmtFecha(t.fecha)}</td><td>{t.hora}</td><td>{t.kinesiologoNombre}</td><td>{t.nroSesion||'—'}</td></tr>)}</tbody>
          </table></div>
        )}
      </div>
    </div>
  )
}
