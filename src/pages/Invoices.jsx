import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

function currency(amount) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount || 0)
}

export default function Invoices() {
  const { token, user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])

  const canManage = useMemo(() => ['admin', 'receptionist', 'doctor'].includes(user?.role), [user])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError('')
      try {
        const [invRes] = await Promise.all([
          fetch('/api/invoices', { headers: { Authorization: `Bearer ${token}` } }),
        ])
        if (!invRes.ok) throw new Error('Failed to load invoices')
        const invData = await invRes.json()
        setInvoices(invData)

        if (['admin', 'receptionist', 'doctor'].includes(user.role)) {
          const qs = new URLSearchParams({ role: 'patient' }).toString()
          const patRes = await fetch(`/api/users?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
          if (patRes.ok) setPatients(await patRes.json())

          if (['admin', 'receptionist'].includes(user.role)) {
            const dqs = new URLSearchParams({ role: 'doctor' }).toString()
            const docRes = await fetch(`/api/users?${dqs}`, { headers: { Authorization: `Bearer ${token}` } })
            if (docRes.ok) setDoctors(await docRes.json())
          } else if (user.role === 'doctor') {
            setDoctors([{ id: user.id, name: user.name, email: user.email, role: 'doctor' }])
          }
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [token, user])

  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedDoctorId, setSelectedDoctorId] = useState('')
  const [items, setItems] = useState([{ description: '', amount: '' }])
  const total = useMemo(() => items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0), [items])

  const addItem = () => setItems((prev) => [...prev, { description: '', amount: '' }])
  const updateItem = (idx, key, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)))
  }
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx))

  const submitInvoice = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        patient_id: Number(selectedPatientId),
        doctor_id: Number(selectedDoctorId || (user.role === 'doctor' ? user.id : '')),
        items: items
          .filter((it) => it.description && it.amount !== '')
          .map((it) => ({ description: it.description, amount: Number(it.amount) })),
      }
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to create invoice')
      const created = await res.json()
      setInvoices((prev) => [created, ...prev])
      setItems([{ description: '', amount: '' }])
      setSelectedPatientId('')
      setSelectedDoctorId('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Invoices</h2>
      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: 8, borderRadius: 6, marginBottom: 12 }}>
          {error}
        </div>
      )}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          {canManage && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0, marginBottom: 12 }}>Create Invoice</h3>
              <form onSubmit={submitInvoice} style={{ display: 'grid', gap: 8 }}>
                <label>
                  <div style={{ marginBottom: 4 }}>Patient</div>
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    required
                    style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 6 }}
                  >
                    <option value="">Select patient...</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.email})
                      </option>
                    ))}
                  </select>
                </label>

                {['admin', 'receptionist'].includes(user.role) && (
                  <label>
                    <div style={{ marginBottom: 4 }}>Doctor</div>
                    <select
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                      required
                      style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 6 }}
                    >
                      <option value="">Select doctor...</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.email})
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontWeight: 600 }}>Items</div>
                  {items.map((it, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px', gap: 8 }}>
                      <input
                        placeholder="Description"
                        value={it.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                        style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 6 }}
                      />
                      <input
                        placeholder="Amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.amount}
                        onChange={(e) => updateItem(idx, 'amount', e.target.value)}
                        style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 6 }}
                      />
                      <button type="button" onClick={() => removeItem(idx)} style={{ border: '1px solid #e5e7eb', borderRadius: 6 }}>
                        Remove
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addItem} style={{ width: 'fit-content' }}>
                    + Add item
                  </button>
                </div>

                <div style={{ fontWeight: 600, marginTop: 8 }}>Total: {currency(total)}</div>

                <button type="submit" style={{ marginTop: 8, padding: '10px 14px', borderRadius: 6, background: '#16a34a', color: 'white', border: 'none', width: 'fit-content' }}>
                  Save Invoice
                </button>
              </form>
            </div>
          )}

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>All Invoices</div>
            <div style={{ padding: 12, display: 'grid', gap: 8 }}>
              {invoices.length === 0 ? (
                <div>No invoices yet</div>
              ) : (
                invoices.map((inv) => (
                  <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, padding: 8, border: '1px solid #f3f4f6', borderRadius: 6 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Invoice</div>
                      <div>#{inv.id}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Patient</div>
                      <div>{inv.patient_name} ({inv.patient_email})</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Doctor</div>
                      <div>{inv.doctor_name} ({inv.doctor_email})</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Total</div>
                      <div>{currency(inv.total)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}