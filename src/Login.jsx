import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError('Email o contraseña incorrectos')
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo.png" alt="El Círculo" onError={e => { e.target.style.display='none' }} />
          <div className="login-title">El Círculo</div>
          <div className="login-subtitle">Kinesiología · Fisioterapia · R.P.G</div>
        </div>

        {error && <div className="alert alert-red" style={{marginBottom:'14px'}}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-field" style={{marginBottom:'12px'}}>
            <label>Correo electrónico</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="form-field" style={{marginBottom:'18px'}}>
            <label>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary" style={{width:'100%', justifyContent:'center', padding:'10px'}} disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <hr className="divider" />
        <div style={{textAlign:'center', fontSize:'13px', color:'#888'}}>
          ¿No tenés cuenta? <Link to="/register" style={{color:'#185FA5', fontWeight:'500'}}>Registrate</Link>
        </div>
      </div>
    </div>
  )
}
