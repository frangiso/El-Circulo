import { useEffect, useState } from 'react'
import { collection, addDoc, doc, updateDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCache } from '../../context/AppCache'
import { calcVenc, diasHabilesRestantes, estadoPlan, escribirLog, hoy, sumarDiasHabiles } from '../../utils/helpers'

const ILupa = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)

const DIAS_SEMANA = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

export default function NuevoTurno() {
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const { getKines, getPacientes, invalidarPacs } = useCache()
  const [kines, setKines]       = useState([])
  const [pacs, setPacs]         = useState([])
  const [busq, setBusq]         = useState('')
  const [pacSel, setPacSel]     = useState(null)
  const [showDL, setShowDL]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [modo, setModo]         = useState('unico') // 'unico' | 'fijo'

  // Turno único
  const [f, setF] = useState({
    fecha: hoy(), hora: '08:00', kineId: '',
    nroSes: '', totSes: '', fechaIni: ''
  })

  // Turno fijo
  const [fijo, setFijo] = useState({
    diaSemana: '1', // 1=lunes
    hora: '08:00',
    kineId: '',
    tipo: 'semanal', // 'semanal' | 'cantidad'
    cantSesiones: '10',
    fechaDesde: hoy()
  })

  useEffect(() => {
    Promise.all([getKines(), getPacientes()]).then(([k, p]) => { setKines(k); setPacs(p) })
  }, [])

  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const setFj = (k, v) => setFijo(p => ({ ...p, [k]: v }))

  const sugs = busq.length < 2 ? [] : pacs.filter(p =>
    (p.apellido + ' ' + p.nombre + ' ' + (p.dni||'')).toLowerCase().includes(busq.toLowerCase())
  ).slice(0, 8)

  function selec(p) {
    setPacSel(p); setBusq(p.apellido + ' ' + p.nombre); setShowDL(false)
    if (p.plan) {
      setF(prev => ({
        ...prev,
        totSes: p.plan.sesionesTotal || '',
        fechaIni: p.plan.fechaInicio || '',
        nroSes: (p.plan.sesionesUsadas || 0) + 1
      }))
    }
  }

  const venc = f.fechaIni ? calcVenc(f.fechaIni) : null
  const dias = venc ? diasHabilesRestantes(venc) : null
  const estPlan = pacSel?.plan ? estadoPlan(pacSel.plan) : null

  // Alerta del plan
  function AlertaPlan() {
    if (!pacSel?.plan) return null
    const est = estadoPlan(pacSel.plan)
    if (est === 'vencido') return (
      <div className="al alr">⚠ El plan de este paciente está vencido. Podés igual agendar el turno.</div>
    )
    if (est === 'por-vencer') {
      const d = diasHabilesRestantes(pacSel.plan.fechaVencimiento)
      return <div className="al ala">⚠ El plan vence en {d} días hábiles.</div>
    }
    return null
  }

  // Generar fechas para turno fijo
  function generarFechasFijas() {
    const fechas = []
    const desde = new Date(fijo.fechaDesde + 'T00:00:00')
    const diaObj = parseInt(fijo.diaSemana)

    // Avanzar hasta el primer día de la semana correcto
    let inicio = new Date(desde)
    while (inicio.getDay() !== diaObj) {
      inicio.setDate(inicio.getDate() + 1)
    }

    if (fijo.tipo === 'cantidad') {
      const cant = parseInt(fijo.cantSesiones) || 1
      for (let i = 0; i < cant; i++) {
        const d = new Date(inicio)
        d.setDate(d.getDate() + i * 7)
        fechas.push(d.toISOString().split('T')[0])
      }
    } else {
      // Semanal por 3 meses
      for (let i = 0; i < 12; i++) {
        const d = new Date(inicio)
        d.setDate(d.getDate() + i * 7)
        fechas.push(d.toISOString().split('T')[0])
      }
    }
    return fechas
  }

  async function guardarUnico(e) {
    e.preventDefault()
    if (!pacSel) return alert('Seleccioná un paciente')
    if (!f.kineId) return alert('Seleccioná un kinesiológo')
    setLoading(true)
    try {
      const kine = kines.find(k => k.id === f.kineId)
      await addDoc(collection(db, 'turnos'), {
        fecha: f.fecha, hora: f.hora,
        pacienteId: pacSel.id, pacienteNombre: pacSel.nombre,
        pacienteApellido: pacSel.apellido, pacienteDni: pacSel.dni || '',
        obraSocial: pacSel.obraSocial || '',
        kinesiologoId: f.kineId,
        kinesiologoNombre: kine.apellido + ' ' + kine.nombre,
        nroSesion: parseInt(f.nroSes) || null,
        asistencia: 'pendiente',
        creadoPor: user.uid,
        creadoPorNombre: perfil.apellido + ' ' + perfil.nombre,
        ts: serverTimestamp()
      })
      if (f.fechaIni || f.totSes) {
        await updateDoc(doc(db, 'pacientes', pacSel.id), {
          plan: {
            sesionesTotal: parseInt(f.totSes) || pacSel.plan?.sesionesTotal,
            sesionesUsadas: pacSel.plan?.sesionesUsadas || 0,
            fechaInicio: f.fechaIni || pacSel.plan?.fechaInicio,
            fechaVencimiento: venc || pacSel.plan?.fechaVencimiento
          }, archivado: false
        })
        invalidarPacs()
      }
      await escribirLog(user.uid, perfil.apellido + ' ' + perfil.nombre, 'Nuevo turno',
        pacSel.apellido + ' ' + pacSel.nombre + ' — ' + f.hora + 'hs')
      navigate('/turnos')
    } catch (err) { console.error(err); alert('Error al guardar') }
    setLoading(false)
  }

  async function guardarFijo(e) {
    e.preventDefault()
    if (!pacSel) return alert('Seleccioná un paciente')
    if (!fijo.kineId) return alert('Seleccioná un kinesiológo')
    setLoading(true)
    try {
      const kine = kines.find(k => k.id === fijo.kineId)
      const fechas = generarFechasFijas()
      const grupoId = Date.now().toString()

      for (let i = 0; i < fechas.length; i++) {
        await addDoc(collection(db, 'turnos'), {
          fecha: fechas[i], hora: fijo.hora,
          pacienteId: pacSel.id, pacienteNombre: pacSel.nombre,
          pacienteApellido: pacSel.apellido, pacienteDni: pacSel.dni || '',
          obraSocial: pacSel.obraSocial || '',
          kinesiologoId: fijo.kineId,
          kinesiologoNombre: kine.apellido + ' ' + kine.nombre,
          nroSesion: (pacSel.plan?.sesionesUsadas || 0) + i + 1,
          asistencia: 'pendiente',
          turnoFijo: true, grupoId,
          creadoPor: user.uid,
          creadoPorNombre: perfil.apellido + ' ' + perfil.nombre,
          ts: serverTimestamp()
        })
      }
      await escribirLog(user.uid, perfil.apellido + ' ' + perfil.nombre, 'Turnos fijos',
        pacSel.apellido + ' ' + pacSel.nombre + ' — ' + fechas.length + ' turnos los ' + DIAS_SEMANA[parseInt(fijo.diaSemana)])
      navigate('/turnos')
    } catch (err) { console.error(err); alert('Error al guardar') }
    setLoading(false)
  }

  const fechasPreview = modo === 'fijo' && fijo.fechaDesde ? generarFechasFijas().slice(0, 3) : []

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="row" style={{ marginBottom: 20 }}>
        <button className="btn bs bsm" onClick={() => navigate(-1)}>← Volver</button>
        <div className="ptitle">Nuevo turno</div>
      </div>

      {/* Selector modo */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={'tab ' + (modo === 'unico' ? 'on' : '')} onClick={() => setModo('unico')}>Turno único</button>
        <button className={'tab ' + (modo === 'fijo' ? 'on' : '')} onClick={() => setModo('fijo')}>Turno fijo / recurrente</button>
      </div>

      {/* Buscador paciente — compartido */}
      <div className="card">
        <div className="card-title">Paciente</div>
        <div className="ff" style={{ position: 'relative' }}>
          <label>Buscar paciente *</label>
          <div className="sw">
            <ILupa />
            <input className="si" value={busq}
              onChange={e => { setBusq(e.target.value); setShowDL(true); if (!e.target.value) setPacSel(null) }}
              onFocus={() => setShowDL(true)}
              placeholder="Escribí 2+ letras..." autoComplete="off" />
          </div>
          {showDL && sugs.length > 0 && (
            <div className="dl">
              {sugs.map(p => (
                <div key={p.id} className="di" onClick={() => selec(p)}>
                  <strong>{p.apellido} {p.nombre}</strong>
                  <span className="cgr" style={{ marginLeft: 8 }}>DNI {p.dni}</span>
                  {p.obraSocial && <span className="badge bb" style={{ marginLeft: 8 }}>{p.obraSocial}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        {pacSel && <AlertaPlan />}
      </div>

      {/* TURNO ÚNICO */}
      {modo === 'unico' && (
        <form onSubmit={guardarUnico}>
          <div className="card">
            <div className="card-title">Datos del turno</div>
            <div className="fg">
              <div className="ff">
                <label>Fecha *</label>
                <input type="date" value={f.fecha} onChange={e => set('fecha', e.target.value)} required />
              </div>
              <div className="ff">
                <label>Hora * (formato HH:MM, ej: 08:30)</label>
                <input type="text" value={f.hora}
                  onChange={e => set('hora', e.target.value)}
                  placeholder="08:00" pattern="^([01]\d|2[0-3]):[0-5]\d$"
                  title="Formato HH:MM entre 08:00 y 20:00" required />
              </div>
              <div className="ff">
                <label>Kinesiológo *</label>
                <select value={f.kineId} onChange={e => set('kineId', e.target.value)} required>
                  <option value="">Seleccioná...</option>
                  {kines.map(k => <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
                </select>
              </div>
              <div className="ff">
                <label>N° de sesión</label>
                <input type="number" min="1" value={f.nroSes} onChange={e => set('nroSes', e.target.value)} placeholder="Ej: 5" />
              </div>
            </div>
          </div>

          {venc && (
            <div className={'al ' + (dias <= 0 ? 'alr' : dias <= 10 ? 'ala' : 'alb')}>
              Plan: {f.totSes} sesiones · Vence: {venc} · {dias} días hábiles restantes
            </div>
          )}

          <div className="card">
            <div className="card-title">Plan del paciente</div>
            <div className="fg">
              <div className="ff">
                <label>Total sesiones autorizadas</label>
                <input type="number" min="1" value={f.totSes} onChange={e => set('totSes', e.target.value)} placeholder="Ej: 10" />
              </div>
              <div className="ff">
                <label>Fecha de inicio del plan</label>
                <input type="date" value={f.fechaIni} onChange={e => set('fechaIni', e.target.value)} />
              </div>
            </div>
            <div className="hint" style={{ marginTop: 8 }}>El vencimiento se calcula a 45 días hábiles desde el inicio.</div>
          </div>

          <div className="re">
            <button type="button" className="btn bs" onClick={() => navigate(-1)}>Cancelar</button>
            <button type="submit" className="btn bp" disabled={loading}>{loading ? 'Guardando...' : 'Guardar turno'}</button>
          </div>
        </form>
      )}

      {/* TURNO FIJO */}
      {modo === 'fijo' && (
        <form onSubmit={guardarFijo}>
          <div className="card">
            <div className="card-title">Configuración del turno fijo</div>
            <div className="fg">
              <div className="ff">
                <label>Día de la semana *</label>
                <select value={fijo.diaSemana} onChange={e => setFj('diaSemana', e.target.value)} required>
                  <option value="1">Lunes</option>
                  <option value="2">Martes</option>
                  <option value="3">Miércoles</option>
                  <option value="4">Jueves</option>
                  <option value="5">Viernes</option>
                  <option value="6">Sábado</option>
                </select>
              </div>
              <div className="ff">
                <label>Hora * (formato HH:MM, ej: 08:30)</label>
                <input type="text" value={fijo.hora}
                  onChange={e => setFj('hora', e.target.value)}
                  placeholder="08:00" pattern="^([01]\d|2[0-3]):[0-5]\d$"
                  title="Formato HH:MM entre 08:00 y 20:00" required />
              </div>
              <div className="ff">
                <label>Kinesiológo *</label>
                <select value={fijo.kineId} onChange={e => setFj('kineId', e.target.value)} required>
                  <option value="">Seleccioná...</option>
                  {kines.map(k => <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
                </select>
              </div>
              <div className="ff">
                <label>Fecha de inicio *</label>
                <input type="date" value={fijo.fechaDesde} onChange={e => setFj('fechaDesde', e.target.value)} required />
              </div>
              <div className="ff">
                <label>Tipo de repetición</label>
                <select value={fijo.tipo} onChange={e => setFj('tipo', e.target.value)}>
                  <option value="semanal">Semanal (12 semanas)</option>
                  <option value="cantidad">Por cantidad de sesiones</option>
                </select>
              </div>
              {fijo.tipo === 'cantidad' && (
                <div className="ff">
                  <label>Cantidad de sesiones</label>
                  <input type="number" min="1" max="52" value={fijo.cantSesiones}
                    onChange={e => setFj('cantSesiones', e.target.value)} />
                </div>
              )}
            </div>
            {fechasPreview.length > 0 && (
              <div className="al alb" style={{ marginTop: 12, marginBottom: 0 }}>
                Se van a crear {fijo.tipo === 'cantidad' ? fijo.cantSesiones : 12} turnos.
                Primeras fechas: {fechasPreview.map(f => {
                  const [y,m,d] = f.split('-'); return d+'/'+m
                }).join(', ')}...
              </div>
            )}
          </div>

          <div className="re">
            <button type="button" className="btn bs" onClick={() => navigate(-1)}>Cancelar</button>
            <button type="submit" className="btn bp" disabled={loading}>
              {loading ? 'Creando turnos...' : 'Crear turnos fijos'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
