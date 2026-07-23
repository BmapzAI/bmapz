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
      supabaseAdmin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active').neq('plan', 'trial'),
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

// POST /api/admin/grant-credits — manually grant credits to a company.
// If the company has no subscription yet, auto-creates a trial sub then grants.
router.post('/grant-credits', async (req, res) => {
  try {
    const { company_id, amount, reason } = req.body;
    if (!company_id || !amount) {
      return res.status(400).json({ error: 'company_id and amount are required' });
    }

    let { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('id, ai_credits_total, ai_credits_used')
      .eq('company_id', company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // No subscription → auto-create a trialing one so the grant can land
    if (!sub) {
      const trialEnds = new Date(Date.now() + 14 * 86400_000).toISOString();
      const { data: newSub, error: createErr } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          company_id,
          plan_id: 'trial',
          status: 'trialing',
          ai_credits_total: 0,
          ai_credits_used: 0,
          trial_ends_at: trialEnds,
        })
        .select()
        .single();
      if (createErr) return res.status(500).json({ error: `Failed to create subscription: ${createErr.message}` });
      sub = newSub;
    }

    const newTotal = (sub.ai_credits_total || 0) + amount;
    await supabaseAdmin.from('subscriptions').update({ ai_credits_total: newTotal }).eq('id', sub.id);

    await supabaseAdmin.from('credit_transactions').insert({
      company_id,
      type: 'bonus',
      feature: reason || 'admin_bonus',
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

// ─── Admin Company CRUD ───────────────────────────────────────────────────────

router.post('/companies', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .insert(req.body)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/companies/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/companies/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('companies')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin Subscription CRUD ──────────────────────────────────────────────────

router.get('/subscriptions', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/subscriptions', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .insert(req.body)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/subscriptions/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin Billing Purchases ──────────────────────────────────────────────────

router.get('/purchases', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('billing_purchases')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/purchases/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('billing_purchases')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin User CRUD ──────────────────────────────────────────────────────────

const ADMIN_ROLES = new Set(['owner', 'system_admin', 'company_admin', 'user']);

router.patch('/users/:id', async (req, res) => {
  try {
    const { role, full_name, profile_picture } = req.body || {};
    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (profile_picture !== undefined) updates.profile_picture = profile_picture;

    if (role !== undefined) {
      if (!ADMIN_ROLES.has(role)) return res.status(400).json({ error: 'Invalid role' });
      const { data: target, error: targetError } = await supabaseAdmin
        .from('users')
        .select('id, role')
        .eq('id', req.params.id)
        .single();
      if (targetError) throw targetError;
      // The UI mirrors this policy, but the backend is the real authorization boundary.
      if (target.role === 'owner') {
        return res.status(403).json({ error: 'Existing Owners cannot be changed from this panel' });
      }
      if (req.dbUser.role === 'system_admin' && ['owner', 'system_admin'].includes(role)) {
        return res.status(403).json({ error: 'Only an Owner can grant internal admin roles' });
      }
      updates.role = role;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No supported user fields supplied' });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin Data Deletion Requests ─────────────────────────────────────────────

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

// GET /api/admin/usage-stats — system-wide AI credit consumption breakdown
// Returns: totals + per-company + per-user + per-model
router.get('/usage-stats', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - Number(days) * 86400_000).toISOString();

    // All usage transactions in window
    const { data: txs } = await supabaseAdmin
      .from('credit_transactions')
      .select('*')
      .eq('type', 'usage')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    const transactions = txs || [];

    // Aggregate
    const byCompany = {};
    const byUser = {};
    const byModel = {};
    const byFeature = {};
    let totalCredits = 0;
    let totalTokens = 0;

    for (const tx of transactions) {
      const credits = Math.abs(tx.credits_delta || 0);
      const tokens = tx.metadata?.tokens || 0;
      totalCredits += credits;
      totalTokens += tokens;

      byCompany[tx.company_id] = (byCompany[tx.company_id] || 0) + credits;
      const ue = tx.metadata?.user_email || 'unknown';
      byUser[ue] = (byUser[ue] || 0) + credits;
      const m = tx.metadata?.model || 'unknown';
      byModel[m] = (byModel[m] || 0) + credits;
      const f = tx.feature || 'unknown';
      byFeature[f] = (byFeature[f] || 0) + credits;
    }

    // Join company names for the byCompany breakdown
    const companyIds = Object.keys(byCompany);
    const { data: companies } = companyIds.length > 0
      ? await supabaseAdmin.from('companies').select('id, name').in('id', companyIds)
      : { data: [] };
    const nameById = Object.fromEntries((companies || []).map(c => [c.id, c.name]));

    const byCompanyList = Object.entries(byCompany)
      .map(([id, credits]) => ({ company_id: id, company_name: nameById[id] || '(deleted)', credits }))
      .sort((a, b) => b.credits - a.credits);
    const byUserList = Object.entries(byUser).map(([email, credits]) => ({ user_email: email, credits })).sort((a, b) => b.credits - a.credits);
    const byModelList = Object.entries(byModel).map(([model, credits]) => ({ model, credits })).sort((a, b) => b.credits - a.credits);
    const byFeatureList = Object.entries(byFeature).map(([feature, credits]) => ({ feature, credits })).sort((a, b) => b.credits - a.credits);

    res.json({
      window_days: Number(days),
      total_credits_consumed: totalCredits,
      total_tokens: totalTokens,
      total_transactions: transactions.length,
      by_company: byCompanyList,
      by_user: byUserList,
      by_model: byModelList,
      by_feature: byFeatureList,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/usage-stats/company/:companyId — detail for one company
router.get('/usage-stats/company/:companyId', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - Number(days) * 86400_000).toISOString();

    const { data: txs } = await supabaseAdmin
      .from('credit_transactions')
      .select('*')
      .eq('company_id', req.params.companyId)
      .eq('type', 'usage')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    const transactions = txs || [];
    const byUser = {};
    const byModel = {};
    const byFeature = {};
    let totalCredits = 0;
    let totalTokens = 0;
    for (const tx of transactions) {
      const credits = Math.abs(tx.credits_delta || 0);
      totalCredits += credits;
      totalTokens += tx.metadata?.tokens || 0;
      const ue = tx.metadata?.user_email || 'unknown';
      byUser[ue] = (byUser[ue] || 0) + credits;
      const m = tx.metadata?.model || 'unknown';
      byModel[m] = (byModel[m] || 0) + credits;
      const f = tx.feature || 'unknown';
      byFeature[f] = (byFeature[f] || 0) + credits;
    }

    res.json({
      company_id: req.params.companyId,
      window_days: Number(days),
      total_credits_consumed: totalCredits,
      total_tokens: totalTokens,
      total_transactions: transactions.length,
      transactions,
      by_user: Object.entries(byUser).map(([email, credits]) => ({ user_email: email, credits })).sort((a, b) => b.credits - a.credits),
      by_model: Object.entries(byModel).map(([model, credits]) => ({ model, credits })).sort((a, b) => b.credits - a.credits),
      by_feature: Object.entries(byFeature).map(([feature, credits]) => ({ feature, credits })).sort((a, b) => b.credits - a.credits),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
