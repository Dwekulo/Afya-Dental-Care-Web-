import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/invoices'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: '48px auto' }}>
      <h2 style={{ marginBottom: 16 }}>Sign in</h2>
      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: 8, borderRadius: 6, marginBottom: 12 }}>
          {error}
        </div>
      )}
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label>
          <div style={{ marginBottom: 4 }}>Email</div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 6 }}
          />
        </label>
        <label>
          <div style={{ marginBottom: 4 }}>Password</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 6 }}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '10px 14px', borderRadius: 6, background: '#2563eb', color: 'white', border: 'none' }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div style={{ marginTop: 16, fontSize: 12, color: '#6b7280' }}>
        Demo accounts will be created on first server start: admin@clinic.local, doctor@clinic.local, receptionist@clinic.local, patient@clinic.local
      </div>
    </div>
  )
}