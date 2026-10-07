// Maps a Stripe price id back to the Bmapz plan it was configured for.
//
// Checkout is created from STRIPE_PRICE_ID_<PLAN>_<MONTHLY|ANNUAL> (routes/billing.js resolvePriceId, with a plain
// STRIPE_PRICE_ID_<PLAN> fallback). The webhook needs the reverse: a customer who changes plan in the Stripe Customer Portal
// produces only `customer.subscription.updated` carrying the new price id, and nothing else tells us which plan that is.
// Returns null for an id that is not configured, so an unknown price can never change anyone's plan.
const PLANS = ['starter', 'growth', 'scale', 'enterprise'];
const SUFFIXES = ['_MONTHLY', '_ANNUAL', ''];

export function planForPriceId(priceId) {
  const wanted = String(priceId || '').trim();
  if (!wanted) return null;
  for (const plan of PLANS) {
    for (const suffix of SUFFIXES) {
      const configured = String(process.env[`STRIPE_PRICE_ID_${plan.toUpperCase()}${suffix}`] || '').trim();
      if (configured && configured === wanted) return plan;
    }
  }
  return null;
}
