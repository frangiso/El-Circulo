import { useState } from 'react'
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

const PLANES = ['Plan mensual — 2 veces/semana', 'Plan mensual — 3 veces/semana', 'Plan mensual — libre', 'Pack 8 clases', 'Pack 12 clases', 'Clase suelta']

export default function GestionAlumnas() {
  const [alumnas, setAlumnas] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [editando, setEditando] = useState(null)
  const [eliminando, setEliminando] = useState(null)
  const [form, setForm] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [filtro, setFiltro] = useState('todas')

  async function buscar() {
    if (!busqueda.trim() && filtro === 'todas') return
    setCargando(true)
    setBuscado(true)

    const snap = await getDocs(query(collection(db, 'usuarios'), where('rol', '==', 'alumna')))
    const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    const resultado = todas.filter(a => {
      const texto = `${a.nombre} ${a.apellido} ${a.telefono} ${a.email}`.toLowerCase()
      const coincideTexto = !busqueda.trim() || texto.includes(busqueda.toLowerCase())
      const coincideFiltro =
        filtro === 'todas' ? true :
        filtro === 'deuda' ? a.deuda :
        filtro === 'inactiva' ? a.estado === 'inactiva' :
        filtro === 'sin-plan' ? !a.plan : true
      return coincideTexto && coincideFiltro
    })

    resultado.sort((a, b) => (a.apellido || '').localeCompare(b.apellido || ''))
    setAlumnas(resultado)
    setCargando(false)
  }

  function abrirEdicion(alumna) {
    setEditando(alumna.id)
    setForm({
      plan: alumna.plan || '',
      clasesRestantes: alumna.clasesRestantes || 0,
      planVencimiento: alumna.planVencimiento
        ? (alumna.planVencimiento.toDate ? alumna.planVencimiento.toDate().toISOString().split('T')[0] : alumna.planVencimiento)
        : '',
      deuda: alumna.deuda || false,
      estado: alumna.estado || 'activa',
      turnoFijo: alumna.turnoFijo || '',
      notas: alumna.notas || ''
    })
  }

  async function guardar() {
    setGuardando(true)
    const datos = {
      plan: form.plan,
      clasesRestantes: parseInt(form.clasesRestantes) || 0,
      deuda: form.deuda,
      estado: form.estado,
      turnoFijo: form.turnoFijo,
      notas: form.notas,
    }
    if (form.planVencimiento) {
      datos.planVencimiento = Timestamp.fromDate(new Date(form.planVencimiento + 'T12:00'))
    }
    await updateDoc(doc(db, 'usuarios', editando), datos)
    setMsg({ tipo: 'exito', texto: 'Alumna actualizada correctamente.' })
    setEditando(null)
    await buscar()
    setGuardando(false)
  }

  async function confirmarEliminar() {
    if (!eliminando) return
    setGuardando(true)
    await deleteDoc(doc(db, 'usuarios', eliminando.id))
    setMsg({ tipo: 'exito', texto: `${eliminando.nombre} ${eliminando.apellido} fue eliminada.` })
    setEliminando(null)
    await buscar()
    setGuardando(false)
  }

  return (
    <div>
      <h3 style={{ color: '#2d5a3a', marginBottom: 20 }}>Gestión de alumnas</h3>

      {msg && (
        <div className={`alert alert-${msg.tipo}`} style={{ marginBottom: 16 }}>
          {msg.texto}
          <button onClick={() => setMsg(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Buscador */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          style={{ flex: 1, minWidth: 200, padding: '12px 16px', border: '2px solid #c8ddd0', borderRadius: 10, fontSize: '1rem', fontFamily: 'Lato, sans-serif' }}
          placeholder="🔍 Nombre, apellido o teléfono..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar()}
        />
        <select
          style={{ padding: '12px 14px', border: '2px solid #c8ddd0', borderRadius: 10, fontSize: '0.92rem', fontFamily: 'Lato, sans-serif', background: 'white' }}
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
        >
          <option value="todas">Todas</option>
          <option value="deuda">Con deuda</option>
          <option value="inactiva">Inactivas</option>
          <option value="sin-plan">Sin plan</option>
        </select>
        <button className="btn btn-primary" onClick={buscar} disabled={cargando}
          style={{ padding: '12px 20px', minHeight: 48, fontSize: '1rem' }}>
          {cargando ? '...' : 'Buscar'}
        </button>
      </div>

      {/* Estado inicial */}
      {!buscado && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔍</div>
          <p style={{ color: '#5a6b60' }}>Escribí el nombre, apellido o teléfono de una alumna y presioná Buscar.</p>
          <p style={{ color: '#5a6b60', fontSize: '0.88rem', marginTop: 8 }}>También podés usar los filtros para buscar por deuda, inactivas o sin plan.</p>
        </div>
      )}

      {/* Sin resultados */}
      {buscado && !cargando && alumnas.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#5a6b60' }}>No encontramos alumnas con ese criterio.</p>
        </div>
      )}

      {/* Resultados */}
      {alumnas.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: '#f0f7f2', borderBottom: '1px solid #c8ddd0', fontSize: '0.85rem', color: '#5a6b60' }}>
            {alumnas.length} resultado{alumnas.length !== 1 ? 's' : ''}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Alumna</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {alumnas.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{a.nombre} {a.apellido}</div>
                      <div style={{ fontSize: '0.82rem', color: '#5a6b60' }}>{a.telefono}</div>
                      <div style={{ fontSize: '0.78rem', color: '#5a6b60' }}>{a.email}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.88rem' }}>{a.plan || <span style={{ color: '#aaa' }}>Sin plan</span>}</div>
                      {a.clasesRestantes > 0 && (
                        <div style={{ fontSize: '0.78rem', color: '#4a7c59' }}>{a.clasesRestantes} clases restantes</div>
                      )}
                      {a.turnoFijo && (
                        <div style={{ fontSize: '0.78rem', color: '#5a6b60' }}>📌 {a.turnoFijo}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className={`badge ${a.estado === 'inactiva' ? 'badge-rojo' : 'badge-verde'}`} style={{ width: 'fit-content' }}>
                          {a.estado === 'inactiva' ? 'Inactiva' : 'Activa'}
                        </span>
                        {a.deuda && <span className="badge badge-rojo" style={{ width: 'fit-content' }}>Con deuda</span>}
                        {!a.plan && <span className="badge badge-amarillo" style={{ width: 'fit-content' }}>Sin plan</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary" style={{ padding: '8px 14px', minHeight: 36, fontSize: '0.88rem' }}
                          onClick={() => abrirEdicion(a)}>
                          Editar
                        </button>
                        <button className="btn btn-danger" style={{ padding: '8px 14px', minHeight: 36, fontSize: '0.85rem' }}
                          onClick={() => setEliminando(a)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal edición */}
      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h3>Editar alumna</h3>
            <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
              <div className="input-group">
                <label>Plan</label>
                <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                  <option value="">Sin plan</option>
                  {PLANES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Clases restantes</label>
                <input type="number" min="0" value={form.clasesRestantes}
                  onChange={e => setForm(f => ({ ...f, clasesRestantes: e.target.value }))} />
              </div>
              <div className="input-group">
                <label>Vencimiento del plan</label>
                <input type="date" value={form.planVencimiento}
                  onChange={e => setForm(f => ({ ...f, planVencimiento: e.target.value }))} />
              </div>
              <div className="input-group">
                <label>Turno fijo asignado</label>
                <input type="text" value={form.turnoFijo} placeholder="Ej: Lunes y miércoles 9:00"
                  onChange={e => setForm(f => ({ ...f, turnoFijo: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 18, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, color: '#5a6b60' }}>
                  <input type="checkbox" checked={form.deuda} onChange={e => setForm(f => ({ ...f, deuda: e.target.checked }))}
                    style={{ width: 20, height: 20, accentColor: '#c0392b' }} />
                  Tiene deuda
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, color: '#5a6b60' }}>
                  <input type="checkbox" checked={form.estado === 'inactiva'} onChange={e => setForm(f => ({ ...f, estado: e.target.checked ? 'inactiva' : 'activa' }))}
                    style={{ width: 20, height: 20, accentColor: '#c0392b' }} />
                  Cuenta inactiva
                </label>
              </div>
              <div className="input-group">
                <label>Notas internas</label>
                <textarea value={form.notas} rows={3} placeholder="Observaciones sobre la alumna..."
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={guardar} disabled={guardando} style={{ flex: 1 }}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button className="btn btn-ghost" onClick={() => setEditando(null)} style={{ flex: 1 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {eliminando && (
        <div className="modal-overlay" onClick={() => setEliminando(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#c0392b' }}>Eliminar alumna</h3>
            <p style={{ color: '#5a6b60', margin: '16px 0' }}>
              ¿Estás segura que querés eliminar a <strong>{eliminando.nombre} {eliminando.apellido}</strong>?
            </p>
            <div className="alert alert-error" style={{ fontSize: '0.9rem' }}>
              ⚠️ Esta acción no se puede deshacer.
            </div>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={confirmarEliminar} disabled={guardando} style={{ flex: 1 }}>
                {guardando ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
              <button className="btn btn-ghost" onClick={() => setEliminando(null)} style={{ flex: 1 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
