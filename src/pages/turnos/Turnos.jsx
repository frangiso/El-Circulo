import { useState, useEffect, useRef } from 'react'
import { collection, query, where, getDocs, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { useCache } from '../../context/AppCache'
import { estadoPlan, diasHabilesRestantes, hoy, escribirLog } from '../../utils/helpers'
import { useAuth } from '../../context/AuthContext'

const ILupa = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)

function PlanBadge({ p }) {
  if (!p || !p.plan) return <span className="badge bk">Sin plan</span>
  const e = estadoPlan(p.plan)
  if (e === 'vencido') return <span className="badge br">Vencido</span>
  if (e === 'por-vencer') return <span className="badge ba">{diasHabilesRestantes(p.plan.fechaVencimiento)}d</span>
  return <span className="badge bg">Vigente</span>
}

function AsistenciaBtn({ turno, onCambio }) {
  const [loading, setLoading] = useState(false)
  const est = turno.asistencia || 'pendiente'
  async function marcar(v) { if(loading) return; setLoading(true); await onCambio(turno,v); setLoading(false) }
  if (est === 'asistio') return (
    <div className="row" style={{gap:4}}>
      <span className="badge bg">Asistió</span>
      <button className="btn bs bsm" style={{fontSize:11,padding:'3px 7px'}} onClick={()=>marcar('pendiente')} disabled={loading}>✕</button>
    </div>
  )
  if (est === 'falto') return (
    <div className="row" style={{gap:4}}>
      <span className="badge br">Faltó</span>
      <button className="btn bs bsm" style={{fontSize:11,padding:'3px 7px'}} onClick={()=>marcar('pendiente')} disabled={loading}>✕</button>
    </div>
  )
  return (
    <div className="row" style={{gap:4}}>
      <button className="btn bsuc bsm" onClick={()=>marcar('asistio')} disabled={loading}>✓ Asistió</button>
      <button className="btn bd bsm" onClick={()=>marcar('falto')} disabled={loading}>✗ Faltó</button>
    </div>
  )
}

export default function Turnos() {
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const { getKines, getPacientes, invalidarPacs } = useCache()
  const [turnos, setTurnos]     = useState([])
  const [mapaP, setMapaP]       = useState({})
  const [kines, setKines]       = useState([])
  const [kineFiltro, setKF]     = useState('')
  const [fecha, setFecha]       = useState(hoy())
  const [busqNombre, setBN]     = useState('')
  const [buscado, setBuscado]   = useState(false)
  const [cargando, setCargando] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    Promise.all([getKines(), getPacientes()]).then(([k, pacs]) => {
      setKines(k)
      const m = {}; pacs.forEach(p => { m[p.id] = p }); setMapaP(m)
    })
  }, [])

  async function buscarPorFecha(f) {
    setCargando(true); setBuscado(true)
    const snap = await getDocs(query(collection(db,'turnos'), where('fecha','==',f), orderBy('hora')))
    setTurnos(snap.docs.map(d => ({id:d.id,...d.data()})))
    setCargando(false)
  }

  function onFechaChange(f) {
    setFecha(f); clearTimeout(timer.current)
    timer.current = setTimeout(() => buscarPorFecha(f), 400)
  }

  async function cambiarAsistencia(turno, nuevoEst) {
    try {
      const pac = mapaP[turno.pacienteId]
      if (nuevoEst === 'asistio') {
        await updateDoc(doc(db,'turnos',turno.id), {asistencia:'asistio',asistenciaTs:serverTimestamp()})
        if (pac?.plan) {
          const n = (pac.plan.sesionesUsadas||0)+1
          await updateDoc(doc(db,'pacientes',turno.pacienteId), {'plan.sesionesUsadas':n})
          setMapaP(p => ({...p,[turno.pacienteId]:{...pac,plan:{...pac.plan,sesionesUsadas:n}}}))
          invalidarPacs()
        }
        await escribirLog(user.uid, perfil.apellido+' '+perfil.nombre,'Asistencia',turno.pacienteApellido+' '+turno.pacienteNombre+' — Asistió')
      } else if (nuevoEst === 'falto') {
        await updateDoc(doc(db,'turnos',turno.id), {asistencia:'falto',asistenciaTs:serverTimestamp()})
        await escribirLog(user.uid, perfil.apellido+' '+perfil.nombre,'Asistencia',turno.pacienteApellido+' '+turno.pacienteNombre+' — Faltó')
      } else {
        const eraA = turno.asistencia === 'asistio'
        await updateDoc(doc(db,'turnos',turno.id), {asistencia:'pendiente',asistenciaTs:serverTimestamp()})
        if (eraA && pac?.plan) {
          const n = Math.max(0,(pac.plan.sesionesUsadas||0)-1)
          await updateDoc(doc(db,'pacientes',turno.pacienteId), {'plan.sesionesUsadas':n})
          setMapaP(p => ({...p,[turno.pacienteId]:{...pac,plan:{...pac.plan,sesionesUsadas:n}}}))
          invalidarPacs()
        }
      }
      setTurnos(prev => prev.map(t => t.id===turno.id ? {...t,asistencia:nuevoEst} : t))
    } catch(err) { console.error(err); alert('Error al actualizar') }
  }

  const filtrados = turnos.filter(t => {
    const nom = (t.pacienteApellido+' '+t.pacienteNombre).toLowerCase()
    return nom.includes(busqNombre.toLowerCase()) && (kineFiltro ? t.kinesiologoId===kineFiltro : true)
  })

  const asistieron = turnos.filter(t => t.asistencia==='asistio').length
  const faltaron   = turnos.filter(t => t.asistencia==='falto').length
  const pendientes = turnos.filter(t => !t.asistencia||t.asistencia==='pendiente').length

  return (
    <div>
      <div className="ph">
        <div className="ptitle">Turnos</div>
        <button className="btn bp" onClick={()=>navigate('/turnos/nuevo')}>+ Nuevo turno</button>
      </div>

      <div className="filtros">
        <div className="sw" style={{flex:1,minWidth:180}}>
          <ILupa />
          <input className="si" placeholder="Filtrar por nombre..." value={busqNombre} onChange={e=>setBN(e.target.value)}/>
        </div>
        <input type="date" value={fecha} onChange={e=>onFechaChange(e.target.value)}/>
        <select value={kineFiltro} onChange={e=>setKF(e.target.value)}>
          <option value="">Todos los kinesiológos</option>
          {kines.map(k=><option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
        </select>
        <button className="btn bp bsm" onClick={()=>buscarPorFecha(fecha)}>Buscar</button>
      </div>

      {buscado && turnos.length > 0 && (
        <div className="mets" style={{gridTemplateColumns:'repeat(3,1fr)',marginBottom:14}}>
          <div className="met"><div className="met-l">Asistieron</div><div className="met-v cve">{asistieron}</div></div>
          <div className="met"><div className="met-l">Faltaron</div><div className="met-v cro">{faltaron}</div></div>
          <div className="met"><div className="met-l">Sin confirmar</div><div className="met-v cgr">{pendientes}</div></div>
        </div>
      )}

      <div className="card" style={{padding:0,overflow:'hidden'}}>
        {cargando ? (
          <div className="sc"><div className="sp"/></div>
        ) : !buscado ? (
          <div className="empty-search">
            <ILupa/>
            <p>Elegí una fecha para ver los turnos</p>
            <span>o hacé clic en "Buscar" para cargar el día de hoy</span>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="emt">No hay turnos para esta fecha</div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Hora</th><th>Paciente</th><th>Obra social</th>
                  <th>Kinesiológo</th><th>Sesión</th><th>Plan</th>
                  <th>Asistencia</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(t => {
                  const pac = mapaP[t.pacienteId]
                  const estP = pac?.plan ? estadoPlan(pac.plan) : null
                  return (
                    <tr key={t.id} style={{background: estP==='vencido'?'#fff8f8':estP==='por-vencer'?'#fffbf0':'inherit'}}>
                      <td className="fw6">{t.hora}</td>
                      <td>
                        <div style={{cursor:'pointer',color:'var(--az)'}} onClick={()=>navigate('/pacientes/'+t.pacienteId)}>
                          {t.pacienteApellido} {t.pacienteNombre}
                        </div>
                        {estP==='vencido' && <div style={{fontSize:11,color:'var(--ro)',marginTop:2}}>⚠ Plan vencido</div>}
                        {estP==='por-vencer' && <div style={{fontSize:11,color:'var(--na)',marginTop:2}}>⚠ Vence en {diasHabilesRestantes(pac.plan.fechaVencimiento)}d</div>}
                      </td>
                      <td>{t.obraSocial?<span className="badge bb">{t.obraSocial}</span>:'—'}</td>
                      <td>{t.kinesiologoNombre}</td>
                      <td>{t.nroSesion?t.nroSesion+'/'+(pac?.plan?.sesionesTotal||'?'):'—'}</td>
                      <td><PlanBadge p={pac}/></td>
                      <td><AsistenciaBtn turno={t} onCambio={cambiarAsistencia}/></td>
                      <td>
                        <button className="btn bs bsm" style={{fontSize:11}} onClick={()=>navigate('/turnos/'+t.id+'/editar')}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
