/**
 * The ONE way a company row is shaped for a client.
 *
 * WHY THIS FILE EXISTS. `flattenCompany` used to live in routes/companies.js.
 * When the secret-redaction fix was made there, routes/auth.js still had its own
 * unhardened copy — and `GET /api/auth/me` (which the SPA calls on every page
 * load) kept spreading the whole `companies.api_keys` blob to the client. So the
 * redaction on /api/companies/current could be bypassed simply by reading
 * /api/auth/me instead, handing the lowest-privileged member of a company its
 * OpenAI/Anthropic billing keys, every social and ads OAuth token, the SMTP /
 * Resend / Gmail credentials, the WhatsApp token and the WordPress password.
 *
 * Two copies of a security decision is one copy too many. Both routers now import
 * from here, so the rule cannot drift out of sync again.
 */

/**
 * A key whose VALUE must never reach a non-admin. Matched on the suffix so any
 * future `*_api_key` / `*_secret` / `*_token` / `*_password` field is covered
 * automatically rather than needing to be added to a list someone will forget.
 */
export const SECRET_KEY_RE = /(_api_key|_secret|_token|_password|refresh_token)$/i;

/**
 * Roles allowed to see raw credential values for their own company.
 *
 * `company_admin` is included because they are the person who PASTES these keys
 * in — the Integrations screen cannot work without reading them back. Plain
 * members ('user') get presence booleans only.
 */
const SECRET_ROLES = new Set(['owner', 'system_admin', 'company_admin']);

export const canSeeCompanySecrets = (role) => SECRET_ROLES.has(String(role || ''));

/**
 * Flatten a company row: spread the api_keys and settings JSONB into top-level
 * keys so the frontend can read `company.openai_api_key` transparently.
 *
 * `includeSecrets` MUST be false for anyone who is not a company admin. Non-admins
 * get `has_<field>` presence booleans instead of values, so the UI can still show
 * "connected" without the secret being on the wire.
 *
 * Defaults to false deliberately: a caller that forgets the flag redacts rather
 * than leaks.
 */
export function flattenCompany(row, { includeSecrets = false } = {}) {
  if (!row) return row;
  const { api_keys, settings, ...rest } = row;
  const keys = api_keys || {};

  if (includeSecrets) {
    return { ...rest, ...keys, ...(settings || {}) };
  }

  const safe = {};
  for (const [k, v] of Object.entries(keys)) {
    if (SECRET_KEY_RE.test(k)) {
      // Presence only — never the value.
      safe[`has_${k}`] = !!(v && String(v).trim());
    } else {
      // Non-secret config (chosen provider, model names, account ids…) is fine.
      safe[k] = v;
    }
  }
  return { ...rest, ...safe, ...(settings || {}) };
}

export default flattenCompany;
