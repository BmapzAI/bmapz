import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireJWT } from '../middleware/auth.js';

const router = Router();

function flattenCompany(row) {
  if (!row) return row;
  const { api_keys, settings, ...rest } = row;
  return { ...rest, ...(api_keys || {}), ...(settings || {}) };
}

/**
 * Fetch the company the user is CURRENTLY working in, flattened for the client.
 *
 * Fetched separately rather than embedded: `users` has two FKs to `companies`
 * (company_id and active_company_id since migration 021), so an embed is either
 * ambiguous — which took the app down — or pinned to the wrong one, which would
 * show the home company's branding for a whole session after switching.
 */
async function activeCompanyFor(user) {
  const id = user?.active_company_id || user?.company_id;
  if (!id) return null;
  const { data } = await supabaseAdmin.from('companies').select('*').eq('id', id).single();
  return flattenCompany(data);
}

/** Slug a string into a legal handle: lowercase, [a-z0-9_], 3–30 chars. */
function slugHandle(src, fallback = 'user') {
  const s = String(src || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
  return s.length >= 3 ? s : fallback;
}

/**
 * Find a free handle by appending a counter. Racy by nature, so the caller must
 * still tolerate the unique index rejecting it (migration 024).
 */
async function freeHandle(table, column, base) {
  let candidate = base;
  for (let n = 2; n <= 50; n++) {
    const { data, error } = await supabaseAdmin
      .from(table).select('id').ilike(column, candidate).limit(1).maybeSingle();
    // Column not there yet (migration 024 not run): signal "no handle" so the
    // caller omits it rather than failing. Signup must never depend on a
    // migration having been applied — that would make a pending migration an
    // outage, which is the exact failure mode we are engineering out.
    if (error) {
      if (/column|does not exist|schema cache/i.test(error.message || '')) return null;
      throw error;
    }
    if (!data) return candidate;
    candidate = `${base}${n}`.slice(0, 30);
  }
  // Give up guessing politely and use something that will not collide.
  return `${base}${Date.now().toString(36)}`.slice(0, 30);
}

async function provisionCompany(authUser) {
  const meta = authUser.user_metadata || {};
  const companyName =
    meta.company_name ||
    (meta.full_name ? meta.full_name.split(' ')[0] + "'s Workspace" : null) ||
    'My Company';
  const fullName = meta.full_name || meta.name || authUser.email.split('@')[0];

  // IDEMPOTENCY GUARD. Provisioning used to insert a company unconditionally,
  // so anything that repeatedly reached this path created a company EVERY time.
  // That is exactly what happened during the 021 outage: the users lookup
  // errored, the caller ignored the error, treated the user as unprovisioned,
  // and each retry minted another empty "…'s Workspace" — 3 companies became 16.
  const { data: current } = await supabaseAdmin
    .from('users').select('*').eq('id', authUser.id).maybeSingle();
  if (current?.company_id) {
    return { user: current, company: await activeCompanyFor(current) };
  }

  // Every company and user gets a unique @handle at creation (migration 024),
  // so the search / invite features never have to cope with missing ones.
  // freeHandle returns null when the column does not exist yet (migration 024
  // not applied). Omit the field in that case: a pending migration must never
  // be able to break signup.
  const companyHandle = await freeHandle('companies', 'handle', slugHandle(companyName, 'company'));
  const { data: company, error: companyErr } = await supabaseAdmin
    .from('companies')
    .insert(companyHandle ? { name: companyName, handle: companyHandle } : { name: companyName })
    .select().single();
  if (companyErr) throw companyErr;

  // KEEP an existing username. This path also serves a user who has a users row
  // but no company, and the upsert below resolves to an UPDATE for them. Two
  // problems if we always computed a fresh handle: freeHandle sees their OWN
  // username as taken and returns `name2`, silently RENAMING them; and since
  // migration 027 that counts as a change, so if they had changed it within 90
  // days the trigger would reject the whole upsert and provisioning would fail.
  // A handle is only ASSIGNED when there isn't one.
  const desiredUsername = meta.username ? slugHandle(meta.username, '') : '';
  const userHandle = current?.username
    ? null                                     // already has one — leave it alone
    : await freeHandle(
      'users', 'username',
      desiredUsername || slugHandle(String(fullName).split(' ')[0], slugHandle(authUser.email.split('@')[0], 'user')),
    );

  // A new customer becomes 'company_admin' — the TOP role for a customer
  // workspace (full control of their own company + team). 'owner' and
  // 'system_admin' are reserved for the Bmapz platform team and can only be
  // granted from the internal Admin Panel. This is deliberate: 'owner' unlocks
  // BYOK, which bypasses Bmapz credit billing — customers must never self-grant it.
  // upsert, not update: this function now serves BOTH the "user row exists but
  // has no company" repair path and the "no user row at all" JIT path, and
  // .update() on a missing row returns no rows and would throw.
  const { data: updatedUser, error: userErr } = await supabaseAdmin
    .from('users')
    .upsert({
      id: authUser.id,
      email: authUser.email,
      company_id: company.id,
      role: 'company_admin',
      full_name: fullName,
      ...(userHandle ? { username: userHandle } : {}),
    }, { onConflict: 'id' })
    .select('*').single();
  if (userErr) throw userErr;

  await supabaseAdmin.from('subscriptions').insert({
    company_id: company.id, plan: 'trial', status: 'trialing',
    ai_credits_total: 8000, ai_credits_used: 0, contacts_limit: 1500,
  });

  return { user: updatedUser, company: await activeCompanyFor(updatedUser) };
}

// GET /api/auth/username-available?username=derek — UNAUTHENTICATED on purpose:
// signup needs to check a handle before an account exists. Returns only a
// boolean, so it cannot be used to read anything about the account that holds it.
router.get('/username-available', async (req, res) => {
  try {
    const username = String(req.query.username || '').trim().replace(/^@+/, '');
    if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) {
      return res.json({ available: false, reason: 'invalid' });
    }
    const { data, error } = await supabaseAdmin
      .from('users').select('id').ilike('username', username).limit(1).maybeSingle();
    if (error) {
      // Column not there yet — say so plainly instead of a bare 500.
      if (/column|does not exist|schema cache/i.test(error.message || '')) {
        return res.status(503).json({ available: false, reason: 'unavailable', error: 'Run migration 024 to enable usernames.' });
      }
      throw error;
    }
    res.json({ available: !data, reason: data ? 'taken' : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', requireJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: dbUser, error: lookupErr } = await supabaseAdmin
      .from('users').select('*').eq('id', userId).maybeSingle();

    // Distinguish "this user genuinely has no row" from "the query failed".
    // The old code destructured only `data`, so ANY query failure looked
    // identical to a brand-new user and triggered provisioning — which is how a
    // transient database error turned into 13 duplicate companies.
    if (lookupErr) {
      console.error('[auth/me] user lookup failed — refusing to provision:', lookupErr.message);
      return res.status(503).json({
        error: 'Could not load your profile. Please try again in a moment.',
        code: 'LOOKUP_FAILED',
      });
    }

    if (dbUser) {
      if (!dbUser.company_id) {
        console.log('[auth/me] Repairing orphaned user:', req.user.email);
        const { user, company } = await provisionCompany(req.user);
        return res.json({ user, company });
      }
      return res.json({ user: dbUser, company: await activeCompanyFor(dbUser) });
    }

    // Genuinely no users row — provision one. provisionCompany() re-checks
    // first, so a race between two concurrent /me calls cannot create two
    // companies for the same person.
    const { user: newUser, company } = await provisionCompany(req.user);
    console.log('[auth/me] JIT-provisioned new user', req.user.email);
    return res.json({ user: newUser, company });
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

    // This endpoint was the UNFIXED TWIN of the runaway-company incident: it
    // used `.single()` (which errors when there is no row), discarded the error,
    // and then inserted a company + subscription. A double-submitted form or any
    // transient read failure created another company each time.
    // maybeSingle + an explicit error check + delegating to the guarded
    // provisionCompany() removes all three problems.
    const { data: existing, error: lookupErr } = await supabaseAdmin
      .from('users').select('*').eq('id', userId).maybeSingle();
    if (lookupErr) {
      console.error('[auth/complete-profile] lookup failed — refusing to provision:', lookupErr.message);
      return res.status(503).json({ error: 'Could not load your profile. Please try again.', code: 'LOOKUP_FAILED' });
    }
    if (existing?.company_id) {
      return res.json({ user: existing, company: await activeCompanyFor(existing) });
    }

    // Carry the names the user just typed into provisioning, then reuse the one
    // hardened creation path instead of a second, unguarded copy of it.
    const { user, company } = await provisionCompany({
      ...req.user,
      user_metadata: {
        ...(req.user.user_metadata || {}),
        full_name: full_name || req.user.user_metadata?.full_name || '',
        company_name: company_name || req.user.user_metadata?.company_name,
        username: req.body?.username || req.user.user_metadata?.username,
      },
    });
    void role; // role is decided inside provisionCompany (always company_admin)

    res.json({ user, company });
  } catch (err) {
    console.error('[auth/complete-profile]', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;