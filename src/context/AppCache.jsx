/**
 * ESTRATEGIA DE LECTURAS:
 * - Usuarios:    1 lectura por sesión (caché)
 * - Pacientes activos: query archivado==false + caché 10min
 * - Pacientes archivados: solo cuando el usuario los pide
 * - Turnos: solo cuando el usuario busca por fecha
 * - Caja: 1 doc por mes, solo cuando se pide
 * - Logs/Reportes: solo cuando el usuario los pide
 * - Limpieza: 1 vez por día en toda la app (doc config/limpieza)
 *   Si ya se ejecutó hoy, los demás usuarios leen 1 doc y salen.
 *   Antes: 7 usuarios × 80 lecturas = 560/día
 *   Ahora: 1 ejecución + 6 × 1 lectura = ~90/día
 */
import { createContext, useContext, useRef, useCallback } from 'react'
import { collection, getDocs, query, where, orderBy,
  doc, writeBatch, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { OBRAS_BASE, estadoPlan, fechaHaceNMeses, escribirLog, hoy } from '../utils/helpers'

const Ctx = createContext()
export const useCache = () => useContext(Ctx)

const TTL = 10 * 60 * 1000 // 10 minutos

export function CacheProvider({ children }) {
  const s = useRef({})

  const get = (k) => {
    const e = s.current[k]
    if (!e || Date.now() - e.ts > TTL) return null
    return e.data
  }
  const set = (k, data) => { s.current[k] = { data, ts: Date.now() }; return data }
  const del = (...ks) => ks.forEach(k => delete s.current[k])

  // ── Usuarios ────────────────────────────────────────────────
  const getUsuarios = useCallback(async (force=false) => {
    if (!force) { const c=get('usuarios'); if(c) return c }
    const snap = await getDocs(collection(db,'usuarios'))
    return set('usuarios', snap.docs.map(d=>({id:d.id,...d.data()})))
  }, [])

  const getKines = useCallback(async () => {
    const todos = await getUsuarios()
    return todos.filter(u=>(u.rol==='kinesiologo'||u.rol==='dueno')&&u.estado==='activo')
  }, [getUsuarios])

  // ── Obras sociales ──────────────────────────────────────────
  const getObras = useCallback(async () => {
    const c=get('obras'); if(c) return c
    const snap = await getDocs(collection(db,'obrasSociales'))
    return set('obras', [...new Set([...OBRAS_BASE,...snap.docs.map(d=>d.data().nombre)])].sort())
  }, [])

  // ── Pacientes ACTIVOS ───────────────────────────────────────
  const getPacientes = useCallback(async (force=false) => {
    if (!force) { const c=get('pacs'); if(c) return c }
    const snap = await getDocs(query(
      collection(db,'pacientes'),
      where('archivado','==',false),
      orderBy('apellido')
    ))
    return set('pacs', snap.docs.map(d=>({id:d.id,...d.data()})))
  }, [])

  // ── Pacientes ARCHIVADOS ────────────────────────────────────
  const getArchivados = useCallback(async (force=false) => {
    if (!force) { const c=get('arch'); if(c) return c }
    const snap = await getDocs(query(
      collection(db,'pacientes'),
      where('archivado','==',true),
      orderBy('apellido')
    ))
    return set('arch', snap.docs.map(d=>({id:d.id,...d.data()})))
  }, [])

  // ── Limpieza automática — 1 vez por día en toda la app ──────
  // Doc: config/limpieza → { fecha: "2026-04-04" }
  // Si fecha == hoy → ya se ejecutó, no hace nada (1 lectura)
  // Si fecha < hoy → ejecuta y actualiza la fecha (1 lectura + escrituras)
  const limpiar = useCallback(async (uid, nombre) => {
    // Primero verificar en memoria si ya corrió en esta sesión
    if (get('limpiezaOk')) return

    try {
      const hoyStr = hoy()
      const configRef = doc(db, 'config', 'limpieza')

      // 1 sola lectura para saber si ya se limpió hoy
      const configSnap = await getDoc(configRef)
      if (configSnap.exists() && configSnap.data().fecha === hoyStr) {
        // Ya se ejecutó hoy — no hacer nada más
        set('limpiezaOk', true)
        return
      }

      // Todavía no se ejecutó hoy — hacer la limpieza
      // Paso 1: archivar pacientes con plan vencido
      const activos = await getPacientes(true)
      const aArchivar = activos.filter(p => p.plan && estadoPlan(p.plan) === 'vencido')
      if (aArchivar.length > 0) {
        const batch = writeBatch(db)
        aArchivar.forEach(p => batch.update(doc(db,'pacientes',p.id), {
          archivado: true, fechaArchivado: hoyStr
        }))
        await batch.commit()
        del('pacs')
      }

      // Paso 2: borrar archivados hace +12 meses
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

      // Marcar en Firestore que hoy ya se limpió
      await setDoc(configRef, { fecha: hoyStr, ejecutadoPor: nombre })

    } catch (e) {
      console.error('Limpieza:', e)
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
