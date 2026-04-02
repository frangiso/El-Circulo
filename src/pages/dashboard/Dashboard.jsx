import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { useCache } from '../../context/AppCache'
import { estadoPlan, hoy, mesActual, fmtMonto } from '../../utils/helpers'

export default function Dashboard() {
  const navigate = useNavigate()
  const { getPacientes } = useCache()
  const [d, setD] = useState(null)

  useEffect(() => {
    async function cargar() {
      const hoyS = hoy(), mes = mesActual()
      const [tsSnap, pacs, cajSnap] = await Promise.all([
        // 1: turnos de hoy (pocos docs, filtrado por fecha exacta)
        getDocs(query(collection(db,'turnos'), where('fecha','==',hoyS), orderBy('hora'))),
        // 2: pacientes activos desde caché
        getPacientes(),
        // 3: caja del mes (1 solo doc)
        getDocs(query(collection(db,'caja'), where('mes','==',mes)))
      ])
      const turnos = tsSnap.docs.map(d=>({id:d.id,...d.data()}))
      const venc = pacs.filter(p=>p.plan&&estadoPlan(p.plan)==='vencido')
      const porV = pacs.filter(p=>p.plan&&estadoPlan(p.plan)==='por-vencer')
      let saldo = 0
      cajSnap.docs.forEach(d=>{
        const mov = d.data()
        saldo += (mov.saldoInicial||0)
        ;(mov.movimientos||[]).forEach(m=>{ saldo += m.tipo==='entrada'?m.importe:-m.importe })
      })
      setD({ turnos, totalPacs: pacs.length, venc, porV, saldo })
    }
    cargar()
  }, [])

  if (!d) return <div className="sc"><div className="sp"/></div>

  const label = new Date().toLocaleDateString('es-AR',{weekday:'long',year:'numeric',month:'long',day:'numeric'})

  return (
    <div>
      <div style={{fontSize:13,color:'#666',marginBottom:16,textTransform:'capitalize'}}>{label}</div>

      <div className="mets m4">
        <div className="met"><div className="met-l">Turnos hoy</div><div className="met-v caz">{d.turnos.length}</div></div>
        <div className="met"><div className="met-l">Pacientes activos</div><div className="met-v">{d.totalPacs}</div></div>
        <div className="met"><div className="met-l">Planes vencidos</div><div className="met-v" style={{color:d.venc.length>0?'var(--ro)':'inherit'}}>{d.venc.length}</div></div>
        <div className="met"><div className="met-l">Saldo en caja</div><div className="met-v cve">{fmtMonto(d.saldo)}</div></div>
      </div>

      {d.venc.length>0&&<div className="al alr">{d.venc.length} paciente{d.venc.length>1?'s':''} con plan vencido: {d.venc.map(p=>`${p.apellido} ${p.nombre}`).join(', ')}</div>}
      {d.porV.length>0&&<div className="al ala">{d.porV.length} paciente{d.porV.length>1?'s':''} con plan por vencer en los próximos 10 días hábiles</div>}

      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <div className="card-title" style={{margin:0}}>Turnos de hoy</div>
          <button className="btn bp bsm" onClick={()=>navigate('/turnos/nuevo')}>+ Nuevo turno</button>
        </div>
        {d.turnos.length===0
          ? <div className="emt">No hay turnos cargados para hoy</div>
          : <div className="tw"><table>
              <thead><tr><th>Hora</th><th>Paciente</th><th>Obra social</th><th>Kinesiológo</th><th>Sesión</th></tr></thead>
              <tbody>
                {d.turnos.map(t=>(
                  <tr key={t.id} onClick={()=>navigate(`/pacientes/${t.pacienteId}`)}>
                    <td className="fw6">{t.hora}</td>
                    <td>{t.pacienteApellido} {t.pacienteNombre}</td>
                    <td>{t.obraSocial?<span className="badge bb">{t.obraSocial}</span>:'—'}</td>
                    <td>{t.kinesiologoNombre}</td>
                    <td>{t.nroSesion||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
        }
      </div>
    </div>
  )
}
