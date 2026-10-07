/**
 * Map a Stripe subscription status onto the statuses this app's `subscriptions` table accepts.
 *
 * The LIVE table has CHECK (status IN ('trialing','active','past_due','canceled','paused')) (read from the
 * production database 2026-10-07). Stripe also emits `unpaid`, `incomplete` and `incomplete_expired`. Writing
 * one of those violates the constraint; supabase-js RESOLVES with an error instead of throwing, and the
 * webhook handler discarded it - so a customer whose payment had failed outright stayed `active` locally and
 * kept full access.
 *
 * Mapped rather than widening the constraint: a billing table's constraint is a riskier thing to change than
 * a pure function, and every place that gates access already understands the five statuses.
 *
 * Returns null for a status we do not recognise (a future Stripe addition): callers must NOT write it, and
 * should log it, rather than guess.
 */
export function toLocalSubscriptionStatus(stripeStatus) {
  switch (stripeStatus) {
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'canceled':
    case 'paused':
      return stripeStatus;
    case 'unpaid':              // retries exhausted: access must stop, same as past_due
    case 'incomplete':          // first payment not completed: not a paying customer yet
      return 'past_due';
    case 'incomplete_expired':  // the first payment never completed and the window closed
      return 'canceled';
    default:
      return null;
  }
}
