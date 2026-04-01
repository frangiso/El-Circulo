import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { estadoPlan, diasHabilesRestantes } from '../../utils/helpers'

function BadgePlan({ p }) {
  if (!p?.plan) return <span className="badge badge-gray">Sin plan</span>
  const est = estadoPlan(p.plan.sesionesUsadas || 0, p.plan.sesionesTotal, p.plan.fechaVencimiento)
  if (est === 'vencido') return <span className="badge badge-red">Vencido</span>
  if (est === 'por-vencer') {
    const dias = diasHabilesRestantes(p.plan.fechaVencimiento)
    return <span className="badge badge-amber">{dias} días restantes</span>
  }
  return <span className="badge badge-green">Vigente</span>
}

export default function Turnos() {
  const navigate = useNavigate()
  const [turnos, setTurnos] = useState([])
  const [pacientes, setPacientes] = useState({})
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [busqueda, setBusqueda] = useState('')
  const [kineFiltro, setKineFiltro] = useState('')
  const [kines, setKines] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDocs(query(collection(db, 'usuarios'), where('rol', 'in', ['kinesiologo', 'dueno'])))
      .then(snap => setKines(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      let q = query(collection(db, 'turnos'), where('fecha', '==', fecha), orderBy('hora'))
      const snap = await getDocs(q)
      const ts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setTurnos(ts)

      // Cargar datos de pacientes
      const ids = [...new Set(ts.map(t => t.pacienteId))]
      const pMap = {}
      for (const id of ids) {
        const pSnap = await getDocs(query(collection(db, 'pacientes'), where('__name__', '==', id)))
        if (!pSnap.empty) pMap[id] = { id: pSnap.docs[0].id, ...pSnap.docs[0].data() }
      }
      setPacientes(pMap)
      setLoading(false)
    }
    cargar()
  }, [fecha])

  const filtrados = turnos.filter(t => {
    const nombre = `${t.pacienteApellido} ${t.pacienteNombre}`.toLowerCase()
    const matchBusq = nombre.includes(busqueda.toLowerCase())
    const matchKine = kineFiltro ? t.kinesiologoId === kineFiltro : true
    return matchBusq && matchKine
  })

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px'}}>
        <h1 style={{fontSize:'20px', fontWeight:'600'}}>Turnos</h1>
        <button className="btn btn-primary" onClick={() => navigate('/turnos/nuevo')}>+ Nuevo turno</button>
      </div>

      <div className="filtros">
        <input placeholder="Buscar paciente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        <select value={kineFiltro} onChange={e => setKineFiltro(e.target.value)}>
          <option value="">Todos los kinesiológos</option>
          {kines.map(k => <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
        </select>
      </div>

      <div className="card" style={{padding:0, overflow:'hidden'}}>
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : filtrados.length === 0 ? (
          <div style={{padding:'40px', textAlign:'center', color:'#888', fontSize:'13px'}}>No hay turnos para esta fecha</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Hora</th><th>Paciente</th><th>DNI</th><th>Obra social</th><th>Kinesiológo</th><th>Sesión</th><th>Estado plan</th><th></th></tr>
              </thead>
              <tbody>
                {filtrados.map(t => (
                  <tr key={t.id}>
                    <td><strong>{t.hora}</strong></td>
                    <td>{t.pacienteApellido} {t.pacienteNombre}</td>
                    <td style={{color:'#888'}}>{t.pacienteDni}</td>
                    <td>{t.obraSocial ? <span className="badge badge-blue">{t.obraSocial}</span> : '—'}</td>
                    <td>{t.kinesiologoNombre}</td>
                    <td>{t.nroSesion ? `${t.nroSesion} / ${pacientes[t.pacienteId]?.plan?.sesionesTotal || '?'}` : '—'}</td>
                    <td><BadgePlan p={pacientes[t.pacienteId]} /></td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/pacientes/${t.pacienteId}`)}>Ver</button>
                    </td>
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
