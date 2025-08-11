import React from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Invoices from './pages/Invoices.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { useAuth } from './context/AuthContext.jsx'

function App() {
  const { user, logout } = useAuth()

  return (
    <div style={{ fontFamily: 'system-ui, Arial, sans-serif', color: '#222' }}>
      <nav style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #e5e7eb' }}>
        <Link to="/">Home</Link>
        <Link to="/invoices">Invoices</Link>
        <div style={{ marginLeft: 'auto' }}>
          {user ? (
            <span>
              Signed in as <strong>{user.name}</strong> ({user.role}){' '}
              <button onClick={logout} style={{ marginLeft: 8 }}>Logout</button>
            </span>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </div>
      </nav>

      <main style={{ padding: 16 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/invoices" replace />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/invoices"
            element={
              <ProtectedRoute>
                <Invoices />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<div>Not Found</div>} />
        </Routes>
      </main>
    </div>
  )
}

export default App