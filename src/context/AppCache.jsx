import { createContext, useContext, useRef, useCallback } from 'react'
import { collection, getDocs, query, where, orderBy,
  doc, writeBatch, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { OBRAS_BASE, hoy } from '../utils/helpers'

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

  // Los pacientes ya no se archivan automáticamente por vencimiento de plan — se
  // reactiva (una sola vez, corre 1 vez por día vía config/limpieza) cualquiera que
  // haya quedado archivado por esa lógica anterior, para que todos queden activos
  const limpiar = useCallback(async () => {
    if (get('limpiezaOk')) return
    try {
      const hoyStr = hoy()
      const configRef = doc(db,'config','limpieza')
      const configSnap = await getDoc(configRef)
      if (configSnap.exists() && configSnap.data().fecha === hoyStr) {
        set('limpiezaOk', true); return
      }
      const snapArchivados = await getDocs(query(collection(db,'pacientes'), where('archivado','==',true)))
      if (snapArchivados.docs.length > 0) {
        const batch = writeBatch(db)
        snapArchivados.docs.forEach(d => batch.update(doc(db,'pacientes',d.id), { archivado: false, fechaArchivado: null }))
        await batch.commit(); del('pacs')
      }
      await setDoc(configRef, { fecha: hoyStr })
    } catch(e) { console.error('Limpieza:',e) }
    set('limpiezaOk', true)
  }, [])

  const invalidarPacs  = () => del('pacs')
  const invalidarUsers = () => del('usuarios','kines')
  const invalidarObras = () => del('obras')

  return (
    <Ctx.Provider value={{
      getUsuarios, getKines, getObras,
      getPacientes, limpiar,
      invalidarPacs, invalidarUsers, invalidarObras
    }}>
      {children}
    </Ctx.Provider>
  )
}
