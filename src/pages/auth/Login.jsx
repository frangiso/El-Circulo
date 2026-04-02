import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export function Login() {
  const { login, resetPw } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [pass, setPass]   = useState('')
  const [err, setErr]     = useState('')
  const [load, setLoad]   = useState(false)
  const [modo, setModo]   = useState('login') // 'login' | 'reset'
  const [rEmail, setREmail] = useState('')
  const [rMsg, setRMsg]   = useState('')

  async function handleLogin(e) {
    e.preventDefault(); setErr(''); setLoad(true)
    try { await login(email, pass); navigate('/') }
    catch { setErr('Email o contraseña incorrectos') }
    setLoad(false)
  }

  async function handleReset(e) {
    e.preventDefault(); setLoad(true); setRMsg('')
    try { await resetPw(rEmail); setRMsg('✓ Te enviamos el link. Revisá tu bandeja.') }
    catch { setRMsg('No encontramos ese email.') }
    setLoad(false)
  }

  return (
    <div className="lp">
      <div className="lc">
        <div className="ll">
          <img src="/logo.png" alt="El Círculo" onError={e=>{e.target.style.display='none'}}/>
          <div className="lt">El Círculo</div>
          <div className="ls">Kinesiología · Fisioterapia · R.P.G</div>
        </div>

        {modo==='login' ? (
          <>
            {err&&<div className="al alr" style={{marginBottom:14}}>{err}</div>}
            <form onSubmit={handleLogin}>
              <div className="ff" style={{marginBottom:12}}><label>Correo electrónico</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus/></div>
              <div className="ff" style={{marginBottom:8}}><label>Contraseña</label><input type="password" value={pass} onChange={e=>setPass(e.target.value)} required/></div>
              <div style={{textAlign:'right',marginBottom:18}}>
                <span onClick={()=>{setModo('reset');setREmail(email)}} style={{fontSize:12,color:'#185FA5',cursor:'pointer'}}>¿Olvidaste tu contraseña?</span>
              </div>
              <button className="btn bp" style={{width:'100%',justifyContent:'center',padding:10}} disabled={load}>{load?'Ingresando...':'Ingresar'}</button>
            </form>
            <div className="div"/>
            <div style={{textAlign:'center',fontSize:13,color:'#888'}}>¿No tenés cuenta? <Link to="/register" style={{color:'#185FA5',fontWeight:600}}>Registrate</Link></div>
          </>
        ) : (
          <>
            <div style={{fontWeight:600,marginBottom:6}}>Recuperar contraseña</div>
            <div style={{fontSize:13,color:'#888',marginBottom:16}}>Ingresá tu email y te enviamos un link para restablecer tu contraseña.</div>
            {rMsg&&<div className={`al ${rMsg.startsWith('✓')?'alg':'alr'}`} style={{marginBottom:14}}>{rMsg}</div>}
            <form onSubmit={handleReset}>
              <div className="ff" style={{marginBottom:16}}><label>Correo electrónico</label><input type="email" value={rEmail} onChange={e=>setREmail(e.target.value)} required autoFocus/></div>
              <button className="btn bp" style={{width:'100%',justifyContent:'center',padding:10}} disabled={load}>{load?'Enviando...':'Enviar link de recuperación'}</button>
            </form>
            <div className="div"/>
            <div style={{textAlign:'center',fontSize:13}}>
              <span onClick={()=>{setModo('login');setRMsg('')}} style={{color:'#185FA5',cursor:'pointer',fontWeight:600}}>← Volver al login</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function Register() {
  const { registrar } = useAuth()
  const navigate = useNavigate()
  const [f, setF] = useState({nombre:'',apellido:'',email:'',pass:'',confirm:'',rol:'secretaria'})
  const [err, setErr] = useState('')
  const [load, setLoad] = useState(false)
  const set = (k,v) => setF(p=>({...p,[k]:v}))

  async function submit(e) {
    e.preventDefault(); setErr('')
    if (f.pass!==f.confirm) return setErr('Las contraseñas no coinciden')
    if (f.pass.length<6) return setErr('Mínimo 6 caracteres')
    setLoad(true)
    try { await registrar(f.email,f.pass,f.nombre,f.apellido,f.rol); navigate('/pendiente') }
    catch(ex) { setErr(ex.code==='auth/email-already-in-use'?'Ese email ya está registrado':'Error al registrarse') }
    setLoad(false)
  }

  return (
    <div className="lp">
      <div className="lc">
        <div className="ll">
          <img src="/logo.png" alt="" onError={e=>{e.target.style.display='none'}}/>
          <div className="lt">Crear cuenta</div>
          <div className="ls">Tu cuenta será aprobada por el administrador</div>
        </div>
        {err&&<div className="al alr" style={{marginBottom:14}}>{err}</div>}
        <form onSubmit={submit}>
          <div className="fg" style={{marginBottom:12}}>
            <div className="ff"><label>Nombre</label><input value={f.nombre} onChange={e=>set('nombre',e.target.value)} required/></div>
            <div className="ff"><label>Apellido</label><input value={f.apellido} onChange={e=>set('apellido',e.target.value)} required/></div>
          </div>
          <div className="ff" style={{marginBottom:12}}><label>Correo electrónico</label><input type="email" value={f.email} onChange={e=>set('email',e.target.value)} required/></div>
          <div className="ff" style={{marginBottom:12}}>
            <label>Soy...</label>
            <select value={f.rol} onChange={e=>set('rol',e.target.value)}>
              <option value="secretaria">Secretaria</option>
              <option value="kinesiologo">Kinesiológo</option>
            </select>
          </div>
          <div className="fg" style={{marginBottom:18}}>
            <div className="ff"><label>Contraseña</label><input type="password" value={f.pass} onChange={e=>set('pass',e.target.value)} required/></div>
            <div className="ff"><label>Confirmar</label><input type="password" value={f.confirm} onChange={e=>set('confirm',e.target.value)} required/></div>
          </div>
          <button className="btn bp" style={{width:'100%',justifyContent:'center',padding:10}} disabled={load}>{load?'Registrando...':'Crear cuenta'}</button>
        </form>
        <div className="div"/>
        <div style={{textAlign:'center',fontSize:13,color:'#888'}}>¿Ya tenés cuenta? <Link to="/login" style={{color:'#185FA5',fontWeight:600}}>Iniciá sesión</Link></div>
      </div>
    </div>
  )
}

export function Pendiente() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="lp">
      <div className="lc" style={{textAlign:'center'}}>
        <img src="/logo.png" alt="" style={{width:80,marginBottom:16}} onError={e=>{e.target.style.display='none'}}/>
        <div style={{fontSize:18,fontWeight:700,marginBottom:8}}>Cuenta pendiente</div>
        <div style={{fontSize:13,color:'#888',marginBottom:20,lineHeight:1.6}}>Tu cuenta fue creada. Un administrador debe aprobarla antes de que puedas ingresar.</div>
        <div className="al ala" style={{textAlign:'left',marginBottom:20}}>Avisale al dueño del centro para que apruebe tu usuario.</div>
        <button className="btn bs" style={{width:'100%',justifyContent:'center'}} onClick={async()=>{await logout();navigate('/login')}}>Cerrar sesión</button>
      </div>
    </div>
  )
}

export default Login
