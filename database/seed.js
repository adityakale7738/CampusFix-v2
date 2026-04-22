// ================================================
// CampusFix Seed Script - Works with Aiven MySQL
// Run: node database/seed.js
// ================================================
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('\n🌱 CampusFix Database Seeder');
  console.log('   Host:', process.env.DB_HOST || 'localhost');
  console.log('   DB:  ', process.env.DB_NAME || 'campusfix_db');
  console.log('   User:', process.env.DB_USER || 'root');
  console.log('   Port:', process.env.DB_PORT || 3306, '\n');

  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'campusfix_db',
    port:     parseInt(process.env.DB_PORT) || 3306,
    ssl:      { rejectUnauthorized: false }
  });

  console.log('✅ Connected!\n');

  // Create all tables
  await conn.query(`CREATE TABLE IF NOT EXISTS departments (
    dept_id INT AUTO_INCREMENT PRIMARY KEY,
    dept_name VARCHAR(100) NOT NULL,
    dept_code VARCHAR(10) NOT NULL
  )`);

  await conn.query(`CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    roll_number VARCHAR(30) DEFAULT NULL,
    department VARCHAR(100) DEFAULT NULL,
    phone VARCHAR(15) DEFAULT NULL,
    role ENUM('student','admin') DEFAULT 'student',
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await conn.query(`CREATE TABLE IF NOT EXISTS categories (
    cat_id INT AUTO_INCREMENT PRIMARY KEY,
    cat_name VARCHAR(100) NOT NULL UNIQUE,
    cat_icon VARCHAR(10) DEFAULT '📋'
  )`);

  await conn.query(`CREATE TABLE IF NOT EXISTS complaints (
    complaint_id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_code VARCHAR(10) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    cat_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority ENUM('Low','Medium','High') DEFAULT 'Medium',
    status ENUM('Pending','In Progress','Resolved','Rejected') DEFAULT 'Pending',
    location VARCHAR(255) DEFAULT NULL,
    image_path VARCHAR(500) DEFAULT NULL,
    admin_note TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (cat_id)  REFERENCES categories(cat_id) ON DELETE RESTRICT
  )`);

  await conn.query(`CREATE TABLE IF NOT EXISTS complaint_updates (
    update_id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NOT NULL,
    updated_by INT NOT NULL,
    old_status VARCHAR(20) DEFAULT NULL,
    new_status VARCHAR(20) NOT NULL,
    admin_note TEXT DEFAULT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await conn.query(`CREATE TABLE IF NOT EXISTS notifications (
    notif_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    complaint_id INT NOT NULL,
    message TEXT NOT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('✅ All tables created/verified');

  // Categories
  const cats = [
    ['Hostel','🏠'],['Classroom','🏫'],['Electricity','💡'],
    ['Water','💧'],['Internet','🌐'],['Cleanliness','🧹']
  ];
  for (const [name, icon] of cats) {
    await conn.query('INSERT IGNORE INTO categories (cat_name, cat_icon) VALUES (?,?)', [name, icon]);
  }
  console.log('✅ Categories seeded');

  // Admin - always update password to ensure it works
  const adminHash = await bcrypt.hash('admin123', 10);
  const [admEx] = await conn.query("SELECT user_id FROM users WHERE email='admin@campusfix.edu'");
  if (!admEx.length) {
    await conn.query(
      "INSERT INTO users (full_name,email,password,role) VALUES (?,?,?,?)",
      ['Administrator','admin@campusfix.edu',adminHash,'admin']
    );
    console.log('✅ Admin created:   admin@campusfix.edu / admin123');
  } else {
    await conn.query("UPDATE users SET password=?, is_active=1 WHERE email='admin@campusfix.edu'", [adminHash]);
    console.log('✅ Admin updated:   admin@campusfix.edu / admin123');
  }

  // Student - always update password
  const stuHash = await bcrypt.hash('student123', 10);
  const [stuEx] = await conn.query("SELECT user_id FROM users WHERE email='student@campusfix.edu'");
  if (!stuEx.length) {
    await conn.query(
      "INSERT INTO users (full_name,email,password,roll_number,department,role) VALUES (?,?,?,?,?,?)",
      ['Aditya Kale','student@campusfix.edu',stuHash,'CS2021001','Computer Science','student']
    );
    console.log('✅ Student created: student@campusfix.edu / student123');
  } else {
    await conn.query("UPDATE users SET password=?, is_active=1 WHERE email='student@campusfix.edu'", [stuHash]);
    console.log('✅ Student updated: student@campusfix.edu / student123');
  }

  // Sample complaints
  const [stuRow] = await conn.query("SELECT user_id FROM users WHERE email='student@campusfix.edu'");
  const [[cnt]]  = await conn.query("SELECT COUNT(*) as c FROM complaints");
  if (stuRow.length && cnt.c === 0) {
    const sid = stuRow[0].user_id;
    const samples = [
      ['CF-0001',sid,1,'Water leakage in hostel room 204','Major water leakage from ceiling in room 204, Block B.','High','In Progress','Block B, Room 204'],
      ['CF-0002',sid,5,'Wi-Fi not working in Library','Wi-Fi has been down for 3 days in the library.','High','Pending','Central Library'],
      ['CF-0003',sid,2,'Broken projector in Lab 3','Projector in Computer Lab 3 broken for over a week.','Medium','Resolved','Computer Lab 3'],
      ['CF-0004',sid,3,'Street lights not working near hostel','Multiple lights near hostel gate not working. Safety risk at night.','High','Pending','Hostel Gate'],
      ['CF-0005',sid,6,'Dustbins overflowing in canteen','Dustbins not cleaned for 2 days. Bad smell.','Low','Pending','Main Canteen'],
    ];
    for (const [code,uid,cat,title,desc,pri,status,loc] of samples) {
      await conn.query(
        'INSERT IGNORE INTO complaints (complaint_code,user_id,cat_id,title,description,priority,status,location) VALUES (?,?,?,?,?,?,?,?)',
        [code,uid,cat,title,desc,pri,status,loc]
      );
    }
    console.log('✅ Sample complaints seeded (5)');
  } else {
    console.log('ℹ️  Complaints already exist — skipping sample data');
  }

  await conn.end();
  console.log('\n🎉 Database ready!');
  console.log('   Admin:   admin@campusfix.edu / admin123');
  console.log('   Student: student@campusfix.edu / student123\n');
}

seed().catch(err => {
  console.error('\n❌ Seed failed:', err.message, '\n');
  process.exit(1);
});
