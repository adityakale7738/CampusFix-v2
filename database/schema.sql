-- ==============================================
-- CampusFix v2.0 — MySQL Database Schema
-- Run this in MySQL Workbench or phpMyAdmin
-- ==============================================

CREATE DATABASE IF NOT EXISTS campusfix_db;
USE campusfix_db;

-- TABLE 1: departments
CREATE TABLE IF NOT EXISTS departments (
  dept_id   INT AUTO_INCREMENT PRIMARY KEY,
  dept_name VARCHAR(100) NOT NULL UNIQUE,
  dept_code VARCHAR(10)  NOT NULL UNIQUE
);

-- TABLE 2: users
CREATE TABLE IF NOT EXISTS users (
  user_id     INT AUTO_INCREMENT PRIMARY KEY,
  full_name   VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  roll_number VARCHAR(30)  DEFAULT NULL,
  department  VARCHAR(100) DEFAULT NULL,
  phone       VARCHAR(15)  DEFAULT NULL,
  role        ENUM('student','admin') DEFAULT 'student',
  is_active   TINYINT(1)  DEFAULT 1,
  created_at  DATETIME    DEFAULT CURRENT_TIMESTAMP
);

-- TABLE 3: categories
CREATE TABLE IF NOT EXISTS categories (
  cat_id   INT AUTO_INCREMENT PRIMARY KEY,
  cat_name VARCHAR(100) NOT NULL UNIQUE,
  cat_icon VARCHAR(10)  DEFAULT '📋'
);

-- TABLE 4: complaints (main table)
CREATE TABLE IF NOT EXISTS complaints (
  complaint_id   INT AUTO_INCREMENT PRIMARY KEY,
  complaint_code VARCHAR(10)  NOT NULL UNIQUE,
  user_id        INT          NOT NULL,
  cat_id         INT          NOT NULL,
  title          VARCHAR(255) NOT NULL,
  description    TEXT         NOT NULL,
  priority       ENUM('Low','Medium','High') DEFAULT 'Medium',
  status         ENUM('Pending','In Progress','Resolved','Rejected') DEFAULT 'Pending',
  location       VARCHAR(255) DEFAULT NULL,
  image_path     VARCHAR(500) DEFAULT NULL,
  admin_note     TEXT         DEFAULT NULL,
  created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (cat_id)  REFERENCES categories(cat_id) ON DELETE RESTRICT
);

-- TABLE 5: complaint_updates (history log)
CREATE TABLE IF NOT EXISTS complaint_updates (
  update_id    INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT  NOT NULL,
  updated_by   INT  NOT NULL,
  old_status   VARCHAR(20),
  new_status   VARCHAR(20) NOT NULL,
  admin_note   TEXT        DEFAULT NULL,
  updated_at   DATETIME    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by)   REFERENCES users(user_id) ON DELETE CASCADE
);

-- TABLE 6: notifications
CREATE TABLE IF NOT EXISTS notifications (
  notif_id     INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT  NOT NULL,
  complaint_id INT  NOT NULL,
  message      TEXT NOT NULL,
  is_read      TINYINT(1) DEFAULT 0,
  created_at   DATETIME   DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)      REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE
);

-- INDEXES
CREATE INDEX idx_complaints_user     ON complaints(user_id);
CREATE INDEX idx_complaints_status   ON complaints(status);
CREATE INDEX idx_complaints_priority ON complaints(priority);
CREATE INDEX idx_notif_user          ON notifications(user_id, is_read);

-- ── SEED DATA ──

INSERT INTO departments (dept_name, dept_code) VALUES
('Computer Science',    'CS'),
('Information Technology', 'IT'),
('Electronics',         'EC'),
('Mechanical',          'ME'),
('Civil',               'CV'),
('MBA',                 'MBA');

INSERT INTO categories (cat_name, cat_icon) VALUES
('Hostel',      '🏠'),
('Classroom',   '🏫'),
('Electricity', '💡'),
('Water',       '💧'),
('Internet',    '🌐'),
('Cleanliness', '🧹');

-- Admin: password = admin123
INSERT INTO users (full_name, email, password, role) VALUES
('Administrator', 'admin@campusfix.edu',
 '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

-- Student: password = student123
INSERT INTO users (full_name, email, password, roll_number, department, role) VALUES
('Aditya Kale', 'student@campusfix.edu',
 '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
 'CS2021001', 'Computer Science', 'student');

-- NOTE: The above hashes use bcrypt cost=10 for 'password'
-- The server uses bcrypt.hash() properly, these are placeholder hashes
-- To get correct hashes, server auto-creates them on first run
-- So DELETE these user inserts and let server handle them, OR
-- use the setup script below which uses correct hashes:

-- CORRECT APPROACH: Delete placeholder users and run server once
-- Server will auto-seed correct admin + student on first start
DELETE FROM users;

-- Sample complaints (will be seeded by server on first run)
