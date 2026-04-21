require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'campusfix_db',
  port:               parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0
});

// Test connection without crashing the whole server
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL connected to campusfix_db');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('   → Check your .env file: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
    // Do NOT exit — let server start so we can see proper error messages
  });

module.exports = pool;
