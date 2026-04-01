import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { sendPasswordResetEmail } from 'firebase/auth'
import { useAuth } from '../../context/AuthContext'
import { auth } from '../../firebase'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetMsg, setResetMsg] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

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

  async function handleReset(e) {
    e.preventDefault()
    setResetLoading(true)
    setResetMsg('')
    try {
      await sendPasswordResetEmail(auth, resetEmail)
      setResetMsg('Te enviamos un email para restablecer tu contraseña. Revisá tu bandeja.')
    } catch (err) {
      setResetMsg('No encontramos ese email. Verificá que sea el correcto.')
    }
    setResetLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo.png" alt="El Círculo" onError={e => { e.target.style.display='none' }} />
          <div className="login-title">El Círculo</div>
          <div className="login-subtitle">Kinesiología · Fisioterapia · R.P.G</div>
        </div>

        {!resetMode ? (
          <>
            {error && <div className="alert alert-red" style={{marginBottom:'14px'}}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-field" style={{marginBottom:'12px'}}>
                <label>Correo electrónico</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
              </div>
              <div className="form-field" style={{marginBottom:'8px'}}>
                <label>Contraseña</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <div style={{textAlign:'right', marginBottom:'16px'}}>
                <span
                  onClick={() => { setResetMode(true); setResetEmail(email) }}
                  style={{fontSize:'12px', color:'#185FA5', cursor:'pointer'}}>
                  ¿Olvidaste tu contraseña?
                </span>
              </div>
              <button className="btn btn-primary" style={{width:'100%', justifyContent:'center', padding:'10px'}} disabled={loading}>
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
            <hr className="divider" />
            <div style={{textAlign:'center', fontSize:'13px', color:'#888'}}>
              ¿No tenés cuenta? <Link to="/register" style={{color:'#185FA5', fontWeight:'500'}}>Registrate</Link>
            </div>
          </>
        ) : (
          <>
            <div style={{fontSize:'14px', fontWeight:'500', marginBottom:'6px'}}>Recuperar contraseña</div>
            <div style={{fontSize:'13px', color:'#888', marginBottom:'16px'}}>
              Ingresá tu email y te enviamos un link para restablecer tu contraseña.
            </div>
            {resetMsg && (
              <div className={`alert ${resetMsg.includes('enviamos') ? 'alert-green' : 'alert-red'}`} style={{marginBottom:'14px'}}>
                {resetMsg}
              </div>
            )}
            <form onSubmit={handleReset}>
              <div className="form-field" style={{marginBottom:'16px'}}>
                <label>Correo electrónico</label>
                <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required autoFocus />
              </div>
              <button className="btn btn-primary" style={{width:'100%', justifyContent:'center', padding:'10px'}} disabled={resetLoading}>
                {resetLoading ? 'Enviando...' : 'Enviar email de recuperación'}
              </button>
            </form>
            <hr className="divider" />
            <div style={{textAlign:'center', fontSize:'13px', color:'#888'}}>
              <span onClick={() => { setResetMode(false); setResetMsg('') }} style={{color:'#185FA5', cursor:'pointer', fontWeight:'500'}}>
                ← Volver al login
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
