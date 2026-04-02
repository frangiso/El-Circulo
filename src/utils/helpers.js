import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export function sumarDiasHabiles(fechaInicio, dias) {
  const f = new Date(fechaInicio + 'T00:00:00')
  let n = 0
  while (n < dias) {
    f.setDate(f.getDate() + 1)
    if (f.getDay() !== 0 && f.getDay() !== 6) n++
  }
  return f
}

export function diasHabilesRestantes(fechaVenc) {
  if (!fechaVenc) return 0
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const v = new Date(fechaVenc + 'T00:00:00')
  if (v <= hoy) return 0
  let c = new Date(hoy), n = 0
  while (c < v) {
    c.setDate(c.getDate() + 1)
    if (c.getDay() !== 0 && c.getDay() !== 6) n++
  }
  return n
}

export function calcVenc(fechaInicio) {
  if (!fechaInicio) return null
  return sumarDiasHabiles(fechaInicio, 45).toISOString().split('T')[0]
}

export function estadoPlan(plan) {
  if (!plan?.fechaVencimiento || !plan?.sesionesTotal) return 'sin-plan'
  if ((plan.sesionesUsadas || 0) >= plan.sesionesTotal) return 'vencido'
  const r = diasHabilesRestantes(plan.fechaVencimiento)
  if (r === 0) return 'vencido'
  if (r <= 10) return 'por-vencer'
  return 'vigente'
}

export async function escribirLog(uid, nombre, accion, detalle) {
  try {
    await addDoc(collection(db, 'logs'), { uid, nombre, accion, detalle, ts: serverTimestamp() })
  } catch (_) {}
}

export function hoy() { return new Date().toISOString().split('T')[0] }

export function mesActual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

export function fmtFecha(s) {
  if (!s) return '—'
  const [y,m,d] = s.split('-')
  return `${d}/${m}/${y}`
}

export function fmtMonto(n) {
  return '$' + Math.round(n||0).toLocaleString('es-AR')
}

export function labelMes(m) {
  if (!m) return ''
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const [y, mo] = m.split('-')
  return `${MESES[parseInt(mo)-1]} ${y}`
}

export function getMeses(n=12) {
  const d = new Date(), lista = []
  for (let i=0;i<n;i++) {
    const x = new Date(d.getFullYear(), d.getMonth()-i, 1)
    lista.push(`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`)
  }
  return lista
}

export function fechaHaceNMeses(n) {
  const d = new Date()
  d.setMonth(d.getMonth()-n)
  return d.toISOString().split('T')[0]
}

export const OBRAS_BASE = ['DOSEP','GALENO','MEDIAL GISE','OSFATUN','OSDE','PAMI','FEMESA','Particular']
export const ROLES = { dueno:'Dueño', kinesiologo:'Kinesiológo', secretaria:'Secretaria', pendiente:'Pendiente' }
