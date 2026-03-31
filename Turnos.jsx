import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Pendiente() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{textAlign:'center'}}>
        <img src="/logo.png" alt="El Círculo" style={{width:'80px', marginBottom:'16px'}} onError={e => { e.target.style.display='none' }} />
        <div style={{fontSize:'18px', fontWeight:'600', marginBottom:'8px'}}>Cuenta pendiente</div>
        <div style={{fontSize:'13px', color:'#888', marginBottom:'20px', lineHeight:'1.6'}}>
          Tu cuenta fue creada correctamente. Un administrador debe aprobarla antes de que puedas ingresar al sistema.
        </div>
        <div className="alert alert-amber" style={{textAlign:'left', marginBottom:'20px'}}>
          Avisale al dueño o encargado para que apruebe tu usuario desde el panel de administración.
        </div>
        <button className="btn btn-secondary" style={{width:'100%', justifyContent:'center'}} onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
