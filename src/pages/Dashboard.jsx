import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { estadoPlan, formatFecha } from '../../utils/helpers'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ turnosHoy: 0, pacientesActivos: 0, planesVencidos: 0, saldoCaja: 0 })
  const [turnosHoy, setTurnosHoy] = useState([])
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const manana = new Date(hoy)
      manana.setDate(manana.getDate() + 1)
      const hoyStr = hoy.toISOString().split('T')[0]

      // Turnos de hoy
      const turnosSnap = await getDocs(query(
        collection(db, 'turnos'),
        where('fecha', '==', hoyStr),
        orderBy('hora')
      ))
      const turnos = turnosSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setTurnosHoy(turnos)

      // Pacientes
      const pacSnap = await getDocs(collection(db, 'pacientes'))
      const pacs = pacSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const vencidos = pacs.filter(p => {
        if (!p.plan) return false
        return estadoPlan(p.plan.sesionesUsadas || 0, p.plan.sesionesTotal, p.plan.fechaVencimiento) === 'vencido'
      })
      setAlertas(vencidos.slice(0, 5))

      // Caja - saldo del mes actual
      const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`
      const cajaSnap = await getDocs(query(
        collection(db, 'caja'),
        where('mes', '==', mesActual)
      ))
      let saldo = 0
      cajaSnap.docs.forEach(d => {
        const mov = d.data()
        if (mov.tipo === 'entrada') saldo += mov.importe
        else saldo -= mov.importe
      })

      setStats({
        turnosHoy: turnos.length,
        pacientesActivos: pacs.length,
        planesVencidos: vencidos.length,
        saldoCaja: saldo
      })
      setLoading(false)
    }
    cargar()
  }, [])

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  const hoyLabel = new Date().toLocaleDateString('es-AR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })

  return (
    <div>
      <div style={{fontSize:'13px', color:'#888', marginBottom:'16px', textTransform:'capitalize'}}>{hoyLabel}</div>

      <div className="metric-grid metric-grid-4">
        <div className="metric-card">
          <div className="metric-label">Turnos hoy</div>
          <div className="metric-value" style={{color:'#185FA5'}}>{stats.turnosHoy}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pacientes activos</div>
          <div className="metric-value">{stats.pacientesActivos}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Planes vencidos</div>
          <div className="metric-value" style={{color: stats.planesVencidos > 0 ? '#A32D2D' : '#1a1a1a'}}>{stats.planesVencidos}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Saldo en caja</div>
          <div className="metric-value" style={{color:'#3B6D11'}}>${stats.saldoCaja.toLocaleString('es-AR')}</div>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="alert alert-red">
          {alertas.length} paciente{alertas.length > 1 ? 's' : ''} con plan vencido: {alertas.map(p => `${p.apellido} ${p.nombre}`).join(', ')}
        </div>
      )}

      <div className="card">
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px'}}>
          <div className="card-title" style={{margin:0}}>Turnos de hoy</div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/turnos/nuevo')}>+ Nuevo turno</button>
        </div>
        {turnosHoy.length === 0 ? (
          <div style={{color:'#888', fontSize:'13px', padding:'20px 0', textAlign:'center'}}>No hay turnos cargados para hoy</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Hora</th><th>Paciente</th><th>Obra social</th><th>Kinesiológo</th><th>Sesión</th></tr>
              </thead>
              <tbody>
                {turnosHoy.map(t => (
                  <tr key={t.id} style={{cursor:'pointer'}} onClick={() => navigate(`/pacientes/${t.pacienteId}`)}>
                    <td>{t.hora}</td>
                    <td>{t.pacienteApellido} {t.pacienteNombre}</td>
                    <td><span className="badge badge-blue">{t.obraSocial || '—'}</span></td>
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
