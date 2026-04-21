// ===== CAMPUSFIX — ADMIN PANEL JS =====
const ICONS = {Hostel:'🏠',Classroom:'🏫',Electricity:'💡',Water:'💧',Internet:'🌐',Cleanliness:'🧹'};
let currentId = null;

window.addEventListener('DOMContentLoaded', async () => {
  const s = await fetch('/api/auth/session').then(r=>r.json());
  if (!s.loggedIn || s.role !== 'admin') { window.location.href='/'; return; }
  loadAdminDashboard();
});

function switchAdminView(view, el) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('admin-view-'+view).classList.add('active');
  if (el) el.classList.add('active');
  const titles={dashboard:'Admin Dashboard',complaints:'All Complaints'};
  document.getElementById('admin-title').textContent = titles[view]||view;
  if (view==='complaints') loadAdminComplaints();
  return false;
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

document.addEventListener('click', e => {
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.querySelector('.hamburger');
  if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== hamburger) {
    sidebar.classList.remove('open');
  }
});

// Topbar search for admin
function handleAdminSearch(val) {
  if (!val.trim()) return;
  switchAdminView('complaints', document.querySelector('[data-view=complaints]'));
  setTimeout(() => {
    const el = document.getElementById('a-search');
    if (el) { el.value = val; loadAdminComplaints(); }
  }, 100);
}

async function loadAdminDashboard() {
  try {
    const [stats, complaints] = await Promise.all([
      fetch('/api/complaints/stats').then(r=>r.json()),
      fetch('/api/complaints/all').then(r=>r.json())
    ]);
    document.getElementById('a-total').textContent   = stats.total||0;
    document.getElementById('a-pending').textContent = stats.pending||0;
    document.getElementById('a-progress').textContent= stats.inProgress||0;
    document.getElementById('a-resolved').textContent= stats.resolved||0;

    const badge = document.getElementById('a-pending-badge');
    badge.style.display = (stats.pending>0)?'':'none';
    if (stats.pending>0) badge.textContent = stats.pending;

    // Category chart
    const cat = stats.byCategory||[];
    document.getElementById('cat-chart').innerHTML = cat.length
      ? cat.map(d=>`
          <div class="bar-row">
            <div class="bar-label">${ICONS[d.category]||''} ${d.category}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${stats.total?(d.count/stats.total*100).toFixed(1):0}%"></div></div>
            <div class="bar-val">${d.count}</div>
          </div>`).join('')
      : '<p style="color:#8a95a3;font-size:13px;text-align:center;padding:12px">No data yet</p>';

    // Priority
    const pri = stats.byPriority||[];
    document.getElementById('hi-count').textContent  = (pri.find(p=>p.priority==='High')||{count:0}).count;
    document.getElementById('med-count').textContent = (pri.find(p=>p.priority==='Medium')||{count:0}).count;
    document.getElementById('lo-count').textContent  = (pri.find(p=>p.priority==='Low')||{count:0}).count;

    renderAdminComplaints(Array.isArray(complaints)?complaints.slice(0,8):[], 'admin-recent', true);
  } catch(e) { console.error(e); }
}

async function loadAdminComplaints() {
  const search   = document.getElementById('a-search')?.value.trim()||'';
  const status   = document.getElementById('a-status')?.value||'';
  const priority = document.getElementById('a-priority')?.value||'';
  const category = document.getElementById('a-category')?.value||'';
  const params = new URLSearchParams();
  if (search)   params.append('search',search);
  if (status)   params.append('status',status);
  if (priority) params.append('priority',priority);
  if (category) params.append('category',category);
  try {
    const list = await fetch('/api/complaints/all?'+params).then(r=>r.json());
    renderAdminComplaints(Array.isArray(list)?list:[], 'admin-list', true);
  } catch(e) {}
}

function renderAdminComplaints(list, containerId, showStudent=false) {
  const el = document.getElementById(containerId);
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><div class="ei">📭</div><p>No complaints found</p><span>Try adjusting filters</span></div>';
    return;
  }
  el.innerHTML = list.map(c => `
    <div class="cmp-card" onclick='openAdminModal(${JSON.stringify(c)})'>
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
          ${showStudent&&c.student_name?`<span class="tag-loc">👤 ${esc(c.student_name)}${c.roll_number?' · '+c.roll_number:''}</span>`:''}
          ${c.location?`<span class="tag-loc">📍 ${esc(c.location)}</span>`:''}
          <span class="tag-date">${fmt(c.created_at)}</span>
        </div>
      </div>
    </div>`).join('');
}

function openAdminModal(c) {
  currentId = c.complaint_id;
  document.getElementById('am-title').textContent    = c.title;
  document.getElementById('am-id').textContent       = c.complaint_id;
  document.getElementById('am-student').textContent  = `${c.student_name||'Unknown'}${c.roll_number?' ('+c.roll_number+')':''}`;
  document.getElementById('am-dept').textContent     = c.department||'—';
  document.getElementById('am-cat').textContent      = `${ICONS[c.category]||''} ${c.category}`;
  document.getElementById('am-priority').innerHTML   = `<span class="pbadge p-${c.priority||'Medium'}">${priEmoji(c.priority)} ${c.priority||'Medium'}</span>`;
  document.getElementById('am-date').textContent     = fmt(c.created_at);
  document.getElementById('am-loc').textContent      = c.location||'—';
  document.getElementById('am-desc').textContent     = c.description;
  document.getElementById('am-status').value         = c.status;
  document.getElementById('am-note').value           = c.admin_note||'';
  const imgRow = document.getElementById('am-img-row');
  if (c.image_path) { imgRow.classList.remove('hidden'); document.getElementById('am-img').src=c.image_path; }
  else imgRow.classList.add('hidden');
  document.getElementById('admin-modal').classList.remove('hidden');
}
function closeAdminModal() { document.getElementById('admin-modal').classList.add('hidden'); currentId=null; }
document.getElementById('admin-modal').addEventListener('click', e=>{ if(e.target.id==='admin-modal') closeAdminModal(); });

async function updateStatus() {
  if (!currentId) return;
  const status     = document.getElementById('am-status').value;
  const admin_note = document.getElementById('am-note').value.trim();
  const btn = document.querySelector('#admin-modal .cf-btn');
  btn.disabled=true; btn.innerHTML='<span>Updating...</span>';
  try {
    const res = await fetch(`/api/complaints/${currentId}/status`,{
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({status,admin_note})
    });
    const data = await res.json();
    if (res.ok) { showToast(`✅ Status updated to "${status}"`, 'success'); closeAdminModal(); refreshView(); }
    else showToast(data.error||'Failed','error');
  } catch(e) { showToast('Network error','error'); }
  finally { btn.disabled=false; btn.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Update Status'; }
}

async function deleteComplaint() {
  if (!currentId||!confirm(`Delete ${currentId}? This cannot be undone.`)) return;
  try {
    const res = await fetch(`/api/complaints/${currentId}`,{method:'DELETE'});
    const data = await res.json();
    if (res.ok) { showToast('Complaint deleted','success'); closeAdminModal(); refreshView(); }
    else showToast(data.error||'Failed','error');
  } catch(e) { showToast('Network error','error'); }
}

function refreshView() {
  const active = document.querySelector('.view.active');
  if (active?.id==='admin-view-dashboard') loadAdminDashboard();
  else loadAdminComplaints();
}

async function handleLogout() { await fetch('/api/auth/logout',{method:'POST'}); window.location.href='/'; }
function fmt(d) { return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function priEmoji(p) { return p==='High'?'🔴':p==='Low'?'🟢':'🟡'; }
function showToast(msg,type='default') {
  const t=document.getElementById('toast');
  t.textContent=msg; t.className=`toast toast-${type}`;
  setTimeout(()=>t.className='toast hidden',3500);
}
