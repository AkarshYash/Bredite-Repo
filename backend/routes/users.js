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

// ── PUT /api/users/:id/role ───────── (ADMIN only: user approval & role management)
router.put('/:id/role', requireAdmin, async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    const { role } = req.body;

    const validRoles = ['ADMIN', 'MEMBER', 'PENDING', 'REJECTED'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${validRoles.join(', ')}.` });
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
      return res.json({ message: `User role updated to ${role}`, data: afterVal });
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

    res.json({ message: `User role updated to ${role}`, data: updatedProfile });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/users/:id ─────────── (ADMIN only: reject/delete registration)
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    const adminEmail = req.profile.email || req.user.email;

    const dbClient = supabaseAdmin || supabase;
    if (!dbClient) {
      const idx = store.getMemProfiles().findIndex(p => p.id === targetUserId);
      if (idx === -1) return res.status(404).json({ error: 'User profile not found.' });

      const deletedVal = store.getMemProfiles()[idx];
      store.setMemProfiles(store.getMemProfiles().filter(p => p.id !== targetUserId));
      store.logAuditInMemory('delete_user', adminEmail, targetUserId, deletedVal, null);
      return res.json({ message: 'User registration deleted successfully.' });
    }

    const { data: beforeData } = await dbClient.from('profiles').select('*').eq('id', targetUserId).single();
    const { error } = await dbClient.from('profiles').delete().eq('id', targetUserId);
    if (error) return res.status(404).json({ error: 'User profile not found.' });

    await dbClient.from('audit_log').insert([{
      action_type: 'delete_user',
      actor: adminEmail,
      target_record: targetUserId,
      before_value: beforeData,
      after_value: null
    }]);

    res.json({ message: 'User registration deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
