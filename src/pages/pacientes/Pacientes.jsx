import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCache } from '../../context/AppCache'
import { estadoPlan, diasHabilesRestantes } from '../../utils/helpers'

const ILupa = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
)

function PlanBadge({ p }) {
  if (!p || !p.plan) return <span className="badge bk">Sin plan</span>
  const e = estadoPlan(p.plan)
  if (e === 'vencido') return <span className="badge br">Vencido</span>
  if (e === 'por-vencer') return <span className="badge ba">{diasHabilesRestantes(p.plan.fechaVencimiento)} días</span>
  return <span className="badge bg">Vigente</span>
}

export default function Pacientes() {
  const navigate = useNavigate()
  const { getPacientes, getArchivados } = useCache()
  const [todos, setTodos]         = useState([])
  const [archivados, setArchivados] = useState([])
  const [archCargados, setArchCarg] = useState(false)
  const [tab, setTab]             = useState('activos')
  const [busq, setBusq]           = useState('')
  const [filtroOS, setFiltroOS]   = useState('')
  const [buscado, setBuscado]     = useState(false)
  const [cargArch, setCargArch]   = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    getPacientes().then(setTodos)
  }, [])

  async function irArchivados() {
    setTab('archivados')
    setBusq('')
    setFiltroOS('')
    setBuscado(false)
    if (!archCargados) {
      setCargArch(true)
      const d = await getArchivados()
      setArchivados(d)
      setArchCarg(true)
      setCargArch(false)
    }
  }

  function onBusqChange(v) {
    setBusq(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setBuscado(v.trim().length > 0 || filtroOS.length > 0)
    }, 300)
  }

  function onOSChange(v) {
    setFiltroOS(v)
    setBuscado(v.length > 0 || busq.trim().length > 0)
  }

  const lista = tab === 'activos' ? todos : archivados
  const obras = [...new Set(todos.map(p => p.obraSocial).filter(Boolean))].sort()

  const visibles = !buscado ? [] : lista.filter(p => {
    const txt = (p.apellido + ' ' + p.nombre + ' ' + (p.dni || '')).toLowerCase()
    const matchB = txt.includes(busq.toLowerCase())
    const matchOS = filtroOS ? p.obraSocial === filtroOS : true
    return matchB && matchOS
  })

  return (
    <div>
      <div className="ph">
        <div className="ptitle">Pacientes</div>
        <button className="btn bp" onClick={() => navigate('/pacientes/nuevo')}>+ Nuevo paciente</button>
      </div>

      <div className="tabs">
        <button
          className={'tab ' + (tab === 'activos' ? 'on' : '')}
          onClick={() => { setTab('activos'); setBusq(''); setFiltroOS(''); setBuscado(false) }}
        >
          Activos ({todos.length})
        </button>
        <button
          className={'tab ' + (tab === 'archivados' ? 'on' : '')}
          onClick={irArchivados}
        >
          Archivados {archCargados ? '(' + archivados.length + ')' : ''}
        </button>
      </div>

      {tab === 'archivados' && (
        <div className="al alb">
          Pacientes con plan vencido. Para reactivar, entrá a la ficha y cargá un plan nuevo.
        </div>
      )}

      <div className="filtros">
        <div className="sw" style={{ flex: 1, minWidth: 200 }}>
          <ILupa />
          <input
            className="si"
            placeholder="Buscar por nombre o DNI..."
            value={busq}
            onChange={e => onBusqChange(e.target.value)}
          />
        </div>
        <select value={filtroOS} onChange={e => onOSChange(e.target.value)}>
          <option value="">Todas las obras sociales</option>
          {obras.map(os => (
            <option key={os} value={os}>{os}</option>
          ))}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {cargArch ? (
          <div className="sc"><div className="sp" /></div>
        ) : !buscado ? (
          <div className="empty-search">
            <ILupa />
            <p>Buscá un paciente para ver resultados</p>
            <span>Escribí el nombre, apellido o DNI en el buscador</span>
          </div>
        ) : visibles.length === 0 ? (
          <div className="emt">No se encontraron pacientes</div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Apellido y nombre</th>
                  <th>DNI</th>
                  <th>Teléfono</th>
                  <th>Obra social</th>
                  <th>Sesiones</th>
                  <th>Plan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(p => (
                  <tr
                    key={p.id}
                    style={{ opacity: tab === 'archivados' ? 0.7 : 1 }}
                    onClick={() => navigate('/pacientes/' + p.id)}
                  >
                    <td><strong>{p.apellido}</strong> {p.nombre}</td>
                    <td className="cgr">{p.dni || '—'}</td>
                    <td>{p.telefono || '—'}</td>
                    <td>
                      {p.obraSocial
                        ? <span className="badge bb">{p.obraSocial}</span>
                        : '—'}
                    </td>
                    <td>
                      {p.plan
                        ? (p.plan.sesionesUsadas || 0) + ' / ' + p.plan.sesionesTotal
                        : '—'}
                    </td>
                    <td><PlanBadge p={p} /></td>
                    <td>
                      <button
                        className="btn bs bsm"
                        onClick={e => { e.stopPropagation(); navigate('/pacientes/' + p.id) }}
                      >
                        Ver
                      </button>
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
