import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useCache } from '../../context/AppCache'
import { mesActual, labelMes, getMeses, fmtMonto, escribirLog, fmtFecha } from '../../utils/helpers'

const ILupa = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
)

export default function Caja() {
  const { user, perfil } = useAuth()
  const { getKines } = useCache()
  const [mes, setMes]       = useState(mesActual())
  const [docC, setDocC]     = useState(null)
  const [kines, setKines]   = useState([])
  const [tab, setTab]       = useState('movimientos')
  const [carg, setCarg]     = useState(false)
  const [cargado, setCargado] = useState(false)
  const [modal, setModal]   = useState(false)
  const [fMov, setFM]       = useState({ tipo: 'entrada', desc: '', importe: '', kineId: '' })
  const [saving, setSaving] = useState(false)
  const [filtroDia, setFiltroDia] = useState('')

  useEffect(() => { getKines().then(setKines) }, [])

  // Cambia de mes → resetea todo, no lee nada
  function onMesChange(m) {
    setMes(m)
    setDocC(null)
    setCargado(false)
    setFiltroDia('')
  }

  // Lee la caja SOLO cuando el usuario hace clic en "Ver caja"
  async function cargarCaja() {
    setCarg(true)
    const snap = await getDoc(doc(db, 'caja', 'caja_' + mes))
    setDocC(snap.exists() ? { id: snap.id, ...snap.data() } : null)
    setCargado(true)
    setCarg(false)
  }

  const movs    = docC?.movimientos || []
  const saldoI  = docC?.saldoInicial || 0
  const entradas = movs.filter(m => m.tipo === 'entrada').reduce((a, m) => a + m.importe, 0)
  const salidas  = movs.filter(m => m.tipo !== 'entrada').reduce((a, m) => a + m.importe, 0)
  const saldoF   = saldoI + entradas - salidas

  // Filtro por día — en memoria, sin Firestore
  const movsVis = !filtroDia
    ? movs
    : movs.filter(m => m.fecha === filtroDia)

  function saldoFila(idx) {
    let s = saldoI
    for (let i = 0; i <= idx; i++) {
      s += movs[i].tipo === 'entrada' ? movs[i].importe : -movs[i].importe
    }
    return s
  }

  const resumenK = kines.map(k => {
    const ms = movs.filter(m => m.kineId === k.id && m.tipo === 'entrada')
    return { ...k, ses: ms.length, total: ms.reduce((a, m) => a + m.importe, 0) }
  }).filter(k => k.ses > 0)

  const transf = !filtroDia
    ? movs.filter(m => m.tipo === 'transferencia')
    : movs.filter(m => m.tipo === 'transferencia' && m.fecha === filtroDia)

  const setF = (k, v) => setFM(p => ({ ...p, [k]: v }))

  async function guardarMov(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const kine = kines.find(k => k.id === fMov.kineId)
      const mov = {
        tipo: fMov.tipo,
        descripcion: fMov.desc,
        importe: parseFloat(fMov.importe),
        kineId: fMov.kineId || null,
        profesionalNombre: kine ? kine.apellido + ' ' + kine.nombre : null,
        cargadoPor: user.uid,
        cargadoPorNombre: perfil.apellido + ' ' + perfil.nombre,
        fecha: new Date().toISOString().split('T')[0],
        hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      }
      const ref = doc(db, 'caja', 'caja_' + mes)
      if (!docC) {
        const esIni = fMov.tipo === 'saldoInicial'
        const data = {
          mes,
          saldoInicial: esIni ? parseFloat(fMov.importe) : 0,
          movimientos: esIni ? [] : [mov],
          creadoEn: serverTimestamp()
        }
        await setDoc(ref, data)
        setDocC(data)
      } else if (fMov.tipo === 'saldoInicial') {
        await updateDoc(ref, { saldoInicial: parseFloat(fMov.importe) })
        setDocC(p => ({ ...p, saldoInicial: parseFloat(fMov.importe) }))
      } else {
        await updateDoc(ref, { movimientos: arrayUnion(mov) })
        setDocC(p => ({ ...p, movimientos: [...(p.movimientos || []), mov] }))
      }
      await escribirLog(user.uid, perfil.apellido + ' ' + perfil.nombre,
        'Movimiento caja', fMov.tipo + ' $' + fMov.importe + ' — ' + fMov.desc)
      setFM({ tipo: 'entrada', desc: '', importe: '', kineId: '' })
      setModal(false)
    } catch (err) {
      console.error(err)
      alert('Error al guardar')
    }
    setSaving(false)
  }

  // Días únicos del mes para el selector
  const diasDelMes = [...new Set(movs.map(m => m.fecha).filter(Boolean))].sort()

  function renderMovimientos() {
    return (
      <div>
        {/* Filtro por día */}
        <div className="filtros">
          <div className="sw" style={{ minWidth: 200 }}>
            <ILupa />
            <input
              className="si"
              type="date"
              value={filtroDia}
              onChange={e => setFiltroDia(e.target.value)}
              style={{ paddingLeft: 33 }}
            />
          </div>
          {filtroDia && (
            <button className="btn bs bsm" onClick={() => setFiltroDia('')}>
              Ver todo el mes
            </button>
          )}
          {filtroDia && (
            <span style={{ fontSize: 13, color: '#666' }}>
              Mostrando: {fmtFecha(filtroDia)}
            </span>
          )}
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Fecha/Hora</th><th>Profesional</th><th>Detalle</th>
                  <th>Entradas</th><th>Salidas</th><th>Saldo acumulado</th><th>Cargado por</th>
                </tr>
              </thead>
              <tbody>
                {!filtroDia && saldoI > 0 && (
                  <tr>
                    <td className="cgr">—</td><td>—</td><td>Saldo inicial</td>
                    <td className="cve fw6">{fmtMonto(saldoI)}</td>
                    <td>—</td>
                    <td className="fw6">{fmtMonto(saldoI)}</td>
                    <td className="cgr">Sistema</td>
                  </tr>
                )}
                {movsVis.length === 0 && (
                  <tr><td colSpan="7" className="emt">
                    {filtroDia ? 'No hay movimientos para este día' : 'Sin movimientos este mes'}
                  </td></tr>
                )}
                {movsVis.map((m, i) => (
                  <tr key={i}>
                    <td className="cgr" style={{ fontSize: 12 }}>{fmtFecha(m.fecha)} {m.hora}</td>
                    <td>{m.profesionalNombre || '—'}</td>
                    <td>{m.descripcion}</td>
                    <td className="cve fw6">{m.tipo === 'entrada' ? '+' + fmtMonto(m.importe) : '—'}</td>
                    <td className="cro fw6">{m.tipo !== 'entrada' ? '-' + fmtMonto(m.importe) : '—'}</td>
                    <td className="fw6">{fmtMonto(saldoFila(movs.indexOf(m)))}</td>
                    <td className="cgr" style={{ fontSize: 12 }}>{m.cargadoPorNombre}</td>
                  </tr>
                ))}
                {!filtroDia && (
                  <tr className="ttr">
                    <td colSpan="3">Total del mes</td>
                    <td className="cve">+{fmtMonto(entradas)}</td>
                    <td className="cro">-{fmtMonto(salidas)}</td>
                    <td className="caz">{fmtMonto(saldoF)}</td>
                    <td />
                  </tr>
                )}
                {filtroDia && (
                  <tr className="ttr">
                    <td colSpan="3">Total del día</td>
                    <td className="cve">+{fmtMonto(movsVis.filter(m=>m.tipo==='entrada').reduce((a,m)=>a+m.importe,0))}</td>
                    <td className="cro">-{fmtMonto(movsVis.filter(m=>m.tipo!=='entrada').reduce((a,m)=>a+m.importe,0))}</td>
                    <td />
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  function renderTransferencias() {
    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Fecha/Hora</th><th>Detalle</th><th>Importe</th><th>Cargado por</th></tr>
            </thead>
            <tbody>
              {transf.length === 0 && (
                <tr><td colSpan="4" className="emt">Sin transferencias</td></tr>
              )}
              {transf.map((m, i) => (
                <tr key={i}>
                  <td className="cgr" style={{ fontSize: 12 }}>{fmtFecha(m.fecha)} {m.hora}</td>
                  <td>{m.descripcion}</td>
                  <td className="cro fw6">-{fmtMonto(m.importe)}</td>
                  <td className="cgr" style={{ fontSize: 12 }}>{m.cargadoPorNombre}</td>
                </tr>
              ))}
              {transf.length > 0 && (
                <tr className="ttr">
                  <td colSpan="2">Total</td>
                  <td className="cro">-{fmtMonto(transf.reduce((a, m) => a + m.importe, 0))}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderResumen() {
    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Profesional</th><th>Sesiones</th><th>Total facturado</th></tr>
            </thead>
            <tbody>
              {resumenK.length === 0 && (
                <tr><td colSpan="3" className="emt">Sin datos este mes</td></tr>
              )}
              {resumenK.map(k => (
                <tr key={k.id}>
                  <td className="fw6">{k.apellido} {k.nombre}</td>
                  <td>{k.ses}</td>
                  <td className="cve fw6">{fmtMonto(k.total)}</td>
                </tr>
              ))}
              {resumenK.length > 0 && (
                <tr className="ttr">
                  <td>Total</td>
                  <td>{resumenK.reduce((a, k) => a + k.ses, 0)}</td>
                  <td className="caz">{fmtMonto(resumenK.reduce((a, k) => a + k.total, 0))}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="ph">
        <div className="ptitle">Control de caja</div>
        <div className="row">
          {cargado && (
            <button className="btn bp" onClick={() => setModal(true)}>+ Movimiento</button>
          )}
        </div>
      </div>

      {/* Selector de mes + botón cargar */}
      <div className="filtros" style={{ marginBottom: 16 }}>
        <select value={mes} onChange={e => onMesChange(e.target.value)}>
          {getMeses(12).map(m => (
            <option key={m} value={m}>{labelMes(m)}</option>
          ))}
        </select>
        <button className="btn bp" onClick={cargarCaja} disabled={carg}>
          {carg ? 'Cargando...' : cargado ? 'Actualizar' : 'Ver caja'}
        </button>
      </div>

      {!cargado ? (
        <div className="card">
          <div className="empty-search">
            <ILupa />
            <p>Elegí el mes y hacé clic en "Ver caja"</p>
            <span>Se carga solo cuando lo pedís — sin lecturas innecesarias</span>
          </div>
        </div>
      ) : carg ? (
        <div className="sc"><div className="sp" /></div>
      ) : (
        <div>
          {/* Métricas */}
          <div className="mets m4" style={{ marginBottom: 16 }}>
            <div className="met"><div className="met-l">Saldo inicial</div><div className="met-v">{fmtMonto(saldoI)}</div></div>
            <div className="met"><div className="met-l">Total entradas</div><div className="met-v cve">+{fmtMonto(entradas)}</div></div>
            <div className="met"><div className="met-l">Total salidas</div><div className="met-v cro">-{fmtMonto(salidas)}</div></div>
            <div className="met"><div className="met-l">Debe haber en caja</div><div className="met-v caz">{fmtMonto(saldoF)}</div></div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button className={'tab ' + (tab === 'movimientos' ? 'on' : '')} onClick={() => setTab('movimientos')}>Movimientos</button>
            <button className={'tab ' + (tab === 'transferencias' ? 'on' : '')} onClick={() => setTab('transferencias')}>Transferencias</button>
            <button className={'tab ' + (tab === 'resumen' ? 'on' : '')} onClick={() => setTab('resumen')}>Por profesional</button>
          </div>

          {tab === 'movimientos' && renderMovimientos()}
          {tab === 'transferencias' && renderTransferencias()}
          {tab === 'resumen' && renderResumen()}
        </div>
      )}

      {/* Modal nuevo movimiento */}
      {modal && (
        <div className="mo" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="mc">
            <div className="mt">Nuevo movimiento</div>
            <form onSubmit={guardarMov}>
              <div className="ff" style={{ marginBottom: 12 }}>
                <label>Tipo</label>
                <select value={fMov.tipo} onChange={e => setF('tipo', e.target.value)}>
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="saldoInicial">Saldo inicial del mes</option>
                </select>
              </div>
              <div className="ff" style={{ marginBottom: 12 }}>
                <label>Descripción *</label>
                <input value={fMov.desc} onChange={e => setF('desc', e.target.value)}
                  placeholder="Ej: Pago sesión García" required />
              </div>
              <div className="ff" style={{ marginBottom: 12 }}>
                <label>Importe *</label>
                <input type="number" min="0" step="0.01" value={fMov.importe}
                  onChange={e => setF('importe', e.target.value)} placeholder="Ej: 8500" required />
              </div>
              {fMov.tipo === 'entrada' && (
                <div className="ff" style={{ marginBottom: 12 }}>
                  <label>Profesional (opcional)</label>
                  <select value={fMov.kineId} onChange={e => setF('kineId', e.target.value)}>
                    <option value="">Sin profesional</option>
                    {kines.map(k => (
                      <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="re" style={{ marginTop: 18 }}>
                <button type="button" className="btn bs" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn bp" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
