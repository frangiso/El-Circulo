import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function getMesActual() {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}`
}

function getMeses() {
  const meses = []
  const h = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(h.getFullYear(), h.getMonth() - i, 1)
    meses.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }
  return meses
}

function labelMes(str) {
  if (!str) return ''
  const [y, m] = str.split('-')
  return `${MESES[parseInt(m)-1]} ${y}`
}

const fmt = n => `$${Number(n).toLocaleString('es-AR', {minimumFractionDigits:0})}`

export default function Reportes() {
  const [mes, setMes] = useState(getMesActual())
  const [kines, setKines] = useState([])
  const [secretarias, setSecretarias] = useState([])
  const [turnos, setTurnos] = useState([])
  const [caja, setCaja] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const [y, m] = mes.split('-')
      const fechaInicio = `${y}-${m}-01`
      const ultimoDia = new Date(parseInt(y), parseInt(m), 0).getDate()
      const fechaFin = `${y}-${m}-${String(ultimoDia).padStart(2,'0')}`

      const [usuariosSnap, turnosSnap, cajaSnap, pacSnap] = await Promise.all([
        getDocs(collection(db, 'usuarios')),
        getDocs(query(collection(db, 'turnos'), where('fecha', '>=', fechaInicio), where('fecha', '<=', fechaFin))),
        getDocs(query(collection(db, 'caja'), where('mes', '==', mes))),
        getDocs(collection(db, 'pacientes'))
      ])

      const usuarios = usuariosSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setKines(usuarios.filter(u => ['kinesiologo','dueno'].includes(u.rol)))
      setSecretarias(usuarios.filter(u => u.rol === 'secretaria'))
      setTurnos(turnosSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCaja(cajaSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setPacientes(pacSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }
    cargar()
  }, [mes])

  const totalEntradas = caja.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.importe, 0)
  const totalSalidas = caja.filter(m => m.tipo === 'salida').reduce((s, m) => s + m.importe, 0)

  const resumenKines = kines.map(k => {
    const ts = turnos.filter(t => t.kinesiologoId === k.id)
    const pacs = [...new Set(ts.map(t => t.pacienteId))]
    return { ...k, sesiones: ts.length, pacientes: pacs.length }
  }).sort((a, b) => b.sesiones - a.sesiones)

  const resumenSec = secretarias.map(s => {
    const ts = turnos.filter(t => t.creadoPor === s.id)
    return { ...s, turnosCargados: ts.length }
  })

  const totalSesiones = turnos.length
  const pacientesActivos = pacientes.length

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px'}}>
        <h1 style={{fontSize:'20px', fontWeight:'600'}}>Reportes</h1>
        <select value={mes} onChange={e => setMes(e.target.value)} style={{padding:'7px 11px', border:'1px solid #ddd', borderRadius:'7px', fontSize:'13px'}}>
          {getMeses().map(m => <option key={m} value={m}>{labelMes(m)}</option>)}
        </select>
      </div>

      {loading ? <div className="loading-center"><div className="spinner" /></div> : <>
        <div className="metric-grid metric-grid-3">
          <div className="metric-card"><div className="metric-label">Sesiones en {labelMes(mes)}</div><div className="metric-value">{totalSesiones}</div></div>
          <div className="metric-card"><div className="metric-label">Facturación del mes</div><div className="metric-value" style={{color:'#3B6D11'}}>{fmt(totalEntradas)}</div></div>
          <div className="metric-card"><div className="metric-label">Pacientes activos</div><div className="metric-value">{pacientesActivos}</div></div>
        </div>

        <div className="card">
          <div className="card-title">Sesiones por kinesiológo — {labelMes(mes)}</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Kinesiológo</th><th>Sesiones realizadas</th><th>Pacientes atendidos</th><th>% del total</th></tr></thead>
              <tbody>
                {resumenKines.length === 0
                  ? <tr><td colSpan="4" style={{textAlign:'center', padding:'20px', color:'#888'}}>Sin sesiones este mes</td></tr>
                  : resumenKines.map(k => (
                    <tr key={k.id}>
                      <td>{k.apellido} {k.nombre}</td>
                      <td>{k.sesiones}</td>
                      <td>{k.pacientes}</td>
                      <td>{totalSesiones > 0 ? ((k.sesiones / totalSesiones) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))
                }
                {resumenKines.length > 0 && (
                  <tr className="total-row">
                    <td>Total</td>
                    <td>{totalSesiones}</td>
                    <td>—</td>
                    <td>100%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Turnos cargados por secretaria — {labelMes(mes)}</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Secretaria</th><th>Turnos cargados</th></tr></thead>
              <tbody>
                {resumenSec.length === 0
                  ? <tr><td colSpan="2" style={{textAlign:'center', padding:'20px', color:'#888'}}>Sin datos</td></tr>
                  : resumenSec.map(s => (
                    <tr key={s.id}>
                      <td>{s.apellido} {s.nombre}</td>
                      <td>{s.turnosCargados}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Resumen financiero — {labelMes(mes)}</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Concepto</th><th>Importe</th></tr></thead>
              <tbody>
                <tr><td>Total entradas</td><td style={{color:'#3B6D11', fontWeight:'500'}}>{fmt(totalEntradas)}</td></tr>
                <tr><td>Total salidas</td><td style={{color:'#A32D2D', fontWeight:'500'}}>-{fmt(totalSalidas)}</td></tr>
                <tr className="total-row"><td>Saldo neto</td><td style={{color:'#185FA5'}}>{fmt(totalEntradas - totalSalidas)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </>}
    </div>
  )
}
