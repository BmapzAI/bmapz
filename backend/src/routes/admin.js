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

// GET /api/admin/accounts — the reseller/parent "accounts" a user can be
// assigned to. The table shipped in the initial schema and the Admin Panel's
// "Set Account" dialog reads it, but no endpoint ever served it, so that
// dropdown was permanently empty.
router.get('/accounts', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('accounts')
      .select('id, name, owner_email, status, company_ids')
      .order('name', { ascending: true });
    if (error) {
      if (/accounts|relation|does not exist/i.test(error.message || '')) return res.json({ data: [] });
      throw error;
    }
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Brain insights (App Owner ONLY) ─────────────────────────────────────────
// The full cross-company view of what the brain has learned. requireAdmin
// already gates to owner/system_admin; this endpoint additionally requires
// role === 'owner' — "only App owners have access to all the information
// within the company brain".
router.get('/brain-insights', async (req, res) => {
  try {
    if (req.dbUser.role !== 'owner') {
      return res.status(403).json({ error: 'Owner access required' });
    }
    const { data, error } = await supabaseAdmin
      .from('brain_learnings')
      .select('*, company:company_id (id, name)')
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) {
      if (/brain_learnings|relation|does not exist/i.test(error.message || '')) {
        return res.json({ data: [], note: 'Run migration 019 to enable brain learning.' });
      }
      throw error;
    }
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin User CRUD ──────────────────────────────────────────────────────────

const ADMIN_ROLES = new Set(['owner', 'system_admin', 'company_admin', 'user']);

// POST /api/admin/invite — invite a user into a SPECIFIC company.
// Internal roles (owner/system_admin) can never be granted via invite — they
// are assigned afterwards through PATCH /users/:id, which enforces the
// platform-company restriction. Invites cap at customer roles.
router.post('/invite', async (req, res) => {
  try {
    const { email, full_name, company_id } = req.body || {};
    if (!email || !company_id) {
      return res.status(400).json({ error: 'email and company_id are required' });
    }
    const role = ['company_admin', 'user'].includes(req.body.role) ? req.body.role : 'user';

    // Verify the company exists so a typo'd id can't create orphan users.
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies').select('id').eq('id', company_id).single();
    if (companyError || !company) return res.status(404).json({ error: 'Company not found' });

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { company_id, role, full_name: full_name || '', invited_by: req.dbUser.email },
    });
    if (error) throw error;

    await supabaseAdmin.from('users').upsert({
      id: data.user.id,
      email,
      full_name: full_name || '',
      company_id,
      role,
    }, { onConflict: 'id' });

    res.json({ success: true, user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const { role, full_name, profile_picture, company_id, account_id, accessible_company_ids } = req.body || {};
    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (profile_picture !== undefined) updates.profile_picture = profile_picture;

    // Company assignment. This route accepted ONLY role/full_name/profile_picture,
    // so "Assign user to company" sent {company_id}, matched nothing, and got
    // 400 "No supported user fields supplied" — after the UI had already
    // claimed success. Same for "Set Account" sending {account_id}.
    if (company_id !== undefined) {
      if (company_id) {
        const { data: company } = await supabaseAdmin
          .from('companies').select('id').eq('id', company_id).single();
        if (!company) return res.status(404).json({ error: 'Company not found' });
      }
      updates.company_id = company_id || null;
      // Moving someone to a different company must not leave them "active" in
      // the old one (migration 021).
      updates.active_company_id = null;
    }
    if (account_id !== undefined) updates.account_id = account_id || null;
    // Extra companies this user may switch into via the account switcher.
    if (accessible_company_ids !== undefined) {
      if (!Array.isArray(accessible_company_ids)) {
        return res.status(400).json({ error: 'accessible_company_ids must be an array' });
      }
      updates.accessible_company_ids = accessible_company_ids;
    }

    if (role !== undefined) {
      if (!ADMIN_ROLES.has(role)) return res.status(400).json({ error: 'Invalid role' });
      const { data: target, error: targetError } = await supabaseAdmin
        .from('users')
        .select('id, role, company_id')
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
      // Internal roles are platform-level power (admin routes, BYOK, brain
      // global view). They may ONLY be held by members of the App Owner's own
      // company — granting them to a customer-company user would hand that
      // customer the entire platform. A DB trigger (migration 018) enforces
      // the same rule at the schema level as defense in depth.
      if (['owner', 'system_admin'].includes(role) && target.company_id !== req.dbUser.company_id) {
        return res.status(403).json({
          error: 'Internal roles (Owner / System Admin) can only be granted to members of the platform company',
        });
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

// GET /api/admin/data-deletion-requests/:id/preview — what WOULD be erased.
// Always run before executing: deletion is irreversible, so the operator sees
// the exact blast radius first.
router.get('/data-deletion-requests/:id/preview', async (req, res) => {
  try {
    const { data: reqRow, error } = await supabaseAdmin
      .from('data_deletion_requests').select('*').eq('id', req.params.id).single();
    if (error || !reqRow) return res.status(404).json({ error: 'Request not found' });

    const email = String(reqRow.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Request has no email' });

    const [users, leads] = await Promise.all([
      supabaseAdmin.from('users').select('id, email, full_name, role, company_id').ilike('email', email),
      supabaseAdmin.from('leads').select('id, lead_name, email, company_id').ilike('email', email),
    ]);

    const leadIds = (leads.data || []).map(l => l.id);
    let messageCount = 0;
    if (leadIds.length) {
      const { count } = await supabaseAdmin
        .from('messages').select('id', { count: 'exact', head: true }).in('lead_id', leadIds);
      messageCount = count || 0;
    }

    // Owners/system_admins are platform staff — never auto-erase them, or a
    // deletion request could remove the account that runs the business.
    const protectedUsers = (users.data || []).filter(u => ['owner', 'system_admin'].includes(u.role));

    res.json({
      request: reqRow,
      matches: {
        users: users.data || [],
        leads: leads.data || [],
        message_count: messageCount,
      },
      protected_users: protectedUsers,
      can_execute: protectedUsers.length === 0,
      warning: protectedUsers.length
        ? 'This email belongs to a platform Owner/System Admin. Erasing it would remove an internal account — handle manually.'
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/data-deletion-requests/:id/execute — actually erase the data.
// Irreversible. Records exactly what was removed as the audit trail.
router.post('/data-deletion-requests/:id/execute', async (req, res) => {
  try {
    const { data: reqRow, error } = await supabaseAdmin
      .from('data_deletion_requests').select('*').eq('id', req.params.id).single();
    if (error || !reqRow) return res.status(404).json({ error: 'Request not found' });
    if (reqRow.status === 'completed') {
      return res.status(409).json({ error: 'This request has already been completed' });
    }

    const email = String(reqRow.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Request has no email' });

    const { data: users } = await supabaseAdmin
      .from('users').select('id, email, role').ilike('email', email);
    if ((users || []).some(u => ['owner', 'system_admin'].includes(u.role))) {
      return res.status(403).json({
        error: 'This email belongs to a platform Owner/System Admin and cannot be erased automatically.',
      });
    }

    const { data: leads } = await supabaseAdmin
      .from('leads').select('id').ilike('email', email);
    const leadIds = (leads || []).map(l => l.id);

    const report = { email, deleted_at: new Date().toISOString(), messages: 0, leads: 0, users: 0, auth_users: 0, errors: [] };

    // Messages first — leads cascade-null rather than delete them for us.
    if (leadIds.length) {
      const { count, error: msgErr } = await supabaseAdmin
        .from('messages').delete({ count: 'exact' }).in('lead_id', leadIds);
      if (msgErr) report.errors.push(`messages: ${msgErr.message}`); else report.messages = count || 0;
    }
    if (leadIds.length) {
      const { count, error: leadErr } = await supabaseAdmin
        .from('leads').delete({ count: 'exact' }).in('id', leadIds);
      if (leadErr) report.errors.push(`leads: ${leadErr.message}`); else report.leads = count || 0;
    }
    for (const u of users || []) {
      const { error: uErr } = await supabaseAdmin.from('users').delete().eq('id', u.id);
      if (uErr) { report.errors.push(`users(${u.id}): ${uErr.message}`); continue; }
      report.users += 1;
      // Remove the auth identity too, otherwise the person can still sign in.
      const { error: aErr } = await supabaseAdmin.auth.admin.deleteUser(u.id);
      if (aErr) report.errors.push(`auth(${u.id}): ${aErr.message}`); else report.auth_users += 1;
    }

    const { data: updated } = await supabaseAdmin
      .from('data_deletion_requests')
      .update({
        status: report.errors.length ? 'processing' : 'completed',
        handled_by: req.dbUser?.email || null,
        handled_at: new Date().toISOString(),
        deletion_report: report,
      })
      .eq('id', reqRow.id)
      .select()
      .single();

    res.json({ success: report.errors.length === 0, report, request: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/data-deletion-requests/:id — status / notes only.
router.patch('/data-deletion-requests/:id', async (req, res) => {
  try {
    const { status, notes } = req.body || {};
    const updates = {};
    if (status !== undefined) {
      if (!['pending', 'processing', 'completed', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updates.status = status;
      updates.handled_by = req.dbUser?.email || null;
      updates.handled_at = new Date().toISOString();
    }
    if (notes !== undefined) updates.notes = notes;
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });

    const { data, error } = await supabaseAdmin
      .from('data_deletion_requests').update(updates).eq('id', req.params.id).select().single();
    if (error) {
      if (/handled_by|deletion_report|notes|column/i.test(error.message || '')) {
        return res.status(503).json({ error: 'Run migration 022 to enable the data-deletion workflow.' });
      }
      throw error;
    }
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
