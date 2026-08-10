/**
 * Strip identity / tenancy columns from a client-supplied update body.
 *
 * WHY: several PATCH handlers passed `req.body` straight into `.update()`.
 * `.eq('company_id', req.companyId)` only constrains WHICH row is updated — it
 * does not stop `company_id` appearing in the SET clause. So a client could
 * PATCH its own record with `{"company_id": "<another tenant>"}` and transplant
 * that row into someone else's company (or, with `is_global: true`, publish its
 * private template to every company on the platform).
 *
 * Deliberately a DENY-list rather than an allow-list: an allow-list per table
 * would silently drop legitimate fields the moment the schema grows, and silent
 * write failures have bitten this codebase repeatedly. These keys are never
 * things a client should be setting.
 */
const NEVER_WRITABLE = new Set([
  'id',
  'company_id',
  'created_at',
  'created_by',
  'is_global',     // makes a private template visible to every company
  'user_id',       // ownership is changed through dedicated, validated routes
  'owner_id',
]);

export function sanitizeUpdate(body, { alsoBlock = [], allowOwner = false } = {}) {
  const blocked = new Set(NEVER_WRITABLE);
  for (const k of alsoBlock) blocked.add(k);
  if (allowOwner) { blocked.delete('owner_id'); blocked.delete('user_id'); }

  const out = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (!blocked.has(k)) out[k] = v;
  }
  return out;
}

export default sanitizeUpdate;
