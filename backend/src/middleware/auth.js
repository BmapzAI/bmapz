import { supabaseAdmin } from '../lib/supabase.js';

/**
 * Verifies the Supabase JWT only — does NOT require an existing DB user row.
 * Use this on endpoints that need to work before a user profile exists
 * (e.g. /api/auth/me for JIT provisioning, /api/auth/complete-profile).
 * Attaches req.user (Supabase auth user).
 */
export async function requireJWT(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('[requireJWT]', err);
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Verifies the Supabase JWT sent as "Authorization: Bearer <token>".
 * Attaches req.user (Supabase auth user) and req.dbUser (users table row).
 */
/**
 * Load the users row plus its company.
 *
 * Tries the disambiguated embed first, and if PostgREST rejects the hint for any
 * reason falls back to two plain queries. Auth is the single choke point for
 * every request in the app, so it must not be able to fail on an embed detail.
 */
export async function loadDbUser(userId) {
  // Deliberately NO PostgREST embed here.
  //
  // Two reasons, both learned the hard way:
  //  1. `users` now has two FKs to `companies` (company_id and, since migration
  //     021, active_company_id). A bare embed is ambiguous and took the whole
  //     app down; even a hinted embed can only follow ONE of them.
  //  2. The company the app must show is the ACTIVE one (what the switcher
  //     selected), not the home one. An embed hinted at company_id would return
  //     the wrong company's name, logo and settings for the entire session after
  //     a switch, while every data query used the active company — mismatched
  //     branding on top of correct data, which is worse than an error.
  // Two explicit queries are cheap, unambiguous, and immune to future FKs.
  const { data: user, error } = await supabaseAdmin
    .from('users').select('*').eq('id', userId).single();
  if (error || !user) return null;

  const activeCompanyId = user.active_company_id || user.company_id;
  if (activeCompanyId) {
    const { data: company } = await supabaseAdmin
      .from('companies').select('*').eq('id', activeCompanyId).single();
    user.companies = company || null;
  } else {
    user.companies = null;
  }
  return user;
}

const PLATFORM_ROLES = new Set(['owner', 'system_admin']);

/**
 * May this user act inside this company?
 *
 * True when it is their home company, when it has been granted to them via
 * accessible_company_ids, or when they hold a platform role.
 *
 * Callers previously compared `users.company_id === req.companyId` directly.
 * Those two DIVERGE for exactly the people the switcher exists for: a guest
 * working inside company B still has company_id = A, so a home-company
 * comparison wrongly excluded them — e.g. team-chat could not add them to a
 * thread in the very company they were working in.
 */
export function isMemberOfCompany(user, companyId) {
  if (!user || !companyId) return false;
  if (PLATFORM_ROLES.has(user.role)) return true;
  if (user.company_id === companyId) return true;
  return (user.accessible_company_ids || []).includes(companyId);
}

/**
 * The company this request acts in: the stored active company IF the user may
 * act there, otherwise their home company. Never returns a company the user has
 * no claim to, regardless of what is stored on the row.
 */
export function resolveActiveCompany(dbUser) {
  const active = dbUser?.active_company_id;
  if (!active) return dbUser?.company_id || null;
  if (isMemberOfCompany(dbUser, active)) return active;
  console.warn(
    `[auth] user ${dbUser.id} has active_company_id ${active} it may not access — falling back to home company`,
  );
  return dbUser.company_id || null;
}

/** The same test, for a set of user ids. Returns the ids that are members. */
export async function filterCompanyMembers(userIds, companyId) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, role, company_id, accessible_company_ids')
    .in('id', ids);
  if (error) throw error;
  return (data || []).filter(u => isMemberOfCompany(u, companyId)).map(u => u.id);
}

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    // Verify the JWT with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user; // Supabase auth user object

    // Load the application user record (has company_id, role, etc.).
    //
    // The embed MUST name which foreign key to follow. Migration 021 added
    // users.active_company_id, giving `users` a SECOND FK to `companies`, and
    // a bare `companies(*)` then fails with "more than one relationship was
    // found for 'users' and 'companies'" — which took the whole app down,
    // because every authenticated request passes through here.
    const dbUser = await loadDbUser(user.id);
    if (!dbUser) {
      return res.status(403).json({ error: 'User profile not found. Please complete registration.' });
    }

    req.dbUser = dbUser;
    // Requests are scoped to the company the user is CURRENTLY working in.
    //
    // RE-DERIVED, not trusted. Every company-scoped query in the app hangs off
    // this one value, so it must not rest solely on migration 021's trigger
    // having been applied and never bypassed. If a stored active_company_id is
    // not one this user may act in, ignore it and fall back to the home company
    // rather than honouring it.
    req.companyId = resolveActiveCompany(dbUser);
    req.homeCompanyId = dbUser.company_id;
    next();
  } catch (err) {
    console.error('[auth middleware]', err);
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Requires the user to have owner or system_admin role.
 */
export function requireAdmin(req, res, next) {
  const role = req.dbUser?.role;
  if (role !== 'owner' && role !== 'system_admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Requires owner, system_admin, or company_admin.
 */
export function requireCompanyAdmin(req, res, next) {
  const role = req.dbUser?.role;
  if (!['owner', 'system_admin', 'company_admin'].includes(role)) {
    return res.status(403).json({ error: 'Company admin access required' });
  }
  next();
}

/**
 * Optional auth — attaches user if token present, continues either way.
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (user) {
      req.user = user;
      const dbUser = await loadDbUser(user.id);
      if (dbUser) {
        req.dbUser = dbUser;
        // Honour the active company here too, so an optionally-authenticated
        // request sees the same scope as an authenticated one.
        req.companyId = resolveActiveCompany(dbUser);
        req.homeCompanyId = dbUser.company_id;
      }
    }
    next();
  } catch {
    next();
  }
}
