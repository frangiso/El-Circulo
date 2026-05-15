import { useEffect, useState } from 'react'
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, addDoc, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate, useParams } from 'react-router-dom'
import { useCache } from '../../context/AppCache'
import { useAuth } from '../../context/AuthContext'
import { estadoPlan, diasHabilesRestantes, hoy } from '../../utils/helpers'

function fmtFecha(s) {
  if (!s) return '—'
  const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`
}

export default function FichaPaciente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const { getKines, invalidarPacs } = useCache()
  const [pac, setPac]         = useState(null)
  const [turnos, setTurnos]   = useState([])
  const [kines, setKines]     = useState([])
  const [carg, setCarg]       = useState(true)
  // Estado del registro rápido
  const [kineSelId, setKineSelId] = useState('')
  const [registrando, setRegistrando] = useState(false)
  const [exito, setExito]     = useState(false)

  useEffect(() => {
    async function cargar() {
      const [snap, k, tsSnap] = await Promise.all([
        getDoc(doc(db, 'pacientes', id)),
        getKines(),
        getDocs(query(collection(db,'turnos'), where('pacienteId','==',id), orderBy('fecha','desc')))
      ])
      if (!snap.exists()) { navigate('/pacientes'); return }
      const p = { id: snap.id, ...snap.data() }

      // Archivar si plan vencido
      if (!p.archivado && p.plan && estadoPlan(p.plan) === 'vencido') {
        await updateDoc(doc(db,'pacientes',id), {
          archivado: true, fechaArchivado: hoy()
        })
        p.archivado = true
        invalidarPacs()
      }

      setPac(p)
      setKines(k)
      if (k.length > 0) setKineSelId(k[0].id)
      setTurnos(tsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCarg(false)
    }
    cargar()
  }, [id])

  async function registrarSesion() {
    if (!kineSelId) return alert('Seleccioná un kinesiológo')
    setRegistrando(true)
    try {
      const kine = kines.find(k => k.id === kineSelId)
      const hoyStr = hoy()
      const nuevasUsadas = (pac.plan?.sesionesUsadas || 0) + 1
      const nroSesion = nuevasUsadas

      // Batch: crear turno + descontar sesión en 1 operación
      const batch = writeBatch(db)

      const turnoRef = doc(collection(db, 'turnos'))
      batch.set(turnoRef, {
        fecha: hoyStr,
        hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        pacienteId: id,
        pacienteNombre: pac.nombre,
        pacienteApellido: pac.apellido,
        pacienteDni: pac.dni || '',
        obraSocial: pac.obraSocial || '',
        kinesiologoId: kineSelId,
        kinesiologoNombre: kine.apellido + ' ' + kine.nombre,
        nroSesion,
        asistencia: 'asistio',
        asistenciaTs: serverTimestamp(),
        creadoPor: user.uid,
        creadoPorNombre: perfil.apellido + ' ' + perfil.nombre,
        ts: serverTimestamp()
      })

      batch.update(doc(db, 'pacientes', id), {
        'plan.sesionesUsadas': nuevasUsadas
      })

      await batch.commit()

      // Actualizar estado local
      const nuevoTurno = {
        id: turnoRef.id,
        fecha: hoyStr,
        hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        kinesiologoNombre: kine.apellido + ' ' + kine.nombre,
        nroSesion,
        asistencia: 'asistio'
      }
      setTurnos(prev => [nuevoTurno, ...prev])
      setPac(prev => ({
        ...prev,
        plan: { ...prev.plan, sesionesUsadas: nuevasUsadas }
      }))
      invalidarPacs()
      setExito(true)
      setTimeout(() => setExito(false), 3000)
    } catch(err) {
      console.error(err)
      alert('Error al registrar la sesión')
    }
    setRegistrando(false)
  }

  if (carg) return <div className="sc"><div className="sp" /></div>
  if (!pac) return null

  const { plan } = pac
  const est  = plan ? estadoPlan(plan) : 'sin-plan'
  const arch = pac.archivado === true
  const dias = plan?.fechaVencimiento ? diasHabilesRestantes(plan.fechaVencimiento) : null
  const ini  = ((pac.nombre?.[0] || '') + (pac.apellido?.[0] || '')).toUpperCase()
  const sesRestantes = plan ? (plan.sesionesTotal - (plan.sesionesUsadas || 0)) : null

  return (
    <div>
      <div className="row" style={{ marginBottom: 20 }}>
        <button className="btn bs bsm" onClick={() => navigate('/pacientes')}>← Volver</button>
        <div className="ptitle" style={{ flex: 1 }}>Ficha de paciente</div>
        <button className="btn bs bsm" onClick={() => navigate(`/pacientes/${id}/editar`)}>
          {arch ? 'Reactivar / Editar' : 'Editar'}
        </button>
        {!arch && (
          <button className="btn bp bsm" onClick={() => navigate('/turnos/nuevo')}>+ Turno</button>
        )}
      </div>

      {arch && <div className="al ala">Paciente archivado — plan vencido. Hacé clic en "Reactivar / Editar" para cargarlo de nuevo.</div>}
      {est === 'por-vencer' && !arch && <div className="al ala">⚠ El plan vence en {dias} días hábiles.</div>}
      {est === 'vencido' && !arch && <div className="al alr">⚠ El plan está vencido.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Datos personales */}
        <div className="card">
          <div className="row" style={{ marginBottom: 14 }}>
            <div className="av avl" style={{ opacity: arch ? .5 : 1 }}>{ini}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{pac.apellido} {pac.nombre}</div>
              <div style={{ fontSize: 12, color: '#888' }}>DNI {pac.dni || '—'}</div>
              {arch && <span className="badge bk" style={{ marginTop: 4 }}>Archivado</span>}
            </div>
          </div>
          <div className="div" />
          <table style={{ width: '100%', fontSize: 13 }}>
            <tbody>
              <tr><td style={{ color: '#888', padding: '4px 0', width: '40%' }}>Teléfono</td><td style={{ padding: '4px 0' }}>{pac.telefono || '—'}</td></tr>
              <tr><td style={{ color: '#888', padding: '4px 0' }}>Obra social</td><td style={{ padding: '4px 0' }}>{pac.obraSocial ? <span className="badge bb">{pac.obraSocial}</span> : '—'}</td></tr>
              <tr><td style={{ color: '#888', padding: '4px 0' }}>N° afiliado</td><td style={{ padding: '4px 0' }}>{pac.nroAfiliado || '—'}</td></tr>
              <tr><td style={{ color: '#888', padding: '4px 0' }}>Diagnóstico</td><td style={{ padding: '4px 0' }}>{pac.diagnostico || '—'}</td></tr>
              {pac.observaciones && <tr><td style={{ color: '#888', padding: '4px 0' }}>Obs.</td><td style={{ padding: '4px 0' }}>{pac.observaciones}</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Estado del plan */}
        <div className="card">
          <div className="card-title">Estado del plan</div>
          {!plan ? (
            <div style={{ color: '#888', fontSize: 13 }}>
              Sin plan cargado.{' '}
              <button className="btn bs bsm" onClick={() => navigate(`/pacientes/${id}/editar`)}>Cargar plan</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div className="met">
                  <div className="met-l">Sesiones</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--az)' }}>
                    {plan.sesionesUsadas || 0}/{plan.sesionesTotal}
                  </div>
                </div>
                <div className="met">
                  <div className="met-l">Días hábiles</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: dias <= 0 ? 'var(--ro)' : dias <= 10 ? 'var(--na)' : 'var(--ve)' }}>
                    {dias ?? '—'}
                  </div>
                </div>
              </div>
              <table style={{ width: '100%', fontSize: 13 }}>
                <tbody>
                  <tr><td style={{ color: '#888', padding: '4px 0', width: '40%' }}>Inicio</td><td style={{ padding: '4px 0' }}>{fmtFecha(plan.fechaInicio)}</td></tr>
                  <tr><td style={{ color: '#888', padding: '4px 0' }}>Vencimiento</td><td style={{ padding: '4px 0' }}>{fmtFecha(plan.fechaVencimiento)}</td></tr>
                  <tr><td style={{ color: '#888', padding: '4px 0' }}>Estado</td><td style={{ padding: '4px 0' }}>
                    {est === 'vencido' && <span className="badge br">Vencido</span>}
                    {est === 'por-vencer' && <span className="badge ba">Por vencer</span>}
                    {est === 'vigente' && <span className="badge bg">Vigente</span>}
                  </td></tr>
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {/* REGISTRO RÁPIDO DE SESIÓN */}
      {!arch && plan && est !== 'vencido' && (
        <div className="card" style={{ marginBottom: 14, borderLeft: '3px solid var(--az)' }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Registrar sesión de hoy</div>
          {sesRestantes !== null && sesRestantes <= 0 ? (
            <div className="al alr" style={{ marginBottom: 0 }}>
              No quedan sesiones disponibles en el plan actual.
            </div>
          ) : (
            <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
              <select
                value={kineSelId}
                onChange={e => setKineSelId(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, flex: 1, minWidth: 200 }}
              >
                <option value="">Seleccioná kinesiológo...</option>
                {kines.map(k => (
                  <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>
                ))}
              </select>
              <button
                className="btn bp"
                onClick={registrarSesion}
                disabled={registrando || !kineSelId}
                style={{ minWidth: 140 }}
              >
                {registrando ? 'Registrando...' : '✓ Marcar asistencia'}
              </button>
              {exito && (
                <div className="badge bg" style={{ padding: '8px 14px', fontSize: 13 }}>
                  ✓ Sesión registrada — quedan {sesRestantes - 1} sesiones
                </div>
              )}
            </div>
          )}
          {sesRestantes !== null && sesRestantes <= 3 && sesRestantes > 0 && (
            <div style={{ fontSize: 12, color: 'var(--na)', marginTop: 8 }}>
              ⚠ Quedan solo {sesRestantes} sesión{sesRestantes > 1 ? 'es' : ''} en el plan
            </div>
          )}
        </div>
      )}

      {/* Historial */}
      <div className="card">
        <div className="card-title">Historial de sesiones ({turnos.length})</div>
        {turnos.length === 0 ? (
          <div className="emt">Sin turnos registrados</div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Hora</th><th>Kinesiológo</th><th>Sesión N°</th><th>Asistencia</th></tr>
              </thead>
              <tbody>
                {turnos.map(t => (
                  <tr key={t.id}>
                    <td>{fmtFecha(t.fecha)}</td>
                    <td>{t.hora || '—'}</td>
                    <td>{t.kinesiologoNombre}</td>
                    <td>{t.nroSesion || '—'}</td>
                    <td>
                      {t.asistencia === 'asistio' && <span className="badge bg">Asistió</span>}
                      {t.asistencia === 'falto' && <span className="badge br">Faltó</span>}
                      {(!t.asistencia || t.asistencia === 'pendiente') && <span className="badge bk">Pendiente</span>}
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
