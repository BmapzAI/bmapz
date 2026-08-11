import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireCompanyAdmin, requireAdmin } from '../middleware/auth.js';

const router = Router();

export const SALES_STATUSES = ['online', 'standby', 'offline'];

// GET /api/users — all users in current company
// ─── @usernames ──────────────────────────────────────────────────────────────
// Stored without the leading '@'; case-insensitive unique (migration 024).
// Used so a company admin can find an existing user to invite, and so teammates
// can find each other.

const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
/** Strip a leading @ and normalise for comparison. */
const normHandle = (v) => String(v || '').trim().replace(/^@+/, '');

// GET /api/users/username-available?username=derek
// Public-ish but still behind auth: used by profile editing. Signup uses the
// unauthenticated variant on the auth router.
router.get('/username-available', requireAuth, async (req, res) => {
  try {
    const username = normHandle(req.query.username);
    if (!USERNAME_RE.test(username)) {
      return res.json({ available: false, reason: 'invalid', message: '3–30 characters, letters, numbers and underscore only.' });
    }
    const { data, error } = await supabaseAdmin
      .from('users').select('id').ilike('username', username).limit(1).maybeSingle();
    if (error) {
      // Column not present until migration 024 runs — say so, don't 500.
      if (/column|does not exist|schema cache/i.test(error.message || '')) {
        return res.status(503).json({ available: false, reason: 'unavailable', error: 'Run migration 024 to enable usernames.' });
      }
      throw error;
    }
    const taken = !!data && data.id !== req.dbUser.id;
    res.json({ available: !taken, reason: taken ? 'taken' : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/lookup?q=@derek — find a user ANYWHERE on the platform by exact
// @username, so a company admin can invite someone who already has an account.
// Deliberately returns only what an inviter needs — never company, role or any
// other tenant data, so this cannot be used to enumerate another company.
router.get('/lookup', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const username = normHandle(req.query.q);
    if (!USERNAME_RE.test(username)) return res.json({ data: null });
    const { data, error } = await supabaseAdmin
      .from('users').select('id, username, full_name, profile_picture')
      .ilike('username', username).limit(1).maybeSingle();
    if (error) {
      if (/column|does not exist|schema cache/i.test(error.message || '')) {
        return res.status(503).json({ data: null, error: 'Run migration 024 to enable username lookup.' });
      }
      throw error;
    }
    if (!data) return res.json({ data: null });
    // Say whether they are ALREADY in this company, without exposing which other
    // company they belong to if they are not.
    const { data: mine } = await supabaseAdmin
      .from('users').select('id').eq('id', data.id).eq('company_id', req.companyId).maybeSingle();
    res.json({ data: { ...data, already_in_company: !!mine } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/search?q=der — find people INSIDE the caller's company only.
// Company-scoped on purpose: this powers mention pickers and team search, which
// must never surface users from another company.
router.get('/search', requireAuth, async (req, res) => {
  try {
    const raw = normHandle(req.query.q);
    if (raw.length < 2) return res.json({ data: [] });
    // Sanitise before interpolating into PostgREST's .or() grammar.
    const term = raw.replace(/[,()"*]/g, '').slice(0, 40);
    if (!term) return res.json({ data: [] });
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, username, full_name, email, profile_picture, role')
      .eq('company_id', req.companyId)
      .or(`username.ilike.%${term}%,full_name.ilike.%${term}%,email.ilike.%${term}%`)
      .limit(20);
    if (error) {
      // Degrade to no results rather than breaking a mention/search picker.
      if (/column|does not exist|schema cache/i.test(error.message || '')) {
        return res.json({ data: [], note: 'Run migration 024 to enable username search.' });
      }
      throw error;
    }
    res.json({ data: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const withSales = 'id, email, full_name, role, created_at, profile_picture, is_sales_team, sales_status, sales_status_updated_at';
    // Team membership = home company OR granted access. A `.eq('company_id')`
    // alone omitted guests working in this company via accessible_company_ids,
    // so they were invisible in the team list, owner pickers and mention menus
    // of the very company they were in.
    const run = (cols) => supabaseAdmin
      .from('users')
      .select(cols)
      .or(`company_id.eq.${req.companyId},accessible_company_ids.cs.{${req.companyId}}`)
      .order('created_at', { ascending: false });

    let { data, error } = await run(withSales);
    // Before migration 011 the sales columns do not exist — still return users.
    if (error && /is_sales_team|sales_status|profile_picture/i.test(error.message || '')) {
      ({ data, error } = await run('id, email, full_name, role, created_at'));
    }
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Sales team ──────────────────────────────────────────────────────────────
// Membership is decided by a company admin; availability is set by the member.

// PATCH /api/users/:id/sales-team — add/remove someone from the sales team.
// Body: { is_sales_team: boolean }
router.patch('/:id/sales-team', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const isMember = !!req.body?.is_sales_team;
    const updates = { is_sales_team: isMember };
    // Someone removed from the team should not stay "available" for leads.
    if (!isMember) {
      updates.sales_status = 'offline';
      updates.sales_status_updated_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .eq('company_id', req.companyId) // never touch another company's users
      .select('id, email, full_name, role, is_sales_team, sales_status')
      .single();
    if (error) {
      if (/is_sales_team|sales_status/i.test(error.message || '')) {
        return res.status(503).json({ error: 'The sales team feature is not enabled yet — the database update (migration 011) still needs to be applied.' });
      }
      throw error;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/me/sales-status — a sales team member sets their OWN status.
// Body: { sales_status: 'online' | 'standby' | 'offline' }
router.patch('/me/sales-status', requireAuth, async (req, res) => {
  try {
    const status = String(req.body?.sales_status || '').toLowerCase();
    if (!SALES_STATUSES.includes(status)) {
      return res.status(400).json({ error: `sales_status must be one of: ${SALES_STATUSES.join(', ')}` });
    }
    // Only actual sales team members have an availability to set.
    if (req.dbUser?.is_sales_team === false) {
      return res.status(403).json({ error: 'Only sales team members can set an availability status. Ask a company admin to add you to the sales team.' });
    }

    const updates = { sales_status: status, sales_status_updated_at: new Date().toISOString() };
    // Becoming available puts you at the BACK of the queue, so the queued
    // routing method serves whoever has been waiting longest.
    if (status === 'online' && req.dbUser?.sales_status !== 'online') {
      updates.lead_queue_position = new Date().toISOString();
    }

    const runUpdate = (body) => supabaseAdmin
      .from('users')
      .update(body)
      .eq('id', req.dbUser.id)
      .select('id, full_name, email, is_sales_team, sales_status, sales_status_updated_at')
      .single();

    let { data, error } = await runUpdate(updates);
    if (error && /lead_queue_position/i.test(error.message || '')) {
      const { lead_queue_position, ...rest } = updates; // eslint-disable-line no-unused-vars
      ({ data, error } = await runUpdate(rest));
    }
    if (error) {
      if (/is_sales_team|sales_status/i.test(error.message || '')) {
        return res.status(503).json({ error: 'The sales team feature is not enabled yet — the database update (migration 011) still needs to be applied.' });
      }
      throw error;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/me — current user profile
router.get('/me', requireAuth, (req, res) => {
  res.json(req.dbUser);
});

// PATCH /api/users/me — update own profile
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { full_name, profile_picture, username } = req.body;
    const updates = {};
    // Only assign fields that were actually sent — the old version always wrote
    // both, so patching one silently nulled the other.
    if (full_name !== undefined) updates.full_name = full_name;
    if (profile_picture !== undefined) updates.profile_picture = profile_picture;

    if (username !== undefined) {
      const clean = normHandle(username);
      if (!USERNAME_RE.test(clean)) {
        return res.status(400).json({ error: 'Username must be 3–30 characters: letters, numbers and underscore only.' });
      }
      const { data: clash } = await supabaseAdmin
        .from('users').select('id').ilike('username', clean).maybeSingle();
      if (clash && clash.id !== req.dbUser.id) {
        return res.status(409).json({ error: `@${clean} is already taken.`, code: 'USERNAME_TAKEN' });
      }
      updates.username = clean;
    }

    if (!Object.keys(updates).length) return res.json(req.dbUser);

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', req.dbUser.id)
      .select()
      .single();
    if (error) {
      // The unique index is the real authority — a race between two people
      // claiming the same handle lands here.
      if (/idx_users_username_lower|duplicate key/i.test(error.message || '')) {
        return res.status(409).json({ error: 'That username was just taken. Pick another.', code: 'USERNAME_TAKEN' });
      }
      if (/users_username_format/i.test(error.message || '')) {
        return res.status(400).json({ error: 'Username must be 3–30 characters: letters, numbers and underscore only.' });
      }
      throw error;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/me/presence — automatic availability on sign-in / sign-out.
// Body: { connected: boolean }
//
// Signing in puts a sales member back Online; signing out (or closing the app)
// drops them to Stand by, so leads stop being routed to someone who is not
// there while the SDR agent keeps handling them. Someone who deliberately chose
// Offline is left alone — that is an explicit "do not route to me".
router.patch('/me/presence', requireAuth, async (req, res) => {
  try {
    if (!req.dbUser?.is_sales_team) return res.json({ skipped: 'not a sales team member' });
    const connected = !!req.body?.connected;
    const current = req.dbUser.sales_status || 'offline';

    if (!connected && current === 'offline') return res.json({ sales_status: current, unchanged: true });
    if (connected && current === 'offline') return res.json({ sales_status: current, unchanged: true, reason: 'explicitly offline' });

    const next = connected ? 'online' : 'standby';
    if (next === current) return res.json({ sales_status: current, unchanged: true });

    const updates = { sales_status: next, sales_status_updated_at: new Date().toISOString() };
    if (next === 'online') updates.lead_queue_position = new Date().toISOString();

    const run = (body) => supabaseAdmin.from('users').update(body)
      .eq('id', req.dbUser.id).select('id, sales_status').single();
    let { data, error } = await run(updates);
    if (error && /lead_queue_position/i.test(error.message || '')) {
      const { lead_queue_position, ...rest } = updates; // eslint-disable-line no-unused-vars
      ({ data, error } = await run(rest));
    }
    if (error) {
      if (/is_sales_team|sales_status/i.test(error.message || '')) return res.json({ skipped: 'sales team feature not enabled yet' });
      throw error;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/invite — invite a new user to the company
router.post('/invite', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const { email, full_name } = req.body;
    // Company-scoped invites can only create customer roles. Elevating a user to
    // owner/system_admin is done afterwards from the Bmapz Admin Panel (admin routes).
    const role = ['company_admin', 'user'].includes(req.body.role) ? req.body.role : 'user';

    // Create Supabase auth invite
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        company_id: req.companyId,
        role,
        full_name: full_name || '',
        invited_by: req.dbUser.email,
      },
    });
    if (error) throw error;

    // Pre-create user profile (id = auth user UUID)
    await supabaseAdmin.from('users').upsert({
      id: data.user.id,
      email,
      full_name: full_name || '',
      company_id: req.companyId,
      role,
    }, { onConflict: 'id' });

    res.json({ success: true, user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id/role — update a user's role
router.patch('/:id/role', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    // Company admins can only assign CUSTOMER roles. 'owner' / 'system_admin'
    // are Bmapz-internal and grantable only from the platform Admin Panel
    // (admin routes), never through company-scoped endpoints.
    const validRoles = ['company_admin', 'user'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ role })
      .eq('id', req.params.id)
      .eq('company_id', req.companyId) // enforce company scope
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id — update a user in the company (admin only)
router.patch('/:id', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const { full_name, role, profile_picture } = req.body;
    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (profile_picture !== undefined) updates.profile_picture = profile_picture;
    if (role !== undefined) {
      // Company admins can only assign CUSTOMER roles. 'owner' / 'system_admin'
    // are Bmapz-internal and grantable only from the platform Admin Panel
    // (admin routes), never through company-scoped endpoints.
    const validRoles = ['company_admin', 'user'];
      if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
      updates.role = role;
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
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

// DELETE /api/users/:id — remove a user from the company
router.delete('/:id', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    if (req.params.id === req.dbUser.id) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }

    const { error } = await supabaseAdmin
      .from('users')
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
