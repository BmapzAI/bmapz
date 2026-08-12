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

  // ── Privilege and billing columns ──────────────────────────────────────────
  // No current caller passes a `users` or `subscriptions` body through here, so
  // these are latent rather than live. They are listed anyway because the cost of
  // being wrong is total: `accessible_company_ids` is what every RLS policy and
  // the company switcher trust to decide which companies you may touch, so one bad
  // write there is a cross-company breach. The database trigger added in migration
  // 029 blocks these for direct client requests, but it deliberately EXEMPTS
  // service_role — which is exactly how this backend connects. So the trigger does
  // not cover this path; only this list does.
  //
  // THE RULE FOR THIS LIST: it is global, applied to every table that passes
  // through sanitizeUpdate (currently blog_posts, dashboard_configs, funnels,
  // leads, seo_analyses). A key belongs here only if it is never a legitimate
  // client-editable column on ANY of them. Two near-misses, both verified against
  // the live schema: `status` is real and editable on leads/blog_posts/funnels,
  // and `role` is the lead contact's JOB TITLE on `leads`. Blocking either here
  // would have silently broken lead editing and blog publishing. Privileged
  // columns that share a name with a legitimate one must be blocked per call site
  // via `alsoBlock`, never here.
  'accessible_company_ids',
  'active_company_id',   // changed only via /api/companies/switch, which verifies membership
  'username',            // 90-day cooldown enforced in routes/users.js + trigger 027
  'handle',              // same, for companies
  'username_changed_at',
  'handle_changed_at',
  'plan',                // billing state belongs to Stripe + the webhook, never a client
  'ai_credits_total',
  'ai_credits_used',
  'contacts_limit',
  'stripe_customer_id',
  'stripe_subscription_id',
  // NOT `status`, deliberately. `subscriptions.status` should never be client-set,
  // but this is a GLOBAL deny-list and `status` is a legitimate, client-editable
  // column on leads, blog_posts, funnels and social_posts. Blocking it here would
  // silently stop lead stage changes and blog publishing — the precise failure
  // this file exists to prevent. If sanitizeUpdate is ever pointed at
  // `subscriptions`, block it at that call site with
  // `sanitizeUpdate(req.body, { alsoBlock: ['status'] })`.
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
