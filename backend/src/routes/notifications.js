/**
 * Notifications API — list, unread count, mark read, mark all read, delete.
 * Company-scoped; a null user_id notification is visible to the whole company.
 */
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/notifications?limit=&unread=
router.get('/', requireAuth, async (req, res) => {
  try {
    const { limit = 50, unread } = req.query;
    let q = supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .limit(Math.min(200, Number(limit) || 50));
    if (unread === 'true') q = q.eq('read', false);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', req.companyId)
      .eq('read', false);
    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id  (mark read/unread)
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ read: req.body.read !== false })
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/read-all
router.post('/read-all', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('company_id', req.companyId)
      .eq('read', false);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
