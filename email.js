const nodemailer = require('nodemailer');

async function sendStatusUpdateEmail({ to, studentName, complaintId, title, status, adminNote }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('📧 Email not configured — skipping'); return;
  }
  const emojis = { Pending:'⏳', 'In Progress':'🔧', Resolved:'✅', Rejected:'❌' };
  const colors = { Pending:'#f59e0b', 'In Progress':'#3b82f6', Resolved:'#10b981', Rejected:'#ef4444' };
  const emoji  = emojis[status] || '📋';
  const color  = colors[status] || '#1a73e8';
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    await transporter.sendMail({
      from: `"CampusFix" <${process.env.EMAIL_USER}>`,
      to,
      subject: `${emoji} Complaint ${complaintId} — Status: ${status}`,
      html: `
      <div style="max-width:560px;margin:40px auto;font-family:'Segoe UI',sans-serif;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <div style="background:#1a73e8;padding:28px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800">🎓 CampusFix</h1>
          <p style="color:rgba(255,255,255,.7);margin:6px 0 0;font-size:13px">Campus Complaint Management</p>
        </div>
        <div style="padding:28px">
          <p style="color:#5f6b7a;font-size:14px">Hi <strong style="color:#1a1f36">${studentName}</strong>,</p>
          <p style="color:#1a1f36;font-size:15px">Your complaint status has been updated.</p>
          <div style="background:#f8faff;border-radius:10px;padding:18px;margin:18px 0;border:1px solid #e0e7ef">
            <p style="margin:0 0 10px"><span style="font-size:10px;color:#8a95a3;text-transform:uppercase;font-weight:700;letter-spacing:.06em">Complaint ID</span><br><strong style="color:#1a73e8;font-size:15px">${complaintId}</strong></p>
            <p style="margin:0 0 10px"><span style="font-size:10px;color:#8a95a3;text-transform:uppercase;font-weight:700;letter-spacing:.06em">Title</span><br><span style="color:#1a1f36">${title}</span></p>
            <p style="margin:0"><span style="font-size:10px;color:#8a95a3;text-transform:uppercase;font-weight:700;letter-spacing:.06em">New Status</span><br><span style="background:${color}22;color:${color};padding:4px 14px;border-radius:20px;font-weight:700;font-size:13px;display:inline-block;margin-top:5px">${emoji} ${status}</span></p>
          </div>
          ${adminNote ? `<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:10px;padding:14px"><p style="margin:0;font-size:10px;color:#b45309;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Admin Note</p><p style="margin:6px 0 0;color:#1a1f36;font-size:14px">${adminNote}</p></div>` : ''}
        </div>
        <div style="background:#f8faff;padding:16px;text-align:center;border-top:1px solid #e0e7ef">
          <p style="color:#8a95a3;font-size:11px;margin:0">© 2024 CampusFix — Campus Complaint Management System</p>
        </div>
      </div>`
    });
    console.log(`📧 Email sent to ${to}`);
  } catch(err) { console.error('📧 Email error:', err.message); }
}

module.exports = { sendStatusUpdateEmail };
