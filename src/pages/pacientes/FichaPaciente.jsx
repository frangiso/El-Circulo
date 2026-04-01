import { useEffect, useState } from 'react'
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate, useParams } from 'react-router-dom'
import { estadoPlan, diasHabilesRestantes } from '../../utils/helpers'

export default function FichaPaciente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [paciente, setPaciente] = useState(null)
  const [turnos, setTurnos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const snap = await getDoc(doc(db, 'pacientes', id))
      if (!snap.exists()) { navigate('/pacientes'); return }
      setPaciente({ id: snap.id, ...snap.data() })
      const tSnap = await getDocs(query(collection(db, 'turnos'), where('pacienteId', '==', id), orderBy('fecha', 'desc')))
      setTurnos(tSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }
    cargar()
  }, [id])

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  const p = paciente
  const plan = p.plan
  const iniciales = (p.apellido?.[0] || '') + (p.nombre?.[0] || '')
  const estPlan = plan ? estadoPlan(plan.sesionesUsadas || 0, plan.sesionesTotal, plan.fechaVencimiento) : null
  const diasRestantes = plan?.fechaVencimiento ? diasHabilesRestantes(plan.fechaVencimiento) : null

  const badgePlan = () => {
    if (!plan) return <span className="badge badge-gray">Sin plan</span>
    if (estPlan === 'vencido') return <span className="badge badge-red">Vencido</span>
    if (estPlan === 'por-vencer') return <span className="badge badge-amber">{diasRestantes} días restantes</span>
    return <span className="badge badge-green">Vigente</span>
  }

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px'}}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/pacientes')}>← Volver</button>
        <h1 style={{fontSize:'20px', fontWeight:'600'}}>Ficha de paciente</h1>
        <div style={{marginLeft:'auto', display:'flex', gap:'8px'}}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/pacientes/${id}/editar`)}>Editar</button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/turnos/nuevo')}>+ Turno</button>
        </div>
      </div>

      {estPlan === 'vencido' && <div className="alert alert-red">⚠ El plan de este paciente está vencido. Renovalo antes de asignar nuevos turnos.</div>}
      {estPlan === 'por-vencer' && <div className="alert alert-amber">⚠ Quedan {diasRestantes} días hábiles para que venza el plan.</div>}

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'14px'}}>
        <div className="card">
          <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'14px'}}>
            <div className="avatar avatar-lg">{iniciales.toUpperCase()}</div>
            <div>
              <div style={{fontSize:'17px', fontWeight:'600'}}>{p.apellido} {p.nombre}</div>
              <div style={{fontSize:'12px', color:'#888'}}>DNI {p.dni || '—'}</div>
            </div>
          </div>
          <hr className="divider" />
          <table style={{width:'100%', fontSize:'13px'}}>
            <tbody>
              <tr><td style={{color:'#888', padding:'4px 0'}}>Teléfono</td><td style={{textAlign:'right'}}>{p.telefono || '—'}</td></tr>
              <tr><td style={{color:'#888', padding:'4px 0'}}>Obra social</td><td style={{textAlign:'right'}}>{p.obraSocial ? <span className="badge badge-blue">{p.obraSocial}</span> : '—'}</td></tr>
              <tr><td style={{color:'#888', padding:'4px 0'}}>N° afiliado</td><td style={{textAlign:'right'}}>{p.nroAfiliado || '—'}</td></tr>
              <tr><td style={{color:'#888', padding:'4px 0'}}>Diagnóstico</td><td style={{textAlign:'right'}}>{p.diagnostico || '—'}</td></tr>
              {p.observaciones && <tr><td style={{color:'#888', padding:'4px 0', verticalAlign:'top'}}>Observaciones</td><td style={{textAlign:'right'}}>{p.observaciones}</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div style={{fontSize:'14px', fontWeight:'600', marginBottom:'12px'}}>Estado del plan</div>
          {plan ? (
            <>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'12px'}}>
                <div className="metric-card">
                  <div className="metric-label">Sesiones</div>
                  <div style={{fontSize:'22px', fontWeight:'600', color:'#185FA5'}}>{plan.sesionesUsadas || 0} / {plan.sesionesTotal}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Días hábiles rest.</div>
                  <div style={{fontSize:'22px', fontWeight:'600', color: diasRestantes <= 0 ? '#A32D2D' : diasRestantes <= 10 ? '#854F0B' : '#3B6D11'}}>{diasRestantes ?? '—'}</div>
                </div>
              </div>
              <table style={{width:'100%', fontSize:'13px'}}>
                <tbody>
                  <tr><td style={{color:'#888', padding:'4px 0'}}>Inicio del plan</td><td style={{textAlign:'right'}}>{plan.fechaInicio ? new Date(plan.fechaInicio+'T12:00:00').toLocaleDateString('es-AR') : '—'}</td></tr>
                  <tr><td style={{color:'#888', padding:'4px 0'}}>Vencimiento</td><td style={{textAlign:'right'}}>{plan.fechaVencimiento ? new Date(plan.fechaVencimiento+'T12:00:00').toLocaleDateString('es-AR') : '—'}</td></tr>
                  <tr><td style={{color:'#888', padding:'4px 0'}}>Estado</td><td style={{textAlign:'right'}}>{badgePlan()}</td></tr>
                </tbody>
              </table>
            </>
          ) : (
            <div style={{color:'#888', fontSize:'13px', padding:'20px 0', textAlign:'center'}}>
              Sin plan cargado.
              <br />
              <button className="btn btn-secondary btn-sm" style={{marginTop:'10px'}} onClick={() => navigate(`/pacientes/${id}/editar`)}>Cargar plan</button>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Historial de sesiones ({turnos.length})</div>
        {turnos.length === 0 ? (
          <div style={{color:'#888', fontSize:'13px', padding:'20px 0', textAlign:'center'}}>Sin sesiones registradas</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Hora</th><th>Kinesiológo</th><th>N° sesión</th></tr></thead>
              <tbody>
                {turnos.map(t => (
                  <tr key={t.id}>
                    <td>{t.fecha ? new Date(t.fecha+'T12:00:00').toLocaleDateString('es-AR') : '—'}</td>
                    <td>{t.hora}</td>
                    <td>{t.kinesiologoNombre}</td>
                    <td>{t.nroSesion || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
