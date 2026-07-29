const express = require('express');
const router  = express.Router();
const supabase = require('../supabase');

// ── In-memory fallback (used when Supabase is not configured) ─────────
let memStore = require('../defaultData');

// ── Helper: normalise a member object coming from the request body ───
function sanitize(body) {
  return {
    name:                  (body.name                  || '').toString().trim().slice(0, 120),
    gmail:                 (body.gmail                 || '').toString().trim().slice(0, 200),
    phone:                 (body.phone                 || '').toString().trim().slice(0, 30),
    address:               (body.address               || '').toString().trim().slice(0, 300),
    age:                   body.age          != null ? String(body.age).slice(0,10)  : '',
    education:             (body.education             || '').toString().trim().slice(0, 200),
    dl_name:               (body.dl_name               || body.dlName || '').toString().trim().slice(0, 120),
    marriage_date:         (body.marriage_date         || body.marriageDate || '').toString().trim().slice(0, 30),
    property_owned:        (body.property_owned        || body.propertyOwned || '').toString().trim().slice(0, 200),
    visa_type:             (body.visa_type             || body.visaType || '').toString().trim().slice(0, 80),
    work_authorization:    (body.work_authorization    || body.workAuthorization || '').toString().trim().slice(0, 80),
    green_card_date:       (body.green_card_date       || body.greenCardDate || '').toString().trim().slice(0, 30),
    green_card_how:        (body.green_card_how        || body.greenCardHow || '').toString().trim().slice(0, 300),
    w2_c2c_preference:     (body.w2_c2c_preference     || body.w2C2cPreference || '').toString().trim().slice(0, 100),
    ssn_last4:             (body.ssn_last4             || body.ssnLast4 || '').toString().trim().slice(0, 4),
    last_company:          (body.last_company          || body.lastCompany || '').toString().trim().slice(0, 200),
    total_experience:      (body.total_experience      || body.totalExperience || '').toString().trim().slice(0, 50),
    total_companies:       parseInt(body.total_companies ?? body.totalCompanies ?? 0, 10) || 0,
    last_project:          (body.last_project          || body.lastProject || '').toString().trim().slice(0, 300),
    last_project_overview: (body.last_project_overview || body.lastProjectOverview || '').toString().trim().slice(0, 2000),
    tech_stack:            (body.tech_stack            || body.techStack || '').toString().trim().slice(0, 1000),
    came_to_us_date:       (body.came_to_us_date       || body.cameToUSDate || '').toString().trim().slice(0, 30),
    first_five_years_how:  (body.first_five_years_how  || body.firstFiveYearsHow || '').toString().trim().slice(0, 500),
    places_lived:          (body.places_lived          || body.placesLived || '').toString().trim().slice(0, 500),
    current_location:      (body.current_location      || body.currentLocation || '').toString().trim().slice(0, 200),
    // Drive links (the new fields)
    resume_link:           (body.resume_link           || body.resumeLink || '').toString().trim().slice(0, 500),
    dl_link:               (body.dl_link               || body.dlLink || '').toString().trim().slice(0, 500),
    // Social
    github:                (body.github                || '').toString().trim().slice(0, 300),
    linkedin:              (body.linkedin              || '').toString().trim().slice(0, 300),
    portfolio:             (body.portfolio             || '').toString().trim().slice(0, 300),
    // References: array stored as JSONB
    references:            Array.isArray(body.references) ? body.references.slice(0, 20) : []
  };
}

// ── GET /api/members ─────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    if (!supabase) {
      return res.json({ data: memStore, source: 'memory' });
    }
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    res.json({ data, source: 'supabase' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/members/:id ─────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    if (!supabase) {
      const member = memStore.find(m => m.id === id);
      if (!member) return res.status(404).json({ error: 'Member not found' });
      return res.json({ data: member });
    }
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return res.status(404).json({ error: 'Member not found' });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/members ────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { name, gmail } = req.body;
    if (!name || !gmail) {
      return res.status(400).json({ error: 'name and gmail are required' });
    }
    const payload = sanitize(req.body);

    if (!supabase) {
      const newId = memStore.length ? Math.max(...memStore.map(m => m.id)) + 1 : 1;
      const newMember = { id: newId, ...payload, created_at: new Date().toISOString() };
      memStore.push(newMember);
      return res.status(201).json({ data: newMember });
    }
    const { data, error } = await supabase
      .from('members')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/members/:id ─────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const payload = sanitize(req.body);

    if (!supabase) {
      const idx = memStore.findIndex(m => m.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Member not found' });
      memStore[idx] = { ...memStore[idx], ...payload };
      return res.json({ data: memStore[idx] });
    }
    const { data, error } = await supabase
      .from('members')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(404).json({ error: 'Member not found' });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/members/:id ──────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    if (!supabase) {
      const before = memStore.length;
      memStore = memStore.filter(m => m.id !== id);
      if (memStore.length === before) return res.status(404).json({ error: 'Member not found' });
      return res.json({ message: 'Deleted successfully' });
    }
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) return res.status(404).json({ error: 'Member not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
