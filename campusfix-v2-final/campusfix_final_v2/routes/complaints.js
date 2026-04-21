const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendStatusUpdateEmail }     = require('../email');

// File upload
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g,'_'))
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null,true) : cb(new Error('Images only'))
});

// Generate CF-0001 code
async function genCode() {
  const [rows] = await db.query('SELECT complaint_code FROM complaints ORDER BY complaint_id DESC LIMIT 1');
  if (!rows.length) return 'CF-0001';
  const num = parseInt(rows[0].complaint_code.split('-')[1]) + 1;
  return 'CF-' + String(num).padStart(4,'0');
}

// ── STUDENT ROUTES ──

// POST /api/complaints/submit
router.post('/submit', requireAuth, upload.single('image'), async (req, res) => {
  const { title, category, priority, description, location } = req.body;
  if (!title || !category || !description)
    return res.status(400).json({ error: 'Title, category and description required.' });
  const validCat = ['Hostel','Classroom','Electricity','Water','Internet','Cleanliness'];
  if (!validCat.includes(category)) return res.status(400).json({ error: 'Invalid category.' });
  const finalPri  = ['Low','Medium','High'].includes(priority) ? priority : 'Medium';
  const imagePath = req.file ? '/uploads/' + req.file.filename : null;
  try {
    const [catRows] = await db.query('SELECT cat_id FROM categories WHERE cat_name=?', [category]);
    const cat_id = catRows.length ? catRows[0].cat_id : 1;
    const code = await genCode();
    await db.query(
      'INSERT INTO complaints (complaint_code,user_id,cat_id,title,description,priority,location,image_path) VALUES (?,?,?,?,?,?,?,?)',
      [code, req.session.userId, cat_id, title, description, finalPri, location||null, imagePath]
    );
    res.json({ success: true, complaintId: code });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Submit failed.' }); }
});

// GET /api/complaints/my
router.get('/my', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.complaint_id, c.complaint_code, c.title, c.description, c.priority,
              c.status, c.location, c.image_path, c.admin_note, c.created_at, c.updated_at,
              cat.cat_name AS category
       FROM complaints c
       JOIN categories cat ON c.cat_id = cat.cat_id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC`,
      [req.session.userId]
    );
    // normalize: add complaint_id field as complaint_code alias for frontend
    const normalized = rows.map(r => ({ ...r, complaint_id: r.complaint_code }));
    res.json(normalized);
  } catch(e) { res.status(500).json({ error: 'Failed.' }); }
});

// GET /api/complaints/mystats
router.get('/mystats', requireAuth, async (req, res) => {
  try {
    const [[stats]] = await db.query(
      `SELECT COUNT(*) AS total,
        SUM(status='Pending') AS pending,
        SUM(status='In Progress') AS inProgress,
        SUM(status='Resolved') AS resolved
       FROM complaints WHERE user_id=?`, [req.session.userId]
    );
    res.json(stats);
  } catch(e) { res.status(500).json({ error: 'Failed.' }); }
});

// GET /api/complaints/my/:id
router.get('/my/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, cat.cat_name AS category, c.complaint_code AS complaint_id
       FROM complaints c
       JOIN categories cat ON c.cat_id = cat.cat_id
       WHERE c.complaint_code = ? AND c.user_id = ?`,
      [req.params.id, req.session.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found.' });
    res.json({ ...rows[0], complaint_id: rows[0].complaint_code });
  } catch(e) { res.status(500).json({ error: 'Failed.' }); }
});

// ── ADMIN ROUTES ──

// GET /api/complaints/all
router.get('/all', requireAdmin, async (req, res) => {
  const { status, category, priority, search } = req.query;
  let sql = `SELECT c.complaint_id, c.complaint_code, c.title, c.description, c.priority,
             c.status, c.location, c.image_path, c.admin_note, c.created_at, c.updated_at,
             cat.cat_name AS category,
             u.full_name AS student_name, u.email AS student_email,
             u.roll_number, u.department
             FROM complaints c
             JOIN categories cat ON c.cat_id  = cat.cat_id
             JOIN users u        ON c.user_id = u.user_id
             WHERE 1=1`;
  const params = [];
  if (status)   { sql += ' AND c.status=?';        params.push(status); }
  if (category) { sql += ' AND cat.cat_name=?';    params.push(category); }
  if (priority) { sql += ' AND c.priority=?';      params.push(priority); }
  if (search)   {
    sql += ' AND (c.title LIKE ? OR c.complaint_code LIKE ? OR u.full_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += " ORDER BY FIELD(c.priority,'High','Medium','Low'), c.created_at DESC";
  try {
    const [rows] = await db.query(sql, params);
    const normalized = rows.map(r => ({ ...r, complaint_id: r.complaint_code }));
    res.json(normalized);
  } catch(e) { console.error(e); res.status(500).json({ error: 'Failed.' }); }
});

// GET /api/complaints/stats
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [[totals]] = await db.query(`
      SELECT COUNT(*) AS total,
        SUM(status='Pending')     AS pending,
        SUM(status='In Progress') AS inProgress,
        SUM(status='Resolved')    AS resolved
      FROM complaints`);
    const [byCategory] = await db.query(
      `SELECT cat.cat_name AS category, COUNT(c.complaint_id) AS count
       FROM categories cat LEFT JOIN complaints c ON cat.cat_id=c.cat_id
       GROUP BY cat.cat_id ORDER BY count DESC`
    );
    const [byPriority] = await db.query(
      'SELECT priority, COUNT(*) AS count FROM complaints GROUP BY priority'
    );
    res.json({
      total:      totals.total      || 0,
      pending:    totals.pending    || 0,
      inProgress: totals.inProgress || 0,
      resolved:   totals.resolved   || 0,
      byCategory, byPriority
    });
  } catch(e) { res.status(500).json({ error: 'Failed.' }); }
});

// PATCH /api/complaints/:id/status
router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status, admin_note } = req.body;
  if (!['Pending','In Progress','Resolved','Rejected'].includes(status))
    return res.status(400).json({ error: 'Invalid status.' });
  try {
    const [rows] = await db.query('SELECT * FROM complaints WHERE complaint_code=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found.' });
    const c = rows[0];
    await db.query(
      'UPDATE complaints SET status=?,admin_note=?,updated_at=NOW() WHERE complaint_code=?',
      [status, admin_note||null, req.params.id]
    );
    // Log history
    await db.query(
      'INSERT INTO complaint_updates (complaint_id,updated_by,old_status,new_status,admin_note) VALUES (?,?,?,?,?)',
      [c.complaint_id, req.session.userId, c.status, status, admin_note||null]
    );
    // Notification
    await db.query(
      'INSERT INTO notifications (user_id,complaint_id,message) VALUES (?,?,?)',
      [c.user_id, c.complaint_id, `Your complaint ${req.params.id} status updated to ${status}`]
    );
    // Email
    const [uRows] = await db.query('SELECT * FROM users WHERE user_id=?', [c.user_id]);
    if (uRows.length) {
      sendStatusUpdateEmail({
        to: uRows[0].email, studentName: uRows[0].full_name,
        complaintId: req.params.id, title: c.title, status, adminNote: admin_note
      });
    }
    res.json({ success: true });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Update failed.' }); }
});

// DELETE /api/complaints/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM complaints WHERE complaint_code=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found.' });
    if (rows[0].image_path) {
      const f = path.join(__dirname,'../public',rows[0].image_path);
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    await db.query('DELETE FROM complaints WHERE complaint_code=?', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'Delete failed.' }); }
});

module.exports = router;
