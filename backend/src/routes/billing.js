import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireCompanyAdmin } from '../middleware/auth.js';
import { getActiveProvider, getPaymentSettings } from '../lib/paymentProviders.js';

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
  const Stripe = (await import('stripe')).default;
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
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

// POST /api/billing/checkout — create Stripe Checkout Session
router.post('/checkout', requireAuth, requireCompanyAdmin, async (req, res) => {
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
      successUrl: success_url || `${process.env.FRONTEND_URL}/billing?success=true`,
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
router.post('/portal', requireAuth, requireCompanyAdmin, async (req, res) => {
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
