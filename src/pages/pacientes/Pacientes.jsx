import { useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { estadoPlan, diasHabilesRestantes } from '../../utils/helpers'

export default function Pacientes() {
  const navigate = useNavigate()
  const [pacientes, setPacientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroOS, setFiltroOS] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDocs(query(collection(db, 'pacientes'), orderBy('apellido')))
      .then(snap => { setPacientes(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) })
  }, [])

  const obrasSociales = [...new Set(pacientes.map(p => p.obraSocial).filter(Boolean))].sort()

  const filtrados = pacientes.filter(p => {
    const txt = `${p.apellido} ${p.nombre} ${p.dni}`.toLowerCase()
    const matchB = txt.includes(busqueda.toLowerCase())
    const matchOS = filtroOS ? p.obraSocial === filtroOS : true
    return matchB && matchOS
  })

  function badgePlan(p) {
    if (!p.plan) return <span className="badge badge-gray">Sin plan</span>
    const est = estadoPlan(p.plan.sesionesUsadas || 0, p.plan.sesionesTotal, p.plan.fechaVencimiento)
    if (est === 'vencido') return <span className="badge badge-red">Vencido</span>
    if (est === 'por-vencer') {
      const dias = diasHabilesRestantes(p.plan.fechaVencimiento)
      return <span className="badge badge-amber">{dias} días</span>
    }
    return <span className="badge badge-green">Vigente</span>
  }

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px'}}>
        <h1 style={{fontSize:'20px', fontWeight:'600'}}>Pacientes</h1>
        <button className="btn btn-primary" onClick={() => navigate('/pacientes/nuevo')}>+ Nuevo paciente</button>
      </div>

      <div className="filtros">
        <input placeholder="Buscar por nombre o DNI..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select value={filtroOS} onChange={e => setFiltroOS(e.target.value)}>
          <option value="">Todas las obras sociales</option>
          {obrasSociales.map(os => <option key={os} value={os}>{os}</option>)}
        </select>
      </div>

      <div className="card" style={{padding:0, overflow:'hidden'}}>
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : filtrados.length === 0 ? (
          <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>No se encontraron pacientes</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Apellido y nombre</th><th>DNI</th><th>Teléfono</th><th>Obra social</th><th>Sesiones</th><th>Estado plan</th><th></th></tr>
              </thead>
              <tbody>
                {filtrados.map(p => (
                  <tr key={p.id} style={{cursor:'pointer'}} onClick={() => navigate(`/pacientes/${p.id}`)}>
                    <td><strong>{p.apellido}</strong> {p.nombre}</td>
                    <td style={{color:'#888'}}>{p.dni}</td>
                    <td>{p.telefono || '—'}</td>
                    <td>{p.obraSocial ? <span className="badge badge-blue">{p.obraSocial}</span> : '—'}</td>
                    <td>{p.plan ? `${p.plan.sesionesUsadas || 0} / ${p.plan.sesionesTotal}` : '—'}</td>
                    <td>{badgePlan(p)}</td>
                    <td><button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); navigate(`/pacientes/${p.id}`) }}>Ver</button></td>
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
