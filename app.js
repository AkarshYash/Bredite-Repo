/* ═══════════════════════════════════════════════════
   TEAM PROFILE HUB  –  app.js
   Full frontend with Auth, RBAC, Approval Workflow & Audit Log
═══════════════════════════════════════════════════ */

'use strict';

const API_BASE = (typeof window !== 'undefined' && window.API_BASE)
  ? window.API_BASE
  : '/api';

const API_TIMEOUT_MS = 6000;

const LS_KEY       = 'tph_offline_data';
const LS_TOKEN     = 'tph_access_token';
const LS_USER      = 'tph_user_info';

/* ── State ────────────────────────────────────────── */
let teamData       = [];
let currentMember   = null;
let isOnline       = false;

let currentUser    = null;  // { id, email }
let currentProfile = { role: 'GUEST', email: '', name: 'Guest' };

let bsModal        = null;  // Member Add/Edit Modal
let bsAuthModal    = null;  // Login/Signup Modal
let bsAccountModal = null;  // Account Profile Modal
let bsRejectModal  = null;  // Reject Note Modal
let bsToast        = null;

let pendingChangesList = [];
let auditLogList       = [];
let userProfilesList   = [];

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[INIT] Starting Team Profile Hub v3.0...');

  bsModal        = new bootstrap.Modal(document.getElementById('profileModal'));
  bsAuthModal    = new bootstrap.Modal(document.getElementById('authModal'));
  bsAccountModal = new bootstrap.Modal(document.getElementById('accountModal'));
  bsRejectModal  = new bootstrap.Modal(document.getElementById('rejectNoteModal'));
  bsToast        = new bootstrap.Toast(document.getElementById('appToast'), { delay: 3500 });

  applyTheme(localStorage.getItem('tph_theme') === 'dark');
  restoreSession();
  renderAuthWidget();

  showSkeletons();
  await fetchMembers();
  bindEvents();

  if (currentUser) {
    await fetchMe();
    if (currentProfile.role === 'ADMIN' || currentProfile.role === 'MEMBER') {
      await fetchPendingCount();
    }
  }

  console.log('[INIT] Initialization complete.');
});

/* ══════════════════════════════════════════════════
   SESSION & AUTH HELPERS
══════════════════════════════════════════════════ */
function restoreSession() {
  try {
    const savedUser = localStorage.getItem(LS_USER);
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      currentUser = parsed.user || null;
      currentProfile = parsed.profile || { role: 'GUEST', email: '', name: 'Guest' };
    }
  } catch (e) {
    console.warn('[AUTH] Failed to restore session:', e.message);
  }
}

function saveSession(session, user, profile) {
  if (session && session.access_token) {
    localStorage.setItem(LS_TOKEN, session.access_token);
  }
  currentUser = user;
  currentProfile = profile || { role: 'MEMBER', email: user?.email, name: user?.email?.split('@')[0] };
  localStorage.setItem(LS_USER, JSON.stringify({ user: currentUser, profile: currentProfile }));
  renderAuthWidget();
  updateUIForRole();
}

function clearSession() {
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_USER);
  currentUser = null;
  currentProfile = { role: 'GUEST', email: '', name: 'Guest' };
  renderAuthWidget();
  updateUIForRole();
  switchView('viewMembers');
}

function getAuthHeader() {
  const token = localStorage.getItem(LS_TOKEN);
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function isFileProtocol() {
  return typeof window !== 'undefined' && window.location.protocol === 'file:';
}

/* ══════════════════════════════════════════════════
   API LAYER
══════════════════════════════════════════════════ */
async function api(method, path, body) {
  if (isFileProtocol()) throw new Error('No server (file:// protocol)');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader()
  };

  const opts = { method, headers, signal: controller.signal };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(`${API_BASE}${path}`, opts);
    clearTimeout(timer);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      const errorObj = new Error(err.error || `HTTP ${res.status}`);
      errorObj.status = res.status;
      errorObj.isMember = err.isMember;
      throw errorObj;
    }
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  }
}

async function fetchMe() {
  try {
    const data = await api('GET', '/auth/me');
    if (data && data.profile) {
      currentProfile = data.profile;
      currentUser = data.user;
      localStorage.setItem(LS_USER, JSON.stringify({ user: currentUser, profile: currentProfile }));
      renderAuthWidget();
      updateUIForRole();
    }
  } catch (e) {
    console.warn('[AUTH] Could not refresh profile:', e.message);
  }
}

async function fetchMembers() {
  try {
    const { data } = await api('GET', '/members');
    teamData = data;
    isOnline = true;
    setApiStatus('online', 'Live – Server');
    cacheLocal(teamData);
  } catch (e) {
    console.warn('[OFFLINE] Using cached/default data:', e.message);
    teamData = getLocalCache();
    isOnline = false;
    if (!teamData.length) {
      teamData = getDefaultFallback();
      setApiStatus('offline', 'Demo – no server');
    } else {
      setApiStatus('offline', 'Offline – cached');
    }
  }
  renderCards();
  updateStats();
}

async function fetchPendingCount() {
  try {
    const { data } = await api('GET', '/pending-changes');
    pendingChangesList = data || [];
    const pendingOnly = pendingChangesList.filter(p => p.status === 'pending');
    const badge = document.getElementById('pendingCountBadge');
    if (badge) {
      badge.textContent = pendingOnly.length;
      badge.classList.toggle('d-none', pendingOnly.length === 0);
    }
    if (document.getElementById('viewPending').classList.contains('active')) {
      renderPendingList();
    }
  } catch (e) {
    console.warn('[PENDING] Failed to fetch pending count:', e.message);
  }
}

async function fetchAuditLog() {
  try {
    const actorFilter = document.getElementById('auditActorFilter')?.value || '';
    const actionFilter = document.getElementById('auditActionFilter')?.value || '';
    let query = `/audit-log?limit=100`;
    if (actorFilter) query += `&actor=${encodeURIComponent(actorFilter)}`;
    if (actionFilter) query += `&action_type=${encodeURIComponent(actionFilter)}`;

    const { data } = await api('GET', query);
    auditLogList = data || [];
    renderAuditTable();
  } catch (e) {
    toast('Error fetching audit log: ' + e.message, 'error');
  }
}

async function fetchUsersList() {
  try {
    const { data } = await api('GET', '/users');
    userProfilesList = data || [];
    renderUsersTable();
  } catch (e) {
    toast('Error fetching user roles: ' + e.message, 'error');
  }
}

/* ── LocalStorage cache ───────────────────────────── */
function cacheLocal(data)  { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch(_){} }
function getLocalCache()   { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch(_){ return []; } }

/* ══════════════════════════════════════════════════
   RENDER CARDS & STATS
══════════════════════════════════════════════════ */
function renderCards(filter = '') {
  const grid = document.getElementById('teamGrid');
  const q    = filter.trim().toLowerCase();
  const list = teamData.filter(p =>
    !q ||
    (p.name             || '').toLowerCase().includes(q) ||
    (p.gmail            || '').toLowerCase().includes(q) ||
    (p.last_company     || '').toLowerCase().includes(q) ||
    (p.visa_type        || '').toLowerCase().includes(q) ||
    (p.current_location || '').toLowerCase().includes(q) ||
    (p.tech_stack       || '').toLowerCase().includes(q)
  );
  document.getElementById('memberCount').textContent = list.length;

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state">
      <i class="bi bi-search"></i>
      <p>No members match <strong>"${escHtml(filter)}"</strong></p>
    </div>`;
    return;
  }

  grid.innerHTML = list.map((p, i) => {
    const initials = getInitials(p.name);
    const hasResume = !!p.resume_link;
    const hasDl     = !!p.dl_link;
    return `
    <div class="person-card" data-id="${p.id}" style="animation-delay:${i*0.04}s" tabindex="0" role="button">
      <div class="card-top">
        <div class="card-avatar">${initials}</div>
        <div class="card-name-block">
          <div class="card-name">${escHtml(p.name)}</div>
          <div class="card-company"><i class="bi bi-building me-1"></i>${escHtml(p.last_company || '—')}</div>
          <div><span class="card-visa">${escHtml(p.visa_type || 'N/A')}</span></div>
        </div>
      </div>
      <div class="card-meta">
        ${p.gmail            ? `<span><i class="bi bi-envelope"></i>${escHtml(p.gmail)}</span>` : ''}
        ${p.phone            ? `<span><i class="bi bi-phone"></i>${escHtml(p.phone)}</span>` : ''}
        ${p.current_location ? `<span><i class="bi bi-geo-alt"></i>${escHtml(p.current_location)}</span>` : ''}
        ${p.total_experience ? `<span><i class="bi bi-briefcase"></i>${escHtml(p.total_experience)}</span>` : ''}
      </div>
      <div class="card-doc-pills">
        ${hasResume ? `<a href="${escAttr(p.resume_link)}" target="_blank" rel="noopener" class="doc-pill-sm" onclick="event.stopPropagation()"><i class="bi bi-file-earmark-person-fill"></i> Resume</a>` : '<span class="doc-pill-sm" style="opacity:.4;cursor:default;"><i class="bi bi-file-earmark-person"></i> No Resume</span>'}
        ${hasDl     ? `<a href="${escAttr(p.dl_link)}"     target="_blank" rel="noopener" class="doc-pill-sm dl" onclick="event.stopPropagation()"><i class="bi bi-card-image"></i> DL Scan</a>` : '<span class="doc-pill-sm dl" style="opacity:.4;cursor:default;"><i class="bi bi-card-image"></i> No DL</span>'}
      </div>
      <span class="card-arrow"><i class="bi bi-arrow-right-circle"></i> view</span>
    </div>`;
  }).join('');

  grid.querySelectorAll('.person-card').forEach(card => {
    card.addEventListener('click', () => openProfile(parseInt(card.dataset.id)));
  });
}

function updateStats() {
  const total   = teamData.length;
  const citizen = teamData.filter(p => /citizen/i.test(p.visa_type || '')).length;
  const gc      = teamData.filter(p => /green.?card|gc/i.test(p.visa_type || '')).length;
  const h1b     = teamData.filter(p => /h.?1/i.test(p.visa_type || '')).length;
  const resumes = teamData.filter(p => !!p.resume_link).length;
  const dls     = teamData.filter(p => !!p.dl_link).length;

  setStatChip('statTotal',   total);
  setStatChip('statCitizen', citizen);
  setStatChip('statGC',      gc);
  setStatChip('statH1b',     h1b);
  setStatChip('statResume',  resumes);
  setStatChip('statDL',      dls);
}

function setStatChip(id, val) {
  const el = document.getElementById(id);
  if (el) el.querySelector('span').textContent = val;
}

/* ══════════════════════════════════════════════════
   ROLE-BASED UI UPDATES
══════════════════════════════════════════════════ */
function renderAuthWidget() {
  const container = document.getElementById('authStatusWidget');
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = `
      <button class="btn-icon-pill" id="openAuthModalBtn">
        <i class="bi bi-person-lock"></i> Sign In
      </button>`;
    document.getElementById('openAuthModalBtn')?.addEventListener('click', () => openAuthModal('login'));
    return;
  }

  const role = currentProfile.role || 'MEMBER';
  const roleClass = role === 'ADMIN' ? 'admin' : 'member';
  const initials = getInitials(currentProfile.name || currentUser.email);

  container.innerHTML = `
    <div class="user-chip" id="openAccountModalBtn" title="View Account">
      <div class="user-avatar-sm">${initials}</div>
      <span class="d-none d-md-inline">${escHtml(currentProfile.name || currentUser.email)}</span>
      <span class="role-pill ${roleClass}">${role}</span>
    </div>`;

  document.getElementById('openAccountModalBtn')?.addEventListener('click', openAccountModal);
}

function updateUIForRole() {
  const role = currentProfile.role || 'GUEST';
  const isAdmin  = role === 'ADMIN';
  const isMember = role === 'MEMBER';

  // Nav buttons
  document.getElementById('navAuditBtn')?.classList.toggle('d-none', !isAdmin);
  document.getElementById('navUsersBtn')?.classList.toggle('d-none', !isAdmin);

  // Modal alert
  document.getElementById('modalRoleAlert')?.classList.toggle('d-none', !isMember);

  // Form Save Button Label
  const saveBtnText = document.getElementById('saveBtnText');
  if (saveBtnText) {
    saveBtnText.textContent = isAdmin ? 'Save Member' : (isMember ? 'Submit for Approval' : 'Sign in to Submit');
  }

  // Edit / Delete button text in profile panel
  const editBtnText = document.getElementById('editBtnText');
  const delBtnText  = document.getElementById('delBtnText');
  if (editBtnText) editBtnText.textContent = isAdmin ? 'Edit' : 'Propose Edit';
  if (delBtnText)  delBtnText.textContent  = isAdmin ? 'Delete' : 'Propose Delete';
}

/* ══════════════════════════════════════════════════
   VIEW SWITCHING
══════════════════════════════════════════════════ */
function switchView(targetViewId) {
  document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.app-nav-btn').forEach(b => b.classList.remove('active'));

  const targetView = document.getElementById(targetViewId);
  const targetBtn  = document.querySelector(`.app-nav-btn[data-view="${targetViewId}"]`);

  if (targetView) targetView.classList.add('active');
  if (targetBtn)  targetBtn.classList.add('active');

  if (targetViewId === 'viewPending') fetchPendingCount();
  if (targetViewId === 'viewAudit') fetchAuditLog();
  if (targetViewId === 'viewUsers') fetchUsersList();
}

/* ══════════════════════════════════════════════════
   PROFILE PANEL
══════════════════════════════════════════════════ */
function openProfile(id) {
  const p = teamData.find(m => m.id === id);
  if (!p) return;
  currentMember = p;

  const panel = document.getElementById('profilePanel');
  panel.classList.add('open');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('heroAvatar').textContent  = getInitials(p.name);
  document.getElementById('detailName').textContent  = p.name;
  document.getElementById('detailVisaBadge').textContent = p.visa_type || 'N/A';
  document.getElementById('detailLocation').innerHTML = `<i class="bi bi-geo-alt-fill"></i> ${escHtml(p.current_location || '—')}`;
  document.getElementById('detailExp').innerHTML      = `<i class="bi bi-briefcase-fill"></i> ${escHtml(p.total_experience || '—')}`;

  renderHeroDocPills(p);
  activateTab('tabOverview');
  renderTabOverview(p);
  renderTabPersonal(p);
  renderTabVisa(p);
  renderTabProfessional(p);
  renderTabUS(p);
  renderTabDocs(p);
  renderTabRefs(p);
}

function closeProfile() {
  const panel = document.getElementById('profilePanel');
  panel.classList.remove('open');
  currentMember = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function activateTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab-body').forEach(b => b.classList.toggle('active', b.id === tabId));
}

function renderHeroDocPills(p) {
  const container = document.getElementById('heroDocPills');
  const pills = [
    { label: 'Master Resume', icon: 'bi-file-earmark-person-fill', link: p.resume_link },
    { label: 'Driver\'s License', icon: 'bi-card-image', link: p.dl_link },
    { label: 'LinkedIn',  icon: 'bi-linkedin',  link: p.linkedin  },
    { label: 'GitHub',    icon: 'bi-github',    link: p.github    },
    { label: 'Portfolio', icon: 'bi-globe2',    link: p.portfolio },
  ];
  container.innerHTML = pills.filter(x => x.link).map(x =>
    `<a href="${escAttr(x.link)}" target="_blank" rel="noopener" class="hero-doc-pill">
      <i class="bi ${x.icon}"></i> ${x.label}
    </a>`
  ).join('');
}

function infoGrid(fields) {
  return `<div class="info-grid">${fields.map(f =>
    `<div class="info-item">
      <div class="info-label">${f.label}</div>
      <div class="info-value ${f.small ? 'small' : ''}">${escHtml(f.value || '—')}</div>
    </div>`
  ).join('')}</div>`;
}

function renderTabOverview(p) {
  document.getElementById('tabOverview').innerHTML = infoGrid([
    { label: 'Full Name',          value: p.name },
    { label: 'Email',              value: p.gmail },
    { label: 'Phone',              value: p.phone },
    { label: 'Current Location',   value: p.current_location },
    { label: 'Visa Type',          value: p.visa_type },
    { label: 'Work Authorization', value: p.work_authorization },
    { label: 'Total Experience',   value: p.total_experience },
    { label: 'Last Company',       value: p.last_company },
    { label: 'Last Project',       value: p.last_project },
    { label: 'Tech Stack',         value: p.tech_stack, small: true },
  ]);
}

function renderTabPersonal(p) {
  document.getElementById('tabPersonal').innerHTML = infoGrid([
    { label: 'Full Name',       value: p.name },
    { label: 'DL Name',         value: p.dl_name },
    { label: 'Age / DOB',       value: p.age },
    { label: 'Phone',           value: p.phone },
    { label: 'Email',           value: p.gmail },
    { label: 'Address',         value: p.address },
    { label: 'Education',       value: p.education },
    { label: 'Marriage Date',   value: p.marriage_date },
    { label: 'Property Owned',  value: p.property_owned },
    { label: 'SSN (last 4)',    value: p.ssn_last4 && p.ssn_last4 !== 'N/A' ? `***-**-${p.ssn_last4}` : p.ssn_last4 },
  ]);
}

function renderTabVisa(p) {
  document.getElementById('tabVisa').innerHTML = infoGrid([
    { label: 'Visa Type',             value: p.visa_type },
    { label: 'Work Authorization',    value: p.work_authorization },
    { label: 'Green Card Date',       value: p.green_card_date },
    { label: 'How Got Green Card',    value: p.green_card_how },
    { label: 'W2 / C2C Preference',  value: p.w2_c2c_preference },
    { label: 'SSN (last 4)',          value: p.ssn_last4 && p.ssn_last4 !== 'N/A' ? `***-**-${p.ssn_last4}` : p.ssn_last4 },
  ]);
}

function renderTabProfessional(p) {
  document.getElementById('tabProfessional').innerHTML = infoGrid([
    { label: 'Last Company',          value: p.last_company },
    { label: 'Last Project',          value: p.last_project },
    { label: 'Project Overview',      value: p.last_project_overview, small: true },
    { label: 'Tech Stack',            value: p.tech_stack, small: true },
    { label: 'Total Experience',      value: p.total_experience },
    { label: 'Total Companies Worked',value: p.total_companies },
  ]);
}

function renderTabUS(p) {
  document.getElementById('tabUS').innerHTML = infoGrid([
    { label: 'Came to US Date',        value: p.came_to_us_date },
    { label: 'First 5 Years – Visa',   value: p.first_five_years_how, small: true },
    { label: 'Places Lived',           value: p.places_lived },
    { label: 'Current Location',       value: p.current_location },
    { label: 'Visa Type',              value: p.visa_type },
    { label: 'Green Card Status',      value: p.green_card_date || 'In process' },
  ]);
}

function renderTabDocs(p) {
  const hasResume = !!p.resume_link;
  const hasDl     = !!p.dl_link;
  const hasGh     = !!p.github;
  const hasLi     = !!p.linkedin;
  const hasPf     = !!p.portfolio;

  document.getElementById('tabDocs').innerHTML = `
    <div class="tab-section-title"><i class="bi bi-folder2-open"></i> Documents</div>
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:28px;">
      <div style="flex:1;min-width:220px;">
        <div class="doc-section-title"><i class="bi bi-file-earmark-person-fill text-primary"></i> Master Resume</div>
        ${hasResume
          ? `<a href="${escAttr(p.resume_link)}" target="_blank" rel="noopener" class="doc-link-card"><i class="bi bi-google" style="color:#4285F4"></i><div><div>Open Resume</div><div class="link-label">Google Drive</div></div><i class="bi bi-box-arrow-up-right ms-auto" style="font-size:.8rem;"></i></a>`
          : `<a class="doc-link-card disabled"><i class="bi bi-file-earmark-x" style="color:var(--c-txt3)"></i><div><div>No Resume</div><div class="link-label">Add a Drive link via Edit</div></div></a>`
        }
      </div>
      <div style="flex:1;min-width:220px;">
        <div class="doc-section-title"><i class="bi bi-card-image text-success"></i> Driver's License</div>
        ${hasDl
          ? `<a href="${escAttr(p.dl_link)}" target="_blank" rel="noopener" class="doc-link-card"><i class="bi bi-google" style="color:#4285F4"></i><div><div>Open DL Scan</div><div class="link-label">Google Drive</div></div><i class="bi bi-box-arrow-up-right ms-auto" style="font-size:.8rem;"></i></a>`
          : `<a class="doc-link-card disabled"><i class="bi bi-image" style="color:var(--c-txt3)"></i><div><div>No DL Scan</div><div class="link-label">Add a Drive link via Edit</div></div></a>`
        }
      </div>
    </div>
    <div class="tab-section-title"><i class="bi bi-link-45deg"></i> Social &amp; Portfolio</div>
    <div class="social-row">
      ${hasGh ? `<a href="${escAttr(p.github)}" target="_blank" rel="noopener" class="social-chip"><i class="bi bi-github"></i> GitHub</a>` : ''}
      ${hasLi ? `<a href="${escAttr(p.linkedin)}" target="_blank" rel="noopener" class="social-chip"><i class="bi bi-linkedin"></i> LinkedIn</a>` : ''}
      ${hasPf ? `<a href="${escAttr(p.portfolio)}" target="_blank" rel="noopener" class="social-chip"><i class="bi bi-globe2"></i> Portfolio</a>` : ''}
      ${!hasGh && !hasLi && !hasPf ? '<span style="color:var(--c-txt3);font-size:.88rem;">No social links added yet.</span>' : ''}
    </div>`;
}

function renderTabRefs(p) {
  const refs = Array.isArray(p.references) ? p.references : [];
  if (!refs.length) {
    document.getElementById('tabRefs').innerHTML = `<p style="color:var(--c-txt2);padding:8px 0;">No references added yet.</p>`;
    return;
  }
  document.getElementById('tabRefs').innerHTML = refs.map(r => `
    <div class="ref-card">
      <div class="ref-name">${escHtml(r.name || '—')}</div>
      <div class="ref-meta">
        ${r.designation ? `<span><i class="bi bi-person-fill"></i>${escHtml(r.designation)}</span>` : ''}
        ${r.company     ? `<span><i class="bi bi-building"></i>${escHtml(r.company)}</span>`         : ''}
        ${r.email       ? `<span><i class="bi bi-envelope"></i>${escHtml(r.email)}</span>`           : ''}
        ${r.phone       ? `<span><i class="bi bi-phone"></i>${escHtml(r.phone)}</span>`              : ''}
        ${r.linkedin    ? `<span><i class="bi bi-linkedin"></i><a href="https://${r.linkedin}" target="_blank" rel="noopener">${escHtml(r.linkedin)}</a></span>` : ''}
      </div>
    </div>`).join('');
}

/* ══════════════════════════════════════════════════
   MODAL – Add / Edit Member
══════════════════════════════════════════════════ */
function openAddModal() {
  if (!currentUser) {
    toast('Please sign in to add or propose a member profile', 'info');
    openAuthModal('login');
    return;
  }
  document.getElementById('editId').value = '';
  document.getElementById('modalTitle').innerHTML = '<i class="bi bi-person-plus-fill me-2"></i>Add New Member';
  document.getElementById('profileForm').reset();
  updateUIForRole();
  bsModal.show();
}

function openEditModal(p) {
  if (!currentUser) {
    toast('Please sign in to edit or propose a change', 'info');
    openAuthModal('login');
    return;
  }
  document.getElementById('editId').value = p.id;
  document.getElementById('modalTitle').innerHTML = '<i class="bi bi-pencil-fill me-2"></i>Edit Member Profile';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('fName',                p.name);
  set('fEmail',               p.gmail);
  set('fPhone',               p.phone);
  set('fAddress',             p.address);
  set('fAge',                 p.age);
  set('fEducation',           p.education);
  set('fDlName',              p.dl_name);
  set('fMarriage',            p.marriage_date);
  set('fProperty',            p.property_owned);
  set('fSsn',                 p.ssn_last4);
  set('fVisa',                p.visa_type);
  set('fAuth',                p.work_authorization);
  set('fGcDate',              p.green_card_date);
  set('fGcHow',               p.green_card_how);
  set('fW2',                  p.w2_c2c_preference);
  set('fLastCompany',         p.last_company);
  set('fTotalExp',            p.total_experience);
  set('fTotalCompanies',      p.total_companies);
  set('fLastProject',         p.last_project);
  set('fLastProjectOverview', p.last_project_overview);
  set('fTechStack',           p.tech_stack);
  set('fCameUS',              p.came_to_us_date);
  set('fFirst5',              p.first_five_years_how);
  set('fPlaces',              p.places_lived);
  set('fCurrentLoc',          p.current_location);
  set('fResumeLink',          p.resume_link);
  set('fDlLink',              p.dl_link);
  set('fGithub',              p.github);
  set('fLinkedin',            p.linkedin);
  set('fPortfolio',           p.portfolio);

  const refs = Array.isArray(p.references) ? p.references : [];
  set('fReferences', refs.map(r => [r.name, r.designation, r.company, r.email, r.phone, r.linkedin].join(' | ')).join('\n'));

  updateUIForRole();
  bsModal.show();
}

async function handleSave() {
  const nameEl  = document.getElementById('fName');
  const emailEl = document.getElementById('fEmail');
  const name    = nameEl.value.trim();
  const email   = emailEl.value.trim();

  if (!name) { nameEl.focus();  toast('Full Name is required', 'warn'); return; }
  if (!email){ emailEl.focus(); toast('Email is required', 'warn');     return; }

  const refsRaw = document.getElementById('fReferences').value;
  const refs = refsRaw.split('\n').filter(l => l.trim()).map(line => {
    const p = line.split('|').map(s => s.trim());
    return { name: p[0]||'', designation: p[1]||'', company: p[2]||'', email: p[3]||'', phone: p[4]||'', linkedin: p[5]||'' };
  });

  const payload = {
    name,
    gmail:                email,
    phone:                document.getElementById('fPhone').value.trim(),
    address:              document.getElementById('fAddress').value.trim(),
    age:                  document.getElementById('fAge').value.trim(),
    education:            document.getElementById('fEducation').value.trim(),
    dl_name:              document.getElementById('fDlName').value.trim(),
    marriage_date:        document.getElementById('fMarriage').value.trim(),
    property_owned:       document.getElementById('fProperty').value.trim(),
    ssn_last4:            document.getElementById('fSsn').value.trim(),
    visa_type:            document.getElementById('fVisa').value.trim(),
    work_authorization:   document.getElementById('fAuth').value.trim(),
    green_card_date:      document.getElementById('fGcDate').value.trim(),
    green_card_how:       document.getElementById('fGcHow').value.trim(),
    w2_c2c_preference:    document.getElementById('fW2').value.trim(),
    last_company:         document.getElementById('fLastCompany').value.trim(),
    total_experience:     document.getElementById('fTotalExp').value.trim(),
    total_companies:      parseInt(document.getElementById('fTotalCompanies').value) || 0,
    last_project:         document.getElementById('fLastProject').value.trim(),
    last_project_overview:document.getElementById('fLastProjectOverview').value.trim(),
    tech_stack:           document.getElementById('fTechStack').value.trim(),
    came_to_us_date:      document.getElementById('fCameUS').value.trim(),
    first_five_years_how: document.getElementById('fFirst5').value.trim(),
    places_lived:         document.getElementById('fPlaces').value.trim(),
    current_location:     document.getElementById('fCurrentLoc').value.trim(),
    resume_link:          document.getElementById('fResumeLink').value.trim(),
    dl_link:              document.getElementById('fDlLink').value.trim(),
    github:               document.getElementById('fGithub').value.trim(),
    linkedin:             document.getElementById('fLinkedin').value.trim(),
    portfolio:            document.getElementById('fPortfolio').value.trim(),
    references: refs
  };

  const editId = document.getElementById('editId').value;
  const id     = editId ? parseInt(editId, 10) : null;
  const isAdmin = currentProfile.role === 'ADMIN';

  const spinner = document.getElementById('saveBtnSpinner');
  const saveBtn = document.getElementById('saveProfileBtn');
  spinner.classList.remove('d-none');
  saveBtn.disabled = true;

  try {
    if (isAdmin) {
      // Direct save
      const path = id ? `/members/${id}` : '/members';
      const method = id ? 'PUT' : 'POST';
      const { data } = await api(method, path, payload);
      await fetchMembers();
      bsModal.hide();
      toast(id ? '✅ Member updated directly!' : '✅ Member added directly!', 'success');
      if (id && currentMember && currentMember.id === id) openProfile(id);
    } else {
      // Proposal path for MEMBER
      const changeType = id ? 'update' : 'create';
      await api('POST', '/pending-changes', {
        change_type: changeType,
        target_member_id: id,
        payload
      });
      bsModal.hide();
      toast('⏳ Change proposal submitted for Admin approval!', 'info');
      fetchPendingCount();
    }
  } catch (e) {
    if (e.isMember) {
      toast('Submitted proposal for Admin review', 'info');
      bsModal.hide();
    } else {
      toast('Error: ' + e.message, 'error');
    }
  } finally {
    spinner.classList.add('d-none');
    saveBtn.disabled = false;
  }
}

async function handleDelete() {
  if (!currentMember) return;
  const isAdmin = currentProfile.role === 'ADMIN';
  const id = currentMember.id;

  if (isAdmin) {
    if (!confirm(`Delete ${currentMember.name}? This action is immediate.`)) return;
    try {
      await api('DELETE', `/members/${id}`);
      closeProfile();
      await fetchMembers();
      toast('🗑️ Member deleted', 'info');
    } catch (e) {
      toast('Delete failed: ' + e.message, 'error');
    }
  } else {
    if (!confirm(`Propose deletion of ${currentMember.name} for Admin review?`)) return;
    try {
      await api('POST', '/pending-changes', {
        change_type: 'delete',
        target_member_id: id,
        payload: { name: currentMember.name }
      });
      closeProfile();
      toast('⏳ Deletion proposal submitted for Admin approval', 'info');
      fetchPendingCount();
    } catch (e) {
      toast('Error submitting deletion: ' + e.message, 'error');
    }
  }
}

/* ══════════════════════════════════════════════════
   PENDING APPROVALS & DIFF VIEW
══════════════════════════════════════════════════ */
function renderPendingList() {
  const container = document.getElementById('pendingList');
  if (!container) return;

  const isAdmin = currentProfile.role === 'ADMIN';
  const list = pendingChangesList;

  if (!list.length) {
    container.innerHTML = `<div class="empty-state">
      <i class="bi bi-check2-circle text-success"></i>
      <p>No pending change requests in queue!</p>
    </div>`;
    return;
  }

  container.innerHTML = list.map(item => {
    const isPending = item.status === 'pending';
    const statusBadge = item.status === 'approved' ? 'bg-success' : item.status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark';
    const targetMember = teamData.find(m => m.id === item.target_member_id);

    return `
      <div class="pending-card">
        <div class="pending-header">
          <div>
            <span class="badge ${statusBadge} me-2 text-uppercase">${escHtml(item.status)}</span>
            <span class="fw-bold text-uppercase me-2 text-primary">[${escHtml(item.change_type)}]</span>
            <span class="fw-semibold">${escHtml(item.payload?.name || targetMember?.name || 'Member #' + item.target_member_id)}</span>
          </div>
          <div class="text-muted small">
            Submitted by <strong>${escHtml(item.submitted_by_email || 'Member')}</strong> on ${new Date(item.submitted_at).toLocaleString()}
          </div>
        </div>

        <div class="diff-view my-3">
          ${renderDiffContent(item, targetMember)}
        </div>

        ${item.admin_note ? `<div class="alert alert-secondary py-2 small mb-3"><strong>Admin Note:</strong> ${escHtml(item.admin_note)}</div>` : ''}

        ${isAdmin && isPending ? `
          <div class="d-flex justify-content-end gap-2">
            <button class="btn btn-sm btn-outline-danger px-3" onclick="openRejectModal(${item.id})">
              <i class="bi bi-x-lg"></i> Reject
            </button>
            <button class="btn btn-sm btn-success px-4" onclick="approveChange(${item.id})">
              <i class="bi bi-check-lg"></i> Approve &amp; Apply
            </button>
          </div>
        ` : ''}
      </div>`;
  }).join('');
}

function renderDiffContent(item, targetMember) {
  const payload = item.payload || {};
  if (item.change_type === 'create') {
    return Object.entries(payload)
      .filter(([_, v]) => v && typeof v !== 'object')
      .map(([k, v]) => `
        <div class="diff-row">
          <div class="diff-label">${escHtml(k)}:</div>
          <div class="diff-val added">+ ${escHtml(String(v))}</div>
        </div>`).join('');
  }
  if (item.change_type === 'delete') {
    return `<div class="diff-row"><div class="diff-label">Action:</div><div class="diff-val removed">Delete record #${item.target_member_id} (${escHtml(targetMember?.name || 'Consultant')})</div></div>`;
  }
  // Update diff
  if (!targetMember) return `<div class="text-muted">Target member #${item.target_member_id}</div>`;

  return Object.entries(payload)
    .filter(([k, v]) => String(targetMember[k] || '') !== String(v || '') && typeof v !== 'object')
    .map(([k, v]) => `
      <div class="diff-row">
        <div class="diff-label">${escHtml(k)}:</div>
        <div class="diff-val removed">- ${escHtml(String(targetMember[k] || ''))}</div>
        <div class="diff-val added">+ ${escHtml(String(v))}</div>
      </div>`).join('');
}

async function approveChange(id) {
  try {
    const res = await api('POST', `/pending-changes/${id}/approve`, { admin_note: 'Approved via Admin Panel' });
    toast('✅ Proposal approved and applied live!', 'success');
    await fetchMembers();
    await fetchPendingCount();
  } catch (e) {
    toast('Approve failed: ' + e.message, 'error');
  }
}

function openRejectModal(id) {
  document.getElementById('rejectPendingId').value = id;
  document.getElementById('rejectNoteInput').value = '';
  bsRejectModal.show();
}

async function confirmReject() {
  const id = document.getElementById('rejectPendingId').value;
  const note = document.getElementById('rejectNoteInput').value;
  try {
    await api('POST', `/pending-changes/${id}/reject`, { admin_note: note || 'Rejected by Admin' });
    bsRejectModal.hide();
    toast('Rejection recorded', 'info');
    await fetchPendingCount();
  } catch (e) {
    toast('Reject failed: ' + e.message, 'error');
  }
}

/* ══════════════════════════════════════════════════
   ACTIVITY LOG (Audit Table)
══════════════════════════════════════════════════ */
function renderAuditTable() {
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;

  if (!auditLogList.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No audit log records found</td></tr>`;
    return;
  }

  tbody.innerHTML = auditLogList.map(item => `
    <tr>
      <td><span class="badge bg-secondary text-uppercase">${escHtml(item.action_type)}</span></td>
      <td class="fw-semibold">${escHtml(item.actor)}</td>
      <td><code>${escHtml(item.target_record || '—')}</code></td>
      <td class="small text-muted">${new Date(item.timestamp).toLocaleString()}</td>
      <td>
        <button class="btn btn-sm btn-link p-0 text-decoration-none" onclick="alert('Before: ${escAttr(JSON.stringify(item.before_value))}\\n\\nAfter: ${escAttr(JSON.stringify(item.after_value))}')">
          View JSON
        </button>
      </td>
    </tr>`).join('');
}

/* ══════════════════════════════════════════════════
   USER MANAGEMENT TABLE
══════════════════════════════════════════════════ */
function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  if (!userProfilesList.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No registered users found</td></tr>`;
    return;
  }

  tbody.innerHTML = userProfilesList.map(u => `
    <tr>
      <td class="fw-bold">${escHtml(u.email)}</td>
      <td>${escHtml(u.name || '—')}</td>
      <td><span class="role-pill ${u.role === 'ADMIN' ? 'admin' : 'member'}">${escHtml(u.role)}</span></td>
      <td class="small text-muted">${new Date(u.created_at).toLocaleDateString()}</td>
      <td>
        ${u.role === 'MEMBER'
          ? `<button class="btn btn-sm btn-outline-danger" onclick="promoteUser('${u.id}', 'ADMIN')">Promote to ADMIN</button>`
          : `<button class="btn btn-sm btn-outline-secondary" onclick="promoteUser('${u.id}', 'MEMBER')">Demote to MEMBER</button>`
        }
      </td>
    </tr>`).join('');
}

async function promoteUser(id, newRole) {
  if (!confirm(`Change role of user to ${newRole}?`)) return;
  try {
    await api('PUT', `/users/${id}/role`, { role: newRole });
    toast(`User role updated to ${newRole}`, 'success');
    fetchUsersList();
  } catch (e) {
    toast('Role update failed: ' + e.message, 'error');
  }
}

/* ══════════════════════════════════════════════════
   AUTH MODAL & FLOWS
══════════════════════════════════════════════════ */
function openAuthModal(mode = 'login') {
  const title = document.getElementById('authModalTitle');
  const submitBtn = document.getElementById('authSubmitLabel');
  const nameGroup = document.getElementById('signupNameGroup');

  if (mode === 'signup') {
    title.innerHTML = '<i class="bi bi-person-plus-fill text-primary me-2"></i>Create Account';
    submitBtn.textContent = 'Register Account';
    nameGroup.classList.remove('d-none');
    document.getElementById('tabSignupBtn').classList.add('active');
    document.getElementById('tabLoginBtn').classList.remove('active');
  } else {
    title.innerHTML = '<i class="bi bi-shield-lock-fill text-primary me-2"></i>Sign In';
    submitBtn.textContent = 'Sign In';
    nameGroup.classList.add('d-none');
    document.getElementById('tabLoginBtn').classList.add('active');
    document.getElementById('tabSignupBtn').classList.active = false;
    document.getElementById('tabSignupBtn').classList.remove('active');
  }

  document.getElementById('authErrorAlert').classList.add('d-none');
  document.getElementById('authForm').reset();
  bsAuthModal.show();
}

function openAccountModal() {
  if (!currentUser) return;
  document.getElementById('accName').textContent = currentProfile.name || currentUser.email;
  document.getElementById('accEmail').textContent = currentUser.email;
  document.getElementById('accAvatar').textContent = getInitials(currentProfile.name || currentUser.email);

  const badge = document.getElementById('accRoleBadge');
  badge.textContent = currentProfile.role || 'MEMBER';
  badge.className = `badge rounded-pill px-3 py-2 fs-6 ${currentProfile.role === 'ADMIN' ? 'bg-danger' : 'bg-primary'}`;

  bsAccountModal.show();
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const isSignup = !document.getElementById('signupNameGroup').classList.contains('d-none');
  const email    = document.getElementById('authEmailInput').value.trim();
  const password = document.getElementById('authPasswordInput').value.trim();
  const name     = document.getElementById('authNameInput').value.trim();
  const errorEl  = document.getElementById('authErrorAlert');
  const spinner  = document.getElementById('authSpinner');

  errorEl.classList.add('d-none');
  spinner.classList.remove('d-none');

  try {
    const endpoint = isSignup ? '/auth/signup' : '/auth/login';
    const payload  = isSignup ? { email, password, name } : { email, password };
    const res = await api('POST', endpoint, payload);

    saveSession(res.session, res.user, res.profile);
    bsAuthModal.hide();
    toast(isSignup ? '🎉 Registration successful!' : '👋 Welcome back!', 'success');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('d-none');
  } finally {
    spinner.classList.add('d-none');
  }
}

/* ══════════════════════════════════════════════════
   EVENT BINDINGS
══════════════════════════════════════════════════ */
function bindEvents() {
  // Navigation tabs
  document.querySelectorAll('.app-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Search & Filters
  document.getElementById('searchInput').addEventListener('input', e => {
    renderCards(e.target.value);
    if (document.getElementById('profilePanel').classList.contains('open')) closeProfile();
  });
  document.getElementById('resetSearchBtn').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    renderCards('');
    if (document.getElementById('profilePanel').classList.contains('open')) closeProfile();
  });

  // Member Modal
  document.getElementById('addNewBtn').addEventListener('click', openAddModal);
  document.getElementById('saveProfileBtn').addEventListener('click', handleSave);

  // Panel buttons
  document.getElementById('closePanelBtn').addEventListener('click', closeProfile);
  document.getElementById('editProfileBtn').addEventListener('click', () => {
    if (currentMember) openEditModal(currentMember);
  });
  document.getElementById('deleteProfileBtn').addEventListener('click', handleDelete);

  // Profile tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  // Auth Form & Modals
  document.getElementById('authForm').addEventListener('submit', handleAuthSubmit);
  document.getElementById('tabLoginBtn').addEventListener('click', () => openAuthModal('login'));
  document.getElementById('tabSignupBtn').addEventListener('click', () => openAuthModal('signup'));
  document.getElementById('accLogoutBtn').addEventListener('click', () => {
    bsAccountModal.hide();
    clearSession();
    toast('Signed out successfully', 'info');
  });

  // Rejection modal
  document.getElementById('confirmRejectBtn').addEventListener('click', confirmReject);

  // Audit filters
  document.getElementById('refreshAuditBtn')?.addEventListener('click', fetchAuditLog);

  // Theme Toggle
  document.getElementById('themeToggle').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyTheme(!isDark);
  });

  // ESC key closes panel
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('profilePanel').classList.contains('open')) {
      closeProfile();
    }
  });
}

/* ══════════════════════════════════════════════════
   THEME & STATUS
══════════════════════════════════════════════════ */
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const icon  = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (icon)  icon.className  = dark ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
  if (label) label.textContent = dark ? 'Light' : 'Dark';
  localStorage.setItem('tph_theme', dark ? 'dark' : 'light');
}

function setApiStatus(state, text) {
  const el = document.getElementById('apiStatus');
  if (!el) return;
  el.className = `api-status ${state}`;
  el.querySelector('.status-text').textContent = text;
}

function toast(msg, type = 'success') {
  const t  = document.getElementById('appToast');
  const tm = document.getElementById('toastMsg');
  if (!t || !tm) return;
  tm.textContent = msg;
  t.style.background = type === 'warn'  ? '#f59e0b'
                      : type === 'error' ? '#ef4444'
                      : type === 'info'  ? '#06b6d4'
                      : '#4f46e5';
  bsToast.show();
}

function showSkeletons() {
  const grid = document.getElementById('teamGrid');
  if (!grid) return;
  grid.innerHTML = Array(6).fill(0).map(() => `
    <div class="skel-card">
      <div class="skeleton skel-line" style="width:40%;height:18px;margin-bottom:14px;"></div>
      <div class="skeleton skel-line" style="width:60%;"></div>
      <div class="skeleton skel-line" style="width:50%;"></div>
      <div class="skeleton skel-line" style="width:70%;"></div>
    </div>`).join('');
}

function getInitials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('');
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escAttr(str) { return escHtml(str); }

/* ══════════════════════════════════════════════════
   DEFAULT FALLBACK DATA (Offline Demo Data)
══════════════════════════════════════════════════ */
function getDefaultFallback() {
  return [
    {
      id:1, name:'Nirav Patel', gmail:'Niravp1216@gmail.com', phone:'601-488-2998',
      address:'905 Waters Edge, Brandon, Mississippi 39047',
      education:'B.E. in Computer Science', last_company:'Centene Corporation',
      last_project:'Healthcare Cloud Migration & AI Integration',
      last_project_overview:'Led cloud migration projects and AI-driven workflows for healthcare claims and member management, ensuring HIPAA compliance.',
      tech_stack:'Python, AWS, Terraform, Docker, React, PostgreSQL',
      work_authorization:'U.S. Citizen', visa_type:'Citizenship (Naturalized)',
      green_card_date:'2018', green_card_how:'Employer-sponsored',
      w2_c2c_preference:'W2: $50–$85/hr, C2C: $50–$85/hr', ssn_last4:'1806',
      came_to_us_date:'2016', first_five_years_how:'F1 → OPT → H1-B → Green Card',
      places_lived:'Brandon, MS', current_location:'Brandon, MS',
      total_companies:3, marriage_date:'Not provided', property_owned:'Not provided',
      dl_name:'Nirav Patel', age:'29', total_experience:'10+ years',
      resume_link:'', dl_link:'',
      github:'https://github.com/niravp1216-tech',
      linkedin:'https://www.linkedin.com/in/coder-48ba46251/',
      portfolio:'https://ubiquitous-starburst-4b7914.netlify.app/',
      references:[]
    },
    {
      id:2, name:'Dhaval Patel', gmail:'dhavalkumawat76@gmail.com', phone:'+1 (980)-215-9384',
      address:'116 Mackinac Drive, Mooresville, NC 28117',
      education:'B.E. in Computer Engineering', last_company:'NBCUniversal',
      last_project:'AI-Powered Clinical Trial Platform',
      last_project_overview:'Led development of cloud-native microservices and AI/LLM workflows for clinical data management.',
      tech_stack:'Python, FastAPI, AWS, Terraform, Docker, LangChain, PyTorch, PostgreSQL',
      work_authorization:'U.S. Citizen', visa_type:'Citizenship (Naturalized)',
      green_card_date:'2019', green_card_how:'Marriage to U.S. citizen',
      w2_c2c_preference:'W2 preferred', ssn_last4:'6747',
      came_to_us_date:'2017', first_five_years_how:'Marriage-based Green Card',
      places_lived:'Mooresville, NC', current_location:'Mooresville, NC',
      total_companies:4, marriage_date:'2019', property_owned:'Not provided',
      dl_name:'Dhaval Patel', age:'33', total_experience:'8 years',
      resume_link:'', dl_link:'',
      github:'https://github.com/niravp1216-tech',
      linkedin:'https://www.linkedin.com/in/ai-expert-coder',
      portfolio:'https://dhavalpatel.tech',
      references:[]
    }
  ];
}
