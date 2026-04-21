// ===== CAMPUSFIX — STUDENT DASHBOARD JS =====
const ICONS = {Hostel:'🏠',Classroom:'🏫',Electricity:'💡',Water:'💧',Internet:'🌐',Cleanliness:'🧹'};
let allComplaints = [];

// Init
window.addEventListener('DOMContentLoaded', async () => {
  const s = await fetch('/api/auth/session').then(r=>r.json());
  if (!s.loggedIn || s.role !== 'student') { window.location.href='/'; return; }
  document.getElementById('sidebar-name').textContent = s.name;
  document.getElementById('welcome-name').textContent = `Good day, ${s.name.split(' ')[0]}! 👋`;
  document.getElementById('user-av').textContent = s.name.charAt(0).toUpperCase();
  loadOverview();
  loadNotifications();
});

function switchView(view, el) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
  if (el) el.classList.add('active');
  const titles={overview:'Overview',submit:'New Complaint',mycomplaints:'My Complaints',profile:'My Profile'};
  document.getElementById('page-title').textContent = titles[view]||view;
  if (view==='mycomplaints') loadAllComplaints();
  if (view==='overview') loadOverview();
  if (view==='profile') loadProfile();
  return false;
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// Close sidebar when clicking outside
document.addEventListener('click', e => {
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.querySelector('.hamburger');
  if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== hamburger) {
    sidebar.classList.remove('open');
  }
});

// ── OVERVIEW ──
async function loadOverview() {
  try {
    const complaints = await fetch('/api/complaints/my').then(r=>r.json());
    allComplaints = complaints;
    const s = {total:0,pending:0,inProgress:0,resolved:0};
    complaints.forEach(c => {
      s.total++;
      if (c.status==='Pending') s.pending++;
      else if (c.status==='In Progress') s.inProgress++;
      else if (c.status==='Resolved') s.resolved++;
    });
    document.getElementById('stat-total').textContent = s.total;
    document.getElementById('stat-pending').textContent = s.pending;
    document.getElementById('stat-progress').textContent = s.inProgress;
    document.getElementById('stat-resolved').textContent = s.resolved;
    document.getElementById('welcome-sub').textContent = `${s.pending} pending · ${s.inProgress} in progress · ${s.resolved} resolved`;
    const badge = document.getElementById('pending-badge');
    badge.style.display = s.pending > 0 ? '' : 'none';
    if (s.pending > 0) badge.textContent = s.pending;
    renderComplaints(complaints.slice(0,5), 'recent-list', 'No complaints yet. Submit your first one!');
  } catch(e) { console.error(e); }
}

// ── ALL COMPLAINTS ──
async function loadAllComplaints() {
  try {
    const list = await fetch('/api/complaints/my').then(r=>r.json());
    allComplaints = list;
    renderComplaints(list, 'all-list', 'No complaints found.');
  } catch(e) {}
}

function filterComplaints() {
  const search = document.getElementById('f-search').value.toLowerCase();
  const status = document.getElementById('f-status').value;
  const priority = document.getElementById('f-priority').value;
  let f = allComplaints;
  if (status) f = f.filter(c=>c.status===status);
  if (priority) f = f.filter(c=>c.priority===priority);
  if (search) f = f.filter(c=>c.title.toLowerCase().includes(search)||c.complaint_id.toLowerCase().includes(search));
  renderComplaints(f, 'all-list', 'No matching complaints.');
}

// ── TOPBAR SEARCH (searches across complaint titles) ──
function handleTopbarSearch(val) {
  if (!val.trim()) return;
  switchView('mycomplaints', document.querySelector('[data-view=mycomplaints]'));
  setTimeout(() => {
    const el = document.getElementById('f-search');
    if (el) { el.value = val; filterComplaints(); }
  }, 100);
}

// ── RENDER COMPLAINTS ──
function renderComplaints(list, containerId, emptyMsg) {
  const el = document.getElementById(containerId);
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="ei">📭</div><p>${emptyMsg}</p><span>Your complaints appear here</span></div>`;
    return;
  }
  el.innerHTML = list.map(c => `
    <div class="cmp-card" onclick="openModal('${c.complaint_id}')">
      <div class="cmp-cat-icon">${ICONS[c.category]||'📋'}</div>
      <div class="cmp-body">
        <div class="cmp-top">
          <span class="cmp-title">${esc(c.title)}</span>
          <span class="cmp-id">${c.complaint_id}</span>
        </div>
        <div class="cmp-desc">${esc(c.description)}</div>
        <div class="cmp-tags">
          <span class="tag-cat">${c.category}</span>
          <span class="sbadge s-${c.status.replace(' ','-')}">${c.status}</span>
          <span class="pbadge p-${c.priority||'Medium'}">${priEmoji(c.priority)} ${c.priority||'Medium'}</span>
          ${c.location ? `<span class="tag-loc">📍 ${esc(c.location)}</span>` : ''}
          <span class="tag-date">${fmt(c.created_at)}</span>
        </div>
      </div>
    </div>`).join('');
}

// ── MODAL ──
async function openModal(id) {
  try {
    const c = await fetch(`/api/complaints/my/${id}`).then(r=>r.json());
    if (c.error) return;
    document.getElementById('m-title').textContent = c.title;
    document.getElementById('m-id').textContent = c.complaint_id;
    document.getElementById('m-cat').textContent = `${ICONS[c.category]||''} ${c.category}`;
    document.getElementById('m-status').innerHTML = `<span class="sbadge s-${c.status.replace(' ','-')}">${c.status}</span>`;
    document.getElementById('m-priority').innerHTML = `<span class="pbadge p-${c.priority||'Medium'}">${priEmoji(c.priority)} ${c.priority||'Medium'}</span>`;
    document.getElementById('m-date').textContent = fmt(c.created_at);
    document.getElementById('m-desc').textContent = c.description;
    const locRow = document.getElementById('m-loc-row');
    if (c.location) { locRow.classList.remove('hidden'); document.getElementById('m-loc').textContent = c.location; }
    else locRow.classList.add('hidden');
    const noteRow = document.getElementById('m-note-row');
    if (c.admin_note) { noteRow.classList.remove('hidden'); document.getElementById('m-note').textContent = c.admin_note; }
    else noteRow.classList.add('hidden');
    const imgRow = document.getElementById('m-img-row');
    if (c.image_path) { imgRow.classList.remove('hidden'); document.getElementById('m-img').src = c.image_path; }
    else imgRow.classList.add('hidden');
    document.getElementById('detail-modal').classList.remove('hidden');
  } catch(e) {}
}
function closeModal() { document.getElementById('detail-modal').classList.add('hidden'); }
document.getElementById('detail-modal').addEventListener('click', e => { if(e.target.id==='detail-modal') closeModal(); });

// ── NOTIFICATIONS ──
async function loadNotifications() {
  try {
    // Try /api/complaints/mystats for unread count indicator
    const stats = await fetch('/api/complaints/mystats').then(r=>r.json());
    const dot = document.getElementById('notif-dot');
    if (stats && stats.pending > 0) dot.style.display = '';
    else dot.style.display = 'none';
  } catch(e) {}
}

function toggleNotifications() {
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown.classList.contains('hidden')) {
    showNotifications();
  } else {
    dropdown.classList.add('hidden');
  }
}

async function showNotifications() {
  const dropdown = document.getElementById('notif-dropdown');
  dropdown.classList.remove('hidden');
  dropdown.innerHTML = `<div class="notif-hdr">Notifications</div><div class="notif-empty">Loading...</div>`;
  try {
    const complaints = await fetch('/api/complaints/my').then(r=>r.json());
    const recent = complaints.slice(0,5);
    if (!recent.length) {
      dropdown.innerHTML = `<div class="notif-hdr">Notifications</div><div class="notif-empty">No notifications yet</div>`;
      return;
    }
    const items = recent.map(c => `
      <div class="notif-item" onclick="openModal('${c.complaint_id}');document.getElementById('notif-dropdown').classList.add('hidden')">
        <div class="notif-code">${c.complaint_id}</div>
        <div>${esc(c.title.substring(0,40))}${c.title.length>40?'...':''}</div>
        <div style="margin-top:2px"><span class="sbadge s-${c.status.replace(' ','-')}" style="font-size:10px">${c.status}</span></div>
      </div>`).join('');
    dropdown.innerHTML = `<div class="notif-hdr">Recent Complaints</div>${items}`;
  } catch(e) {
    dropdown.innerHTML = `<div class="notif-hdr">Notifications</div><div class="notif-empty">Failed to load</div>`;
  }
}

// Close notification dropdown when clicking outside
document.addEventListener('click', e => {
  const dropdown = document.getElementById('notif-dropdown');
  const btn = document.getElementById('notif-btn');
  if (dropdown && !dropdown.classList.contains('hidden') && !dropdown.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
    dropdown.classList.add('hidden');
  }
});

// ── SUBMIT ──
function selectCat(btn) {
  document.querySelectorAll('.cat-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('sel-cat').value = btn.dataset.cat;
}
function selectPri(btn) {
  document.querySelectorAll('.pri-btn').forEach(b=>{ b.className='pri-btn'; });
  const p = btn.dataset.pri;
  btn.classList.add(`pri-sel-${p}`, 'selected');
  document.getElementById('sel-pri').value = p;
}
document.getElementById('c-desc').addEventListener('input', function() {
  document.getElementById('char-count').textContent = `${this.value.length} / 500`;
});
function previewImg(input) {
  if (!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('preview-img').src = e.target.result;
    document.getElementById('upload-placeholder').classList.add('hidden');
    document.getElementById('upload-preview').classList.remove('hidden');
  };
  reader.readAsDataURL(input.files[0]);
}
function clearImg(e) {
  e.stopPropagation();
  document.getElementById('file-input').value='';
  document.getElementById('upload-placeholder').classList.remove('hidden');
  document.getElementById('upload-preview').classList.add('hidden');
}

async function submitComplaint() {
  const title = document.getElementById('c-title').value.trim();
  const category = document.getElementById('sel-cat').value;
  const priority = document.getElementById('sel-pri').value||'Medium';
  const description = document.getElementById('c-desc').value.trim();
  const location = document.getElementById('c-loc').value.trim();
  const errEl = document.getElementById('submit-err');
  const okEl = document.getElementById('submit-ok');
  errEl.className='cf-alert hidden'; okEl.className='cf-alert hidden';
  if (!category) { errEl.textContent='Please select a category.'; errEl.className='cf-alert cf-alert-error'; return; }
  if (!title)    { errEl.textContent='Please enter a complaint title.'; errEl.className='cf-alert cf-alert-error'; return; }
  if (!description) { errEl.textContent='Please describe the issue.'; errEl.className='cf-alert cf-alert-error'; return; }
  const btn = document.querySelector('.btn-submit');
  btn.disabled=true; btn.innerHTML='<span>Submitting...</span>';
  const fd = new FormData();
  fd.append('title',title); fd.append('category',category);
  fd.append('priority',priority); fd.append('description',description);
  if (location) fd.append('location',location);
  const fi = document.getElementById('file-input');
  if (fi.files[0]) fd.append('image',fi.files[0]);
  try {
    const res = await fetch('/api/complaints/submit',{method:'POST',body:fd});
    const data = await res.json();
    if (!res.ok) { errEl.textContent=data.error; errEl.className='cf-alert cf-alert-error'; }
    else {
      okEl.textContent=`✅ Submitted! Your ID: ${data.complaintId}`;
      okEl.className='cf-alert cf-alert-success';
      document.getElementById('c-title').value='';
      document.getElementById('c-desc').value='';
      document.getElementById('c-loc').value='';
      document.getElementById('sel-cat').value='';
      document.querySelectorAll('.cat-btn').forEach(b=>b.classList.remove('selected'));
      document.querySelectorAll('.pri-btn').forEach(b=>{b.className='pri-btn'});
      document.getElementById('sel-pri').value='Medium';
      document.querySelector('.pri-btn[data-pri=Medium]').classList.add('pri-sel-Medium','selected');
      clearImg({stopPropagation:()=>{}});
      document.getElementById('char-count').textContent='0 / 500';
      setTimeout(()=>switchView('mycomplaints',document.querySelector('[data-view=mycomplaints]')),1800);
    }
  } catch(e){ errEl.textContent='Network error.'; errEl.className='cf-alert cf-alert-error'; }
  finally { btn.disabled=false; btn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Submit Complaint'; }
}

// ── PROFILE ──
async function loadProfile() {
  try {
    const user = await fetch('/api/auth/profile').then(r=>r.json());
    document.getElementById('profile-content').innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
        <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#1a73e8,#4fc3f7);display:flex;align-items:center;justify-content:center;color:white;font-size:24px;font-weight:800">${(user.name||'?').charAt(0)}</div>
        <div><div style="font-size:18px;font-weight:800;color:#1a1f36">${esc(user.name)}</div><div style="font-size:12px;color:#8a95a3">${user.role}</div></div>
      </div>
      <div class="detail-grid">
        <div class="detail-item"><label>Email</label><span>${esc(user.email)}</span></div>
        <div class="detail-item"><label>Roll Number</label><span>${user.roll_number||'—'}</span></div>
        <div class="detail-item"><label>Department</label><span>${user.department||'—'}</span></div>
        <div class="detail-item"><label>Phone</label><span>${user.phone||'—'}</span></div>
        <div class="detail-item"><label>Member Since</label><span>${fmt(user.created_at)}</span></div>
      </div>`;
  } catch(e) {}
}

async function handleLogout() {
  await fetch('/api/auth/logout',{method:'POST'});
  window.location.href='/';
}

// ── UTILS ──
function fmt(d) { return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function priEmoji(p) { return p==='High'?'🔴':p==='Low'?'🟢':'🟡'; }
function showToast(msg,type='default') {
  const t=document.getElementById('toast');
  t.textContent=msg; t.className=`toast toast-${type}`;
  setTimeout(()=>t.className='toast hidden',3000);
}
