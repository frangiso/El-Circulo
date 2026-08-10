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

// Hora actual siempre en formato 24hs (HH:MM), sin importar el dispositivo/navegador —
// toLocaleTimeString con 'es-AR' puede devolver 12hs con a.m./p.m. según el sistema
// operativo (ej: iOS), lo que rompe cualquier comparación numérica de la hora
export function horaActual() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

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

// Un paciente es "particular" si tiene la modalidad seteada, o si (herencia de antes de
// que existiera la modalidad) tiene "particular" cargado como obra social, en cualquier mayúscula/minúscula
export function esParticular(pac) {
  if (!pac) return false
  if (pac.modalidad === 'particular') return true
  return (pac.obraSocial || '').trim().toLowerCase() === 'particular'
}

// Pacientes que además del plan de sesiones autorizadas pagan un copago por sesión
// (típicamente PAMI). Se infiere automáticamente si la obra social contiene "pami",
// o se puede marcar a mano para cualquier otra obra social con el mismo caso.
export function requiereCopago(pac) {
  if (!pac) return false
  if (pac.requiereCopago === true) return true
  return (pac.obraSocial || '').toLowerCase().includes('pami')
}

// PAMI funciona igual que un paciente particular (sin plan de obra social, nunca se
// archiva) pero en vez de pagar sesión por sesión siempre prepaga por packs de varias
// sesiones juntas (ej: 5 o 10). Es específico de PAMI, no del flag genérico de copago.
export function esPami(pac) {
  if (!pac) return false
  return (pac.obraSocial || '').toLowerCase().includes('pami')
}

// Saca acentos/diacríticos para comparar texto sin importar cómo se haya tipeado
// (ej: "JERARQUICOS" sin acento vs "Jerárquicos" con acento deberían matchear)
function sinAcentos(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Obras sociales que piden token de autorización antes de cada sesión
export const OBRAS_TOKEN = ['SanCor','Prevención','Poder Judicial','OSDE','Galeno','Medife','Swiss Medical','Jerárquicos']

export function necesitaToken(obraSocial) {
  if (!obraSocial) return false
  const norm = sinAcentos(obraSocial)
  return OBRAS_TOKEN.some(o => norm.includes(sinAcentos(o)))
}
