import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireJWT } from '../middleware/auth.js';

const router = Router();

// Helper: provision a fresh company + subscription for a user
async function provisionCompany(authUser) {
  const meta = authUser.user_metadata || {};
  const companyName =
    meta.company_name ||
    (meta.full_name ? meta.full_name.split(' ')[0] + "'s Workspace" : null) ||
    'My Company';
  const fullName =
    meta.full_name || meta.name || authUser.email.split('@')[0];

  const { data: company, error: companyErr } = await supabaseAdmin
    .from('companies')
    .insert({ name: companyName })
    .select()
    .single();
  if (companyErr) throw companyErr;

  const { data: updatedUser, error: userErr } = await supabaseAdmin
    .from('users')
    .update({ company_id: company.id, role: 'owner', full_name: fullName })
    .eq('id', authUser.id)
    .select('*, companies(*)')
    .single();
  if (userErr) throw userErr;

  await supabaseAdmin.from('subscriptions').insert({
    company_id: company.id,
    plan: 'trial',
    status: 'trialing',
    ai_credits_total: 8000,
    ai_credits_used: 0,
    contacts_limit: 1500,
  });

  return { user: updatedUser, company };
}

// GET /api/auth/me - returns the authenticated user + company.
// Uses requireJWT (not requireAuth) so it works for brand-new users who have
// no DB profile yet - it auto-provisions them on first call (JIT provisioning).
// Also repairs orphaned users (exists in DB but company_id is null).
router.get('/me', requireJWT, async (req, res) => {
  try {
    const userId = req.user.id;

    // Try to load existing profile
    const { data: dbUser } = await supabaseAdmin
      .from('users')
      .select('*, companies(*)')
      .eq('id', userId)
      .single();

    if (dbUser) {
      // Repair orphaned user: exists in DB but no company linked
      if (!dbUser.company_id) {
        console.log('[auth/me] Repairing orphaned user:', req.user.email);
        const { user, company } = await provisionCompany(req.user);
        return res.json({ user, company });
      }
      return res.json({ user: dbUser, company: dbUser.companies });
    }

    // JIT Provisioning — brand new user, no DB row yet
    const meta = req.user.user_metadata || {};
    const companyName =
      meta.company_name ||
      (meta.full_name ? meta.full_name.split(' ')[0] + "'s Workspace" : null) ||
      'My Company';
    const fullName =
      meta.full_name || meta.name || req.user.email.split('@')[0];

    // Create company
    const { data: company, error: companyErr } = await supabaseAdmin
      .from('companies')
      .insert({ name: companyName })
      .select()
      .single();
    if (companyErr) throw companyErr;

    // Create user profile (id = auth user UUID)
    const { data: newUser, error: userErr } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        email: req.user.email,
        full_name: fullName,
        company_id: company.id,
        role: 'owner',
      })
      .select('*, companies(*)')
      .single();
    if (userErr) throw userErr;

    // Create free subscription
    await supabaseAdmin.from('subscriptions').insert({
      company_id: company.id,
      plan: 'trial',
      status: 'trialing',
      ai_credits_total: 8000,
      ai_credits_used: 0,
      contacts_limit: 1500,
    });

    console.log('[auth/me] JIT-provisioned new user', req.user.email);
    return res.json({ user: newUser, company: newUser.companies });
  } catch (err) {
    console.error('[auth/me]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  try {
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/complete-profile
router.post('/complete-profile', requireJWT, async (req, res) => {
  try {
    const { full_name, company_name, role = 'owner' } = req.body;
    const userId = req.user.id;

    // Check if user profile already exists with a company (idempotent)
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('*, companies(*)')
      .eq('id', userId)
      .single();

    if (existing && existing.company_id) {
      return res.json({ user: existing, company: existing.companies });
    }

    // Create company
    const { data: company, error: companyErr } = await supabaseAdmin
      .from('companies')
      .insert({ name: company_name || 'My Company' })
      .select()
      .single();
    if (companyErr) throw companyErr;

    // Create or update user profile
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        email: req.user.email,
        full_name: full_name || req.user.user_metadata?.full_name || '',
        company_id: company.id,
        role,
      })
      .select()
      .single();
    if (userErr) throw userErr;

    // Create default subscription
    await supabaseAdmin.from('subscriptions').insert({
      company_id: company.id,
      plan: 'trial',
      status: 'trialing',
      ai_credits_total: 8000,
      ai_credits_used: 0,
      contacts_limit: 1500,
    });

    res.json({ user, company });
  } catch (err) {
    console.error('[auth/complete-profile]', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
