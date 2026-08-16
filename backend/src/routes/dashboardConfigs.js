import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { sanitizeUpdate } from '../lib/safeUpdate.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { company_id, user_id } = req.query;
    let query = supabaseAdmin
      .from('dashboard_configs')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });

    if (user_id) query = query.eq('user_id', user_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('dashboard_configs')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Dashboard config not found' });
  }
});

/** The only fields a client may set. Anything else is server-owned. */
const WRITABLE_DASHBOARD = ['name', 'widgets', 'layout', 'is_default'];
const pickDashboard = (body) => Object.fromEntries(
  Object.entries(body || {}).filter(([k]) => WRITABLE_DASHBOARD.includes(k)),
);

router.post('/', requireAuth, async (req, res) => {
  try {
    // Whitelisted, matching what the PATCH below already guards. The spread let a
    // caller set id, user_id or created_at on insert — the PATCH refused exactly
    // those, so the two halves of the same resource disagreed.
    const { data, error } = await supabaseAdmin
      .from('dashboard_configs')
      .insert({ ...pickDashboard(req.body), company_id: req.companyId, user_id: req.dbUser?.id || null })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('dashboard_configs')
      // sanitizeUpdate strips company_id/id/is_global: .eq('company_id') limits
      // WHICH row is updated, not what the SET clause may contain.
      .update(sanitizeUpdate(req.body))
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

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('dashboard_configs')
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
