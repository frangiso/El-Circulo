/**
 * ESTRATEGIA COMPLETA DE LECTURAS:
 *
 * 1. Pacientes ACTIVOS  → query where(archivado==false) + caché 10min
 *    Si hay 1.000.000 archivados, Firestore NO los lee.
 *
 * 2. Pacientes ARCHIVADOS → solo cuando el usuario hace clic en la solapa.
 *    Nunca se leen automáticamente.
 *
 * 3. Turnos → solo se leen cuando el usuario busca (por DNI, nombre o fecha).
 *    Panel arranca VACÍO. Cero lecturas hasta que buscan.
 *
 * 4. Caja → 1 documento por mes con array de movimientos adentro.
 *    Todo el mes = 1 lectura.
 *
 * 5. Usuarios → máx ~10 docs, caché por toda la sesión.
 *
 * 6. Logs → 100 docs, solo cuando el usuario abre el panel.
 *
 * 7. Limpieza automática → al iniciar sesión:
 *    a) Archiva en batch los pacientes con plan vencido (1 operación)
 *    b) Borra automáticamente (sin aviso) los archivados hace +12 meses
 *    Todo silencioso, los profesionales no lo notan.
 */
import { createContext, useContext, useRef, useCallback } from 'react'
import { collection, getDocs, query, where, orderBy,
  doc, writeBatch, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { OBRAS_BASE, estadoPlan, fechaHaceNMeses, escribirLog } from '../utils/helpers'

const Ctx = createContext()
export const useCache = () => useContext(Ctx)

const TTL = 10 * 60 * 1000 // 10 minutos

export function CacheProvider({ children }) {
  const s = useRef({}) // store: { key: { data, ts } }

  const get = (k) => {
    const e = s.current[k]
    if (!e || Date.now() - e.ts > TTL) return null
    return e.data
  }
  const set = (k, data) => { s.current[k] = { data, ts: Date.now() }; return data }
  const del = (...ks) => ks.forEach(k => delete s.current[k])

  // ── Usuarios (máx ~10 docs) ────────────────────────────────
  const getUsuarios = useCallback(async (force=false) => {
    if (!force) { const c=get('usuarios'); if(c) return c }
    const snap = await getDocs(collection(db,'usuarios'))
    return set('usuarios', snap.docs.map(d=>({id:d.id,...d.data()})))
  }, [])

  const getKines = useCallback(async () => {
    const todos = await getUsuarios()
    return todos.filter(u=>(u.rol==='kinesiologo'||u.rol==='dueno')&&u.estado==='activo')
  }, [getUsuarios])

  // ── Obras sociales ─────────────────────────────────────────
  const getObras = useCallback(async () => {
    const c=get('obras'); if(c) return c
    const snap = await getDocs(collection(db,'obrasSociales'))
    return set('obras', [...new Set([...OBRAS_BASE,...snap.docs.map(d=>d.data().nombre)])].sort())
  }, [])

  // ── Pacientes ACTIVOS (query filtrada, nunca lee archivados) ─
  const getPacientes = useCallback(async (force=false) => {
    if (!force) { const c=get('pacs'); if(c) return c }
    const snap = await getDocs(query(
      collection(db,'pacientes'),
      where('archivado','==',false),
      orderBy('apellido')
    ))
    return set('pacs', snap.docs.map(d=>({id:d.id,...d.data()})))
  }, [])

  // ── Pacientes ARCHIVADOS (solo cuando el usuario los pide) ──
  const getArchivados = useCallback(async (force=false) => {
    if (!force) { const c=get('arch'); if(c) return c }
    const snap = await getDocs(query(
      collection(db,'pacientes'),
      where('archivado','==',true),
      orderBy('apellido')
    ))
    return set('arch', snap.docs.map(d=>({id:d.id,...d.data()})))
  }, [])

  // ── Limpieza automática al iniciar sesión ──────────────────
  // Silenciosa: los profesionales no notan nada
  const limpiar = useCallback(async (uid, nombre) => {
    if (get('limpiezaOk')) return // ya se ejecutó en esta sesión

    try {
      // Paso 1: archivar activos con plan vencido (batch = 1 operación)
      const activos = await getPacientes(true)
      const aArchivar = activos.filter(p => p.plan && estadoPlan(p.plan)==='vencido')
      if (aArchivar.length > 0) {
        const batch = writeBatch(db)
        const hoyStr = new Date().toISOString().split('T')[0]
        aArchivar.forEach(p => batch.update(doc(db,'pacientes',p.id), {
          archivado: true, fechaArchivado: hoyStr
        }))
        await batch.commit()
        del('pacs') // forzar recarga sin los recién archivados
      }

      // Paso 2: borrar automáticamente archivados hace +12 meses (silencioso)
      const limite = fechaHaceNMeses(12)
      const snapViejos = await getDocs(query(
        collection(db,'pacientes'),
        where('archivado','==',true),
        where('fechaArchivado','<=',limite)
      ))
      if (snapViejos.docs.length > 0) {
        const batch2 = writeBatch(db)
        snapViejos.docs.forEach(d => batch2.delete(doc(db,'pacientes',d.id)))
        await batch2.commit()
        del('arch')
        await escribirLog(uid, nombre, 'Borrado automático',
          `${snapViejos.docs.length} paciente(s) eliminados por inactividad +12 meses`)
      }
    } catch (e) {
      console.error('Limpieza:', e) // silencioso para el usuario
    }

    set('limpiezaOk', true)
  }, [getPacientes])

  const invalidarPacs  = () => del('pacs','arch')
  const invalidarUsers = () => del('usuarios')
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
