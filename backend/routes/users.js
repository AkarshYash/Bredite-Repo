const express = require('express');
const router  = express.Router();
const { supabase, supabaseAdmin } = require('../supabase');
const { requireAdmin } = require('../middleware/auth');
const store = require('../store');

// ── GET /api/users ────────────────── (ADMIN only) ───────────────────
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const dbClient = supabaseAdmin || supabase;
    if (!dbClient) {
      return res.json({ data: store.getMemProfiles() });
    }

    const { data, error } = await dbClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/users/:id/role ───────── (ADMIN only: role promotion) ───
router.put('/:id/role', requireAdmin, async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    const { role } = req.body;

    if (!['ADMIN', 'MEMBER'].includes(role)) {
      return res.status(400).json({ error: 'Role must be ADMIN or MEMBER.' });
    }

    const adminEmail = req.profile.email || req.user.email;

    const dbClient = supabaseAdmin || supabase;
    if (!dbClient) {
      const idx = store.getMemProfiles().findIndex(p => p.id === targetUserId);
      if (idx === -1) return res.status(404).json({ error: 'User profile not found.' });

      const beforeVal = { ...store.getMemProfiles()[idx] };
      store.getMemProfiles()[idx].role = role;
      const afterVal = store.getMemProfiles()[idx];

      store.logAuditInMemory('promote_user', adminEmail, targetUserId, beforeVal, afterVal);
      return res.json({ message: `Role updated to ${role}`, data: afterVal });
    }

    const { data: beforeData } = await dbClient
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single();

    const { data: updatedProfile, error } = await dbClient
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', targetUserId)
      .select()
      .single();

    if (error) return res.status(404).json({ error: 'User profile not found.' });

    // Log audit
    await dbClient.from('audit_log').insert([{
      action_type: 'promote_user',
      actor: adminEmail,
      target_record: targetUserId,
      before_value: beforeData,
      after_value: updatedProfile
    }]);

    res.json({ message: `Role updated to ${role}`, data: updatedProfile });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
