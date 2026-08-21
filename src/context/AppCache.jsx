import { createContext, useContext, useRef, useCallback } from 'react'
import { collection, getDocs, query, where, orderBy,
  doc, writeBatch, getDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { OBRAS_BASE, hoy, esParticular, esPami } from '../utils/helpers'

const Ctx = createContext()
export const useCache = () => useContext(Ctx)
const TTL = 30 * 60 * 1000 // 30 minutos
const OBRAS_BASE_NORM = OBRAS_BASE.map(o => o.trim().toLowerCase())

export function CacheProvider({ children }) {
  const s = useRef({})
  const get = (k) => { const e=s.current[k]; if(!e||Date.now()-e.ts>TTL) return null; return e.data }
  const set = (k,data) => { s.current[k]={data,ts:Date.now()}; return data }
  const del = (...ks) => ks.forEach(k=>delete s.current[k])

  // Usuarios del sistema (secretarias, dueños)
  const getUsuarios = useCallback(async (force=false) => {
    if (!force) { const c=get('usuarios'); if(c) return c }
    const snap = await getDocs(collection(db,'usuarios'))
    return set('usuarios', snap.docs.map(d=>({id:d.id,...d.data()})))
  }, [])

  // Kinesiológos — ahora vienen de la colección 'kinesiologos' (carga manual)
  const getKines = useCallback(async (force=false) => {
    if (!force) { const c=get('kines'); if(c) return c }
    const snap = await getDocs(query(collection(db,'kinesiologos'), where('activo','==',true)))
    return set('kines', snap.docs.map(d=>({id:d.id,...d.data()})))
  }, [])

  const getObras = useCallback(async () => {
    const c=get('obras'); if(c) return c
    const snap = await getDocs(collection(db,'obrasSociales'))
    return set('obras', [...new Set([...OBRAS_BASE,...snap.docs.map(d=>d.data().nombre)])].sort())
  }, [])

  const getPacientes = useCallback(async (force=false) => {
    if (!force) { const c=get('pacs'); if(c) return c }
    const snap = await getDocs(query(
      collection(db,'pacientes'), where('archivado','==',false), orderBy('apellido')
    ))
    return set('pacs', snap.docs.map(d=>({id:d.id,...d.data()})))
  }, [])

  // Limpieza diaria — reservada para futuras tareas de mantenimiento (corre 1 vez
  // por día, vía config/limpieza). Hoy no hace nada por sí sola.
  const limpiar = useCallback(async () => {
    if (get('limpiezaOk')) return
    try {
      const hoyStr = hoy()
      const configRef = doc(db,'config','limpieza')
      const configSnap = await getDoc(configRef)
      if (configSnap.exists() && configSnap.data().fecha === hoyStr) {
        set('limpiezaOk', true); return
      }
      await setDoc(configRef, { fecha: hoyStr })
    } catch(e) { console.error('Limpieza:',e) }
    set('limpiezaOk', true)
  }, [])

  // Migración de una sola vez: los pacientes ya no se archivan automáticamente por
  // vencimiento de plan, así que se reactiva cualquiera que haya quedado archivado
  // por esa lógica vieja. Usa su propio candado (independiente del de la limpieza
  // diaria) para que corra apenas se despliega el cambio, sin esperar a que cambie
  // la fecha del candado diario si ese ya se había usado hoy.
  const reactivarPacientes = useCallback(async () => {
    if (get('reactivacionOk')) return
    try {
      const configRef = doc(db,'config','reactivarPacientes')
      const configSnap = await getDoc(configRef)
      if (configSnap.exists() && configSnap.data().hecho === true) {
        set('reactivacionOk', true); return
      }
      const snapArchivados = await getDocs(query(collection(db,'pacientes'), where('archivado','==',true)))
      if (snapArchivados.docs.length > 0) {
        const batch = writeBatch(db)
        snapArchivados.docs.forEach(d => batch.update(doc(db,'pacientes',d.id), { archivado: false, fechaArchivado: null }))
        await batch.commit(); del('pacs')
      }
      await setDoc(configRef, { hecho: true })
    } catch(e) { console.error('Reactivación de pacientes:',e) }
    set('reactivacionOk', true)
  }, [])

  // Migración de una sola vez: antes de que existiera la pestaña de Órdenes, cada
  // paciente solo guardaba el dato de su última orden (fecha + detalle) suelto en
  // la ficha. Se importa esa última orden como primer registro en la colección
  // nueva 'ordenes' para que no arranque vacía — no reconstruye el historial
  // completo (nunca se guardó una por una), solo la última conocida de cada uno.
  const migrarOrdenes = useCallback(async () => {
    if (get('migracionOrdenesOk')) return
    try {
      const configRef = doc(db,'config','migracionOrdenes')
      const configSnap = await getDoc(configRef)
      if (configSnap.exists() && configSnap.data().hecho === true) {
        set('migracionOrdenesOk', true); return
      }
      const snap = await getDocs(collection(db,'pacientes'))
      const candidatos = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.ordenFecha && !esParticular(p))
      for (const p of candidatos) {
        const pami = esPami(p)
        const sesiones = pami ? (p.copagoPlan?.sesionesTotal || 0) : (p.plan?.sesionesTotal || 0)
        if (!sesiones) continue
        await addDoc(collection(db,'ordenes'), {
          pacienteId: p.id, pacienteNombre: p.nombre, pacienteApellido: p.apellido,
          pacienteDni: p.dni || '', obraSocial: p.obraSocial || '',
          fechaEntrega: p.ordenFecha, sesiones, detalle: p.ordenDetalle || '',
          esPami: pami, migrada: true,
          cargadoPor: 'sistema', cargadoPorNombre: 'Migración automática', creadoEn: serverTimestamp()
        })
      }
      await setDoc(configRef, { hecho: true })
    } catch(e) { console.error('Migración de órdenes:',e) }
    set('migracionOrdenesOk', true)
  }, [])

  // Migración de una sola vez: antes, al cargar la obra social de un paciente solo
  // se chequeaba si ya estaba en la lista base del sistema (no contra las que ya
  // habían agregado otras secretarias), así que la misma obra social terminaba
  // creándose repetida cada vez que alguien la volvía a tipear. Se borran los
  // duplicados (sin importar mayúsculas/minúsculas ni espacios) dejando una sola
  // fila por nombre, y se sacan las que ya venían incluidas en la lista base.
  const dedupeObras = useCallback(async () => {
    if (get('dedupeObrasOk')) return
    try {
      const configRef = doc(db,'config','dedupeObras')
      const configSnap = await getDoc(configRef)
      if (configSnap.exists() && configSnap.data().hecho === true) {
        set('dedupeObrasOk', true); return
      }
      const snap = await getDocs(collection(db,'obrasSociales'))
      const vistos = new Set()
      const aBorrar = []
      snap.docs.forEach(d => {
        const norm = (d.data().nombre || '').trim().toLowerCase()
        if (!norm || OBRAS_BASE_NORM.includes(norm) || vistos.has(norm)) {
          aBorrar.push(d.id)
        } else {
          vistos.add(norm)
        }
      })
      if (aBorrar.length > 0) {
        const batch = writeBatch(db)
        aBorrar.forEach(id => batch.delete(doc(db,'obrasSociales',id)))
        await batch.commit()
        del('obras')
      }
      await setDoc(configRef, { hecho: true })
    } catch(e) { console.error('Dedupe obras sociales:',e) }
    set('dedupeObrasOk', true)
  }, [])

  // Migración de una sola vez: aplica retroactivamente el arreglo de "el pack de
  // copagos salda primero la deuda vieja" a los pacientes que ya tenían crédito de
  // pack cargado y sesiones sueltas pendientes de antes de ese arreglo. Para PAMI
  // cuenta como pendiente tanto "Debe" (pagado:false) como "sin autorizar"
  // (autorizado:false, un estado de antes del modelo de packs que no tiene sentido
  // para PAMI). Para el resto de copago solo cuenta "Debe" — ahí "autorizado" es un
  // estado real del plan de obra social, separado del pago del copago.
  // v2: la primera versión de esta migración solo buscaba pagado==false, que no
  // encuentra los turnos viejos donde ese campo directamente no existe (el caso de
  // "sin autorizar" en PAMI) — usa su propio candado para volver a correr.
  const saldarDeudaConPacksExistentes = useCallback(async () => {
    if (get('saldoDeudaPacksV2Ok')) return
    try {
      const configRef = doc(db,'config','saldarDeudaPacksV2')
      const configSnap = await getDoc(configRef)
      if (configSnap.exists() && configSnap.data().hecho === true) {
        set('saldoDeudaPacksV2Ok', true); return
      }
      const [pacsSnap, deudaSnap] = await Promise.all([
        getDocs(collection(db,'pacientes')),
        getDocs(query(collection(db,'turnos'), where('asistencia','==','asistio')))
      ])
      const deudaPorPaciente = {}
      deudaSnap.docs.forEach(d => {
        const t = { id: d.id, ...d.data() }
        if (t.anulado || t.pagado === true) return
        if (!deudaPorPaciente[t.pacienteId]) deudaPorPaciente[t.pacienteId] = []
        deudaPorPaciente[t.pacienteId].push(t)
      })
      const batch = writeBatch(db)
      let huboMovimientos = false
      pacsSnap.docs.forEach(d => {
        const p = { id: d.id, ...d.data() }
        const plan = p.copagoPlan
        if (!plan) return
        const disponibles = (plan.sesionesTotal || 0) - (plan.sesionesUsadas || 0)
        if (disponibles <= 0) return
        const pami = esPami(p)
        const deuda = (deudaPorPaciente[p.id] || [])
          .filter(t => pami || t.pagado === false)
          .sort((a,b) => (a.fecha||'').localeCompare(b.fecha||''))
        if (deuda.length === 0) return
        const aSaldar = deuda.slice(0, disponibles)
        batch.update(doc(db,'pacientes',p.id), { 'copagoPlan.sesionesUsadas': (plan.sesionesUsadas || 0) + aSaldar.length })
        aSaldar.forEach(t => batch.update(doc(db,'turnos',t.id), pami
          ? { pagado: true, pagadoConPack: true, autorizado: true }
          : { pagado: true, pagadoConPack: true }))
        huboMovimientos = true
      })
      if (huboMovimientos) {
        await batch.commit()
        del('pacs')
      }
      await setDoc(configRef, { hecho: true })
    } catch(e) { console.error('Saldar deuda con packs existentes:',e) }
    set('saldoDeudaPacksV2Ok', true)
  }, [])

  const invalidarPacs  = () => del('pacs')
  const invalidarUsers = () => del('usuarios','kines')
  const invalidarObras = () => del('obras')

  return (
    <Ctx.Provider value={{
      getUsuarios, getKines, getObras,
      getPacientes, limpiar, reactivarPacientes, migrarOrdenes, dedupeObras, saldarDeudaConPacksExistentes,
      invalidarPacs, invalidarUsers, invalidarObras
    }}>
      {children}
    </Ctx.Provider>
  )
}
