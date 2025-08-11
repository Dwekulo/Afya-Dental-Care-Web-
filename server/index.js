import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const app = express()
const PORT = process.env.PORT || 8080
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

// Initialize database
const db = new Database('./server/data.db')
db.pragma('journal_mode = WAL')

// Schema
const ensureSchema = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','doctor','patient','receptionist')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      items TEXT NOT NULL, -- JSON string
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'unpaid',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES users(id),
      FOREIGN KEY (doctor_id) REFERENCES users(id)
    );
  `)
}
ensureSchema()

// Seed default users if not present
const getUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?')
const insertUser = db.prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)')
const seedUser = (email, name, password, role) => {
  const existing = getUserByEmail.get(email)
  if (!existing) {
    const hash = bcrypt.hashSync(password, 10)
    insertUser.run(email, name, hash, role)
    console.log(`Seeded ${role}: ${email}`)
  }
}
seedUser('admin@clinic.local', 'Admin', 'admin12345', 'admin')
seedUser('doctor@clinic.local', 'Dr. John Doe', 'doctor12345', 'doctor')
seedUser('receptionist@clinic.local', 'Reception', 'receptionist123', 'receptionist')
seedUser('patient@clinic.local', 'Jane Patient', 'patient12345', 'patient')

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' })
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || ''
  const [, token] = header.split(' ')
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = { id: payload.sub, role: payload.role, email: payload.email, name: payload.name }
    next()
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' })
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
    next()
  }
}

app.get('/api/health', (req, res) => res.json({ ok: true }))

// Auth routes
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' })
  const user = getUserByEmail.get(email)
  if (!user) return res.status(400).json({ message: 'Invalid credentials' })
  const ok = bcrypt.compareSync(password, user.password_hash)
  if (!ok) return res.status(400).json({ message: 'Invalid credentials' })
  const token = signToken(user)
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } })
})

// Admin can register other users
app.post('/api/auth/register', authRequired, requireRole(['admin']), (req, res) => {
  const { email, name, password, role } = req.body
  if (!email || !name || !password || !role) return res.status(400).json({ message: 'Missing fields' })
  try {
    const hash = bcrypt.hashSync(password, 10)
    const info = insertUser.run(email, name, hash, role)
    const created = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(info.lastInsertRowid)
    res.status(201).json(created)
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ message: 'Email already exists' })
    console.error(e)
    res.status(500).json({ message: 'Failed to create user' })
  }
})

// List users by role
app.get('/api/users', authRequired, (req, res) => {
  const role = String(req.query.role || '').trim()
  if (!role) return res.status(400).json({ message: 'role query required' })

  // Permissions:
  // - admin, receptionist: can list any role
  // - doctor: can list patients
  // - patient: cannot list
  if (req.user.role === 'patient') return res.status(403).json({ message: 'Forbidden' })
  if (req.user.role === 'doctor' && role !== 'patient') return res.status(403).json({ message: 'Forbidden' })

  const rows = db.prepare('SELECT id, email, name, role FROM users WHERE role = ? ORDER BY name').all(role)
  res.json(rows)
})

// Invoices
const insertInvoice = db.prepare(
  'INSERT INTO invoices (patient_id, doctor_id, items, total, status) VALUES (?, ?, ?, ?, ?)' 
)
const selectInvoiceById = db.prepare('SELECT * FROM invoices WHERE id = ?')
const selectInvoices = db.prepare('SELECT * FROM invoices ORDER BY id DESC')
const selectInvoicesByDoctor = db.prepare('SELECT * FROM invoices WHERE doctor_id = ? ORDER BY id DESC')
const selectInvoicesByPatient = db.prepare('SELECT * FROM invoices WHERE patient_id = ? ORDER BY id DESC')
const updateInvoice = db.prepare('UPDATE invoices SET items = ?, total = ?, status = ? WHERE id = ?')
const deleteInvoice = db.prepare('DELETE FROM invoices WHERE id = ?')

function hydrateInvoice(row) {
  const patient = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(row.patient_id)
  const doctor = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(row.doctor_id)
  const items = JSON.parse(row.items)
  return {
    id: row.id,
    patient_id: row.patient_id,
    patient_name: patient?.name,
    patient_email: patient?.email,
    doctor_id: row.doctor_id,
    doctor_name: doctor?.name,
    doctor_email: doctor?.email,
    items,
    total: row.total,
    status: row.status,
    created_at: row.created_at,
  }
}

app.get('/api/invoices', authRequired, (req, res) => {
  const role = req.user.role
  let rows = []
  if (role === 'admin' || role === 'receptionist') {
    rows = selectInvoices.all()
  } else if (role === 'doctor') {
    rows = selectInvoicesByDoctor.all(req.user.id)
  } else if (role === 'patient') {
    rows = selectInvoicesByPatient.all(req.user.id)
  }
  res.json(rows.map(hydrateInvoice))
})

app.post('/api/invoices', authRequired, (req, res) => {
  const role = req.user.role
  if (!['admin', 'receptionist', 'doctor'].includes(role)) return res.status(403).json({ message: 'Forbidden' })

  const { patient_id, doctor_id, items } = req.body
  if (!patient_id || (!doctor_id && role !== 'doctor') || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Invalid payload' })
  }
  const resolvedDoctorId = role === 'doctor' ? req.user.id : doctor_id
  const total = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0)

  try {
    const info = insertInvoice.run(patient_id, resolvedDoctorId, JSON.stringify(items), total, 'unpaid')
    const created = selectInvoiceById.get(info.lastInsertRowid)
    res.status(201).json(hydrateInvoice(created))
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to create invoice' })
  }
})

app.get('/api/invoices/:id', authRequired, (req, res) => {
  const inv = selectInvoiceById.get(Number(req.params.id))
  if (!inv) return res.status(404).json({ message: 'Not found' })
  if (
    req.user.role === 'patient' && inv.patient_id !== req.user.id ||
    req.user.role === 'doctor' && inv.doctor_id !== req.user.id
  ) {
    return res.status(403).json({ message: 'Forbidden' })
  }
  res.json(hydrateInvoice(inv))
})

app.put('/api/invoices/:id', authRequired, (req, res) => {
  const inv = selectInvoiceById.get(Number(req.params.id))
  if (!inv) return res.status(404).json({ message: 'Not found' })
  const role = req.user.role
  if (!['admin', 'receptionist'].includes(role) && !(role === 'doctor' && inv.doctor_id === req.user.id)) {
    return res.status(403).json({ message: 'Forbidden' })
  }
  const { items, status } = req.body
  if (!Array.isArray(items) || items.length === 0 || !status) return res.status(400).json({ message: 'Invalid payload' })
  const total = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0)
  try {
    updateInvoice.run(JSON.stringify(items), total, status, inv.id)
    const updated = selectInvoiceById.get(inv.id)
    res.json(hydrateInvoice(updated))
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Failed to update invoice' })
  }
})

app.delete('/api/invoices/:id', authRequired, requireRole(['admin']), (req, res) => {
  const info = deleteInvoice.run(Number(req.params.id))
  res.json({ deleted: info.changes > 0 })
})

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`)
})