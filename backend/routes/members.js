const express = require('express');
const router  = express.Router();
const { supabase, supabaseAdmin } = require('../supabase');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const store = require('../store');

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
    resume_link:           (body.resume_link           || body.resumeLink || '').toString().trim().slice(0, 500),
    dl_link:               (body.dl_link               || body.dlLink || '').toString().trim().slice(0, 500),
    github:                (body.github                || '').toString().trim().slice(0, 300),
    linkedin:              (body.linkedin              || '').toString().trim().slice(0, 300),
    portfolio:             (body.portfolio             || '').toString().trim().slice(0, 300),
    references:            Array.isArray(body.references) ? body.references.slice(0, 20) : []
  };
}

// ── GET /api/members ─────────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const dbClient = supabaseAdmin || supabase;
    if (!dbClient) {
      return res.json({ data: store.getMemMembers(), source: 'memory' });
    }
    const { data, error } = await dbClient
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
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const dbClient = supabaseAdmin || supabase;
    if (!dbClient) {
      const member = store.getMemMembers().find(m => m.id === id);
      if (!member) return res.status(404).json({ error: 'Member not found' });
      return res.json({ data: member });
    }
    const { data, error } = await dbClient
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

// ── POST /api/members ────────────── (Direct create: ADMIN only) ─────
router.post('/', requireAuth, async (req, res, next) => {
  try {
    // If not ADMIN, reject direct mutation
    if (req.profile.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Forbidden: Members cannot modify profiles directly. Please submit your change for admin approval via /api/pending-changes.',
        isMember: true
      });
    }

    const { name, gmail } = req.body;
    if (!name || !gmail) {
      return res.status(400).json({ error: 'name and gmail are required' });
    }
    const payload = sanitize(req.body);
    const actorEmail = req.profile.email || req.user.email;

    const dbClient = supabaseAdmin || supabase;
    if (!dbClient) {
      const newId = store.getMemMembers().length ? Math.max(...store.getMemMembers().map(m => m.id)) + 1 : 1;
      const newMember = { id: newId, ...payload, created_at: new Date().toISOString() };
      store.getMemMembers().push(newMember);
      store.logAuditInMemory('create_member', actorEmail, newId, null, newMember);
      return res.status(201).json({ data: newMember });
    }

    const { data, error } = await dbClient
      .from('members')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;

    // Log audit
    await dbClient.from('audit_log').insert([{
      action_type: 'create_member',
      actor: actorEmail,
      target_record: String(data.id),
      after_value: data
    }]);

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/members/:id ─────────── (Direct update: ADMIN only) ─────
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.profile.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Forbidden: Members cannot modify profiles directly. Please submit your change for admin approval via /api/pending-changes.',
        isMember: true
      });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const payload = sanitize(req.body);
    const actorEmail = req.profile.email || req.user.email;

    const dbClient = supabaseAdmin || supabase;
    if (!dbClient) {
      const idx = store.getMemMembers().findIndex(m => m.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Member not found' });
      const beforeVal = { ...store.getMemMembers()[idx] };
      store.getMemMembers()[idx] = { ...store.getMemMembers()[idx], ...payload };
      store.logAuditInMemory('update_member', actorEmail, id, beforeVal, store.getMemMembers()[idx]);
      return res.json({ data: store.getMemMembers()[idx] });
    }

    const { data: beforeData } = await dbClient.from('members').select('*').eq('id', id).single();
    const { data, error } = await dbClient
      .from('members')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(404).json({ error: 'Member not found' });

    // Log audit
    await dbClient.from('audit_log').insert([{
      action_type: 'update_member',
      actor: actorEmail,
      target_record: String(id),
      before_value: beforeData,
      after_value: data
    }]);

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/members/:id ──────── (Direct delete: ADMIN only) ─────
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.profile.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Forbidden: Members cannot modify profiles directly. Please submit your change for admin approval via /api/pending-changes.',
        isMember: true
      });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const actorEmail = req.profile.email || req.user.email;

    const dbClient = supabaseAdmin || supabase;
    if (!dbClient) {
      const idx = store.getMemMembers().findIndex(m => m.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Member not found' });
      const deletedVal = store.getMemMembers()[idx];
      store.setMemMembers(store.getMemMembers().filter(m => m.id !== id));
      store.logAuditInMemory('delete_member', actorEmail, id, deletedVal, null);
      return res.json({ message: 'Deleted successfully' });
    }

    const { data: beforeData } = await dbClient.from('members').select('*').eq('id', id).single();
    const { error } = await dbClient.from('members').delete().eq('id', id);
    if (error) return res.status(404).json({ error: 'Member not found' });

    // Log audit
    await dbClient.from('audit_log').insert([{
      action_type: 'delete_member',
      actor: actorEmail,
      target_record: String(id),
      before_value: beforeData,
      after_value: null
    }]);

    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
