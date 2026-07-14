import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireJWT } from '../middleware/auth.js';

const router = Router();

function flattenCompany(row) {
  if (!row) return row;
  const { api_keys, settings, ...rest } = row;
  return { ...rest, ...(api_keys || {}), ...(settings || {}) };
}

async function provisionCompany(authUser) {
  const meta = authUser.user_metadata || {};
  const companyName =
    meta.company_name ||
    (meta.full_name ? meta.full_name.split(' ')[0] + "'s Workspace" : null) ||
    'My Company';
  const fullName = meta.full_name || meta.name || authUser.email.split('@')[0];

  const { data: company, error: companyErr } = await supabaseAdmin
    .from('companies').insert({ name: companyName }).select().single();
  if (companyErr) throw companyErr;

  // A new customer becomes 'company_admin' — the TOP role for a customer
  // workspace (full control of their own company + team). 'owner' and
  // 'system_admin' are reserved for the Bmapz platform team and can only be
  // granted from the internal Admin Panel. This is deliberate: 'owner' unlocks
  // BYOK, which bypasses Bmapz credit billing — customers must never self-grant it.
  const { data: updatedUser, error: userErr } = await supabaseAdmin
    .from('users')
    .update({ company_id: company.id, role: 'company_admin', full_name: fullName })
    .eq('id', authUser.id).select('*, companies(*)').single();
  if (userErr) throw userErr;

  await supabaseAdmin.from('subscriptions').insert({
    company_id: company.id, plan: 'trial', status: 'trialing',
    ai_credits_total: 8000, ai_credits_used: 0, contacts_limit: 1500,
  });

  return { user: updatedUser, company: flattenCompany(updatedUser.companies) };
}

router.get('/me', requireJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: dbUser } = await supabaseAdmin
      .from('users').select('*, companies(*)').eq('id', userId).single();

    if (dbUser) {
      if (!dbUser.company_id) {
        console.log('[auth/me] Repairing orphaned user:', req.user.email);
        const { user, company } = await provisionCompany(req.user);
        return res.json({ user, company });
      }
      return res.json({ user: dbUser, company: flattenCompany(dbUser.companies) });
    }

    const meta = req.user.user_metadata || {};
    const companyName =
      meta.company_name ||
      (meta.full_name ? meta.full_name.split(' ')[0] + "'s Workspace" : null) ||
      'My Company';
    const fullName = meta.full_name || meta.name || req.user.email.split('@')[0];

    const { data: company, error: companyErr } = await supabaseAdmin
      .from('companies').insert({ name: companyName }).select().single();
    if (companyErr) throw companyErr;

    const { data: newUser, error: userErr } = await supabaseAdmin
      .from('users').upsert({
        id: userId, email: req.user.email, full_name: fullName,
        company_id: company.id, role: 'company_admin', // top CUSTOMER role; owner is Bmapz-internal
      }).select('*, companies(*)').single();
    if (userErr) throw userErr;

    await supabaseAdmin.from('subscriptions').insert({
      company_id: company.id, plan: 'trial', status: 'trialing',
      ai_credits_total: 8000, ai_credits_used: 0, contacts_limit: 1500,
    });

    console.log('[auth/me] JIT-provisioned new user', req.user.email);
    return res.json({ user: newUser, company: flattenCompany(newUser.companies) });
  } catch (err) {
    console.error('[auth/me]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  try { res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/complete-profile', requireJWT, async (req, res) => {
  try {
    // Ignore any client-supplied role — a customer completing their profile is
    // always 'company_admin'. Elevated roles are granted only from the Bmapz Admin Panel.
    const { full_name, company_name } = req.body;
    const role = 'company_admin';
    const userId = req.user.id;

    const { data: existing } = await supabaseAdmin
      .from('users').select('*, companies(*)').eq('id', userId).single();
    if (existing && existing.company_id) {
      return res.json({ user: existing, company: flattenCompany(existing.companies) });
    }

    const { data: company, error: companyErr } = await supabaseAdmin
      .from('companies').insert({ name: company_name || 'My Company' }).select().single();
    if (companyErr) throw companyErr;

    const { data: user, error: userErr } = await supabaseAdmin
      .from('users').upsert({
        id: userId, email: req.user.email,
        full_name: full_name || req.user.user_metadata?.full_name || '',
        company_id: company.id, role,
      }).select().single();
    if (userErr) throw userErr;

    await supabaseAdmin.from('subscriptions').insert({
      company_id: company.id, plan: 'trial', status: 'trialing',
      ai_credits_total: 8000, ai_credits_used: 0, contacts_limit: 1500,
    });

    res.json({ user, company: flattenCompany(company) });
  } catch (err) {
    console.error('[auth/complete-profile]', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;