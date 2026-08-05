import { useEffect, useState } from 'react'
import { collection, addDoc, doc, updateDoc, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useCache } from '../../context/AppCache'
import { escribirLog, fmtMonto, fmtFecha, hoy, horaActual } from '../../utils/helpers'

const ILupa = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)

function ModalDevolver({ sena, onConfirmar, onCancelar }) {
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  async function confirmar() {
    if (!motivo.trim()) return alert('Escribí el motivo de la devolución')
    setSaving(true)
    await onConfirmar(motivo.trim())
    setSaving(false)
  }

  return (
    <div className="mo" onClick={e => { if (e.target === e.currentTarget) onCancelar() }}>
      <div className="mc">
        <div className="mt" style={{ marginBottom: 6 }}>Devolver seña</div>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>
          {sena.pacienteApellido} {sena.pacienteNombre} — {fmtMonto(sena.monto)}
        </div>
        <div className="ff" style={{ marginBottom: 14 }}>
          <label>Motivo *</label>
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder="Ej: Llegó la autorización de la obra social" autoFocus />
        </div>
        <div className="re">
          <button type="button" className="btn bs" onClick={onCancelar} disabled={saving}>Cancelar</button>
          <button type="button" className="btn bp" onClick={confirmar} disabled={saving}>
            {saving ? 'Guardando...' : 'Confirmar devolución'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Anular una seña — queda registrada, no se borra
function ModalAnular({ sena, onConfirmar, onCancelar }) {
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  async function confirmar() {
    if (!motivo.trim()) return alert('Escribí el motivo de la anulación')
    setSaving(true)
    await onConfirmar(motivo.trim())
    setSaving(false)
  }

  return (
    <div className="mo" onClick={e => { if (e.target === e.currentTarget) onCancelar() }}>
      <div className="mc">
        <div className="mt" style={{ marginBottom: 6 }}>Anular seña</div>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>
          {sena.pacienteApellido} {sena.pacienteNombre} — {fmtMonto(sena.monto)}
        </div>
        <div className="ff" style={{ marginBottom: 14 }}>
          <label>Motivo *</label>
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder="Ej: se cargó por error, paciente equivocado" autoFocus />
        </div>
        <div className="re">
          <button type="button" className="btn bs" onClick={onCancelar} disabled={saving}>Cancelar</button>
          <button type="button" className="btn bd" onClick={confirmar} disabled={saving}>
            {saving ? 'Guardando...' : 'Confirmar anulación'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Senas() {
  const { user, perfil } = useAuth()
  const { getPacientes } = useCache()
  const [senas, setSenas] = useState([])
  const [carg, setCarg] = useState(true)
  const [modal, setModal] = useState(false)
  const [pacs, setPacs] = useState([])
  const [busq, setBusq] = useState('')
  const [pacSel, setPacSel] = useState(null)
  const [showDL, setShowDL] = useState(false)
  const [monto, setMonto] = useState('')
  const [medioPago, setMedioPago] = useState('efectivo')
  const [saving, setSaving] = useState(false)
  const [devolviendo, setDevolviendo] = useState(null)
  const [anulando, setAnulando] = useState(null)
  const [tab, setTab] = useState('lista')

  async function cargar() {
    setCarg(true)
    const snap = await getDocs(collection(db, 'senas'))
    setSenas(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.fecha||'').localeCompare(a.fecha||'')))
    setCarg(false)
  }

  useEffect(() => { cargar(); getPacientes().then(setPacs) }, [])

  const sugs = busq.length < 2 ? [] : pacs.filter(p =>
    (p.apellido + ' ' + p.nombre + ' ' + (p.dni||'')).toLowerCase().includes(busq.toLowerCase())
  ).slice(0, 8)

  function selec(p) { setPacSel(p); setBusq(p.apellido + ' ' + p.nombre); setShowDL(false) }

  function abrirNueva() {
    setPacSel(null); setBusq(''); setMonto(''); setMedioPago('efectivo')
    setModal(true)
  }

  async function guardar(e) {
    e.preventDefault()
    if (!pacSel) return alert('Seleccioná un paciente')
    if (!monto || parseFloat(monto) <= 0) return alert('Ingresá el monto')
    setSaving(true)
    try {
      await addDoc(collection(db, 'senas'), {
        pacienteId: pacSel.id, pacienteNombre: pacSel.nombre, pacienteApellido: pacSel.apellido, pacienteDni: pacSel.dni || '',
        monto: parseFloat(monto), medioPago,
        fecha: hoy(), hora: horaActual(),
        estado: 'activa',
        cargadoPor: user.uid, cargadoPorNombre: `${perfil.apellido} ${perfil.nombre}`,
        ts: serverTimestamp()
      })
      await escribirLog(user.uid, `${perfil.apellido} ${perfil.nombre}`, 'Cargó seña', `${pacSel.apellido} ${pacSel.nombre} — ${fmtMonto(parseFloat(monto))}`)
      setModal(false)
      await cargar()
    } catch(err) { console.error(err); alert('Error al guardar') }
    setSaving(false)
  }

  async function devolver(sena, motivo) {
    try {
      await updateDoc(doc(db,'senas',sena.id), {
        estado: 'devuelta',
        devueltoFecha: hoy(), devueltoPor: user.uid, devueltoPorNombre: `${perfil.apellido} ${perfil.nombre}`,
        motivoDevolucion: motivo
      })
      await escribirLog(user.uid, `${perfil.apellido} ${perfil.nombre}`, 'Devolvió seña',
        `${sena.pacienteApellido} ${sena.pacienteNombre} — ${fmtMonto(sena.monto)} — ${motivo}`)
      setDevolviendo(null)
      await cargar()
    } catch(err) { console.error(err); alert('Error al devolver') }
  }

  function pedirAnulacion(sena) {
    if (!window.confirm(`¿Anular la seña de ${sena.pacienteApellido} ${sena.pacienteNombre} por ${fmtMonto(sena.monto)}? Queda registrada en Anulaciones, no se borra.`)) return
    setAnulando(sena)
  }

  async function anularSena(sena, motivo) {
    try {
      await updateDoc(doc(db,'senas',sena.id), {
        anulado: true, anuladoPor: user.uid, anuladoPorNombre: `${perfil.apellido} ${perfil.nombre}`,
        anuladoFecha: hoy(), anuladoHora: horaActual(),
        motivoAnulacion: motivo
      })
      await escribirLog(user.uid, `${perfil.apellido} ${perfil.nombre}`, 'Anuló seña',
        `${sena.pacienteApellido} ${sena.pacienteNombre} — ${fmtMonto(sena.monto)} — ${motivo}`)
      setAnulando(null)
      await cargar()
    } catch(err) { console.error(err); alert('Error al anular') }
  }

  const vivas = senas.filter(s => !s.anulado)
  const activas = vivas.filter(s => s.estado !== 'devuelta')
  const devueltas = vivas.filter(s => s.estado === 'devuelta')
  const anuladas = senas.filter(s => s.anulado)
  const totalActivas = activas.reduce((a,s) => a + (s.monto||0), 0)

  if (carg) return <div className="sc"><div className="sp" /></div>

  return (
    <div>
      <div className="ph">
        <div className="ptitle">Caja de señas</div>
        <button className="btn bp" onClick={abrirNueva}>+ Nueva seña</button>
      </div>

      <div className="al alb">
        Registro separado de la Caja normal — para señas de pacientes con obra social que todavía no tienen autorización.
      </div>

      <div className="mets" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 16 }}>
        <div className="met"><div className="met-l">Señas activas</div><div className="met-v">{activas.length}</div></div>
        <div className="met"><div className="met-l">Total a devolver</div><div className="met-v caz">{fmtMonto(totalActivas)}</div></div>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={'tab ' + (tab === 'lista' ? 'on' : '')} onClick={() => setTab('lista')}>Señas</button>
        <button className={'tab ' + (tab === 'anulaciones' ? 'on' : '')} onClick={() => setTab('anulaciones')}>Anulaciones {anuladas.length > 0 && `(${anuladas.length})`}</button>
      </div>

      {tab === 'lista' && (
        <>
          <div className="card">
            <div className="card-title">Activas ({activas.length})</div>
            <div className="tw">
              <table>
                <thead><tr><th>Fecha</th><th>Paciente</th><th>Monto</th><th>Medio</th><th>Cargada por</th><th></th></tr></thead>
                <tbody>
                  {activas.length === 0 && <tr><td colSpan="6" className="emt">Sin señas activas</td></tr>}
                  {activas.map(s => (
                    <tr key={s.id}>
                      <td>{fmtFecha(s.fecha)}</td>
                      <td className="fw6">{s.pacienteApellido} {s.pacienteNombre}</td>
                      <td className="cve fw6">{fmtMonto(s.monto)}</td>
                      <td>{s.medioPago === 'transferencia' ? <span className="badge bb">Transferencia</span> : <span className="badge bg">Efectivo</span>}</td>
                      <td className="cgr" style={{ fontSize: 12 }}>{s.cargadoPorNombre}</td>
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          <button className="btn bd bsm" onClick={() => setDevolviendo(s)}>Devolver</button>
                          <button className="btn bs bsm" onClick={() => pedirAnulacion(s)}>Anular</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {devueltas.length > 0 && (
            <div className="card">
              <div className="card-title cgr">Devueltas ({devueltas.length})</div>
              <div className="tw">
                <table>
                  <thead><tr><th>Fecha</th><th>Paciente</th><th>Monto</th><th>Devuelta el</th><th>Motivo</th><th></th></tr></thead>
                  <tbody>
                    {devueltas.map(s => (
                      <tr key={s.id} style={{ opacity: .7 }}>
                        <td>{fmtFecha(s.fecha)}</td>
                        <td>{s.pacienteApellido} {s.pacienteNombre}</td>
                        <td>{fmtMonto(s.monto)}</td>
                        <td>{fmtFecha(s.devueltoFecha)}</td>
                        <td style={{ fontSize: 12 }}>{s.motivoDevolucion}</td>
                        <td><button className="btn bs bsm" onClick={() => pedirAnulacion(s)}>Anular</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'anulaciones' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="tw">
            <table>
              <thead><tr><th>Fecha</th><th>Paciente</th><th>Monto</th><th>Cargada por</th><th>Anulada por</th><th>Motivo</th></tr></thead>
              <tbody>
                {anuladas.length === 0 && <tr><td colSpan="6" className="emt">Sin anulaciones</td></tr>}
                {anuladas.map(s => (
                  <tr key={s.id}>
                    <td>{fmtFecha(s.fecha)}</td>
                    <td className="fw6">{s.pacienteApellido} {s.pacienteNombre}</td>
                    <td>{fmtMonto(s.monto)}</td>
                    <td className="cgr" style={{ fontSize: 12 }}>{s.cargadoPorNombre}</td>
                    <td style={{ fontSize: 12 }}>{s.anuladoPorNombre}<div className="cgr" style={{ fontSize: 11 }}>{fmtFecha(s.anuladoFecha)} {s.anuladoHora}</div></td>
                    <td style={{ fontSize: 12 }}>{s.motivoAnulacion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {devolviendo && (
        <ModalDevolver sena={devolviendo}
          onConfirmar={(motivo) => devolver(devolviendo, motivo)}
          onCancelar={() => setDevolviendo(null)} />
      )}
      {anulando && (
        <ModalAnular sena={anulando}
          onConfirmar={(motivo) => anularSena(anulando, motivo)}
          onCancelar={() => setAnulando(null)} />
      )}

      {modal && (
        <div className="mo" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="mc">
            <div className="mt">Nueva seña</div>
            <form onSubmit={guardar}>
              <div className="ff" style={{ marginBottom: 12, position: 'relative' }}>
                <label>Paciente *</label>
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="ff" style={{ marginBottom: 12 }}>
                <label>Monto *</label>
                <input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej: 5000" required />
              </div>
              <div className="ff" style={{ marginBottom: 12 }}>
                <label>Medio de pago</label>
                <select value={medioPago} onChange={e => setMedioPago(e.target.value)}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>
              <div className="re" style={{ marginTop: 18 }}>
                <button type="button" className="btn bs" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn bp" disabled={saving || !pacSel}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
