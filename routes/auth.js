const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../database/db');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, roll_number, department, phone } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password required.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  try {
    const [ex] = await db.query('SELECT user_id FROM users WHERE email=?', [email]);
    if (ex.length) return res.status(409).json({ error: 'Email already registered.' });
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (full_name,email,password,roll_number,department,phone,role) VALUES (?,?,?,?,?,?,?)',
      [name, email, hash, roll_number||null, department||null, phone||null, 'student']
    );
    req.session.userId = result.insertId;
    req.session.name   = name;
    req.session.role   = 'student';
    res.json({ success: true, role: 'student', name });
  } catch(e) { console.error('register error:', e.message); res.status(500).json({ error: 'Registration failed.' }); }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required.' });
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email=? AND is_active=1', [email]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password)))
      return res.status(401).json({ error: 'Invalid email or password.' });
    const user = rows[0];
    req.session.userId = user.user_id;
    req.session.name   = user.full_name;
    req.session.role   = user.role;
    res.json({ success: true, role: user.role, name: user.full_name });
  } catch(e) { console.error('login error:', e.message); res.status(500).json({ error: 'Login failed.' }); }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// GET /api/auth/session
router.get('/session', (req, res) => {
  if (req.session && req.session.userId)
    res.json({ loggedIn: true, role: req.session.role, name: req.session.name, userId: req.session.userId });
  else
    res.json({ loggedIn: false });
});

// GET /api/auth/profile
router.get('/profile', async (req, res) => {
  if (!req.session || !req.session.userId)
    return res.status(401).json({ error: 'Unauthorized' });
  try {
    const [rows] = await db.query(
      'SELECT user_id as id, full_name as name, email, roll_number, department, phone, role, created_at FROM users WHERE user_id=?',
      [req.session.userId]
    );
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: 'Failed.' }); }
});

module.exports = router;
