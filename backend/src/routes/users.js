import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireCompanyAdmin, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/users — all users in current company
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role, created_at')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
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
    const { email, role = 'user', full_name } = req.body;

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
    const validRoles = ['owner', 'company_admin', 'user'];
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
      const validRoles = ['owner', 'company_admin', 'user'];
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
