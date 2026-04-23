import { createContext, useContext, useRef, useCallback } from 'react'
import { collection, getDocs, query, where, orderBy,
  doc, writeBatch, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { OBRAS_BASE, estadoPlan, fechaHaceNMeses, escribirLog, hoy } from '../utils/helpers'

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

  const getArchivados = useCallback(async (force=false) => {
    if (!force) { const c=get('arch'); if(c) return c }
    const snap = await getDocs(query(
      collection(db,'pacientes'), where('archivado','==',true), orderBy('apellido')
    ))
    return set('arch', snap.docs.map(d=>({id:d.id,...d.data()})))
  }, [])

  // Limpieza 1 vez por día — verifica doc config/limpieza
  const limpiar = useCallback(async (uid, nombre) => {
    if (get('limpiezaOk')) return
    try {
      const hoyStr = hoy()
      const configRef = doc(db,'config','limpieza')
      const configSnap = await getDoc(configRef)
      if (configSnap.exists() && configSnap.data().fecha === hoyStr) {
        set('limpiezaOk', true); return
      }
      const activos = await getPacientes(true)
      const aArchivar = activos.filter(p => p.plan && estadoPlan(p.plan)==='vencido')
      if (aArchivar.length > 0) {
        const batch = writeBatch(db)
        aArchivar.forEach(p => batch.update(doc(db,'pacientes',p.id), {archivado:true, fechaArchivado:hoyStr}))
        await batch.commit(); del('pacs')
      }
      const limite = fechaHaceNMeses(12)
      const snapViejos = await getDocs(query(collection(db,'pacientes'), where('archivado','==',true), where('fechaArchivado','<=',limite)))
      if (snapViejos.docs.length > 0) {
        const batch2 = writeBatch(db)
        snapViejos.docs.forEach(d => batch2.delete(doc(db,'pacientes',d.id)))
        await batch2.commit(); del('arch')
        await escribirLog(uid, nombre, 'Borrado automático', `${snapViejos.docs.length} paciente(s) eliminados por inactividad +12 meses`)
      }
      await setDoc(configRef, { fecha: hoyStr, ejecutadoPor: nombre })
    } catch(e) { console.error('Limpieza:',e) }
    set('limpiezaOk', true)
  }, [getPacientes])

  const invalidarPacs  = () => del('pacs','arch')
  const invalidarUsers = () => del('usuarios','kines')
  const invalidarObras = () => del('obras')

  return (
    <Ctx.Provider value={{
      getUsuarios, getKines, getObras,
      getPacientes, getArchivados, limpiar,
      invalidarPacs, invalidarUsers, invalidarObras
    }}>
      {children}
    </Ctx.Provider>
  )
}
