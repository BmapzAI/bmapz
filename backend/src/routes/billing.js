import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireCompanyAdmin } from '../middleware/auth.js';
import { getActiveProvider, getPaymentSettings } from '../lib/paymentProviders.js';
import { isAppOrigin } from '../lib/appOrigins.js';

const router = Router();

// GET /api/billing/payment-method — which provider customers will be charged
// through. Safe for any authenticated user: returns the label only, never
// credentials or the full provider config.
router.get('/payment-method', requireAuth, async (_req, res) => {
  try {
    const settings = await getPaymentSettings();
    const key = settings.active_provider || 'stripe';
    res.json({ provider: key, label: settings.providers?.[key]?.label || key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function getStripe() {
  // new Stripe(undefined) does NOT throw: the failure arrived later as a raw Stripe authentication error returned to
  // the browser, and the adapter's "not configured" guard (which tests for a falsy client) could never fire.
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const Stripe = (await import('stripe')).default;
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: process.env.STRIPE_API_VERSION || '2024-06-20' });
}

// GET /api/billing/subscription
router.get('/subscription', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Map plan_id + billing_cycle to Stripe price_id from environment
function resolvePriceId(planId, billingCycle) {
  const cycle = billingCycle === 'annual' ? 'ANNUAL' : 'MONTHLY';
  const key = `STRIPE_PRICE_ID_${String(planId).toUpperCase()}_${cycle}`;
  const fallbackKey = `STRIPE_PRICE_ID_${String(planId).toUpperCase()}`;
  return process.env[key] || process.env[fallbackKey] || null;
}

// The Android / iOS apps are consumption-only: the stores require their own payment system for digital subscriptions, so no checkout or
// portal session is ever created for a request from the apps' pages (the app build does not even contain the screens that call these).
// 404, not 403: it must not read as "you may buy elsewhere".
const refuseApps = (req, res, next) => (isAppOrigin(req) ? res.status(404).json({ error: 'Not found' }) : next());

// POST /api/billing/checkout — create Stripe Checkout Session
router.post('/checkout', refuseApps, requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const { plan, plan_id, price_id: directPriceId, billing_cycle, success_url, cancel_url } = req.body;
    const price_id = directPriceId || resolvePriceId(plan_id || plan, billing_cycle);
    if (!price_id) return res.status(400).json({ error: 'price_id is required. Provide price_id or a known plan_id.' });

    // Dispatch through the provider registry rather than calling Stripe
    // directly, so the App Owner can switch providers without a code change
    // (Admin → Payments). Stripe stays the default.
    const { key: providerKey, adapter } = await getActiveProvider();
    const stripe = providerKey === 'stripe' ? await getStripe() : null;

    const { url, reference } = await adapter.createCheckout({
      stripe,
      priceId: price_id,
      companyId: req.companyId,
      plan: plan || plan_id,
      customerEmail: req.dbUser.email,
      // {CHECKOUT_SESSION_ID} is replaced by Stripe, so the landing page can confirm the payment itself if the webhook is slow
      // (Checkout waits for nothing: the redirect and the webhook race).
      successUrl: success_url || `${process.env.FRONTEND_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: cancel_url || `${process.env.FRONTEND_URL}/billing?cancelled=true`,
      mode: 'subscription',
    });

    res.json({ url, session_id: reference, provider: providerKey });
  } catch (err) {
    const status = err.code?.startsWith('PROVIDER_') ? 503 : 500;
    res.status(status).json({ error: err.publicMessage || err.message, code: err.code });
  }
});

// POST /api/billing/portal — Stripe Customer Portal
router.post('/portal', refuseApps, requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('company_id', req.companyId)
      .single();

    if (!sub?.stripe_customer_id) {
      return res.status(400).json({ error: 'No Stripe customer found. Please subscribe first.' });
    }

    const stripe = await getStripe();
    if (!stripe) return res.status(503).json({ error: 'Stripe is not configured on the server (STRIPE_SECRET_KEY missing).' });
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: req.body.return_url || `${process.env.FRONTEND_URL}/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/purchases
router.get('/purchases', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('billing_purchases')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/transactions
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('credit_transactions')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
