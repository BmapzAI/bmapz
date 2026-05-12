import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// All admin routes require system_admin or owner role
router.use(requireAuth, requireAdmin);

// GET /api/admin/companies — list all companies
router.get('/companies', async (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;
    let query = supabaseAdmin
      .from('companies')
      .select('*, subscriptions(plan, status, ai_credits_total, ai_credits_used)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (search) query = query.ilike('name', `%${search}%`);
    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users — list all users
router.get('/users', async (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;
    let query = supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [
      { count: totalCompanies },
      { count: totalUsers },
      { count: totalLeads },
      { count: activeSubscriptions },
    ] = await Promise.all([
      supabaseAdmin.from('companies').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active').neq('plan', 'free'),
    ]);

    res.json({ totalCompanies, totalUsers, totalLeads, activeSubscriptions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/change-logs
router.get('/change-logs', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const { data, error } = await supabaseAdmin
      .from('admin_change_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/grant-credits — manually grant credits to a company
router.post('/grant-credits', async (req, res) => {
  try {
    const { company_id, amount, reason } = req.body;

    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('id, ai_credits_total, ai_credits_used')
      .eq('company_id', company_id)
      .single();

    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    const newTotal = (sub.ai_credits_total || 0) + amount;
    await supabaseAdmin.from('subscriptions').update({ ai_credits_total: newTotal }).eq('id', sub.id);

    await supabaseAdmin.from('credit_transactions').insert({
      company_id,
      type: 'admin_grant',
      feature: reason || 'admin_grant',
      credits_delta: amount,
      credits_after: newTotal - (sub.ai_credits_used || 0),
    });

    await supabaseAdmin.from('admin_change_logs').insert({
      performed_by_email: req.dbUser.email,
      action_type: 'grant_credits',
      target_type: 'company',
      target_id: company_id,
      details: { amount, reason },
    });

    res.json({ success: true, new_total: newTotal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/data-deletion-requests
router.get('/data-deletion-requests', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('data_deletion_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
