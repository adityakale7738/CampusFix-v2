// ═══ CAMPUSFIX v2.0 — STUDENT DASHBOARD JS ═══
const ICONS = { Hostel:'🏠', Classroom:'🏫', Electricity:'💡', Water:'💧', Internet:'🌐', Cleanliness:'🧹' };
let allComplaints = [];
let notifOpen = false;

// ── INIT ──
window.addEventListener('DOMContentLoaded', async () => {
  const s = await api('/api/auth/session');
  if (!s.loggedIn || s.role !== 'student') { window.location.href = '/'; return; }
  const first = s.name.split(' ')[0];
  document.getElementById('sb-name').textContent    = s.name;
  document.getElementById('welcome-name').textContent = `Good day, ${first}! 👋`;
  document.getElementById('user-av').textContent    = s.name.charAt(0).toUpperCase();
  loadOverview();
});

// ── NAVIGATION ──
function switchView(view, el) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  if (el) el.classList.add('active');
  const titles = { overview:'Overview', submit:'New Complaint', mycomplaints:'My Complaints', profile:'My Profile' };
  document.getElementById('page-title').textContent = titles[view] || view;
  if (view === 'mycomplaints') loadAll();
  if (view === 'overview')     loadOverview();
  if (view === 'profile')      loadProfile();
  closeSidebar();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function closeSidebar()   { document.getElementById('sidebar').classList.remove('open'); }

// Close sidebar + notif on outside click
document.addEventListener('click', e => {
  const sb = document.getElementById('sidebar');
  const hb = document.querySelector('.hamburger');
  if (sb.classList.contains('open') && !sb.contains(e.target) && e.target !== hb) closeSidebar();

  const dd  = document.getElementById('notif-dd');
  const btn = document.getElementById('notif-btn');
  if (notifOpen && !dd.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
    dd.classList.add('hidden'); notifOpen = false;
  }
});

// ── TOPBAR SEARCH → goes to My Complaints and filters ──
function topbarSearch(val) {
  if (!val.trim()) return;
  switchView('mycomplaints', document.querySelector('[data-view=mycomplaints]'));
  setTimeout(() => {
    const el = document.getElementById('f-q');
    if (el) { el.value = val; filterList(); }
  }, 80);
}

// ── OVERVIEW ──
async function loadOverview() {
  try {
    const list = await api('/api/complaints/my');
    allComplaints = Array.isArray(list) ? list : [];
    const s = { total:0, pending:0, inProgress:0, resolved:0 };
    allComplaints.forEach(c => {
      s.total++;
      if (c.status === 'Pending')     s.pending++;
      else if (c.status === 'In Progress') s.inProgress++;
      else if (c.status === 'Resolved')    s.resolved++;
    });
    document.getElementById('st-total').textContent    = s.total;
    document.getElementById('st-pending').textContent  = s.pending;
    document.getElementById('st-progress').textContent = s.inProgress;
    document.getElementById('st-resolved').textContent = s.resolved;
    document.getElementById('welcome-sub').textContent  = `${s.pending} pending · ${s.inProgress} in progress · ${s.resolved} resolved`;

    const badge = document.getElementById('pending-badge');
    if (s.pending > 0) { badge.textContent = s.pending; badge.style.display = ''; }
    else badge.style.display = 'none';

    // Notif dot
    if (s.pending > 0) document.getElementById('notif-dot').style.display = '';
    else document.getElementById('notif-dot').style.display = 'none';

    renderList(allComplaints.slice(0, 5), 'recent-list', 'No complaints yet. Submit your first one!');
  } catch(e) { console.error(e); }
}

// ── ALL COMPLAINTS ──
async function loadAll() {
  try {
    const list = await api('/api/complaints/my');
    allComplaints = Array.isArray(list) ? list : [];
    renderList(allComplaints, 'all-list', 'No complaints found.');
  } catch(e) {}
}

function filterList() {
  const q   = (document.getElementById('f-q').value || '').toLowerCase();
  const st  = document.getElementById('f-status').value;
  const pri = document.getElementById('f-pri').value;
  let f = allComplaints;
  if (st)  f = f.filter(c => c.status === st);
  if (pri) f = f.filter(c => c.priority === pri);
  if (q)   f = f.filter(c => c.title.toLowerCase().includes(q) || (c.complaint_id||'').toLowerCase().includes(q));
  renderList(f, 'all-list', 'No matching complaints.');
}

// ── RENDER LIST ──
function renderList(list, id, emptyMsg) {
  const el = document.getElementById(id);
  if (!list || !list.length) {
    el.innerHTML = `<div class="empty"><div class="ei">📭</div><p>${emptyMsg}</p><span>Complaints appear here once submitted</span></div>`;
    return;
  }
  el.innerHTML = list.map(c => {
    const cid = c.complaint_id || c.complaint_code || '';
    return `<div class="cmp-card" onclick="openModal('${cid}')">
      <div class="cmp-cat-ico">${ICONS[c.category]||'📋'}</div>
      <div class="cmp-body">
        <div class="cmp-top">
          <span class="cmp-title">${esc(c.title)}</span>
          <span class="cmp-id">${cid}</span>
        </div>
        <div class="cmp-desc">${esc(c.description)}</div>
        <div class="cmp-tags">
          <span class="tag-cat">${c.category}</span>
          <span class="sb ${(c.status||'').replace(' ','-')}">${c.status}</span>
          <span class="pb ${c.priority||'Medium'}">${priE(c.priority)} ${c.priority||'Medium'}</span>
          ${c.location ? `<span class="tag-loc">📍 ${esc(c.location)}</span>` : ''}
          <span class="tag-date">${fmt(c.created_at)}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── DETAIL MODAL ──
async function openModal(id) {
  if (!id) return;
  try {
    const c = await api(`/api/complaints/my/${id}`);
    if (c.error) return;
    const cid = c.complaint_id || c.complaint_code || id;
    document.getElementById('m-title').textContent = c.title;
    document.getElementById('m-id').textContent    = cid;
    document.getElementById('m-cat').textContent   = `${ICONS[c.category]||''} ${c.category}`;
    document.getElementById('m-status').innerHTML  = `<span class="sb ${(c.status||'').replace(' ','-')}">${c.status}</span>`;
    document.getElementById('m-pri').innerHTML     = `<span class="pb ${c.priority||'Medium'}">${priE(c.priority)} ${c.priority||'Medium'}</span>`;
    document.getElementById('m-date').textContent  = fmt(c.created_at);
    document.getElementById('m-desc').textContent  = c.description;

    const locRow = document.getElementById('m-loc-row');
    if (c.location) { locRow.classList.remove('hidden'); document.getElementById('m-loc').textContent = c.location; }
    else locRow.classList.add('hidden');

    const noteRow = document.getElementById('m-note-row');
    if (c.admin_note) { noteRow.classList.remove('hidden'); document.getElementById('m-note').textContent = c.admin_note; }
    else noteRow.classList.add('hidden');

    const imgRow = document.getElementById('m-img-row');
    if (c.image_path) { imgRow.classList.remove('hidden'); document.getElementById('m-img').src = c.image_path; }
    else imgRow.classList.add('hidden');

    document.getElementById('det-modal').classList.remove('hidden');
  } catch(e) { console.error(e); }
}
function closeModal() { document.getElementById('det-modal').classList.add('hidden'); }
document.getElementById('det-modal').addEventListener('click', e => { if (e.target.id === 'det-modal') closeModal(); });

// ── NOTIFICATIONS DROPDOWN ──
function toggleNotif() {
  const dd = document.getElementById('notif-dd');
  if (notifOpen) { dd.classList.add('hidden'); notifOpen = false; }
  else { showNotif(); notifOpen = true; }
}

async function showNotif() {
  const dd = document.getElementById('notif-dd');
  dd.classList.remove('hidden');
  dd.innerHTML = `<div class="notif-hdr-row">Notifications</div><div class="notif-empty">Loading...</div>`;
  try {
    const list = await api('/api/complaints/my');
    const recent = (Array.isArray(list) ? list : []).slice(0, 6);
    if (!recent.length) {
      dd.innerHTML = `<div class="notif-hdr-row">Notifications</div><div class="notif-empty">No notifications yet</div>`;
      return;
    }
    const items = recent.map(c => {
      const cid = c.complaint_id || c.complaint_code || '';
      return `<div class="notif-item" onclick="openModal('${cid}');document.getElementById('notif-dd').classList.add('hidden');notifOpen=false">
        <div class="notif-code">${cid}</div>
        <div class="notif-msg">${esc(c.title.substring(0,40))}${c.title.length>40?'...':''}</div>
        <div class="notif-status"><span class="sb ${(c.status||'').replace(' ','-')}" style="font-size:10px">${c.status}</span></div>
      </div>`;
    }).join('');
    dd.innerHTML = `<div class="notif-hdr-row">Recent Complaints <span onclick="switchView('mycomplaints',document.querySelector('[data-view=mycomplaints]'));document.getElementById('notif-dd').classList.add('hidden');notifOpen=false">View all</span></div>${items}`;
  } catch(e) {
    dd.innerHTML = `<div class="notif-hdr-row">Notifications</div><div class="notif-empty">Failed to load</div>`;
  }
}

// ── SUBMIT COMPLAINT ──
function selCat(btn) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  document.getElementById('sel-cat').value = btn.dataset.cat;
}
function selPri(btn) {
  const p = btn.dataset.pri;
  document.querySelectorAll('.pri-btn').forEach(b => { b.className = 'pri-btn'; });
  btn.classList.add(`sel-${p}`);
  document.getElementById('sel-pri').value = p;
}
document.getElementById('c-desc').addEventListener('input', function() {
  document.getElementById('char-cnt').textContent = `${this.value.length} / 500`;
});
function previewImg(input) {
  if (!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('pv-img').src = e.target.result;
    document.getElementById('up-ph').classList.add('hidden');
    document.getElementById('up-pv').classList.remove('hidden');
  };
  reader.readAsDataURL(input.files[0]);
}
function clearImg(e) {
  e.stopPropagation();
  document.getElementById('file-in').value = '';
  document.getElementById('up-ph').classList.remove('hidden');
  document.getElementById('up-pv').classList.add('hidden');
}

async function submitComplaint() {
  const title    = document.getElementById('c-title').value.trim();
  const category = document.getElementById('sel-cat').value;
  const priority = document.getElementById('sel-pri').value || 'Medium';
  const desc     = document.getElementById('c-desc').value.trim();
  const location = document.getElementById('c-loc').value.trim();
  const errEl    = document.getElementById('sub-err');
  const okEl     = document.getElementById('sub-ok');
  errEl.className = 'cf-alert hidden';
  okEl.className  = 'cf-alert hidden';

  if (!category) { errEl.textContent='Please select a category.'; errEl.className='cf-alert cf-alert-err'; return; }
  if (!title)    { errEl.textContent='Please enter a title.';      errEl.className='cf-alert cf-alert-err'; return; }
  if (!desc)     { errEl.textContent='Please describe the issue.'; errEl.className='cf-alert cf-alert-err'; return; }

  const btn = document.querySelector('.btn-submit');
  btn.disabled = true;
  btn.innerHTML = '<span>Submitting...</span>';

  const fd = new FormData();
  fd.append('title', title);
  fd.append('category', category);
  fd.append('priority', priority);
  fd.append('description', desc);
  if (location) fd.append('location', location);
  const fi = document.getElementById('file-in');
  if (fi.files[0]) fd.append('image', fi.files[0]);

  try {
    const res  = await fetch('/api/complaints/submit', { method:'POST', body:fd });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error;
      errEl.className = 'cf-alert cf-alert-err';
    } else {
      okEl.textContent = `✅ Submitted! Your complaint ID: ${data.complaintId}`;
      okEl.className = 'cf-alert cf-alert-ok';
      // Reset form
      document.getElementById('c-title').value = '';
      document.getElementById('c-desc').value  = '';
      document.getElementById('c-loc').value   = '';
      document.getElementById('sel-cat').value = '';
      document.getElementById('sel-pri').value = 'Medium';
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('sel'));
      document.querySelectorAll('.pri-btn').forEach(b => { b.className='pri-btn'; });
      document.querySelector('.pri-btn[data-pri=Medium]').classList.add('sel-Medium');
      document.getElementById('char-cnt').textContent = '0 / 500';
      clearImg({ stopPropagation:()=>{} });
      setTimeout(() => switchView('mycomplaints', document.querySelector('[data-view=mycomplaints]')), 1800);
    }
  } catch(e) {
    errEl.textContent = 'Network error.';
    errEl.className = 'cf-alert cf-alert-err';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Submit Complaint';
  }
}

// ── PROFILE ──
async function loadProfile() {
  try {
    const u = await api('/api/auth/profile');
    document.getElementById('profile-content').innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
        <div style="width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg,#1a73e8,#4fc3f7);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:800">${(u.name||'?').charAt(0)}</div>
        <div><div style="font-size:17px;font-weight:800;color:#1a1f36">${esc(u.name)}</div><div style="font-size:11px;color:#8a95a3;text-transform:capitalize">${u.role}</div></div>
      </div>
      <div class="d-grid">
        <div class="d-item"><label>Email</label><span>${esc(u.email)}</span></div>
        <div class="d-item"><label>Roll Number</label><span>${u.roll_number||'—'}</span></div>
        <div class="d-item"><label>Department</label><span>${u.department||'—'}</span></div>
        <div class="d-item"><label>Phone</label><span>${u.phone||'—'}</span></div>
        <div class="d-item"><label>Member Since</label><span>${fmt(u.created_at)}</span></div>
      </div>`;
  } catch(e) {}
}

// ── LOGOUT ──
async function handleLogout() {
  await fetch('/api/auth/logout', { method:'POST' });
  window.location.href = '/';
}

// ── HELPERS ──
async function api(url, opts={}) {
  const res = await fetch(url, opts);
  return res.json();
}
function fmt(d)  { return d ? new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—'; }
function esc(s)  { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function priE(p) { return p==='High'?'🔴':p==='Low'?'🟢':'🟡'; }
function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast${type?' '+type:''}`;
  setTimeout(() => t.className = 'toast hidden', 3500);
}
