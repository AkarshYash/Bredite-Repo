const express = require('express');
const router  = express.Router();
const { supabase, supabaseAdmin } = require('../supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const store = require('../store');

// ── POST /api/pending-changes ────── (Submit change: MEMBER or ADMIN) ──
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { change_type, target_member_id, payload } = req.body;
    if (!['create', 'update', 'delete'].includes(change_type)) {
      return res.status(400).json({ error: 'change_type must be create, update, or delete.' });
    }
    if (change_type !== 'create' && !target_member_id) {
      return res.status(400).json({ error: 'target_member_id is required for update or delete.' });
    }

    const cleanPayload = payload && typeof payload === 'object' ? payload : {};
    const submitterEmail = req.profile.email || req.user.email;
    const submitterId = req.user.id;

    const dbClient = supabaseAdmin || supabase;
    if (!dbClient) {
      const newId = store.getMemPending().length ? Math.max(...store.getMemPending().map(p => p.id)) + 1 : 1;
      const pendingObj = {
        id: newId,
        change_type,
        target_member_id: target_member_id ? parseInt(target_member_id, 10) : null,
        payload: cleanPayload,
        submitted_by: submitterId,
        submitted_by_email: submitterEmail,
        submitted_at: new Date().toISOString(),
        status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
        admin_note: ''
      };
      store.getMemPending().unshift(pendingObj);
      store.logAuditInMemory('submit_pending_change', submitterEmail, newId, null, pendingObj);
      return res.status(201).json({ data: pendingObj });
    }

    const { data, error } = await dbClient
      .from('pending_changes')
      .insert([{
        change_type,
        target_member_id: target_member_id ? parseInt(target_member_id, 10) : null,
        payload: cleanPayload,
        submitted_by: submitterId,
        submitted_by_email: submitterEmail,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await dbClient.from('audit_log').insert([{
      action_type: 'submit_pending_change',
      actor: submitterEmail,
      target_record: String(data.id),
      after_value: data
    }]);

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/pending-changes ────── (List: ADMIN all, MEMBER own) ────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const isAdmin = req.profile.role === 'ADMIN';
    const userId = req.user.id;

    const dbClient = supabaseAdmin || supabase;
    if (!dbClient) {
      const list = store.getMemPending().filter(p => isAdmin || p.submitted_by === userId);
      return res.json({ data: list });
    }

    let query = dbClient.from('pending_changes').select('*').order('submitted_at', { ascending: false });
    if (!isAdmin) {
      query = query.eq('submitted_by', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/pending-changes/:id/approve ── (Approve: ADMIN only) ────
router.post('/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const adminEmail = req.profile.email || req.user.email;
    const adminId = req.user.id;
    const adminNote = (req.body.admin_note || req.body.adminNote || 'Approved by Admin').trim();

    const dbClient = supabaseAdmin || supabase;

    // Offline / Demo mode execution
    if (!dbClient) {
      const pending = store.getMemPending().find(p => p.id === id);
      if (!pending) return res.status(404).json({ error: 'Pending change not found.' });
      if (pending.status !== 'pending') return res.status(400).json({ error: `Change already ${pending.status}.` });

      let beforeVal = null;
      let afterVal = null;

      if (pending.change_type === 'create') {
        const newId = store.getMemMembers().length ? Math.max(...store.getMemMembers().map(m => m.id)) + 1 : 1;
        afterVal = { id: newId, ...pending.payload, created_at: new Date().toISOString() };
        store.getMemMembers().push(afterVal);
      } else if (pending.change_type === 'update') {
        const idx = store.getMemMembers().findIndex(m => m.id === pending.target_member_id);
        if (idx !== -1) {
          beforeVal = { ...store.getMemMembers()[idx] };
          store.getMemMembers()[idx] = { ...store.getMemMembers()[idx], ...pending.payload };
          afterVal = store.getMemMembers()[idx];
        }
      } else if (pending.change_type === 'delete') {
        const idx = store.getMemMembers().findIndex(m => m.id === pending.target_member_id);
        if (idx !== -1) {
          beforeVal = store.getMemMembers()[idx];
          store.setMemMembers(store.getMemMembers().filter(m => m.id !== pending.target_member_id));
        }
      }

      pending.status = 'approved';
      pending.reviewed_by = adminId;
      pending.reviewed_at = new Date().toISOString();
      pending.admin_note = adminNote;

      store.logAuditInMemory('approve_change', adminEmail, id, beforeVal, { pending, appliedResult: afterVal });
      return res.json({ message: 'Change approved and applied successfully', data: pending });
    }

    // Supabase DB execution
    const { data: pending, error: pErr } = await dbClient
      .from('pending_changes')
      .select('*')
      .eq('id', id)
      .single();

    if (pErr || !pending) return res.status(404).json({ error: 'Pending change not found.' });
    if (pending.status !== 'pending') return res.status(400).json({ error: `Change already ${pending.status}.` });

    let beforeVal = null;
    let afterVal = null;

    if (pending.change_type === 'create') {
      const { data: created, error: cErr } = await dbClient.from('members').insert([pending.payload]).select().single();
      if (cErr) throw cErr;
      afterVal = created;
    } else if (pending.change_type === 'update') {
      const { data: bData } = await dbClient.from('members').select('*').eq('id', pending.target_member_id).single();
      beforeVal = bData;
      const { data: updated, error: uErr } = await dbClient.from('members').update(pending.payload).eq('id', pending.target_member_id).select().single();
      if (uErr) throw uErr;
      afterVal = updated;
    } else if (pending.change_type === 'delete') {
      const { data: bData } = await dbClient.from('members').select('*').eq('id', pending.target_member_id).single();
      beforeVal = bData;
      const { error: dErr } = await dbClient.from('members').delete().eq('id', pending.target_member_id);
      if (dErr) throw dErr;
    }

    const { data: updatedPending, error: upErr } = await dbClient
      .from('pending_changes')
      .update({
        status: 'approved',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        admin_note: adminNote
      })
      .eq('id', id)
      .select()
      .single();

    if (upErr) throw upErr;

    // Log audit
    await dbClient.from('audit_log').insert([{
      action_type: 'approve_change',
      actor: adminEmail,
      target_record: String(id),
      before_value: beforeVal,
      after_value: { pending: updatedPending, applied: afterVal }
    }]);

    res.json({ message: 'Change approved and applied successfully', data: updatedPending });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/pending-changes/:id/reject ── (Reject: ADMIN only) ────
router.post('/:id/reject', requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const adminEmail = req.profile.email || req.user.email;
    const adminId = req.user.id;
    const adminNote = (req.body.admin_note || req.body.adminNote || 'Rejected by Admin').trim();

    const dbClient = supabaseAdmin || supabase;

    if (!dbClient) {
      const pending = store.getMemPending().find(p => p.id === id);
      if (!pending) return res.status(404).json({ error: 'Pending change not found.' });
      if (pending.status !== 'pending') return res.status(400).json({ error: `Change already ${pending.status}.` });

      pending.status = 'rejected';
      pending.reviewed_by = adminId;
      pending.reviewed_at = new Date().toISOString();
      pending.admin_note = adminNote;

      store.logAuditInMemory('reject_change', adminEmail, id, null, pending);
      return res.json({ message: 'Change rejected', data: pending });
    }

    const { data: pending, error: pErr } = await dbClient
      .from('pending_changes')
      .select('*')
      .eq('id', id)
      .single();

    if (pErr || !pending) return res.status(404).json({ error: 'Pending change not found.' });
    if (pending.status !== 'pending') return res.status(400).json({ error: `Change already ${pending.status}.` });

    const { data: updatedPending, error: upErr } = await dbClient
      .from('pending_changes')
      .update({
        status: 'rejected',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        admin_note: adminNote
      })
      .eq('id', id)
      .select()
      .single();

    if (upErr) throw upErr;

    // Log audit
    await dbClient.from('audit_log').insert([{
      action_type: 'reject_change',
      actor: adminEmail,
      target_record: String(id),
      before_value: pending,
      after_value: updatedPending
    }]);

    res.json({ message: 'Change rejected', data: updatedPending });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
