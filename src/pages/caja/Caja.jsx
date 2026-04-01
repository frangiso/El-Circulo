import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { registrarLog } from '../../utils/helpers'

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

export default function Caja() {
  const { currentUser, userProfile } = useAuth()
  const [mes, setMes] = useState(getMesActual())
  const [movimientos, setMovimientos] = useState([])
  const [kines, setKines] = useState([])
  const [kineFiltro, setKineFiltro] = useState('')
  const [tab, setTab] = useState('movimientos')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ tipo:'entrada', importe:'', detalle:'', profesionalId:'', esTransferencia:false, destinatario:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getDocs(query(collection(db, 'usuarios'), where('estado','==','activo')))
      .then(snap => setKines(snap.docs.map(d=>({id:d.id,...d.data()})).filter(u=>['kinesiologo','dueno'].includes(u.rol))))
  }, [])

  useEffect(() => { cargar() }, [mes])

  async function cargar() {
    setLoading(true)
    const snap = await getDocs(query(collection(db,'caja'), where('mes','==',mes), orderBy('timestamp','asc')))
    setMovimientos(snap.docs.map(d=>({id:d.id,...d.data()})))
    setLoading(false)
  }

  function setF(k,v) { setForm(f=>({...f,[k]:v})) }

  async function guardar(e) {
    e.preventDefault()
    if (!form.importe || !form.detalle) return alert('Completá importe y detalle')
    setSaving(true)
    try {
      const kine = kines.find(k=>k.id===form.profesionalId)
      await addDoc(collection(db,'caja'), {
        mes, tipo:form.tipo, importe:parseFloat(form.importe),
        detalle:form.detalle.trim(),
        profesionalId:form.profesionalId||null,
        profesionalNombre:kine?`${kine.apellido} ${kine.nombre}`:null,
        esTransferencia:form.esTransferencia,
        destinatario:form.esTransferencia?form.destinatario:null,
        cargadoPor:currentUser.uid,
        cargadoPorNombre:`${userProfile.apellido} ${userProfile.nombre}`,
        timestamp:serverTimestamp()
      })
      await registrarLog(currentUser.uid, `${userProfile.apellido} ${userProfile.nombre}`,
        form.tipo==='entrada'?'Entrada caja':'Salida caja',
        `${fmt(parseFloat(form.importe))} — ${form.detalle}`)
      setModal(false)
      setForm({tipo:'entrada',importe:'',detalle:'',profesionalId:'',esTransferencia:false,destinatario:''})
      cargar()
    } catch(err){ console.error(err); alert('Error al guardar') }
    setSaving(false)
  }

  const filtrados = kineFiltro ? movimientos.filter(m=>m.profesionalId===kineFiltro) : movimientos
  const transferencias = movimientos.filter(m=>m.esTransferencia)
  const totalEntradas = movimientos.filter(m=>m.tipo==='entrada').reduce((s,m)=>s+m.importe,0)
  const totalSalidas = movimientos.filter(m=>m.tipo==='salida').reduce((s,m)=>s+m.importe,0)
  const saldoFinal = totalEntradas - totalSalidas
  const resumenKines = kines.map(k=>{
    const ms = movimientos.filter(m=>m.profesionalId===k.id&&m.tipo==='entrada')
    return {...k, sesiones:ms.length, total:ms.reduce((s,m)=>s+m.importe,0)}
  }).filter(k=>k.total>0)

  let saldoAcum = 0
  const movConSaldo = filtrados.map(m=>{
    if(m.tipo==='entrada') saldoAcum+=m.importe; else saldoAcum-=m.importe
    return {...m, saldoAcum}
  })

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
        <h1 style={{fontSize:'20px',fontWeight:'600'}}>Control de caja</h1>
        <button className="btn btn-primary" onClick={()=>setModal(true)}>+ Movimiento</button>
      </div>

      <div className="metric-grid metric-grid-4">
        <div className="metric-card"><div className="metric-label">Total entradas</div><div className="metric-value" style={{color:'#3B6D11'}}>{fmt(totalEntradas)}</div></div>
        <div className="metric-card"><div className="metric-label">Total salidas</div><div className="metric-value" style={{color:'#A32D2D'}}>-{fmt(totalSalidas)}</div></div>
        <div className="metric-card"><div className="metric-label">Debe haber en caja</div><div className="metric-value" style={{color:'#185FA5'}}>{fmt(saldoFinal)}</div></div>
        <div className="metric-card"><div className="metric-label">Transferencias</div><div className="metric-value">{fmt(transferencias.reduce((s,m)=>s+m.importe,0))}</div></div>
      </div>

      <div className="filtros">
        <select value={mes} onChange={e=>setMes(e.target.value)}>
          {getMeses().map(m=><option key={m} value={m}>{labelMes(m)}</option>)}
        </select>
        <select value={kineFiltro} onChange={e=>setKineFiltro(e.target.value)}>
          <option value="">Todos los profesionales</option>
          {kines.map(k=><option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
        </select>
      </div>

      <div className="tabs">
        {[['movimientos','Movimientos'],['transferencias','Transferencias'],['resumen','Resumen por profesional']].map(([k,l])=>(
          <button key={k} className={'tab-btn'+(tab===k?' active':'')} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {loading ? <div className="loading-center"><div className="spinner"/></div> : <>
        {tab==='movimientos' && (
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Profesional</th><th>Detalle</th><th>Entradas</th><th>Salidas</th><th>Saldo</th><th>Cargado por</th></tr></thead>
                <tbody>
                  {movConSaldo.length===0
                    ? <tr><td colSpan="7" style={{textAlign:'center',padding:'30px',color:'#888'}}>Sin movimientos este mes</td></tr>
                    : movConSaldo.map(m=>(
                      <tr key={m.id}>
                        <td style={{color:'#888',whiteSpace:'nowrap'}}>{m.timestamp?.toDate?.()?.toLocaleDateString('es-AR')||'—'}</td>
                        <td>{m.profesionalNombre||'—'}</td>
                        <td>{m.detalle}</td>
                        <td style={{color:'#3B6D11',fontWeight:'500'}}>{m.tipo==='entrada'?fmt(m.importe):'—'}</td>
                        <td style={{color:'#A32D2D',fontWeight:'500'}}>{m.tipo==='salida'?`-${fmt(m.importe)}`:'—'}</td>
                        <td style={{fontWeight:'500'}}>{fmt(m.saldoAcum)}</td>
                        <td style={{color:'#888'}}>{m.cargadoPorNombre}</td>
                      </tr>
                    ))
                  }
                  {movConSaldo.length>0 && <tr className="total-row">
                    <td colSpan="3">Total {labelMes(mes)}</td>
                    <td style={{color:'#3B6D11'}}>{fmt(totalEntradas)}</td>
                    <td style={{color:'#A32D2D'}}>-{fmt(totalSalidas)}</td>
                    <td style={{color:'#185FA5'}}>{fmt(saldoFinal)}</td>
                    <td></td>
                  </tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==='transferencias' && (
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Destinatario</th><th>Detalle</th><th>Importe</th><th>Cargado por</th></tr></thead>
                <tbody>
                  {transferencias.length===0
                    ? <tr><td colSpan="5" style={{textAlign:'center',padding:'30px',color:'#888'}}>Sin transferencias este mes</td></tr>
                    : transferencias.map(m=>(
                      <tr key={m.id}>
                        <td style={{color:'#888'}}>{m.timestamp?.toDate?.()?.toLocaleDateString('es-AR')||'—'}</td>
                        <td>{m.destinatario||'—'}</td>
                        <td>{m.detalle}</td>
                        <td style={{color:'#A32D2D',fontWeight:'500'}}>-{fmt(m.importe)}</td>
                        <td style={{color:'#888'}}>{m.cargadoPorNombre}</td>
                      </tr>
                    ))
                  }
                  {transferencias.length>0 && <tr className="total-row">
                    <td colSpan="3">Total transferencias</td>
                    <td style={{color:'#A32D2D'}}>-{fmt(transferencias.reduce((s,m)=>s+m.importe,0))}</td>
                    <td></td>
                  </tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==='resumen' && (
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Profesional</th><th>Sesiones cobradas</th><th>Total facturado</th></tr></thead>
                <tbody>
                  {resumenKines.length===0
                    ? <tr><td colSpan="3" style={{textAlign:'center',padding:'30px',color:'#888'}}>Sin datos este mes</td></tr>
                    : <>{resumenKines.map(k=>(
                        <tr key={k.id}>
                          <td>{k.apellido} {k.nombre}</td>
                          <td>{k.sesiones}</td>
                          <td style={{color:'#3B6D11',fontWeight:'500'}}>{fmt(k.total)}</td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td>Total</td>
                        <td>{resumenKines.reduce((s,k)=>s+k.sesiones,0)}</td>
                        <td style={{color:'#185FA5'}}>{fmt(resumenKines.reduce((s,k)=>s+k.total,0))}</td>
                      </tr>
                    </>
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>}

      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}}>
          <div style={{background:'#fff',borderRadius:'12px',padding:'24px',width:'100%',maxWidth:'440px',margin:'16px'}}>
            <div style={{fontSize:'16px',fontWeight:'600',marginBottom:'18px'}}>Nuevo movimiento — {labelMes(mes)}</div>
            <form onSubmit={guardar}>
              <div className="form-grid" style={{marginBottom:'14px'}}>
                <div className="form-field"><label>Tipo *</label>
                  <select value={form.tipo} onChange={e=>setF('tipo',e.target.value)}>
                    <option value="entrada">Entrada</option>
                    <option value="salida">Salida</option>
                  </select>
                </div>
                <div className="form-field"><label>Importe *</label>
                  <input type="number" min="0" step="0.01" value={form.importe} onChange={e=>setF('importe',e.target.value)} placeholder="Ej: 8500" required />
                </div>
                <div className="form-field full"><label>Detalle *</label>
                  <input value={form.detalle} onChange={e=>setF('detalle',e.target.value)} placeholder="Ej: Pago sesión — García Juan" required />
                </div>
                <div className="form-field full"><label>Profesional (opcional)</label>
                  <select value={form.profesionalId} onChange={e=>setF('profesionalId',e.target.value)}>
                    <option value="">Sin profesional</option>
                    {kines.map(k=><option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
                  </select>
                </div>
                <div className="form-field full" style={{flexDirection:'row',alignItems:'center',gap:'8px'}}>
                  <input type="checkbox" id="esTrans" checked={form.esTransferencia} onChange={e=>setF('esTransferencia',e.target.checked)} />
                  <label htmlFor="esTrans" style={{margin:0,cursor:'pointer'}}>Es una transferencia</label>
                </div>
                {form.esTransferencia && (
                  <div className="form-field full"><label>Destinatario</label>
                    <input value={form.destinatario} onChange={e=>setF('destinatario',e.target.value)} placeholder="Ej: Luis, Germán..." />
                  </div>
                )}
              </div>
              <div className="row-end">
                <button type="button" className="btn btn-secondary" onClick={()=>setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
