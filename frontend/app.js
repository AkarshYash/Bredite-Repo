/* ═══════════════════════════════════════════════════
   TEAM PROFILE HUB  –  app.js
   Full frontend with REST API + localStorage fallback
═══════════════════════════════════════════════════ */

'use strict';

/* ── Config ─────────────────────────────────────────
   The API URL is injected by Vercel env vars at build
   time OR falls back to relative path (same-origin).
   For local dev override window.API_BASE in a <script>
   before this file, or set VITE_API_BASE env var.
──────────────────────────────────────────────────── */
// When served from Express on port 3001 (local dev) OR Vercel (same-origin),
// always use a relative /api path so it just works everywhere.
// When opened as a local file (file://) there is no backend, so we skip API calls.
const API_BASE = (typeof window !== 'undefined' && window.API_BASE)
  ? window.API_BASE
  : '/api';

// How long (ms) to wait for the backend before giving up and using offline data
const API_TIMEOUT_MS = 4000;

const LS_KEY     = 'tph_offline_data';
const LS_PENDING = 'tph_pending_sync';

/* ── State ────────────────────────────────────────── */
let teamData     = [];
let currentMember = null;
let isOnline     = false;
let bsModal      = null;
let bsToast      = null;

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  bsModal = new bootstrap.Modal(document.getElementById('profileModal'));
  bsToast = new bootstrap.Toast(document.getElementById('appToast'), { delay: 3000 });

  applyTheme(localStorage.getItem('tph_theme') === 'dark');
  showSkeletons();
  await fetchMembers();
  bindEvents();
});

/* ══════════════════════════════════════════════════
   API LAYER  (with localStorage offline fallback)
══════════════════════════════════════════════════ */

// Returns true when the page is loaded as a local file (no server at all)
function isFileProtocol() {
  return typeof window !== 'undefined' && window.location.protocol === 'file:';
}

async function api(method, path, body) {
  // Bail out immediately when there's no server (opened as file://)
  if (isFileProtocol()) throw new Error('No server (file:// protocol)');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
  };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(`${API_BASE}${path}`, opts);
    clearTimeout(timer);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  }
}

async function fetchMembers() {
  try {
    const { data } = await api('GET', '/members');
    teamData = data;
    isOnline = true;
    setApiStatus('online', 'Live – Supabase');
    cacheLocal(teamData);
  } catch (e) {
    console.warn('[OFFLINE] Using cached/default data:', e.message);
    teamData = getLocalCache();
    isOnline = false;
    if (!teamData.length) {
      // No cache either — load the built-in default members so something is always visible
      teamData = getDefaultFallback();
      setApiStatus('offline', 'Demo – no server');
    } else {
      setApiStatus('offline', 'Offline – cached');
    }
  }
  renderCards();
  updateStats();
}

async function saveMember(payload, id) {
  if (isOnline && !isFileProtocol()) {
    try {
      const { data } = id
        ? await api('PUT', `/members/${id}`, payload)
        : await api('POST', '/members', payload);
      return data;
    } catch (e) {
      toast('API error – saved locally only', 'warn');
    }
  }
  // offline path
  const newId = id || (teamData.length ? Math.max(...teamData.map(m => m.id)) + 1 : 1);
  const saved = { id: newId, ...payload, created_at: new Date().toISOString() };
  if (id) {
    const idx = teamData.findIndex(m => m.id === id);
    if (idx !== -1) teamData[idx] = { ...teamData[idx], ...saved };
  } else {
    teamData.push(saved);
  }
  cacheLocal(teamData);
  return saved;
}

async function deleteMemberAPI(id) {
  if (isOnline && !isFileProtocol()) {
    try { await api('DELETE', `/members/${id}`); }
    catch (e) { toast('Delete failed on server', 'warn'); }
  }
  teamData = teamData.filter(m => m.id !== id);
  cacheLocal(teamData);
}

/* ── LocalStorage cache ───────────────────────────── */
function cacheLocal(data)  { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch(_){} }
function getLocalCache()   { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch(_){ return []; } }

/* ══════════════════════════════════════════════════
   RENDER CARDS
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
    <div class="person-card" data-id="${p.id}" style="animation-delay:${i*0.04}s" tabindex="0" role="button" aria-label="View ${escHtml(p.name)}'s profile">
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
    card.addEventListener('keydown', e => { if (e.key === 'Enter') openProfile(parseInt(card.dataset.id)); });
  });
}

/* ══════════════════════════════════════════════════
   STATS BAR
══════════════════════════════════════════════════ */
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
   PROFILE PANEL
══════════════════════════════════════════════════ */
function openProfile(id) {
  const p = teamData.find(m => m.id === id);
  if (!p) return;
  currentMember = p;

  const panel = document.getElementById('profilePanel');
  panel.classList.add('open');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Hero
  document.getElementById('heroAvatar').textContent  = getInitials(p.name);
  document.getElementById('detailName').textContent  = p.name;
  document.getElementById('detailVisaBadge').textContent = p.visa_type || 'N/A';
  document.getElementById('detailLocation').innerHTML = `<i class="bi bi-geo-alt-fill"></i> ${escHtml(p.current_location || '—')}`;
  document.getElementById('detailExp').innerHTML      = `<i class="bi bi-briefcase-fill"></i> ${escHtml(p.total_experience || '—')}`;

  // Hero doc pills
  renderHeroDocPills(p);

  // Tabs
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
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-body').forEach(b => {
    b.classList.toggle('active', b.id === tabId);
  });
}

/* ── Hero doc pills ─────────────────────────────── */
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

/* ── Tab render helpers ─────────────────────────── */
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
          ? `<a href="${escAttr(p.resume_link)}" target="_blank" rel="noopener" class="doc-link-card">
               <i class="bi bi-google" style="color:#4285F4"></i>
               <div><div>Open Resume</div><div class="link-label">Google Drive</div></div>
               <i class="bi bi-box-arrow-up-right ms-auto" style="font-size:.8rem;"></i>
             </a>`
          : `<a class="doc-link-card disabled"><i class="bi bi-file-earmark-x" style="color:var(--c-txt3)"></i>
               <div><div>No Resume</div><div class="link-label">Add a Drive link via Edit</div></div>
             </a>`
        }
      </div>

      <div style="flex:1;min-width:220px;">
        <div class="doc-section-title"><i class="bi bi-card-image text-success"></i> Driver's License</div>
        ${hasDl
          ? `<a href="${escAttr(p.dl_link)}" target="_blank" rel="noopener" class="doc-link-card">
               <i class="bi bi-google" style="color:#4285F4"></i>
               <div><div>Open DL Scan</div><div class="link-label">Google Drive</div></div>
               <i class="bi bi-box-arrow-up-right ms-auto" style="font-size:.8rem;"></i>
             </a>`
          : `<a class="doc-link-card disabled"><i class="bi bi-image" style="color:var(--c-txt3)"></i>
               <div><div>No DL Scan</div><div class="link-label">Add a Drive link via Edit</div></div>
             </a>`
        }
      </div>
    </div>

    <div class="tab-section-title"><i class="bi bi-link-45deg"></i> Social &amp; Portfolio</div>
    <div class="social-row">
      ${hasGh ? `<a href="${escAttr(p.github)}"    target="_blank" rel="noopener" class="social-chip"><i class="bi bi-github"></i> GitHub</a>`    : ''}
      ${hasLi ? `<a href="${escAttr(p.linkedin)}"  target="_blank" rel="noopener" class="social-chip"><i class="bi bi-linkedin"></i> LinkedIn</a>`  : ''}
      ${hasPf ? `<a href="${escAttr(p.portfolio)}" target="_blank" rel="noopener" class="social-chip"><i class="bi bi-globe2"></i> Portfolio</a>`   : ''}
      ${!hasGh && !hasLi && !hasPf ? '<span style="color:var(--c-txt3);font-size:.88rem;">No social links added yet.</span>' : ''}
    </div>
  `;
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
   MODAL  –  Add / Edit
══════════════════════════════════════════════════ */
function openAddModal() {
  document.getElementById('editId').value = '';
  document.getElementById('modalTitle').innerHTML = '<i class="bi bi-person-plus-fill me-2"></i>Add New Member';
  document.getElementById('profileForm').reset();
  bsModal.show();
}

function openEditModal(p) {
  document.getElementById('editId').value = p.id;
  document.getElementById('modalTitle').innerHTML = '<i class="bi bi-pencil-fill me-2"></i>Edit Member';

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
  // NEW Drive link fields
  set('fResumeLink',          p.resume_link);
  set('fDlLink',              p.dl_link);
  // Social
  set('fGithub',              p.github);
  set('fLinkedin',            p.linkedin);
  set('fPortfolio',           p.portfolio);
  // References
  const refs = Array.isArray(p.references) ? p.references : [];
  set('fReferences', refs.map(r =>
    [r.name, r.designation, r.company, r.email, r.phone, r.linkedin].join(' | ')
  ).join('\n'));

  bsModal.show();
}

async function handleSave() {
  const nameEl  = document.getElementById('fName');
  const emailEl = document.getElementById('fEmail');
  const name    = nameEl.value.trim();
  const email   = emailEl.value.trim();

  if (!name) { nameEl.focus();  toast('Full Name is required', 'warn'); return; }
  if (!email){ emailEl.focus(); toast('Email is required', 'warn');     return; }

  // Parse references
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
    // Drive links
    resume_link:          document.getElementById('fResumeLink').value.trim(),
    dl_link:              document.getElementById('fDlLink').value.trim(),
    // Social
    github:               document.getElementById('fGithub').value.trim(),
    linkedin:             document.getElementById('fLinkedin').value.trim(),
    portfolio:            document.getElementById('fPortfolio').value.trim(),
    references: refs
  };

  const editId = document.getElementById('editId').value;
  const id     = editId ? parseInt(editId) : null;

  // Spinner
  const spinner = document.getElementById('saveBtnSpinner');
  const saveBtn = document.getElementById('saveProfileBtn');
  spinner.classList.remove('d-none');
  saveBtn.disabled = true;

  try {
    const saved = await saveMember(payload, id);

    // Update local teamData
    if (id) {
      const idx = teamData.findIndex(m => m.id === id);
      if (idx !== -1) teamData[idx] = { ...teamData[idx], ...saved };
    } else {
      teamData.push(saved);
    }

    renderCards(document.getElementById('searchInput').value);
    updateStats();
    bsModal.hide();
    toast(id ? '✅ Member updated!' : '✅ Member added!', 'success');

    // Re-open profile panel if we just edited the open member
    if (id && currentMember && currentMember.id === id) {
      openProfile(id);
    } else if (!id) {
      openProfile(saved.id);
    }
  } catch (e) {
    toast('Error saving: ' + e.message, 'error');
  } finally {
    spinner.classList.add('d-none');
    saveBtn.disabled = false;
  }
}

async function handleDelete() {
  if (!currentMember) return;
  if (!confirm(`Delete ${currentMember.name}? This cannot be undone.`)) return;
  const id = currentMember.id;
  await deleteMemberAPI(id);
  closeProfile();
  renderCards(document.getElementById('searchInput').value);
  updateStats();
  toast('🗑️ Member deleted', 'info');
}

/* ══════════════════════════════════════════════════
   EVENT BINDINGS
══════════════════════════════════════════════════ */
function bindEvents() {
  // Search
  document.getElementById('searchInput').addEventListener('input', e => {
    renderCards(e.target.value);
    if (document.getElementById('profilePanel').classList.contains('open')) closeProfile();
  });
  document.getElementById('resetSearchBtn').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    renderCards('');
    if (document.getElementById('profilePanel').classList.contains('open')) closeProfile();
  });

  // Add new
  document.getElementById('addNewBtn').addEventListener('click', openAddModal);

  // Save
  document.getElementById('saveProfileBtn').addEventListener('click', handleSave);

  // Panel buttons
  document.getElementById('closePanelBtn').addEventListener('click', closeProfile);
  document.getElementById('editProfileBtn').addEventListener('click', () => {
    if (currentMember) openEditModal(currentMember);
  });
  document.getElementById('deleteProfileBtn').addEventListener('click', handleDelete);

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  // Theme
  document.getElementById('themeToggle').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyTheme(!isDark);
  });

  // Keyboard: Esc closes panel
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('profilePanel').classList.contains('open')) {
      closeProfile();
    }
  });

  // Reset form on modal close
  document.getElementById('profileModal').addEventListener('hidden.bs.modal', () => {
    document.getElementById('profileForm').reset();
  });
}

/* ══════════════════════════════════════════════════
   THEME
══════════════════════════════════════════════════ */
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const icon  = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (icon)  icon.className  = dark ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
  if (label) label.textContent = dark ? 'Light' : 'Dark';
  localStorage.setItem('tph_theme', dark ? 'dark' : 'light');
}

/* ══════════════════════════════════════════════════
   API STATUS
══════════════════════════════════════════════════ */
function setApiStatus(state, text) {
  const el = document.getElementById('apiStatus');
  if (!el) return;
  el.className = `api-status ${state}`;
  el.querySelector('.status-text').textContent = text;
}

/* ══════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════
   LOADING SKELETONS
══════════════════════════════════════════════════ */
function showSkeletons() {
  const grid = document.getElementById('teamGrid');
  grid.innerHTML = Array(6).fill(0).map(() => `
    <div class="skel-card">
      <div class="skeleton skel-line" style="width:40%;height:18px;margin-bottom:14px;"></div>
      <div class="skeleton skel-line" style="width:60%;"></div>
      <div class="skeleton skel-line" style="width:50%;"></div>
      <div class="skeleton skel-line" style="width:70%;"></div>
    </div>`).join('');
}

/* ══════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════ */
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

function escAttr(str) {
  return escHtml(str);
}

/* ══════════════════════════════════════════════════
   DEFAULT FALLBACK DATA  (browser only, no server)
══════════════════════════════════════════════════ */
function getDefaultFallback() {
  return [
    {
      id:1, name:'Nirav Patel', gmail:'Niravp1216@gmail.com', phone:'601-488-2998',
      address:'905 Waters Edge, Brandon, Mississippi 39047',
      education:'B.E. in Computer Science',
      last_company:'Centene Corporation',
      last_project:'Healthcare Cloud Migration & AI Integration',
      last_project_overview:'Led cloud migration projects and AI-driven workflows for healthcare claims and member management, ensuring HIPAA compliance and high availability.',
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
      references:[
        { name:'Vito Mantese', designation:'Team Lead', company:'Centene Corporation', email:'Not Available', phone:'+1 314-399-9771', linkedin:'linkedin.com/in/vito-mantese-3a7264140' },
        { name:'Amol Basargekar', designation:'Group Product Manager', company:'IntegriChain', email:'amol.basargekar@gmail.com', phone:'+1 954-555-0636', linkedin:'linkedin.com/in/amol-basargekar-8b66aa8' },
        { name:'Mrudula Vijayanarasimha', designation:'Sr. Software Engineer | AI Engineer', company:'Centene Corporation', email:'mrudula.v1712@gmail.com', phone:'+1 585-406-2642', linkedin:'linkedin.com/in/mrudulavijayanarasimha/' }
      ]
    },
    {
      id:2, name:'Dhaval Patel', gmail:'dhavalkumawat76@gmail.com', phone:'+1 (980)-215-9384',
      address:'116 Mackinac Drive, Mooresville, NC 28117',
      education:'B.E. in Computer Engineering',
      last_company:'NBCUniversal',
      last_project:'AI-Powered Clinical Trial Platform',
      last_project_overview:'Led development of cloud-native microservices and AI/LLM workflows for clinical data management, patient monitoring, and regulatory compliance.',
      tech_stack:'Python, FastAPI, AWS (Lambda, EKS, S3, DynamoDB), Terraform, Docker, LangChain, PyTorch, PostgreSQL, MongoDB, Redis',
      work_authorization:'U.S. Citizen', visa_type:'Citizenship (Naturalized)',
      green_card_date:'2019', green_card_how:'Marriage to U.S. citizen',
      w2_c2c_preference:'W2 preferred', ssn_last4:'6747',
      came_to_us_date:'2017', first_five_years_how:'Marriage-based Green Card in 2019, Citizenship in 2025',
      places_lived:'Mooresville, NC', current_location:'Mooresville, NC',
      total_companies:4, marriage_date:'2019', property_owned:'Not provided',
      dl_name:'Dhaval Patel', age:'33', total_experience:'8 years',
      resume_link:'', dl_link:'',
      github:'https://github.com/niravp1216-tech',
      linkedin:'https://www.linkedin.com/in/ai-expert-coder',
      portfolio:'https://dhavalpatel.tech',
      references:[]
    },
    {
      id:3, name:'Foram Patel', gmail:'foram.patel4932@gmail.com', phone:'(561) 342-1074',
      address:'Florida',
      education:'B.S./M.S. in Computer Science',
      last_company:'McKinsey & Company',
      last_project:'AI-Driven Healthcare RCM Platform',
      last_project_overview:'Architected agentic AI and ETL pipelines for healthcare Revenue Cycle Management, cutting claim resolution time from hours to minutes using multi-agent LLM workflows and RAG systems.',
      tech_stack:'Python, React, NestJS, FastAPI, Node.js, AWS, DynamoDB, Kubernetes, Terraform, LangChain, pgvector, Docker, Grafana',
      work_authorization:'U.S. Citizen', visa_type:'Citizenship',
      green_card_date:'Not provided', green_card_how:'Not provided',
      w2_c2c_preference:'Not provided', ssn_last4:'N/A',
      came_to_us_date:'Not provided', first_five_years_how:'Not provided',
      places_lived:'Not provided', current_location:'Florida',
      total_companies:4, marriage_date:'Not provided', property_owned:'Not provided',
      dl_name:'Foram Patel', age:'34', total_experience:'11+ years',
      resume_link:'', dl_link:'',
      github:'https://github.com/foram-p',
      linkedin:'https://www.linkedin.com/in/forampatel',
      portfolio:'https://forampatel.dev',
      references:[]
    },
    {
      id:4, name:'Rishabh Tiwari', gmail:'Rishabhstiwari1996@gmail.com', phone:'Not provided',
      address:'Not provided',
      education:'B.Tech in Computer Science & Engineering, Rajasthan Technical University',
      last_company:'WCG',
      last_project:'AI-Powered Anomaly Detection & Remediation',
      last_project_overview:'Architected secure multi-cloud infrastructure for an AI-powered anomaly detection platform using Terraform, deploying containerised microservices on AKS and OpenShift.',
      tech_stack:'AWS, Azure, GCP, Kubernetes, Helm, Terraform, Ansible, Jenkins, GitHub Actions, ArgoCD, Datadog, Prometheus, Grafana, ELK, Python, Bash, PostgreSQL',
      work_authorization:'Not specified', visa_type:'Not specified',
      green_card_date:'Not provided', green_card_how:'Not provided',
      w2_c2c_preference:'Not provided', ssn_last4:'N/A',
      came_to_us_date:'Not provided', first_five_years_how:'Not provided',
      places_lived:'Not provided', current_location:'Not provided',
      total_companies:5, marriage_date:'Not provided', property_owned:'Not provided',
      dl_name:'Rishabh Tiwari', age:'0', total_experience:'9+ years',
      resume_link:'', dl_link:'', github:'', linkedin:'', portfolio:'', references:[]
    },
    {
      id:5, name:'Ritu', gmail:'Not provided', phone:'Not provided',
      address:'Not provided', education:'Not specified',
      last_company:'Centene',
      last_project:'AI Platform Management & API Gateway',
      last_project_overview:'Leading development of enterprise and healthcare AI & Generative AI platforms, including a centralized API management platform.',
      tech_stack:'Python, Go, FastAPI, Flask, Django, AWS, GCP, Azure, Kubernetes, Docker, LangChain, FAISS, OpenSearch, Kafka, Airflow, Databricks, Snowflake',
      work_authorization:'Not specified', visa_type:'Not specified',
      green_card_date:'Not provided', green_card_how:'Not provided',
      w2_c2c_preference:'Not provided', ssn_last4:'N/A',
      came_to_us_date:'Not provided', first_five_years_how:'Not provided',
      places_lived:'Not provided', current_location:'Not provided',
      total_companies:5, marriage_date:'Not provided', property_owned:'Not provided',
      dl_name:'Ritu', age:'0', total_experience:'10.5 years',
      resume_link:'', dl_link:'', github:'', linkedin:'', portfolio:'', references:[]
    },
    {
      id:6, name:'Hridesh Sharma', gmail:'Not provided', phone:'Not provided',
      address:'Not provided',
      education:'B.Tech in Computer Science',
      last_company:'Brudite Private Limited',
      last_project:'AI-Powered Slack Workflow Automation',
      last_project_overview:'Led design and development of custom Slack applications with OAuth 2.0, RBAC, interactive components, and AI-powered workflows integrating GPT-4 and Claude via LangChain and MCP servers.',
      tech_stack:'Python, Node.js, Go, FastAPI, Slack Bolt SDK, OAuth 2.0, LangChain, GPT-4, Claude, RAG, Vector DB, PostgreSQL, MongoDB, AWS, GCP, Terraform',
      work_authorization:'Not specified', visa_type:'Not specified',
      green_card_date:'Not provided', green_card_how:'Not provided',
      w2_c2c_preference:'Not provided', ssn_last4:'N/A',
      came_to_us_date:'Not provided', first_five_years_how:'Not provided',
      places_lived:'Not provided', current_location:'Not provided',
      total_companies:6, marriage_date:'Not provided', property_owned:'Not provided',
      dl_name:'Hridesh Sharma', age:'0', total_experience:'6+ years',
      resume_link:'', dl_link:'', github:'', linkedin:'', portfolio:'', references:[]
    },
  ];
}
