import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminPage } from './pages/admin/AdminPage'
import { DisplayPage } from './pages/DisplayPage'
import { RegisterPage } from './pages/RegisterPage'
import { StatusPage } from './pages/StatusPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<DisplayPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
