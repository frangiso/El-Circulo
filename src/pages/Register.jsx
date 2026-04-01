import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden')
    if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
    setLoading(true)
    try {
      await register(form.email, form.password, form.nombre, form.apellido)
      navigate('/pendiente')
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Ese email ya está registrado')
      else setError('Error al registrarse. Intentá de nuevo.')
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo.png" alt="El Círculo" onError={e => { e.target.style.display='none' }} />
          <div className="login-title">Crear cuenta</div>
          <div className="login-subtitle">Tu cuenta será aprobada por el administrador</div>
        </div>

        {error && <div className="alert alert-red" style={{marginBottom:'14px'}}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{marginBottom:'12px'}}>
            <div className="form-field">
              <label>Nombre</label>
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)} required />
            </div>
            <div className="form-field">
              <label>Apellido</label>
              <input value={form.apellido} onChange={e => set('apellido', e.target.value)} required />
            </div>
          </div>
          <div className="form-field" style={{marginBottom:'12px'}}>
            <label>Correo electrónico</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
          </div>
          <div className="form-grid" style={{marginBottom:'18px'}}>
            <div className="form-field">
              <label>Contraseña</label>
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)} required />
            </div>
            <div className="form-field">
              <label>Confirmar contraseña</label>
              <input type="password" value={form.confirm} onChange={e => set('confirm', e.target.value)} required />
            </div>
          </div>
          <button className="btn btn-primary" style={{width:'100%', justifyContent:'center', padding:'10px'}} disabled={loading}>
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </button>
        </form>

        <hr className="divider" />
        <div style={{textAlign:'center', fontSize:'13px', color:'#888'}}>
          ¿Ya tenés cuenta? <Link to="/login" style={{color:'#185FA5', fontWeight:'500'}}>Iniciá sesión</Link>
        </div>
      </div>
    </div>
  )
}
