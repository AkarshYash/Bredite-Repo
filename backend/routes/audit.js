const express = require('express');
const router  = express.Router();
const { supabase, supabaseAdmin } = require('../supabase');
const { requireAdmin } = require('../middleware/auth');
const store = require('../store');

// ── GET /api/audit-log ────────────── (Filterable: ADMIN only) ───────
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { actor, action_type, date_from, date_to, limit } = req.query;
    const maxLimit = Math.min(parseInt(limit || '100', 10), 500);

    const dbClient = supabaseAdmin || supabase;
    if (!dbClient) {
      let list = [...store.getMemAudit()];
      if (actor) {
        list = list.filter(a => (a.actor || '').toLowerCase().includes(actor.toLowerCase()));
      }
      if (action_type) {
        list = list.filter(a => a.action_type === action_type);
      }
      if (date_from) {
        list = list.filter(a => new Date(a.timestamp) >= new Date(date_from));
      }
      if (date_to) {
        list = list.filter(a => new Date(a.timestamp) <= new Date(date_to));
      }
      return res.json({ data: list.slice(0, maxLimit) });
    }

    let query = dbClient
      .from('audit_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(maxLimit);

    if (actor) query = query.ilike('actor', `%${actor}%`);
    if (action_type) query = query.eq('action_type', action_type);
    if (date_from) query = query.gte('timestamp', date_from);
    if (date_to) query = query.lte('timestamp', date_to);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
