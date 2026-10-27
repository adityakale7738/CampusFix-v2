// ------------------------------------------------------------------
// CampusFix email sender
//
// WHY THIS CHANGED:
//   Render blocks outbound SMTP (ports 25/465/587) on free web services,
//   so nodemailer + Gmail times out on Render but works on your laptop.
//   Fix: send through Brevo's HTTPS API (port 443, never blocked).
//
// Provider choice (automatic):
//   - APPS_SCRIPT_URL set -> Google Apps Script relay (free, use on Render)
//   - BREVO_API_KEY set  -> Brevo HTTPS API   (also fine on Render)
//   - else EMAIL_USER+PASS -> Gmail SMTP      (works locally only)
// ------------------------------------------------------------------
const nodemailer = require('nodemailer');

const EMOJIS = { Pending: '⏳', 'In Progress': '🔧', Resolved: '✅', Rejected: '❌' };
const COLORS = { Pending: '#f59e0b', 'In Progress': '#3b82f6', Resolved: '#10b981', Rejected: '#ef4444' };

// Escape user-supplied text so titles/notes can't inject HTML into the email
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function buildHtml({ studentName, complaintId, title, status, adminNote }) {
  const emoji = EMOJIS[status] || '📋';
  const color = COLORS[status] || '#1a73e8';
  const year = new Date().getFullYear();
  const appUrl = process.env.APP_URL; // optional: https://your-app.onrender.com
  const label = 'font-size:11px;color:#8a95a3;text-transform:uppercase;font-weight:700;letter-spacing:.08em';
  const loginText = appUrl
    ? `<a href="${esc(appUrl)}" style="color:#4f46e5;text-decoration:none;font-weight:600">Login to CampusFix</a> to view full details.`
    : 'Login to CampusFix to view full details.';

  return `
  <div style="max-width:560px;margin:24px auto;font-family:'Segoe UI',Roboto,Arial,sans-serif;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <div style="background:#312e81;background:linear-gradient(135deg,#1e1b4b 0%,#4f46e5 100%);padding:34px 24px;text-align:center">
      <div style="color:#ffffff;font-size:30px;font-weight:800;margin:0">🎓 CampusFix</div>
      <div style="color:#c7d2fe;font-size:15px;margin-top:8px">Campus Complaint Management System</div>
    </div>
    <div style="padding:32px 28px">
      <p style="color:#5f6b7a;font-size:16px;margin:0 0 18px">Hi <strong style="color:#1a1f36">${esc(studentName)}</strong>,</p>
      <p style="color:#1a1f36;font-size:20px;margin:0 0 22px">Your complaint status has been updated.</p>
      <div style="background:#f8faff;border:1px solid #e0e7ef;border-radius:14px;padding:22px">
        <div style="${label}">Complaint ID</div>
        <div style="color:#4f46e5;font-size:22px;font-weight:800;margin:4px 0 18px">${esc(complaintId)}</div>
        <div style="${label}">Title</div>
        <div style="color:#1a1f36;font-size:17px;margin:4px 0 18px">${esc(title)}</div>
        <div style="${label}">New Status</div>
        <div style="margin-top:8px">
          <span style="display:inline-block;background:${color}22;color:${color};padding:8px 18px;border-radius:24px;font-weight:700;font-size:16px">${emoji} ${esc(status)}</span>
        </div>
      </div>
      ${adminNote ? `
      <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:12px;padding:16px;margin-top:18px">
        <div style="font-size:11px;color:#b45309;font-weight:700;text-transform:uppercase;letter-spacing:.08em">Admin Note</div>
        <div style="color:#1a1f36;font-size:15px;margin-top:6px">${esc(adminNote)}</div>
      </div>` : ''}
      <p style="color:#5f6b7a;font-size:16px;margin:26px 0 0">${loginText}</p>
    </div>
    <div style="background:#f8faff;border-top:1px solid #e0e7ef;padding:18px;text-align:center">
      <div style="color:#8a95a3;font-size:12px">© ${year} CampusFix — Campus Complaint Management System</div>
    </div>
  </div>`;
}

// ---- Provider 0: Google Apps Script relay (100% free, HTTPS, works on Render) ----
async function sendViaAppsScript({ to, subject, html }) {
  const res = await fetch(process.env.APPS_SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow', // Apps Script answers with a redirect; the mail is already sent by then
    headers: { 'content-type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: process.env.APPS_SCRIPT_TOKEN, to, subject, html }),
  });
  const text = await res.text();
  if (!res.ok || text.trim() !== 'ok') throw new Error(`Apps Script replied: ${text.slice(0, 200)}`);
}

// ---- Provider 1: Brevo HTTPS API (works on Render free tier) ----
async function sendViaBrevo({ to, toName, subject, html }) {
  const senderEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  if (!senderEmail) throw new Error('Set EMAIL_FROM (a sender verified in Brevo).');

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'CampusFix', email: senderEmail },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---- Provider 2: Gmail SMTP (local development only) ----
async function sendViaGmail({ to, subject, html }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: String(process.env.EMAIL_PASS).replace(/\s+/g, ''), // app password: strip spaces
    },
    connectionTimeout: 10000, // fail fast instead of hanging when SMTP is blocked
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return transporter.sendMail({ from: `"CampusFix" <${process.env.EMAIL_USER}>`, to, subject, html });
}

async function sendStatusUpdateEmail({ to, studentName, complaintId, title, status, adminNote }) {
  const subject = `${EMOJIS[status] || '📋'} Complaint ${complaintId} — ${status}`;
  const html = buildHtml({ studentName, complaintId, title, status, adminNote });

  try {
    if (process.env.APPS_SCRIPT_URL) {
      await sendViaAppsScript({ to, subject, html });
      console.log(`📧 Email sent via Google Apps Script to ${to}`);
    } else if (process.env.BREVO_API_KEY) {
      await sendViaBrevo({ to, toName: studentName, subject, html });
      console.log(`📧 Email sent via Brevo to ${to}`);
    } else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await sendViaGmail({ to, subject, html });
      console.log(`📧 Email sent via Gmail SMTP to ${to}`);
    } else {
      console.log('📧 Email not configured (no BREVO_API_KEY / EMAIL_USER) — skipping');
    }
  } catch (err) {
    // Never crash the request because of email; but DO log the real reason
    console.error('📧 Email FAILED:', err.message);
  }
}

module.exports = { sendStatusUpdateEmail };