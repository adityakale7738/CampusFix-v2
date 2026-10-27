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
  return `
  <div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:auto;border:1px solid #e0e7ef;border-radius:12px;overflow:hidden">
    <div style="background:#1a73e8;padding:20px;text-align:center">
      <h2 style="color:#fff;margin:0">🎓 CampusFix</h2>
    </div>
    <div style="padding:24px">
      <p>Hi <b>${esc(studentName)}</b>,</p>
      <p>Your complaint <b>${esc(complaintId)}</b> — <i>${esc(title)}</i> — has been updated to
        <span style="background:${color}22;color:${color};padding:3px 12px;border-radius:20px;font-weight:700">${emoji} ${esc(status)}</span>
      </p>
      ${adminNote ? `<p style="background:#fff8e1;padding:12px;border-radius:8px"><b>Admin note:</b> ${esc(adminNote)}</p>` : ''}
      <p style="color:#8a95a3;font-size:12px">— CampusFix Team</p>
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