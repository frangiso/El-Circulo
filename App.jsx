import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Pendiente from './pages/auth/Pendiente'
import Dashboard from './pages/dashboard/Dashboard'
import Turnos from './pages/turnos/Turnos'
import NuevoTurno from './pages/turnos/NuevoTurno'
import Pacientes from './pages/pacientes/Pacientes'
import NuevoPaciente from './pages/pacientes/NuevoPaciente'
import FichaPaciente from './pages/pacientes/FichaPaciente'
import EditarPaciente from './pages/pacientes/EditarPaciente'
import Caja from './pages/caja/Caja'
import Reportes from './pages/reportes/Reportes'
import Usuarios from './pages/usuarios/Usuarios'
import Logs from './pages/logs/Logs'

function PrivateRoute({ children, roles }) {
  const { currentUser, userProfile } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  if (userProfile?.estado === 'pendiente') return <Navigate to="/pendiente" replace />
  if (roles && !roles.includes(userProfile?.rol)) return <Navigate to="/" replace />
  return children
}

function PublicRoute({ children }) {
  const { currentUser, userProfile } = useAuth()
  if (currentUser && userProfile?.estado !== 'pendiente') return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/pendiente" element={<Pendiente />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="turnos" element={<Turnos />} />
        <Route path="turnos/nuevo" element={<NuevoTurno />} />
        <Route path="pacientes" element={<Pacientes />} />
        <Route path="pacientes/nuevo" element={<NuevoPaciente />} />
        <Route path="pacientes/:id" element={<FichaPaciente />} />
        <Route path="pacientes/:id/editar" element={<EditarPaciente />} />
        <Route path="caja" element={<Caja />} />
        <Route path="reportes" element={<PrivateRoute roles={['dueno', 'kinesiologo']}><Reportes /></PrivateRoute>} />
        <Route path="usuarios" element={<PrivateRoute roles={['dueno']}><Usuarios /></PrivateRoute>} />
        <Route path="logs" element={<PrivateRoute roles={['dueno', 'kinesiologo']}><Logs /></PrivateRoute>} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
