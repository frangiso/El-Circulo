import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, updateDoc, writeBatch, deleteDoc, addDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate, useParams } from 'react-router-dom'
import { useCache } from '../../context/AppCache'
import { useAuth } from '../../context/AuthContext'
import { estadoPlan, diasHabilesRestantes, hoy, mesActual, fmtMonto, esParticular as esPacienteParticular } from '../../utils/helpers'

// Agrega un movimiento de entrada a la caja del mes actual (crea el doc si no existe)
async function agregarMovimientoCaja(mov) {
  const mesStr = mesActual()
  const cajaRef = doc(db, 'caja', 'caja_' + mesStr)
  const cajaSnap = await getDoc(cajaRef)
  if (cajaSnap.exists()) {
    await updateDoc(cajaRef, { movimientos: arrayUnion(mov) })
  } else {
    await setDoc(cajaRef, { mes: mesStr, saldoInicial: 0, movimientos: [mov], creadoEn: serverTimestamp() })
  }
}

function fmtFecha(s) {
  if (!s) return '—'
  const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`
}

const OBRAS_TOKEN = ['SanCor','Prevención','Poder Judicial','OSDE','Galeno','Medife','Swiss Medical','Jerárquicos']

function necesitaToken(obraSocial) {
  if (!obraSocial) return false
  return OBRAS_TOKEN.some(o => obraSocial.toLowerCase().includes(o.toLowerCase()))
}

// Modal recordatorio de token
function ModalToken({ obraSocial, onConfirmar, onCancelar }) {
  return (
    <div className="mo" onClick={e => { if (e.target === e.currentTarget) onCancelar() }}>
      <div className="mc">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔑</div>
          <div className="mt" style={{ marginBottom: 6 }}>Recordatorio de token</div>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
            Este paciente tiene <strong>{obraSocial}</strong>.<br />
            Antes de registrar la sesión, recordá pedirle el <strong>token de autorización</strong> al paciente.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn bs" style={{ flex: 1 }} onClick={onCancelar}>Cancelar</button>
          <button className="btn bp" style={{ flex: 1 }} onClick={onConfirmar}>
            ✓ Token pedido, registrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

// Modal de pago — para registrar sesión particular (pagó / debe) o para saldar una deuda existente
function ModalPago({ soloPago, onConfirmar, onCancelar }) {
  const [pago, setPago] = useState('si')
  const [monto, setMonto] = useState('')
  const [medioPago, setMedioPago] = useState('efectivo')

  function confirmar() {
    if (pago === 'si') {
      if (!monto || parseFloat(monto) <= 0) return alert('Ingresá el monto')
      onConfirmar({ pagado: true, monto: parseFloat(monto), medioPago })
    } else {
      onConfirmar({ pagado: false })
    }
  }

  return (
    <div className="mo" onClick={e => { if (e.target === e.currentTarget) onCancelar() }}>
      <div className="mc">
        <div className="mt" style={{ marginBottom: 14 }}>{soloPago ? 'Registrar pago' : '¿Pagó la sesión?'}</div>
        {!soloPago && (
          <div className="row" style={{ gap: 10, marginBottom: 14 }}>
            <button type="button" className={'btn ' + (pago === 'si' ? 'bp' : 'bs')} style={{ flex: 1 }} onClick={() => setPago('si')}>Sí, pagó</button>
            <button type="button" className={'btn ' + (pago === 'no' ? 'bd' : 'bs')} style={{ flex: 1 }} onClick={() => setPago('no')}>No, queda debiendo</button>
          </div>
        )}
        {pago === 'si' && (
          <div className="fg" style={{ marginBottom: 14 }}>
            <div className="ff">
              <label>Monto *</label>
              <input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej: 8500" autoFocus />
            </div>
            <div className="ff">
              <label>Medio de pago</label>
              <select value={medioPago} onChange={e => setMedioPago(e.target.value)}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
          </div>
        )}
        <div className="re">
          <button type="button" className="btn bs" onClick={onCancelar}>Cancelar</button>
          <button type="button" className="btn bp" onClick={confirmar}>Confirmar</button>
        </div>
      </div>
    </div>
  )
}

function FilaTurno({ turno, kines, onEliminarAsistencia, onCambiarKine, onMarcarPagada }) {
  const [editandoKine, setEditandoKine] = useState(false)
  const [loadingK, setLoadingK] = useState(false)
  const [loadingE, setLoadingE] = useState(false)
  const [modalLiquidar, setModalLiquidar] = useState(false)
  const [liquidando, setLiquidando] = useState(false)

  async function liquidar(pagoInfo) {
    setModalLiquidar(false)
    setLiquidando(true)
    await onMarcarPagada(turno, pagoInfo)
    setLiquidando(false)
  }

  async function cambiarKine(kineId) {
    if (!kineId || kineId === turno.kinesiologoId) { setEditandoKine(false); return }
    setLoadingK(true)
    await onCambiarKine(turno, kineId)
    setEditandoKine(false)
    setLoadingK(false)
  }

  async function eliminar() {
    if (!window.confirm('¿Eliminar la asistencia? Se devolverá la sesión al plan.')) return
    setLoadingE(true)
    await onEliminarAsistencia(turno)
    setLoadingE(false)
  }

  return (
    <tr style={turno.autorizado === false ? { background: 'rgba(220,53,69,0.06)' } : undefined}>
      <td style={turno.autorizado === false ? { color: 'var(--ro)' } : undefined}>{fmtFecha(turno.fecha)}</td>
      <td>{turno.hora || '—'}</td>
      <td>
        {editandoKine ? (
          <select autoFocus defaultValue={turno.kinesiologoId}
            onChange={e => cambiarKine(e.target.value)}
            onBlur={() => setEditandoKine(false)}
            disabled={loadingK}
            style={{ fontSize: 12, padding: '3px 6px', border: '1px solid var(--az)', borderRadius: 6 }}>
            <option value="">Seleccioná...</option>
            {kines.map(k => <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
          </select>
        ) : (
          <div className="row" style={{ gap: 4 }}>
            <span>{turno.kinesiologoNombre}</span>
            <button className="btn bs bsm" style={{ fontSize: 10, padding: '2px 6px' }}
              onClick={() => setEditandoKine(true)} title="Cambiar kinesiológo">✎</button>
          </div>
        )}
      </td>
      <td>
        {turno.autorizado === false
          ? <span className="badge br" title="Se descuenta del plan cuando se cargue la autorización">No autorizado</span>
          : (turno.nroSesion || '—')
        }
      </td>
      <td>
        {modalLiquidar && (
          <ModalPago soloPago onConfirmar={liquidar} onCancelar={() => setModalLiquidar(false)} />
        )}
        {turno.asistencia === 'asistio' && (
          <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
            <span className="badge bg">Asistió</span>
            {turno.pagado === true && <span className="badge bg" title={turno.medioPago}>Pagó {turno.monto ? fmtMonto(turno.monto) : ''}</span>}
            {turno.pagado === false && <span className="badge ba">Debe</span>}
            {turno.pagado === false && (
              <button className="btn bs bsm" style={{ fontSize: 10, padding: '2px 6px' }}
                onClick={() => setModalLiquidar(true)} disabled={liquidando}>
                {liquidando ? '...' : 'Marcar pagada'}
              </button>
            )}
            <button className="btn bs bsm" style={{ fontSize: 10, padding: '2px 6px', color: 'var(--ro)' }}
              onClick={eliminar} disabled={loadingE} title="Eliminar asistencia">✕</button>
          </div>
        )}
        {turno.asistencia === 'falto' && <span className="badge br">Faltó</span>}
        {(!turno.asistencia || turno.asistencia === 'pendiente') && (
          <div className="row" style={{ gap: 4 }}>
            <span className="badge bk">Pendiente</span>
            <button className="btn bs bsm" style={{ fontSize: 10, padding: '2px 6px', color: 'var(--ro)' }}
              onClick={eliminar} disabled={loadingE} title="Eliminar turno">✕</button>
          </div>
        )}
      </td>
    </tr>
  )
}

export default function FichaPaciente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const { getKines, invalidarPacs } = useCache()
  const [pac, setPac]             = useState(null)
  const [turnos, setTurnos]       = useState([])
  const [kines, setKines]         = useState([])
  const [carg, setCarg]           = useState(true)
  const [kineSelId, setKineSelId] = useState('')
  const [registrando, setRegistrando] = useState(false)
  const [exito, setExito]         = useState(false)
  const [modalToken, setModalToken] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [kineRefNombre, setKineRefNombre] = useState(null)
  const [modoRegistro, setModoRegistro] = useState('normal')
  const [fechaRegistro, setFechaRegistro] = useState(hoy())
  const [modalPago, setModalPago] = useState(false)

  useEffect(() => {
    async function cargar() {
      const [snap, k, tsSnap] = await Promise.all([
        getDoc(doc(db,'pacientes',id)),
        getKines(),
        getDocs(query(collection(db,'turnos'), where('pacienteId','==',id), orderBy('fecha','desc')))
      ])
      if (!snap.exists()) { navigate('/pacientes'); return }
      const p = { id: snap.id, ...snap.data() }
      if (!esPacienteParticular(p) && !p.archivado && p.plan && estadoPlan(p.plan) === 'vencido') {
        await updateDoc(doc(db,'pacientes',id), { archivado: true, fechaArchivado: hoy() })
        p.archivado = true; invalidarPacs()
      }
      setPac(p); setKines(k)
      setTurnos(tsSnap.docs.map(d => ({ id: d.id, ...d.data() })))

      const refId = p.plan?.kinesiologoRef
      if (refId) {
        const enCache = k.find(x => x.id === refId)
        if (enCache) setKineRefNombre(`${enCache.apellido} ${enCache.nombre}`)
        else {
          const rSnap = await getDoc(doc(db,'kinesiologos',refId))
          setKineRefNombre(rSnap.exists() ? `${rSnap.data().apellido} ${rSnap.data().nombre}` : null)
        }
      }
      // Preseleccionar el kinesiológo referente del plan; si no está activo o no hay, el primero de la lista
      if (refId && k.some(x => x.id === refId)) setKineSelId(refId)
      else if (k.length > 0) setKineSelId(k[0].id)
      setCarg(false)
    }
    cargar()
  }, [id])

  // Intento de registrar sesión — verifica si necesita token primero
  function intentarRegistrar() {
    if (!kineSelId) return alert('Seleccioná un kinesiológo')
    if (!fechaRegistro) return alert('Seleccioná una fecha')
    setModoRegistro('normal')
    if (necesitaToken(pac.obraSocial)) {
      setModalToken(true) // mostrar recordatorio
    } else {
      registrarSesion()
    }
  }

  // Registro de asistencia sin sesiones autorizadas todavía — requiere confirmación explícita
  function intentarRegistrarSinAutorizacion() {
    if (!kineSelId) return alert('Seleccioná un kinesiológo')
    if (!fechaRegistro) return alert('Seleccioná una fecha')
    if (!window.confirm('Este paciente todavía no tiene sesiones autorizadas. ¿Registrar la asistencia igual como NO AUTORIZADA? Se descontará del plan apenas se cargue la autorización.')) return
    setModoRegistro('sinAutorizacion')
    if (necesitaToken(pac.obraSocial)) {
      setModalToken(true)
    } else {
      registrarSesionSinAutorizacion()
    }
  }

  async function registrarSesion() {
    setModalToken(false)
    setRegistrando(true)
    try {
      const kine = kines.find(k => k.id === kineSelId)
      const fechaStr = fechaRegistro || hoy()
      const nuevasUsadas = (pac.plan?.sesionesUsadas || 0) + 1
      const batch = writeBatch(db)
      const turnoRef = doc(collection(db,'turnos'))
      batch.set(turnoRef, {
        fecha: fechaStr,
        hora: new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}),
        pacienteId: id,
        pacienteNombre: pac.nombre, pacienteApellido: pac.apellido,
        pacienteDni: pac.dni || '', obraSocial: pac.obraSocial || '',
        kinesiologoId: kineSelId,
        kinesiologoNombre: kine.apellido + ' ' + kine.nombre,
        nroSesion: nuevasUsadas,
        asistencia: 'asistio', asistenciaTs: serverTimestamp(),
        creadoPor: user.uid,
        creadoPorNombre: perfil.apellido + ' ' + perfil.nombre,
        ts: serverTimestamp()
      })
      batch.update(doc(db,'pacientes',id), { 'plan.sesionesUsadas': nuevasUsadas })
      await batch.commit()
      const nuevoT = {
        id: turnoRef.id, fecha: fechaStr,
        hora: new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}),
        kinesiologoId: kineSelId,
        kinesiologoNombre: kine.apellido + ' ' + kine.nombre,
        nroSesion: nuevasUsadas, asistencia: 'asistio'
      }
      setTurnos(prev => [...prev, nuevoT].sort((a,b) => (b.fecha||'').localeCompare(a.fecha||'')))
      setPac(prev => ({ ...prev, plan: { ...prev.plan, sesionesUsadas: nuevasUsadas } }))
      invalidarPacs()
      setFechaRegistro(hoy())
      setExito(true)
      setTimeout(() => setExito(false), 3000)
    } catch(err) { console.error(err); alert('Error al registrar') }
    setRegistrando(false)
  }

  // Registra asistencia sin plan/sesiones autorizadas — queda marcada en rojo hasta que se cargue el plan
  async function registrarSesionSinAutorizacion() {
    setModalToken(false)
    setRegistrando(true)
    try {
      const kine = kines.find(k => k.id === kineSelId)
      const fechaStr = fechaRegistro || hoy()
      const nuevoRef = await addDoc(collection(db,'turnos'), {
        fecha: fechaStr,
        hora: new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}),
        pacienteId: id,
        pacienteNombre: pac.nombre, pacienteApellido: pac.apellido,
        pacienteDni: pac.dni || '', obraSocial: pac.obraSocial || '',
        kinesiologoId: kineSelId,
        kinesiologoNombre: kine.apellido + ' ' + kine.nombre,
        nroSesion: null,
        autorizado: false,
        asistencia: 'asistio', asistenciaTs: serverTimestamp(),
        creadoPor: user.uid,
        creadoPorNombre: perfil.apellido + ' ' + perfil.nombre,
        ts: serverTimestamp()
      })
      const nuevoT = {
        id: nuevoRef.id, fecha: fechaStr,
        hora: new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}),
        kinesiologoId: kineSelId,
        kinesiologoNombre: kine.apellido + ' ' + kine.nombre,
        nroSesion: null, autorizado: false, asistencia: 'asistio'
      }
      setTurnos(prev => [...prev, nuevoT].sort((a,b) => (b.fecha||'').localeCompare(a.fecha||'')))
      setFechaRegistro(hoy())
      setExito(true)
      setTimeout(() => setExito(false), 3000)
    } catch(err) { console.error(err); alert('Error al registrar') }
    setRegistrando(false)
  }

  // Paciente particular — abre el modal para elegir si pagó o queda debiendo
  function intentarRegistrarParticular() {
    if (!kineSelId) return alert('Seleccioná un kinesiológo')
    if (!fechaRegistro) return alert('Seleccioná una fecha')
    setModalPago(true)
  }

  async function registrarSesionParticular(pagoInfo) {
    setModalPago(false)
    setRegistrando(true)
    try {
      const kine = kines.find(k => k.id === kineSelId)
      const fechaStr = fechaRegistro || hoy()
      const horaStr = new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})
      const nuevoRef = await addDoc(collection(db,'turnos'), {
        fecha: fechaStr, hora: horaStr,
        pacienteId: id,
        pacienteNombre: pac.nombre, pacienteApellido: pac.apellido,
        pacienteDni: pac.dni || '',
        kinesiologoId: kineSelId,
        kinesiologoNombre: kine.apellido + ' ' + kine.nombre,
        nroSesion: null,
        asistencia: 'asistio', asistenciaTs: serverTimestamp(),
        pagado: pagoInfo.pagado,
        monto: pagoInfo.pagado ? pagoInfo.monto : null,
        medioPago: pagoInfo.pagado ? pagoInfo.medioPago : null,
        creadoPor: user.uid,
        creadoPorNombre: perfil.apellido + ' ' + perfil.nombre,
        ts: serverTimestamp()
      })
      if (pagoInfo.pagado) {
        await agregarMovimientoCaja({
          tipo: pagoInfo.medioPago === 'transferencia' ? 'entrada-transferencia' : 'entrada-efectivo',
          descripcion: `Sesión particular — ${pac.apellido} ${pac.nombre}`,
          importe: pagoInfo.monto,
          kineId: kineSelId,
          profesionalNombre: kine.apellido + ' ' + kine.nombre,
          cargadoPor: user.uid,
          cargadoPorNombre: perfil.apellido + ' ' + perfil.nombre,
          fecha: hoy(),
          hora: horaStr
        })
      }
      const nuevoT = {
        id: nuevoRef.id, fecha: fechaStr, hora: horaStr,
        kinesiologoId: kineSelId,
        kinesiologoNombre: kine.apellido + ' ' + kine.nombre,
        nroSesion: null, asistencia: 'asistio',
        pagado: pagoInfo.pagado, monto: pagoInfo.pagado ? pagoInfo.monto : null, medioPago: pagoInfo.pagado ? pagoInfo.medioPago : null
      }
      setTurnos(prev => [...prev, nuevoT].sort((a,b) => (b.fecha||'').localeCompare(a.fecha||'')))
      setFechaRegistro(hoy())
      setExito(true)
      setTimeout(() => setExito(false), 3000)
    } catch(err) { console.error(err); alert('Error al registrar') }
    setRegistrando(false)
  }

  // Salda una sesión particular que había quedado marcada como "Debe"
  async function marcarComoPagada(turno, pagoInfo) {
    try {
      const kine = kines.find(k => k.id === turno.kinesiologoId)
      await updateDoc(doc(db,'turnos',turno.id), {
        pagado: true, monto: pagoInfo.monto, medioPago: pagoInfo.medioPago
      })
      await agregarMovimientoCaja({
        tipo: pagoInfo.medioPago === 'transferencia' ? 'entrada-transferencia' : 'entrada-efectivo',
        descripcion: `Sesión particular — ${pac.apellido} ${pac.nombre}`,
        importe: pagoInfo.monto,
        kineId: turno.kinesiologoId || null,
        profesionalNombre: kine ? kine.apellido + ' ' + kine.nombre : turno.kinesiologoNombre,
        cargadoPor: user.uid,
        cargadoPorNombre: perfil.apellido + ' ' + perfil.nombre,
        fecha: hoy(),
        hora: new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})
      })
      setTurnos(prev => prev.map(t => t.id === turno.id ? { ...t, pagado: true, monto: pagoInfo.monto, medioPago: pagoInfo.medioPago } : t))
    } catch(err) { console.error(err); alert('Error al registrar el pago') }
  }

  async function eliminarAsistencia(turno) {
    try {
      const batch = writeBatch(db)
      batch.delete(doc(db,'turnos',turno.id))
      if (turno.asistencia === 'asistio' && pac.plan) {
        const nuevasUsadas = Math.max(0, (pac.plan?.sesionesUsadas || 0) - 1)
        batch.update(doc(db,'pacientes',id), { 'plan.sesionesUsadas': nuevasUsadas })
        await batch.commit()
        setPac(prev => ({ ...prev, plan: { ...prev.plan, sesionesUsadas: nuevasUsadas } }))
      } else {
        await batch.commit()
      }
      setTurnos(prev => prev.filter(t => t.id !== turno.id))
      invalidarPacs()
    } catch(err) { console.error(err); alert('Error al eliminar turno') }
  }

  async function cambiarKineTurno(turno, kineId) {
    try {
      const kine = kines.find(k => k.id === kineId)
      if (!kine) return
      await updateDoc(doc(db,'turnos',turno.id), {
        kinesiologoId: kineId,
        kinesiologoNombre: kine.apellido + ' ' + kine.nombre
      })
      setTurnos(prev => prev.map(t => t.id === turno.id
        ? { ...t, kinesiologoId: kineId, kinesiologoNombre: kine.apellido + ' ' + kine.nombre }
        : t
      ))
    } catch(err) { console.error(err); alert('Error al cambiar kinesiológo') }
  }

  // Eliminar paciente — borra el doc (los turnos quedan como historial)
  async function eliminarPaciente() {
    if (!window.confirm(`¿Eliminar a ${pac.apellido} ${pac.nombre}? Esta acción no se puede deshacer.`)) return
    if (!window.confirm('Segunda confirmación: ¿estás seguro que querés eliminar este paciente?')) return
    setEliminando(true)
    try {
      await deleteDoc(doc(db,'pacientes',id))
      invalidarPacs()
      navigate('/pacientes')
    } catch(err) { console.error(err); alert('Error al eliminar') }
    setEliminando(false)
  }

  if (carg) return <div className="sc"><div className="sp" /></div>
  if (!pac) return null

  const { plan } = pac
  const est  = plan ? estadoPlan(plan) : 'sin-plan'
  const arch = pac.archivado === true
  const dias = plan?.fechaVencimiento ? diasHabilesRestantes(plan.fechaVencimiento) : null
  const ini  = ((pac.nombre?.[0]||'') + (pac.apellido?.[0]||'')).toUpperCase()
  const sesRestantes = plan ? (plan.sesionesTotal - (plan.sesionesUsadas || 0)) : null
  const conToken = necesitaToken(pac.obraSocial)
  const sinAutorizarCount = turnos.filter(t => t.autorizado === false).length
  const excedido = plan && (plan.sesionesUsadas || 0) > plan.sesionesTotal
  const esParticular = esPacienteParticular(pac)
  const sesionesAdeudadas = turnos.filter(t => t.pagado === false)
  const totalAdeudado = sesionesAdeudadas.reduce((a,t) => a + (t.monto||0), 0)

  return (
    <div>
      {modalToken && (
        <ModalToken
          obraSocial={pac.obraSocial}
          onConfirmar={() => modoRegistro === 'sinAutorizacion' ? registrarSesionSinAutorizacion() : registrarSesion()}
          onCancelar={() => setModalToken(false)}
        />
      )}
      {modalPago && (
        <ModalPago onConfirmar={registrarSesionParticular} onCancelar={() => setModalPago(false)} />
      )}

      <div className="row" style={{ marginBottom: 20 }}>
        <button className="btn bs bsm" onClick={() => navigate('/pacientes')}>← Volver</button>
        <div className="ptitle" style={{ flex: 1 }}>Ficha de paciente</div>
        <button className="btn bs bsm" onClick={() => navigate(`/pacientes/${id}/editar`)}>
          {arch ? 'Reactivar / Editar' : 'Editar'}
        </button>
        {!arch && <button className="btn bp bsm" onClick={() => navigate('/turnos/nuevo')}>+ Turno</button>}
        <button className="btn bd bsm" onClick={eliminarPaciente} disabled={eliminando}>
          {eliminando ? 'Eliminando...' : 'Eliminar'}
        </button>
      </div>

      {arch && <div className="al ala">Paciente archivado. Hacé clic en "Reactivar / Editar" para cargarlo de nuevo.</div>}
      {est === 'por-vencer' && !arch && <div className="al ala">⚠ El plan vence en {dias} días hábiles.</div>}
      {est === 'vencido' && !arch && <div className="al alr">⚠ El plan está vencido.</div>}
      {conToken && (
        <div className="al alb">
          🔑 Este paciente tiene <strong>{pac.obraSocial}</strong> — recordá pedirle el <strong>token</strong> antes de cada sesión.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
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
              <tr><td style={{ color:'#888', padding:'4px 0', width:'40%' }}>Teléfono</td><td style={{ padding:'4px 0' }}>{pac.telefono||'—'}</td></tr>
              <tr><td style={{ color:'#888', padding:'4px 0' }}>Obra social</td><td style={{ padding:'4px 0' }}>{pac.obraSocial?<span className="badge bb">{pac.obraSocial}</span>:'—'}</td></tr>
              <tr><td style={{ color:'#888', padding:'4px 0' }}>N° afiliado</td><td style={{ padding:'4px 0' }}>{pac.nroAfiliado||'—'}</td></tr>
              <tr><td style={{ color:'#888', padding:'4px 0' }}>Diagnóstico</td><td style={{ padding:'4px 0' }}>{pac.diagnostico||'—'}</td></tr>
              <tr><td style={{ color:'#888', padding:'4px 0' }}>Orden médica</td><td style={{ padding:'4px 0' }}>
                {pac.ordenFecha
                  ? <>{fmtFecha(pac.ordenFecha)}{pac.ordenDetalle ? ' — '+pac.ordenDetalle : ''}</>
                  : <span style={{ color:'var(--na)' }}>Sin orden entregada todavía</span>
                }
              </td></tr>
              {pac.observaciones && <tr><td style={{ color:'#888', padding:'4px 0' }}>Obs.</td><td style={{ padding:'4px 0' }}>{pac.observaciones}</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">{esParticular ? 'Cuenta corriente' : 'Estado del plan'}</div>
          {esParticular ? (
            sesionesAdeudadas.length === 0 ? (
              <div style={{ color:'#888', fontSize:13 }}>Sin sesiones adeudadas.</div>
            ) : (
              <div className="al alr" style={{ marginBottom:0 }}>
                ⚠ {sesionesAdeudadas.length} sesión{sesionesAdeudadas.length>1?'es':''} adeudada{sesionesAdeudadas.length>1?'s':''} — {fmtMonto(totalAdeudado)}
              </div>
            )
          ) : !plan ? (
            <div style={{ color:'#888', fontSize:13 }}>
              Sin plan cargado.{' '}
              <button className="btn bs bsm" onClick={() => navigate(`/pacientes/${id}/editar`)}>Cargar plan</button>
              {sinAutorizarCount > 0 && (
                <div style={{ color:'var(--ro)', fontSize:12, marginTop:8 }}>
                  ⚠ {sinAutorizarCount} sesión{sinAutorizarCount>1?'es':''} sin autorizar registrada{sinAutorizarCount>1?'s':''} — se descuenta{sinAutorizarCount>1?'n':''} del plan al cargarlo.
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                <div className="met">
                  <div className="met-l">Sesiones</div>
                  <div style={{ fontSize:20, fontWeight:700, color: excedido ? 'var(--ro)' : 'var(--az)' }}>{plan.sesionesUsadas||0}/{plan.sesionesTotal}</div>
                  {excedido && <div style={{ fontSize:11, color:'var(--ro)' }}>{plan.sesionesUsadas - plan.sesionesTotal} de más</div>}
                </div>
                <div className="met">
                  <div className="met-l">Días hábiles</div>
                  <div style={{ fontSize:20, fontWeight:700, color: dias<=0?'var(--ro)':dias<=10?'var(--na)':'var(--ve)' }}>{dias??'—'}</div>
                </div>
              </div>
              <table style={{ width:'100%', fontSize:13 }}>
                <tbody>
                  <tr><td style={{ color:'#888', padding:'4px 0', width:'40%' }}>Inicio</td><td style={{ padding:'4px 0' }}>{fmtFecha(plan.fechaInicio)}</td></tr>
                  <tr><td style={{ color:'#888', padding:'4px 0' }}>Vencimiento</td><td style={{ padding:'4px 0' }}>{fmtFecha(plan.fechaVencimiento)}</td></tr>
                  <tr><td style={{ color:'#888', padding:'4px 0' }}>Kinesiológo referente</td><td style={{ padding:'4px 0' }}>{kineRefNombre || '—'}</td></tr>
                  <tr><td style={{ color:'#888', padding:'4px 0' }}>Estado</td><td style={{ padding:'4px 0' }}>
                    {est==='vencido'&&<span className="badge br">Vencido</span>}
                    {est==='por-vencer'&&<span className="badge ba">Por vencer</span>}
                    {est==='vigente'&&<span className="badge bg">Vigente</span>}
                  </td></tr>
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {/* Registro sesión — paciente particular (paga por sesión) */}
      {!arch && esParticular && (
        <div className="card" style={{ marginBottom: 14, borderLeft: '3px solid var(--az)' }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Registrar sesión</div>
          <div style={{ fontSize:12, color:'#888', marginBottom:10 }}>
            Paciente particular — al confirmar te pregunta si pagó (se carga solo en Caja) o si queda debiendo.
          </div>
          <div className="row" style={{ flexWrap:'wrap', gap:10 }}>
            <input type="date" value={fechaRegistro} max={hoy()} onChange={e => setFechaRegistro(e.target.value)}
              style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:13 }} />
            <select value={kineSelId} onChange={e => setKineSelId(e.target.value)}
              style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:13, flex:1, minWidth:200 }}>
              <option value="">Seleccioná kinesiológo...</option>
              {kines.map(k => <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
            </select>
            <button className="btn bp" onClick={intentarRegistrarParticular} disabled={registrando || !kineSelId || !fechaRegistro} style={{ minWidth:160 }}>
              {registrando ? 'Registrando...' : '✓ Marcar asistencia'}
            </button>
            {exito && <div className="badge bg" style={{ padding:'8px 14px', fontSize:13 }}>✓ Sesión registrada</div>}
          </div>
        </div>
      )}

      {/* Registro sin autorización — paciente sin plan cargado todavía */}
      {!arch && !esParticular && !plan && (
        <div className="card" style={{ marginBottom: 14, borderLeft: '3px solid var(--ro)' }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Registrar sesión sin autorización</div>
          <div style={{ fontSize:13, color:'#666', marginBottom:10 }}>
            Este paciente todavía no tiene sesiones autorizadas. Podés registrar que asistió igual — queda marcado en <strong style={{ color:'var(--ro)' }}>rojo</strong> como no autorizado, y se descuenta automáticamente del plan cuando se cargue la autorización.
          </div>
          <div className="row" style={{ flexWrap:'wrap', gap:10 }}>
            <input type="date" value={fechaRegistro} max={hoy()} onChange={e => setFechaRegistro(e.target.value)}
              style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:13 }} />
            <select value={kineSelId} onChange={e => setKineSelId(e.target.value)}
              style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:13, flex:1, minWidth:200 }}>
              <option value="">Seleccioná kinesiológo...</option>
              {kines.map(k => <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
            </select>
            <button className="btn bd" onClick={intentarRegistrarSinAutorizacion} disabled={registrando || !kineSelId || !fechaRegistro} style={{ minWidth:220 }}>
              {registrando ? 'Registrando...' : '⚠ Registrar sin autorización'}
            </button>
            {exito && <div className="badge br" style={{ padding:'8px 14px', fontSize:13 }}>✓ Sesión registrada sin autorización</div>}
          </div>
        </div>
      )}

      {/* Registro rápido */}
      {!arch && !esParticular && plan && est !== 'vencido' && (
        <div className="card" style={{ marginBottom: 14, borderLeft: '3px solid var(--az)' }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Registrar sesión</div>
          <div style={{ fontSize:12, color:'#888', marginBottom:10 }}>
            Por defecto es hoy — elegí una fecha anterior si es una sesión que se pasó por alto cargar.
          </div>
          {sesRestantes !== null && sesRestantes <= 0 ? (
            <div className="al alr" style={{ marginBottom: 0 }}>No quedan sesiones disponibles en el plan actual.</div>
          ) : (
            <div className="row" style={{ flexWrap:'wrap', gap:10 }}>
              <input type="date" value={fechaRegistro} max={hoy()} onChange={e => setFechaRegistro(e.target.value)}
                style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:13 }} />
              <select value={kineSelId} onChange={e => setKineSelId(e.target.value)}
                style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:13, flex:1, minWidth:200 }}>
                <option value="">Seleccioná kinesiológo...</option>
                {kines.map(k => <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
              </select>
              <button className="btn bp" onClick={intentarRegistrar} disabled={registrando || !kineSelId || !fechaRegistro} style={{ minWidth:160 }}>
                {registrando ? 'Registrando...' : conToken ? '🔑 ✓ Marcar asistencia' : '✓ Marcar asistencia'}
              </button>
              {exito && <div className="badge bg" style={{ padding:'8px 14px', fontSize:13 }}>✓ Sesión registrada — quedan {sesRestantes - 1} sesiones</div>}
            </div>
          )}
          {sesRestantes !== null && sesRestantes <= 3 && sesRestantes > 0 && (
            <div style={{ fontSize:12, color:'var(--na)', marginTop:8 }}>⚠ Quedan solo {sesRestantes} sesión{sesRestantes>1?'es':''} en el plan</div>
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
                  <FilaTurno key={t.id} turno={t} kines={kines}
                    onEliminarAsistencia={eliminarAsistencia}
                    onCambiarKine={cambiarKineTurno}
                    onMarcarPagada={marcarComoPagada} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
