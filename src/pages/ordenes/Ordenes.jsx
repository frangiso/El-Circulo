import { useEffect, useState } from 'react'
import { collection, addDoc, doc, getDoc, setDoc, updateDoc, getDocs, query, where, orderBy, writeBatch, arrayUnion, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useCache } from '../../context/AppCache'
import { calcVenc, hoy, horaActual, mesActual, fmtFecha, fmtMonto, escribirLog, esParticular, esPami } from '../../utils/helpers'

const ILupa = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)

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

export default function Ordenes() {
  const { user, perfil } = useAuth()
  const { getPacientes, invalidarPacs } = useCache()
  const [ordenes, setOrdenes] = useState([])
  const [carg, setCarg] = useState(true)
  const [busq, setBusq] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [modal, setModal] = useState(false)

  async function cargarOrdenes() {
    setCarg(true)
    const snap = await getDocs(query(collection(db, 'ordenes'), orderBy('fechaEntrega', 'desc')))
    setOrdenes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setCarg(false)
  }

  useEffect(() => { cargarOrdenes() }, [])

  const visibles = ordenes.filter(o => {
    const txt = (o.pacienteApellido + ' ' + o.pacienteNombre + ' ' + (o.pacienteDni || '')).toLowerCase()
    const matchB = busq ? txt.includes(busq.toLowerCase()) : true
    const matchDesde = desde ? o.fechaEntrega >= desde : true
    const matchHasta = hasta ? o.fechaEntrega <= hasta : true
    return matchB && matchDesde && matchHasta
  })

  return (
    <div>
      {modal && (
        <ModalNuevaOrden
          getPacientes={getPacientes}
          user={user} perfil={perfil}
          onGuardada={() => { setModal(false); cargarOrdenes(); invalidarPacs() }}
          onCancelar={() => setModal(false)}
        />
      )}

      <div className="ph">
        <div className="ptitle">Órdenes</div>
        <button className="btn bp" onClick={() => setModal(true)}>+ Nueva orden</button>
      </div>

      <div className="filtros">
        <div className="sw" style={{ flex: 1, minWidth: 200 }}>
          <ILupa />
          <input className="si" placeholder="Buscar por paciente o DNI..." value={busq} onChange={e => setBusq(e.target.value)} />
        </div>
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} title="Fecha de entrega desde"
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }} />
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} title="Fecha de entrega hasta"
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {carg ? (
          <div className="sc"><div className="sp" /></div>
        ) : visibles.length === 0 ? (
          <div className="emt">No hay órdenes cargadas{busq || desde || hasta ? ' con ese filtro' : ''}</div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Fecha de entrega</th><th>Paciente</th><th>Obra social</th>
                  <th>Sesiones</th><th>Detalle</th><th>Cargado por</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(o => (
                  <tr key={o.id}>
                    <td className="fw6">{fmtFecha(o.fechaEntrega)}</td>
                    <td>{o.pacienteApellido} {o.pacienteNombre}</td>
                    <td>
                      {o.obraSocial ? <span className="badge bb">{o.obraSocial}</span> : '—'}
                      {o.esPami && <span className="badge bk" style={{ marginLeft: 4 }}>Pack PAMI</span>}
                    </td>
                    <td>{o.sesiones}{o.esPami && o.monto ? ` — ${fmtMonto(o.monto)}` : ''}</td>
                    <td>{o.detalle || '—'}</td>
                    <td>
                      {o.migrada
                        ? <span className="badge bk" title="Importada del dato de orden que ya tenía cargado el paciente, antes de que existiera esta pestaña">Migrada</span>
                        : (o.cargadoPorNombre || '—')}
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

function ModalNuevaOrden({ getPacientes, user, perfil, onGuardada, onCancelar }) {
  const [pacs, setPacs] = useState([])
  const [busq, setBusq] = useState('')
  const [showDL, setShowDL] = useState(false)
  const [pacSel, setPacSel] = useState(null)
  const [fechaEntrega, setFechaEntrega] = useState(hoy())
  const [sesiones, setSesiones] = useState('')
  const [detalle, setDetalle] = useState('')
  const [monto, setMonto] = useState('')
  const [medioPago, setMedioPago] = useState('efectivo')
  const [saving, setSaving] = useState(false)

  useEffect(() => { getPacientes().then(setPacs) }, [])

  // Particular no tiene concepto de sesiones autorizadas — no aplica acá
  const sugs = busq.length < 2 ? [] : pacs.filter(p => !esParticular(p) &&
    (p.apellido + ' ' + p.nombre + ' ' + (p.dni || '')).toLowerCase().includes(busq.toLowerCase())
  ).slice(0, 8)

  function selec(p) {
    setPacSel(p); setBusq(p.apellido + ' ' + p.nombre); setShowDL(false)
  }

  const pami = pacSel ? esPami(pacSel) : false

  async function guardar(e) {
    e.preventDefault()
    if (!pacSel) return alert('Seleccioná un paciente')
    const n = parseInt(sesiones)
    if (!n || n <= 0) return alert('Ingresá la cantidad de sesiones')
    if (!fechaEntrega) return alert('Ingresá la fecha de entrega')
    if (pami && (!monto || parseFloat(monto) <= 0)) return alert('Ingresá el monto del pack')
    setSaving(true)
    try {
      const nombreCompleto = `${perfil.apellido} ${perfil.nombre}`
      const ordenData = {
        pacienteId: pacSel.id, pacienteNombre: pacSel.nombre, pacienteApellido: pacSel.apellido,
        pacienteDni: pacSel.dni || '', obraSocial: pacSel.obraSocial || '',
        fechaEntrega, sesiones: n, detalle: detalle.trim(), esPami: pami,
        ...(pami ? { monto: parseFloat(monto), medioPago } : {}),
        cargadoPor: user.uid, cargadoPorNombre: nombreCompleto, creadoEn: serverTimestamp()
      }
      await addDoc(collection(db, 'ordenes'), ordenData)

      if (pami) {
        // Pack de copagos prepago — igual que "Cargar pack" desde la ficha del paciente
        const previo = pacSel.copagoPlan || { sesionesTotal: 0, sesionesUsadas: 0 }
        const nuevoCopagoPlan = { sesionesTotal: previo.sesionesTotal + n, sesionesUsadas: previo.sesionesUsadas || 0, medioPago, fecha: hoy() }
        await updateDoc(doc(db, 'pacientes', pacSel.id), {
          copagoPlan: nuevoCopagoPlan, ordenFecha: fechaEntrega, ordenDetalle: detalle.trim()
        })
        await agregarMovimientoCaja({
          tipo: medioPago === 'transferencia' ? 'entrada-transferencia' : 'entrada-efectivo',
          descripcion: `Pack de ${n} copagos — ${pacSel.apellido} ${pacSel.nombre}`,
          importe: parseFloat(monto),
          kineId: null, profesionalNombre: null,
          cargadoPor: user.uid, cargadoPorNombre: nombreCompleto,
          fecha: hoy(), hora: horaActual()
        })
      } else {
        // Plan de obra social — suma al total que ya tenía y renueva la fecha del plan
        // con la de esta orden. Si había sesiones sin autorizar esperando esto, se
        // autorizan y numeran ahora (igual que al cargar un plan desde Editar paciente).
        const plan = pacSel.plan || null
        const pendSnap = await getDocs(query(
          collection(db, 'turnos'), where('pacienteId', '==', pacSel.id), where('autorizado', '==', false)
        ))
        const pendientes = pendSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(t => !t.anulado)
          .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))

        const sesionesUsadas = (plan?.sesionesUsadas || 0) + pendientes.length
        const nuevoPlan = {
          sesionesTotal: (plan?.sesionesTotal || 0) + n,
          sesionesUsadas,
          fechaInicio: fechaEntrega,
          fechaVencimiento: calcVenc(fechaEntrega),
          kinesiologoRef: plan?.kinesiologoRef || pacSel.kinesiologoRef || null
        }
        const batch = writeBatch(db)
        batch.update(doc(db, 'pacientes', pacSel.id), {
          plan: nuevoPlan, ordenFecha: fechaEntrega, ordenDetalle: detalle.trim()
        })
        let numero = plan?.sesionesUsadas || 0
        pendientes.forEach(t => {
          numero++
          batch.update(doc(db, 'turnos', t.id), { autorizado: true, nroSesion: numero })
        })
        await batch.commit()
        if (pendientes.length > 0) {
          await escribirLog(user.uid, nombreCompleto, 'Autorizó sesiones pendientes',
            `${pendientes.length} sesión${pendientes.length > 1 ? 'es' : ''} de ${pacSel.apellido} ${pacSel.nombre}`)
        }
      }

      await escribirLog(user.uid, nombreCompleto, 'Cargó orden',
        `${n} sesiones — ${fmtFecha(fechaEntrega)} — ${pacSel.apellido} ${pacSel.nombre}`)
      onGuardada()
    } catch (err) { console.error(err); alert('Error al guardar la orden') }
    setSaving(false)
  }

  return (
    <div className="mo" onClick={e => { if (e.target === e.currentTarget) onCancelar() }}>
      <div className="mc">
        <div className="mt" style={{ marginBottom: 14 }}>Nueva orden</div>
        <form onSubmit={guardar}>
          <div className="ff" style={{ position: 'relative', marginBottom: 12 }}>
            <label>Paciente *</label>
            <div className="sw">
              <ILupa />
              <input className="si" value={busq}
                onChange={e => { setBusq(e.target.value); setShowDL(true); if (!e.target.value) setPacSel(null) }}
                onFocus={() => setShowDL(true)}
                placeholder="Escribí 2+ letras... (particulares no aplican)" autoComplete="off" />
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
          {pacSel && pami && (
            <div className="al alb" style={{ marginBottom: 12 }}>
              Este paciente es PAMI — la orden se carga como un pack de copagos prepago (se suma al que ya tenga, y genera un movimiento en Caja).
            </div>
          )}
          <div className="fg" style={{ marginBottom: 12 }}>
            <div className="ff">
              <label>Fecha de entrega *</label>
              <input type="date" value={fechaEntrega} max={hoy()} onChange={e => setFechaEntrega(e.target.value)} required />
            </div>
            <div className="ff">
              <label>Cantidad de sesiones *</label>
              <input type="number" min="1" value={sesiones} onChange={e => setSesiones(e.target.value)} placeholder="Ej: 10" required />
            </div>
            {pami && (
              <>
                <div className="ff">
                  <label>Monto del pack *</label>
                  <input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej: 25000" />
                </div>
                <div className="ff">
                  <label>Medio de pago</label>
                  <select value={medioPago} onChange={e => setMedioPago(e.target.value)}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </div>
              </>
            )}
            <div className="ff full">
              <label>Detalle</label>
              <input value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="Ej: 10 sesiones kinesiología — cervical" />
            </div>
          </div>
          {!pami && pacSel && (
            <div className="hint" style={{ marginBottom: 12, display: 'block' }}>
              Se suma a las sesiones que ya tenía autorizadas, y el plan pasa a vencer a 45 días hábiles desde esta fecha.
            </div>
          )}
          <div className="re">
            <button type="button" className="btn bs" onClick={onCancelar} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn bp" disabled={saving || !pacSel}>{saving ? 'Guardando...' : 'Guardar orden'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
