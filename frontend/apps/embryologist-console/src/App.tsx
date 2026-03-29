import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CycleView from './pages/CycleView'
import EmbryoDetail from './pages/EmbryoDetail'
import ChecklistRunner from './pages/ChecklistRunner'
import WeekView from './pages/WeekView'
import Settings from './pages/Settings'
import Export from './pages/Export'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="cycles/:id" element={<CycleView />} />
          <Route path="embryos/:id" element={<EmbryoDetail />} />
          <Route path="checklists/:id" element={<ChecklistRunner />} />
          <Route path="week" element={<WeekView />} />
          <Route path="settings" element={<Settings />} />
          <Route path="export" element={<Export />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
