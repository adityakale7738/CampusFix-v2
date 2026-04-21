// ═══ CAMPUSFIX v2.0 — ADMIN PANEL JS ═══
const ICONS = { Hostel:'🏠', Classroom:'🏫', Electricity:'💡', Water:'💧', Internet:'🌐', Cleanliness:'🧹' };
let currentId = null;

// ── INIT ──
window.addEventListener('DOMContentLoaded', async () => {
  const s = await api('/api/auth/session');
  if (!s.loggedIn || s.role !== 'admin') { window.location.href = '/'; return; }
  loadAdminDashboard();
});

// ── NAVIGATION ──
function switchAdminView(view, el) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('admin-view-' + view).classList.add('active');
  if (el) el.classList.add('active');
  const titles = { dashboard:'Admin Dashboard', complaints:'All Complaints' };
  document.getElementById('admin-title').textContent = titles[view] || view;
  if (view === 'complaints') loadAdminComplaints();
  closeSidebar();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function closeSidebar()   { document.getElementById('sidebar').classList.remove('open'); }

document.addEventListener('click', e => {
  const sb = document.getElementById('sidebar');
  const hb = document.querySelector('.hamburger');
  if (sb.classList.contains('open') && !sb.contains(e.target) && e.target !== hb) closeSidebar();
});

// ── TOPBAR SEARCH → complaints view with filter ──
function adminTopbarSearch(val) {
  if (!val.trim()) return;
  switchAdminView('complaints', document.querySelector('[data-view=complaints]'));
  setTimeout(() => {
    const el = document.getElementById('a-q');
    if (el) { el.value = val; loadAdminComplaints(); }
  }, 80);
}

// ── ADMIN DASHBOARD ──
async function loadAdminDashboard() {
  try {
    const [stats, complaints] = await Promise.all([
      api('/api/complaints/stats'),
      api('/api/complaints/all')
    ]);

    document.getElementById('a-total').textContent    = stats.total    || 0;
    document.getElementById('a-pending').textContent  = stats.pending  || 0;
    document.getElementById('a-progress').textContent = stats.inProgress || 0;
    document.getElementById('a-resolved').textContent = stats.resolved  || 0;

    const badge = document.getElementById('a-badge');
    if (stats.pending > 0) { badge.textContent = stats.pending; badge.style.display = ''; }
    else badge.style.display = 'none';

    // Category bar chart
    const cats = stats.byCategory || [];
    const total = stats.total || 1;
    document.getElementById('cat-chart').innerHTML = cats.length
      ? cats.map(d => `
          <div class="bar-row">
            <div class="bar-lbl">${ICONS[d.category]||''} ${d.category}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${((d.count/total)*100).toFixed(1)}%"></div></div>
            <div class="bar-val">${d.count}</div>
          </div>`).join('')
      : '<p style="color:#8a95a3;font-size:13px;text-align:center;padding:12px">No data yet</p>';

    // Priority circles
    const pris = stats.byPriority || [];
    const findP = p => (pris.find(x => x.priority === p)||{count:0}).count;
    document.getElementById('hi-cnt').textContent  = findP('High');
    document.getElementById('med-cnt').textContent = findP('Medium');
    document.getElementById('lo-cnt').textContent  = findP('Low');

    // Recent list (first 8)
    renderAdminList(Array.isArray(complaints) ? complaints.slice(0,8) : [], 'admin-recent');
  } catch(e) { console.error(e); }
}

// ── ALL COMPLAINTS WITH FILTERS ──
async function loadAdminComplaints() {
  const q      = (document.getElementById('a-q')?.value || '').trim();
  const status = document.getElementById('a-status')?.value || '';
  const pri    = document.getElementById('a-pri')?.value    || '';
  const cat    = document.getElementById('a-cat')?.value    || '';

  const params = new URLSearchParams();
  if (q)      params.append('search',   q);
  if (status) params.append('status',   status);
  if (pri)    params.append('priority', pri);
  if (cat)    params.append('category', cat);

  try {
    const list = await api('/api/complaints/all?' + params);
    renderAdminList(Array.isArray(list) ? list : [], 'admin-list');
  } catch(e) { console.error(e); }
}

// ── RENDER ADMIN COMPLAINT LIST ──
function renderAdminList(list, containerId) {
  const el = document.getElementById(containerId);
  if (!list.length) {
    el.innerHTML = '<div class="empty"><div class="ei">📭</div><p>No complaints found</p><span>Try adjusting filters</span></div>';
    return;
  }
  el.innerHTML = list.map(c => {
    const cid = c.complaint_id || c.complaint_code || '';
    return `<div class="cmp-card" onclick='openAdminModal(${JSON.stringify(c).replace(/'/g,"&#39;")})'>
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
          ${c.student_name ? `<span class="tag-loc">👤 ${esc(c.student_name)}${c.roll_number?' · '+c.roll_number:''}</span>` : ''}
          ${c.location     ? `<span class="tag-loc">📍 ${esc(c.location)}</span>` : ''}
          <span class="tag-date">${fmt(c.created_at)}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── ADMIN MODAL ──
function openAdminModal(c) {
  currentId = c.complaint_id || c.complaint_code;
  document.getElementById('am-title').textContent   = c.title;
  document.getElementById('am-id').textContent      = currentId;
  document.getElementById('am-student').textContent = `${c.student_name||'Unknown'}${c.roll_number?' ('+c.roll_number+')':''}`;
  document.getElementById('am-dept').textContent    = c.department || '—';
  document.getElementById('am-cat').textContent     = `${ICONS[c.category]||''} ${c.category}`;
  document.getElementById('am-pri').innerHTML       = `<span class="pb ${c.priority||'Medium'}">${priE(c.priority)} ${c.priority||'Medium'}</span>`;
  document.getElementById('am-date').textContent    = fmt(c.created_at);
  document.getElementById('am-loc').textContent     = c.location || '—';
  document.getElementById('am-desc').textContent    = c.description;
  document.getElementById('am-status').value        = c.status || 'Pending';
  document.getElementById('am-note').value          = c.admin_note || '';

  const imgRow = document.getElementById('am-img-row');
  if (c.image_path) { imgRow.classList.remove('hidden'); document.getElementById('am-img').src = c.image_path; }
  else imgRow.classList.add('hidden');

  document.getElementById('admin-modal').classList.remove('hidden');
}
function closeAdminModal() {
  document.getElementById('admin-modal').classList.add('hidden');
  currentId = null;
}
document.getElementById('admin-modal').addEventListener('click', e => {
  if (e.target.id === 'admin-modal') closeAdminModal();
});

// ── UPDATE STATUS ──
async function updateStatus() {
  if (!currentId) return;
  const status     = document.getElementById('am-status').value;
  const admin_note = document.getElementById('am-note').value.trim();
  const btn        = document.getElementById('update-btn');
  btn.disabled = true;
  btn.innerHTML = '<span>Updating...</span>';
  try {
    const res  = await fetch(`/api/complaints/${currentId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ status, admin_note })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`✅ Status updated to "${status}"`, 'ok');
      closeAdminModal();
      refreshActive();
    } else {
      showToast(data.error || 'Update failed', 'err');
    }
  } catch(e) { showToast('Network error', 'err'); }
  finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Update Status';
  }
}

// ── DELETE ──
async function deleteComplaint() {
  if (!currentId || !confirm(`Delete complaint ${currentId}? This cannot be undone.`)) return;
  try {
    const res  = await fetch(`/api/complaints/${currentId}`, { method:'DELETE' });
    const data = await res.json();
    if (res.ok) { showToast('Complaint deleted', 'ok'); closeAdminModal(); refreshActive(); }
    else showToast(data.error || 'Delete failed', 'err');
  } catch(e) { showToast('Network error', 'err'); }
}

// Refresh whichever view is active
function refreshActive() {
  const active = document.querySelector('.view.active');
  if (active?.id === 'admin-view-dashboard') loadAdminDashboard();
  else loadAdminComplaints();
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
