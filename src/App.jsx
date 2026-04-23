import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CacheProvider, useCache } from './context/AppCache'
import Layout from './components/Layout'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Pendiente from './pages/auth/Pendiente'
import Dashboard from './pages/dashboard/Dashboard'
import Turnos from './pages/turnos/Turnos'
import NuevoTurno from './pages/turnos/NuevoTurno'
import EditarTurno from './pages/turnos/EditarTurno'
import Pacientes from './pages/pacientes/Pacientes'
import NuevoPaciente from './pages/pacientes/NuevoPaciente'
import FichaPaciente from './pages/pacientes/FichaPaciente'
import EditarPaciente from './pages/pacientes/EditarPaciente'
import Caja from './pages/caja/Caja'
import Reportes from './pages/reportes/Reportes'
import Usuarios from './pages/usuarios/Usuarios'
import Kinesiologos from './pages/kinesiologos/Kinesiologos'
import Logs from './pages/logs/Logs'

function LimpiezaSilenciosa() {
  const { user, perfil } = useAuth()
  const { limpiar } = useCache()
  useEffect(() => {
    if (user && perfil?.estado === 'activo') {
      limpiar(user.uid, `${perfil.apellido} ${perfil.nombre}`)
    }
  }, [user?.uid])
  return null
}

function PrivR({ children, soloDueno }) {
  const { user, perfil } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (perfil?.estado === 'pendiente') return <Navigate to="/pendiente" replace />
  if (soloDueno && perfil?.rol !== 'dueno') return <Navigate to="/" replace />
  return children
}

function PubR({ children }) {
  const { user, perfil } = useAuth()
  if (user && perfil?.estado !== 'pendiente') return <Navigate to="/" replace />
  return children
}

function Rutas() {
  return (
    <>
      <LimpiezaSilenciosa />
      <Routes>
        <Route path="/login"     element={<PubR><Login /></PubR>} />
        <Route path="/register"  element={<PubR><Register /></PubR>} />
        <Route path="/pendiente" element={<Pendiente />} />
        <Route path="/" element={<PrivR><Layout /></PrivR>}>
          <Route index element={<Dashboard />} />
          <Route path="turnos" element={<Turnos />} />
          <Route path="turnos/nuevo" element={<NuevoTurno />} />
          <Route path="turnos/:id/editar" element={<EditarTurno />} />
          <Route path="pacientes" element={<Pacientes />} />
          <Route path="pacientes/nuevo" element={<NuevoPaciente />} />
          <Route path="pacientes/:id" element={<FichaPaciente />} />
          <Route path="pacientes/:id/editar" element={<EditarPaciente />} />
          <Route path="caja" element={<Caja />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="logs" element={<Logs />} />
          <Route path="kinesiologos" element={<Kinesiologos />} />
          <Route path="usuarios" element={<PrivR soloDueno><Usuarios /></PrivR>} />
        </Route>
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <CacheProvider>
        <BrowserRouter><Rutas /></BrowserRouter>
      </CacheProvider>
    </AuthProvider>
  )
}
