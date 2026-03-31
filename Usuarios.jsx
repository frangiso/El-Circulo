import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const IconDash = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
const IconCal = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const IconUser = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
const IconMoney = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
const IconChart = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
const IconUsers = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const IconLog = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
const IconOut = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>

export default function Layout() {
  const { userProfile, logout } = useAuth()
  const navigate = useNavigate()
  const rol = userProfile?.rol
  const nombre = `${userProfile?.nombre || ''} ${userProfile?.apellido || ''}`.trim()
  const iniciales = (userProfile?.nombre?.[0] || '') + (userProfile?.apellido?.[0] || '')

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-text">El <span>Círculo</span></div>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({isActive}) => 'sidebar-item' + (isActive ? ' active' : '')}>
            <IconDash /> Dashboard
          </NavLink>
          <NavLink to="/turnos" className={({isActive}) => 'sidebar-item' + (isActive ? ' active' : '')}>
            <IconCal /> Turnos
          </NavLink>
          <NavLink to="/pacientes" className={({isActive}) => 'sidebar-item' + (isActive ? ' active' : '')}>
            <IconUser /> Pacientes
          </NavLink>
          <NavLink to="/caja" className={({isActive}) => 'sidebar-item' + (isActive ? ' active' : '')}>
            <IconMoney /> Caja
          </NavLink>
          {(rol === 'dueno' || rol === 'kinesiologo') && (
            <NavLink to="/reportes" className={({isActive}) => 'sidebar-item' + (isActive ? ' active' : '')}>
              <IconChart /> Reportes
            </NavLink>
          )}
          {rol === 'dueno' && (
            <NavLink to="/usuarios" className={({isActive}) => 'sidebar-item' + (isActive ? ' active' : '')}>
              <IconUsers /> Usuarios
            </NavLink>
          )}
          {(rol === 'dueno' || rol === 'kinesiologo') && (
            <NavLink to="/logs" className={({isActive}) => 'sidebar-item' + (isActive ? ' active' : '')}>
              <IconLog /> Actividad
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px'}}>
            <div className="avatar">{iniciales.toUpperCase()}</div>
            <div>
              <div style={{fontSize:'12px', fontWeight:'500'}}>{nombre}</div>
              <div style={{fontSize:'11px', color:'#888', textTransform:'capitalize'}}>{rol}</div>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" style={{width:'100%'}} onClick={handleLogout}>
            <IconOut /> Salir
          </button>
        </div>
      </aside>
      <main className="main-content">
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
