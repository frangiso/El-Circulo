import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

// Calcula la fecha de vencimiento sumando N días hábiles (lun-vie) desde una fecha
export function sumarDiasHabiles(fechaInicio, dias) {
  let fecha = new Date(fechaInicio)
  let contados = 0
  while (contados < dias) {
    fecha.setDate(fecha.getDate() + 1)
    const dia = fecha.getDay()
    if (dia !== 0 && dia !== 6) contados++
  }
  return fecha
}

// Calcula cuántos días hábiles quedan hasta una fecha
export function diasHabilesRestantes(fechaVencimiento) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(fechaVencimiento)
  venc.setHours(0, 0, 0, 0)
  if (venc <= hoy) return 0
  let cursor = new Date(hoy)
  let contados = 0
  while (cursor < venc) {
    cursor.setDate(cursor.getDate() + 1)
    const dia = cursor.getDay()
    if (dia !== 0 && dia !== 6) contados++
  }
  return contados
}

export function estadoPlan(sesionesUsadas, sesionesTotal, fechaVencimiento) {
  if (!fechaVencimiento || !sesionesTotal) return 'sin-plan'
  const restantes = diasHabilesRestantes(fechaVencimiento)
  if (restantes === 0) return 'vencido'
  if (restantes <= 10) return 'por-vencer'
  if (sesionesUsadas >= sesionesTotal) return 'vencido'
  return 'vigente'
}

export function formatFecha(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('es-AR')
}

export function formatFechaHora(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export async function registrarLog(userId, userName, accion, detalle) {
  try {
    await addDoc(collection(db, 'logs'), {
      userId,
      userName,
      accion,
      detalle,
      timestamp: serverTimestamp()
    })
  } catch (e) {
    console.error('Error registrando log:', e)
  }
}

export const OBRAS_SOCIALES_DEFAULT = [
  'DOSEP', 'GALENO', 'MEDIAL GISE', 'OSFATUN', 'OSDE',
  'PAMI', 'FEMESA', 'Particular'
]

export const ROLES = {
  dueno: 'Dueño',
  kinesiologo: 'Kinesiológo',
  secretaria: 'Secretaria',
  pendiente: 'Pendiente'
}
