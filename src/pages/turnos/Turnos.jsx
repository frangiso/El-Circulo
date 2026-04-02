import { useState, useRef } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { useCache } from '../../context/AppCache'
import { estadoPlan, diasHabilesRestantes, hoy } from '../../utils/helpers'

const ILupa = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>

function PlanBadge({ p }) {
  if (!p?.plan) return <span className="badge bk">Sin plan</span>
  const e = estadoPlan(p.plan)
  if (e==='vencido')    return <span className="badge br">Vencido</span>
  if (e==='por-vencer') return <span className="badge ba">{diasHabilesRestantes(p.plan.fechaVencimiento)}d</span>
  return <span className="badge bg">Vigente</span>
}

export default function Turnos() {
  const navigate = useNavigate()
  const { getKines, getPacientes } = useCache()
  const [turnos, setTurnos]   = useState([])
  const [mapaP, setMapaP]     = useState({})
  const [kines, setKines]     = useState([])
  const [kineFiltro, setKF]   = useState('')
  const [fecha, setFecha]     = useState(hoy())
  const [busqNombre, setBN]   = useState('')
  const [buscado, setBuscado] = useState(false)
  const [cargando, setC]      = useState(false)
  const timer = useRef(null)

  // Cargar kines desde caché al montar (0 lecturas si ya están)
  useState(() => {
    Promise.all([getKines(), getPacientes()]).then(([k, pacs]) => {
      setKines(k)
      const m={}; pacs.forEach(p=>{m[p.id]=p}); setMapaP(m)
    })
  })

  // Buscar turnos por fecha — solo cuando el usuario elige una fecha o presiona buscar
  async function buscarPorFecha(f) {
    setC(true); setBuscado(true)
    const snap = await getDocs(query(collection(db,'turnos'), where('fecha','==',f), orderBy('hora')))
    setTurnos(snap.docs.map(d=>({id:d.id,...d.data()})))
    setC(false)
  }

  function onFechaChange(f) {
    setFecha(f)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => buscarPorFecha(f), 400)
  }

  // Filtrado en memoria — sin lecturas extra
  const filtrados = turnos.filter(t => {
    const nom = `${t.pacienteApellido} ${t.pacienteNombre}`.toLowerCase()
    return nom.includes(busqNombre.toLowerCase()) && (kineFiltro ? t.kinesiologoId===kineFiltro : true)
  })

  return (
    <div>
      <div className="ph">
        <div className="ptitle">Turnos</div>
        <button className="btn bp" onClick={()=>navigate('/turnos/nuevo')}>+ Nuevo turno</button>
      </div>

      <div className="filtros">
        {/* Lupa + nombre */}
        <div className="sw" style={{flex:1,minWidth:180}}>
          <ILupa/>
          <input className="si" placeholder="Filtrar por nombre..." value={busqNombre} onChange={e=>setBN(e.target.value)}/>
        </div>
        {/* Fecha — disparador de lectura */}
        <input type="date" value={fecha} onChange={e=>onFechaChange(e.target.value)}/>
        <select value={kineFiltro} onChange={e=>setKF(e.target.value)}>
          <option value="">Todos los kinesiológos</option>
          {kines.map(k=><option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
        </select>
        <button className="btn bp bsm" onClick={()=>buscarPorFecha(fecha)}>Buscar</button>
      </div>

      <div className="card" style={{padding:0,overflow:'hidden'}}>
        {cargando
          ? <div className="sc"><div className="sp"/></div>
          : !buscado
          ? <div className="empty-search">
              <ILupa/>
              <p>Elegí una fecha para ver los turnos</p>
              <span>o hacé clic en "Buscar" para cargar el día de hoy</span>
            </div>
          : filtrados.length===0
          ? <div className="emt">No hay turnos para esta fecha</div>
          : <div className="tw"><table>
              <thead><tr><th>Hora</th><th>Paciente</th><th>DNI</th><th>Obra social</th><th>Kinesiológo</th><th>Sesión</th><th>Plan</th><th></th></tr></thead>
              <tbody>
                {filtrados.map(t=>(
                  <tr key={t.id}>
                    <td className="fw6">{t.hora}</td>
                    <td>{t.pacienteApellido} {t.pacienteNombre}</td>
                    <td className="cgr">{t.pacienteDni||'—'}</td>
                    <td>{t.obraSocial?<span className="badge bb">{t.obraSocial}</span>:'—'}</td>
                    <td>{t.kinesiologoNombre}</td>
                    <td>{t.nroSesion?`${t.nroSesion}/${mapaP[t.pacienteId]?.plan?.sesionesTotal||'?'}`:'—'}</td>
                    <td><PlanBadge p={mapaP[t.pacienteId]}/></td>
                    <td><button className="btn bs bsm" onClick={()=>navigate(`/pacientes/${t.pacienteId}`)}>Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>}
      </div>
    </div>
  )
}
