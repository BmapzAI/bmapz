import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireJWT } from '../middleware/auth.js';

const router = Router();

// GET /api/auth/me — returns the authenticated user + company.
// Uses requireJWT (not requireAuth) so it works for brand-new users who have
// no DB profile yet — it auto-provisions them on first call (JIT provisioning).
router.get('/me', requireJWT, async (req, res) => {
  try {
    const userId = req.user.id;

    // Try to load existing profile
    const { data: dbUser } = await supabaseAdmin
      .from('users')
      .select('*, companies(*)')
      .eq('auth_user_id', userId)
      .single();

    if (dbUser) {
      return res.json({ user: dbUser, company: dbUser.companies });
    }

    // ── JIT Provisioning ──────────────────────────────────────────────────────
    // No DB user yet — this is their very first login (Google OAuth or confirmed
    // email signup). Auto-create company + user + free subscription now.
    const meta = req.user.user_metadata || {};
    const companyName = meta.company_name || meta.full_name?.split(' ')[0] + "'s Workspace" || 'My Company';
    const fullName = meta.full_name || meta.name || req.user.email.split('@')[0];

    // Create company
    const { data: company, error: companyErr } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyName,
        owner_email: req.user.email,
      })
      .select()
      .single();
    if (companyErr) throw companyErr;

    // Create user profile
    const { data: newUser, error: userErr } = await supabaseAdmin
      .from('users')
      .insert({
        auth_user_id: userId,
        email: req.user.email,
        full_name: fullName,
        company_id: company.id,
        role: 'owner',
      })
      .select('*, companies(*)')
      .single();
    if (userErr) throw userErr;

    // Create free subscription
    await supabaseAdmin
      .from('subscriptions')
      .insert({
        company_id: company.id,
        plan: 'free',
        status: 'active',
        ai_credits_total: 100,
        ai_credits_used: 0,
        contacts_limit: 250,
      });

    console.log(`[auth/me] JIT-provisioned new user ${req.user.email}`);
    return res.json({ user: newUser, company: newUser.companies });
  } catch (err) {
    console.error('[auth/me]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout — invalidate session (client also clears token)
router.post('/logout', requireAuth, async (req, res) => {
  try {
    // Supabase doesn't have server-side session revocation for JWTs by default.
    // The client should call supabase.auth.signOut() which clears the local session.
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/complete-profile — called after signup to finish user setup.
// Uses requireJWT so it can be called before DB user row exists.
router.post('/complete-profile', requireJWT, async (req, res) => {
  try {
    const { full_name, company_name, role = 'owner' } = req.body;
    const userId = req.user.id;

    // Check if user profile already exists (idempotent)
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('*, companies(*)')
      .eq('auth_user_id', userId)
      .single();

    if (existing) {
      return res.json({ user: existing, company: existing.companies });
    }

    // Create company
    const { data: company, error: companyErr } = await supabaseAdmin
      .from('companies')
      .insert({
        name: company_name || 'My Company',
        owner_email: req.user.email,
      })
      .select()
      .single();

    if (companyErr) throw companyErr;

    // Create user profile
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .insert({
        auth_user_id: userId,
        email: req.user.email,
        full_name: full_name || req.user.user_metadata?.full_name || '',
        company_id: company.id,
        role,
      })
      .select()
      .single();

    if (userErr) throw userErr;

    // Create default subscription (free plan)
    await supabaseAdmin
      .from('subscriptions')
      .insert({
        company_id: company.id,
        plan: 'free',
        status: 'active',
        ai_credits_total: 100,
        ai_credits_used: 0,
        contacts_limit: 250,
      });

    res.json({ user, company });
  } catch (err) {
    console.error('[auth/complete-profile]', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
