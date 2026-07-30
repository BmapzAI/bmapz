import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireCompanyAdmin, requireAdmin } from '../middleware/auth.js';

const router = Router();

export const SALES_STATUSES = ['online', 'standby', 'offline'];

// GET /api/users — all users in current company
router.get('/', requireAuth, async (req, res) => {
  try {
    const withSales = 'id, email, full_name, role, created_at, profile_picture, is_sales_team, sales_status, sales_status_updated_at';
    const run = (cols) => supabaseAdmin
      .from('users')
      .select(cols)
      .eq('company_id', req.companyId)
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

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ sales_status: status, sales_status_updated_at: new Date().toISOString() })
      .eq('id', req.dbUser.id)
      .select('id, full_name, email, is_sales_team, sales_status, sales_status_updated_at')
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

// GET /api/users/me — current user profile
router.get('/me', requireAuth, (req, res) => {
  res.json(req.dbUser);
});

// PATCH /api/users/me — update own profile
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { full_name, profile_picture } = req.body;
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ full_name, profile_picture })
      .eq('id', req.dbUser.id)
      .select()
      .single();
    if (error) throw error;
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
