import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const I = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}/>
const IDash  = () => <I><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></I>
const ICal   = () => <I><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></I>
const IUser  = () => <I><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></I>
const IMon   = () => <I><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></I>
const IChart = () => <I><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></I>
const ILog   = () => <I><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></I>
const IUsers = () => <I><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></I>
const IKine  = () => <I><path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2z"/><path d="M12 14c-5 0-9 2-9 4v1h18v-1c0-2-4-4-9-4z"/></I>
const IOut   = () => <I><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></I>
const IMenu  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
const IX     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>

export default function Layout() {
  const { perfil, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rol = perfil?.rol
  const ini = ((perfil?.nombre?.[0]||'')+(perfil?.apellido?.[0]||'')).toUpperCase()
  const nombre = `${perfil?.nombre||''} ${perfil?.apellido||''}`.trim()
  const cerrar = () => setOpen(false)

  return (
    <div className="app">
      <div className={`overlay ${open?'show':''}`} onClick={cerrar}/>
      <aside className={`sb ${open?'open':''}`}>
        <div className="sb-logo">
          <span className="sb-logo-txt">El <span>Círculo</span></span>
          <button onClick={cerrar} style={{background:'none',border:'none',cursor:'pointer',display:'flex',color:'#666'}}><IX/></button>
        </div>
        <nav className="sb-nav">
          <NavLink to="/" end className={({isActive})=>'ni'+(isActive?' on':'')} onClick={cerrar}><IDash/>Dashboard</NavLink>
          <NavLink to="/turnos" className={({isActive})=>'ni'+(isActive?' on':'')} onClick={cerrar}><ICal/>Turnos</NavLink>
          <NavLink to="/pacientes" className={({isActive})=>'ni'+(isActive?' on':'')} onClick={cerrar}><IUser/>Pacientes</NavLink>
          <NavLink to="/caja" className={({isActive})=>'ni'+(isActive?' on':'')} onClick={cerrar}><IMon/>Caja</NavLink>
          <NavLink to="/reportes" className={({isActive})=>'ni'+(isActive?' on':'')} onClick={cerrar}><IChart/>Reportes</NavLink>
          <NavLink to="/logs" className={({isActive})=>'ni'+(isActive?' on':'')} onClick={cerrar}><ILog/>Actividad</NavLink>
          <NavLink to="/kinesiologos" className={({isActive})=>'ni'+(isActive?' on':'')} onClick={cerrar}><IKine/>Kinesiológos</NavLink>
          {rol==='dueno' && <NavLink to="/usuarios" className={({isActive})=>'ni'+(isActive?' on':'')} onClick={cerrar}><IUsers/>Usuarios</NavLink>}
        </nav>
        <div className="sb-footer">
          <div className="sb-user">
            <div className="av">{ini}</div>
            <div><div className="sb-uname">{nombre}</div><div className="sb-urol">{rol}</div></div>
          </div>
          <button className="btn bs bsm" style={{width:'100%'}} onClick={async()=>{await logout();navigate('/login')}}>
            <IOut/>Salir
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="tmob">
          <button onClick={()=>setOpen(true)} style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}><IMenu/></button>
          <span className="sb-logo-txt" style={{fontSize:15}}>El <span style={{color:'#185FA5'}}>Círculo</span></span>
          <div className="av">{ini}</div>
        </div>
        <div className="page"><Outlet/></div>
      </main>
    </div>
  )
}
