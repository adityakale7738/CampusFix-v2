require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret:            process.env.SESSION_SECRET || 'campusfix-secret-2024',
  resave:            false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Load routes safely
try {
  const authRoute        = require('./routes/auth');
  const complaintsRoute  = require('./routes/complaints');

  if (typeof authRoute !== 'function') throw new Error('routes/auth.js does not export a router. Delete the file and re-copy from the downloaded package.');
  if (typeof complaintsRoute !== 'function') throw new Error('routes/complaints.js does not export a router. Delete the file and re-copy from the downloaded package.');

  app.use('/api/auth',       authRoute);
  app.use('/api/complaints', complaintsRoute);
} catch(err) {
  console.error('\n❌ Route loading error:', err.message, '\n');
  process.exit(1);
}

// Pages
app.get('/',          (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/admin',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🎓 CampusFix v2.0 (MySQL) → http://localhost:${PORT}`);
  console.log(`   Admin:   admin@campusfix.edu  / admin123`);
  console.log(`   Student: student@campusfix.edu / student123\n`);
});
