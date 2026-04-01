import { useState, useEffect } from 'react'
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'

const ICONOS = {
  nueva_alumna: '👤',
  nueva_reserva: '📅',
  turno_fijo_solicitado: '📌',
  turno_aprobado: '✓',
  turno_rechazado: '✗',
  pago_registrado: '💰',
  cancelacion: '❌',
}

function tiempoRelativo(ts) {
  if (!ts) return ''
  const fecha = ts.toDate ? ts.toDate() : new Date(ts)
  const diff = (Date.now() - fecha.getTime()) / 1000
  if (diff < 60) return 'Hace un momento'
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} hs`
  return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export default function Notificaciones() {
  const [notifs, setNotifs] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const snap = await getDocs(query(collection(db, 'notificaciones'), orderBy('creadoEn', 'desc'), limit(30)))
    setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setCargando(false)
  }

  async function marcarLeida(id) {
    await updateDoc(doc(db, 'notificaciones', id), { leida: true })
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
  }

  async function marcarTodasLeidas() {
    const batch = writeBatch(db)
    notifs.filter(n => !n.leida).forEach(n => {
      batch.update(doc(db, 'notificaciones', n.id), { leida: true })
    })
    await batch.commit()
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })))
  }

  if (cargando) return <div className="spinner" />

  const noLeidas = notifs.filter(n => !n.leida).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ color: '#2d5a3a' }}>
          Notificaciones
          {noLeidas > 0 && (
            <span style={{ background: '#c0392b', color: 'white', borderRadius: 20, padding: '2px 10px',
              fontSize: '0.78rem', marginLeft: 10, verticalAlign: 'middle' }}>{noLeidas} nuevas</span>
          )}
        </h3>
        {noLeidas > 0 && (
          <button className="btn btn-ghost" style={{ padding: '8px 16px', minHeight: 38, fontSize: '0.88rem' }}
            onClick={marcarTodasLeidas}>
            Marcar todas como leídas
          </button>
        )}
      </div>

      {notifs.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔔</div>
          <p style={{ color: '#5a6b60' }}>No hay notificaciones todavía.</p>
        </div>
      )}

      {notifs.length > 0 && (
        <div className="card">
          {notifs.map(n => (
            <div
              key={n.id}
              className={`notif-item ${!n.leida ? 'notif-unread' : ''}`}
              style={{ cursor: !n.leida ? 'pointer' : 'default', borderRadius: !n.leida ? 8 : 0, padding: '14px 8px' }}
              onClick={() => !n.leida && marcarLeida(n.id)}
            >
              <div className="notif-icon" style={{ background: !n.leida ? '#d4edda' : undefined }}>
                {ICONOS[n.tipo] || '🔔'}
              </div>
              <div style={{ flex: 1 }}>
                <div className="notif-texto">
                  <strong>{n.titulo}</strong>
                  {!n.leida && (
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                      background: '#4a7c59', marginLeft: 8, verticalAlign: 'middle' }} />
                  )}
                  <br />
                  {n.mensaje}
                </div>
                <div className="notif-tiempo">{tiempoRelativo(n.creadoEn)}</div>
              </div>
              {!n.leida && (
                <div style={{ fontSize: '0.78rem', color: '#4a7c59', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  Marcar leída
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
