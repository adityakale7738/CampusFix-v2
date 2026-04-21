// Run once: node database/seed.js
// This seeds admin + student with correct bcrypt passwords
require('dotenv').config({ path: require('path').join(__dirname,'../.env') });
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function seed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST||'localhost',
    user: process.env.DB_USER||'root',
    password: process.env.DB_PASSWORD||'aditya',
    database: process.env.DB_NAME||'campusfix_db'
  });

  const adminHash   = await bcrypt.hash('admin123',   10);
  const studentHash = await bcrypt.hash('student123', 10);

  // Admin
  const [admEx] = await conn.query("SELECT user_id FROM users WHERE email='admin@campusfix.edu'");
  if (!admEx.length) {
    await conn.query("INSERT INTO users (full_name,email,password,role) VALUES (?,?,?,?)",
      ['Administrator','admin@campusfix.edu', adminHash,'admin']);
    console.log('✅ Admin created: admin@campusfix.edu / admin123');
  } else console.log('ℹ️  Admin already exists');

  // Student
  const [stuEx] = await conn.query("SELECT user_id FROM users WHERE email='student@campusfix.edu'");
  if (!stuEx.length) {
    await conn.query("INSERT INTO users (full_name,email,password,roll_number,department,role) VALUES (?,?,?,?,?,?)",
      ['Aditya Kale','student@campusfix.edu',studentHash,'CS2021001','Computer Science','student']);
    console.log('✅ Student created: student@campusfix.edu / student123');
  } else console.log('ℹ️  Student already exists');

  // Sample complaints
  const [stuRow] = await conn.query("SELECT user_id FROM users WHERE email='student@campusfix.edu'");
  const [cnt]    = await conn.query("SELECT COUNT(*) as c FROM complaints");
  if (stuRow.length && cnt[0].c === 0) {
    const sid = stuRow[0].user_id;
    const samples = [
      ['CF-0001', sid, 1, 'Water leakage in hostel room 204', 'Major water leakage from ceiling in room 204, Block B.', 'High',   'In Progress', 'Block B, Room 204'],
      ['CF-0002', sid, 5, 'Wi-Fi not working in Library',     'Wi-Fi has been down for 3 days in the library.',         'High',   'Pending',     'Central Library'],
      ['CF-0003', sid, 2, 'Broken projector in Lab 3',        'Projector in Computer Lab 3 broken for a week.',         'Medium', 'Resolved',    'Computer Lab 3'],
      ['CF-0004', sid, 3, 'Street lights near hostel not working', 'Multiple lights near hostel gate not working.',     'High',   'Pending',     'Hostel Gate'],
      ['CF-0005', sid, 6, 'Dustbins overflowing in canteen',  'Dustbins not cleaned for 2 days.',                       'Low',    'Pending',     'Main Canteen'],
    ];
    for (const [code,uid,cat,title,desc,pri,status,loc] of samples) {
      await conn.query(
        'INSERT INTO complaints (complaint_code,user_id,cat_id,title,description,priority,status,location) VALUES (?,?,?,?,?,?,?,?)',
        [code,uid,cat,title,desc,pri,status,loc]
      );
    }
    console.log('✅ Sample complaints seeded (5 complaints)');
  }

  await conn.end();
  console.log('\n🎉 Database ready! Run: npm start\n');
}

seed().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
