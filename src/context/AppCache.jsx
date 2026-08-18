import { createContext, useContext, useRef, useCallback } from 'react'
import { collection, getDocs, query, where, orderBy,
  doc, writeBatch, getDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { OBRAS_BASE, hoy, esParticular, esPami } from '../utils/helpers'

const Ctx = createContext()
export const useCache = () => useContext(Ctx)
const TTL = 30 * 60 * 1000 // 30 minutos

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

  const invalidarPacs  = () => del('pacs')
  const invalidarUsers = () => del('usuarios','kines')
  const invalidarObras = () => del('obras')

  return (
    <Ctx.Provider value={{
      getUsuarios, getKines, getObras,
      getPacientes, limpiar, reactivarPacientes, migrarOrdenes,
      invalidarPacs, invalidarUsers, invalidarObras
    }}>
      {children}
    </Ctx.Provider>
  )
}
