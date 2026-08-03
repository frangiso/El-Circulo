import { useEffect, useState } from 'react'
import { collection, addDoc, doc, getDoc, updateDoc, writeBatch, serverTimestamp, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCache } from '../../context/AppCache'
import { calcVenc, estadoPlan, escribirLog, OBRAS_BASE } from '../../utils/helpers'

const INIT = { nombre:'', apellido:'', dni:'', telefono:'', obraSocial:'', nroAfiliado:'', diagnostico:'', sesionesTotal:'', sesionesUsadas:0, fechaInicio:'', kinesiologoRef:'', observaciones:'', ordenFecha:'', ordenDetalle:'' }

// Busca duplicados SOLO por DNI — pueden existir pacientes con el mismo nombre
async function buscarDuplicado(nombre, apellido, dni, idExcluir) {
  const resultados = []
  if (!dni || !dni.trim()) return resultados
  const snapDni = await getDocs(query(collection(db,'pacientes'), where('dni','==',dni.trim())))
  snapDni.docs.forEach(d => {
    if (d.id !== idExcluir) resultados.push({ id: d.id, ...d.data() })
  })
  return resultados
}

function Form({ inicial, titulo, onGuardar, saving, eraArch, idExcluir }) {
  const { getKines, getObras } = useCache()
  const [kines, setKines] = useState([])
  const [obras, setObras] = useState(OBRAS_BASE)
  const [f, setF] = useState(inicial)
  const [duplicado, setDuplicado] = useState(null)
  const [chequando, setChequando] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const venc = f.fechaInicio ? calcVenc(f.fechaInicio) : null

  useEffect(() => {
    Promise.all([getKines(), getObras()]).then(([k,o]) => { setKines(k); setObras(o) })
  }, [])

  // Verificar duplicado al salir del campo DNI
  async function verificarDuplicado() {
    if (!f.dni || !f.dni.trim()) return
    setChequando(true)
    const dupes = await buscarDuplicado(f.nombre, f.apellido, f.dni, idExcluir)
    setDuplicado(dupes.length > 0 ? dupes[0] : null)
    setChequando(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    // Verificar duplicado antes de guardar
    const dupes = await buscarDuplicado(f.nombre, f.apellido, f.dni, idExcluir)
    if (dupes.length > 0) {
      setDuplicado(dupes[0])
      return
    }
    onGuardar(f)
  }

  return (
    <form onSubmit={handleSubmit}>
      {duplicado && (
        <div className="al alr" style={{ marginBottom: 14 }}>
          ⚠ Ya existe un paciente con estos datos: <strong>{duplicado.apellido} {duplicado.nombre}</strong>
          {duplicado.dni ? ` — DNI ${duplicado.dni}` : ''}.
          {' '}Verificá antes de continuar.
          <button type="button" className="btn bs bsm" style={{ marginLeft: 8 }} onClick={() => setDuplicado(null)}>
            Ignorar y continuar
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-title">Datos personales</div>
        <div className="fg">
          <div className="ff">
            <label>Nombre *</label>
            <input value={f.nombre}
              onChange={e => set('nombre', e.target.value)} required />
          </div>
          <div className="ff">
            <label>Apellido *</label>
            <input value={f.apellido}
              onChange={e => set('apellido', e.target.value)} required />
          </div>
          <div className="ff">
            <label>DNI</label>
            <input value={f.dni}
              onChange={e => { set('dni', e.target.value); setDuplicado(null) }}
              onBlur={verificarDuplicado} />
            {chequando && <span style={{ fontSize: 11, color: '#888' }}>Verificando...</span>}
          </div>
          <div className="ff">
            <label>Teléfono</label>
            <input value={f.telefono} onChange={e => set('telefono', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Obra social</div>
        <div className="fg">
          <div className="ff">
            <label>Obra social</label>
            <input list="obs-dl" value={f.obraSocial} onChange={e => set('obraSocial', e.target.value)} placeholder="Seleccioná o escribí una nueva..." />
            <datalist id="obs-dl">{obras.map(o => <option key={o} value={o} />)}</datalist>
            <span className="hint">Si escribís una nueva se guarda automáticamente</span>
          </div>
          <div className="ff">
            <label>N° de afiliado</label>
            <input value={f.nroAfiliado} onChange={e => set('nroAfiliado', e.target.value)} />
          </div>
          <div className="ff full">
            <label>Diagnóstico</label>
            <input value={f.diagnostico} onChange={e => set('diagnostico', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Orden médica</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
          Opcional — se puede cargar el paciente sin haber recibido la orden todavía.
        </div>
        <div className="fg">
          <div className="ff">
            <label>Fecha de entrega de la orden</label>
            <input type="date" value={f.ordenFecha} onChange={e => set('ordenFecha', e.target.value)} />
          </div>
          <div className="ff full">
            <label>Detalle de la orden</label>
            <input value={f.ordenDetalle} onChange={e => set('ordenDetalle', e.target.value)} placeholder="Ej: 10 sesiones kinesiología — cervical" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          Plan de sesiones{' '}
          {eraArch && <span style={{ color: 'var(--na)', fontSize: 12, fontWeight: 400 }}>(cargá uno nuevo para reactivar)</span>}
        </div>
        <div className="fg">
          <div className="ff">
            <label>Total sesiones autorizadas</label>
            <input type="number" min="1" value={f.sesionesTotal} onChange={e => set('sesionesTotal', e.target.value)} />
          </div>
          {eraArch && (
            <div className="ff">
              <label>Sesiones ya realizadas</label>
              <input type="number" min="0" value={f.sesionesUsadas} onChange={e => set('sesionesUsadas', e.target.value)} />
            </div>
          )}
          <div className="ff">
            <label>Fecha de inicio del plan</label>
            <input type="date" value={f.fechaInicio} onChange={e => set('fechaInicio', e.target.value)} />
          </div>
          <div className="ff full">
            <label>Kinesiológo referente</label>
            <select value={f.kinesiologoRef} onChange={e => set('kinesiologoRef', e.target.value)}>
              <option value="">Sin asignar</option>
              {kines.map(k => <option key={k.id} value={k.id}>{k.apellido} {k.nombre}</option>)}
            </select>
          </div>
        </div>
        {venc && <div className="al alb" style={{ marginTop: 10, marginBottom: 0 }}>Vencimiento calculado: {venc} (45 días hábiles)</div>}
      </div>

      <div className="card">
        <div className="card-title">Observaciones</div>
        <div className="ff">
          <label>Notas adicionales</label>
          <textarea value={f.observaciones} onChange={e => set('observaciones', e.target.value)} />
        </div>
      </div>

      <div className="re">
        <button type="button" className="btn bs" onClick={() => history.back()}>Cancelar</button>
        <button type="submit" className="btn bp" disabled={saving || !!duplicado}>
          {saving ? 'Guardando...' : titulo}
        </button>
      </div>
    </form>
  )
}

export function NuevoPaciente() {
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const { getObras, invalidarPacs, invalidarObras } = useCache()
  const [saving, setSaving] = useState(false)

  async function guardar(f) {
    setSaving(true)
    try {
      if (f.obraSocial && !OBRAS_BASE.includes(f.obraSocial)) {
        await addDoc(collection(db,'obrasSociales'), { nombre: f.obraSocial })
        invalidarObras()
      }
      const venc = f.fechaInicio ? calcVenc(f.fechaInicio) : null
      const plan = f.sesionesTotal ? {
        sesionesTotal: parseInt(f.sesionesTotal), sesionesUsadas: 0,
        fechaInicio: f.fechaInicio || null, fechaVencimiento: venc,
        kinesiologoRef: f.kinesiologoRef || null
      } : null
      await addDoc(collection(db,'pacientes'), {
        nombre: f.nombre.trim(), apellido: f.apellido.trim(),
        dni: f.dni.trim(), telefono: f.telefono.trim(),
        obraSocial: f.obraSocial.trim(), nroAfiliado: f.nroAfiliado.trim(),
        diagnostico: f.diagnostico.trim(), observaciones: f.observaciones.trim(),
        ordenFecha: f.ordenFecha || null, ordenDetalle: f.ordenDetalle.trim(),
        plan, archivado: false, creadoPor: user.uid, creadoEn: serverTimestamp()
      })
      invalidarPacs()
      await escribirLog(user.uid, `${perfil.apellido} ${perfil.nombre}`, 'Nuevo paciente', `${f.apellido} ${f.nombre}`)
      navigate('/pacientes')
    } catch(err) { console.error(err); alert('Error al guardar') }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="row" style={{ marginBottom: 20 }}>
        <button className="btn bs bsm" onClick={() => navigate(-1)}>← Volver</button>
        <div className="ptitle">Nuevo paciente</div>
      </div>
      <div className="al alb">El plan se puede cargar ahora o después desde la ficha.</div>
      <Form inicial={INIT} titulo="Guardar paciente" onGuardar={guardar} saving={saving} eraArch={false} idExcluir={null} />
    </div>
  )
}

export function EditarPaciente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const { invalidarPacs, invalidarObras } = useCache()
  const [inicial, setInicial] = useState(null)
  const [eraArch, setEraArch] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [planAnterior, setPlanAnterior] = useState(null)

  useEffect(() => {
    getDoc(doc(db,'pacientes',id)).then(s => {
      if (!s.exists()) { navigate('/pacientes'); return }
      const d = s.data(); setEraArch(d.archivado === true)
      setPlanAnterior(d.plan || null)
      setInicial({
        nombre: d.nombre||'', apellido: d.apellido||'', dni: d.dni||'', telefono: d.telefono||'',
        obraSocial: d.obraSocial||'', nroAfiliado: d.nroAfiliado||'',
        diagnostico: d.diagnostico||'', observaciones: d.observaciones||'',
        sesionesTotal: d.plan?.sesionesTotal||'', sesionesUsadas: d.plan?.sesionesUsadas||0,
        fechaInicio: d.plan?.fechaInicio||'', kinesiologoRef: d.plan?.kinesiologoRef||'',
        ordenFecha: d.ordenFecha||'', ordenDetalle: d.ordenDetalle||''
      })
    })
  }, [id])

  async function guardar(f) {
    setSaving(true)
    try {
      if (f.obraSocial && !OBRAS_BASE.includes(f.obraSocial)) {
        await addDoc(collection(db,'obrasSociales'), { nombre: f.obraSocial }); invalidarObras()
      }
      const venc = f.fechaInicio ? calcVenc(f.fechaInicio) : null

      // Si se está cargando un plan, las sesiones ya registradas sin autorización
      // se descuentan del total (quedan marcadas como autorizadas y numeradas)
      let sesionesUsadas = parseInt(f.sesionesUsadas)||0
      let pendientes = []
      if (f.sesionesTotal) {
        const pendSnap = await getDocs(query(
          collection(db,'turnos'), where('pacienteId','==',id), where('autorizado','==',false)
        ))
        pendientes = pendSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a,b) => (a.fecha||'').localeCompare(b.fecha||''))
        sesionesUsadas += pendientes.length
      }

      // Si se está dando de baja el plan que había (se vació "Total sesiones
      // autorizadas"), las sesiones que se hicieron bajo ese plan vuelven a
      // quedar sin autorizar, para descontarlas de nuevo cuando llegue la orden real
      let revertidas = []
      if (!f.sesionesTotal && planAnterior) {
        const tSnap = await getDocs(query(collection(db,'turnos'), where('pacienteId','==',id)))
        revertidas = tSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t =>
          t.asistencia === 'asistio' && t.autorizado !== false &&
          (!planAnterior.fechaInicio || (t.fecha||'') >= planAnterior.fechaInicio)
        )
      }

      const plan = f.sesionesTotal ? {
        sesionesTotal: parseInt(f.sesionesTotal), sesionesUsadas,
        fechaInicio: f.fechaInicio||null, fechaVencimiento: venc,
        kinesiologoRef: f.kinesiologoRef||null
      } : null
      const nuevoEst = plan ? estadoPlan(plan) : 'sin-plan'

      const batch = writeBatch(db)
      batch.update(doc(db,'pacientes',id), {
        nombre: f.nombre.trim(), apellido: f.apellido.trim(), dni: f.dni.trim(), telefono: f.telefono.trim(),
        obraSocial: f.obraSocial.trim(), nroAfiliado: f.nroAfiliado.trim(),
        diagnostico: f.diagnostico.trim(), observaciones: f.observaciones.trim(),
        ordenFecha: f.ordenFecha || null, ordenDetalle: f.ordenDetalle.trim(),
        plan, archivado: nuevoEst === 'vencido', actualizadoEn: serverTimestamp()
      })
      let numero = parseInt(f.sesionesUsadas)||0
      pendientes.forEach(t => {
        numero++
        batch.update(doc(db,'turnos',t.id), { autorizado: true, nroSesion: numero })
      })
      revertidas.forEach(t => {
        batch.update(doc(db,'turnos',t.id), { autorizado: false, nroSesion: null })
      })
      await batch.commit()

      invalidarPacs()
      const acc = eraArch && nuevoEst !== 'vencido' ? 'Reactivó paciente' : 'Edición paciente'
      await escribirLog(user.uid, `${perfil.apellido} ${perfil.nombre}`, acc, `${f.apellido} ${f.nombre}`)
      if (pendientes.length > 0) {
        await escribirLog(user.uid, `${perfil.apellido} ${perfil.nombre}`, 'Autorizó sesiones pendientes',
          `${pendientes.length} sesión${pendientes.length>1?'es':''} de ${f.apellido} ${f.nombre}`)
      }
      if (revertidas.length > 0) {
        await escribirLog(user.uid, `${perfil.apellido} ${perfil.nombre}`, 'Dio de baja el plan',
          `${revertidas.length} sesión${revertidas.length>1?'es':''} de ${f.apellido} ${f.nombre} volvió a quedar sin autorizar`)
      }
      navigate(`/pacientes/${id}`)
    } catch(err) { console.error(err); alert('Error al guardar') }
    setSaving(false)
  }

  if (!inicial) return <div className="sc"><div className="sp" /></div>

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="row" style={{ marginBottom: 20 }}>
        <button className="btn bs bsm" onClick={() => navigate(-1)}>← Volver</button>
        <div className="ptitle">{eraArch ? 'Reactivar paciente' : 'Editar paciente'}</div>
      </div>
      {eraArch && <div className="al ala">Paciente archivado. Cargá un plan nuevo con fecha válida para reactivarlo.</div>}
      <Form inicial={inicial} titulo="Guardar cambios" onGuardar={guardar} saving={saving} eraArch={eraArch} idExcluir={id} />
    </div>
  )
}

export default NuevoPaciente
