import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireCompanyAdmin } from '../middleware/auth.js';

const router = Router();

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

// POST /api/billing/checkout — create Stripe Checkout Session
router.post('/checkout', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const { plan, price_id, success_url, cancel_url } = req.body;
    if (!price_id) return res.status(400).json({ error: 'price_id is required' });

    const stripe = await getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: price_id, quantity: 1 }],
      customer_email: req.dbUser.email,
      metadata: { company_id: req.companyId, plan },
      success_url: success_url || `${process.env.FRONTEND_URL}/billing?success=true`,
      cancel_url: cancel_url || `${process.env.FRONTEND_URL}/billing?cancelled=true`,
    });

    res.json({ url: session.url, session_id: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
