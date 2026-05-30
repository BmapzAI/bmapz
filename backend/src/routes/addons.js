/**
 * Add-on purchases: extra AI credits, extra scan tokens, etc.
 *
 * These endpoints handle the bookkeeping for purchasing one-off resources.
 * Actual Stripe checkout/payment is handled by /api/billing/checkout — these
 * endpoints are called by the Stripe webhook on payment success, OR by
 * System Admins for manual grants.
 */
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Add-on definitions — single source of truth (mirror frontend ADDON_PRICES).
const ADDONS = {
  extra_credit_pack: { price: 79.90, credits: 15000 },
  extra_full_scan:   { price: 800,   scan_tokens: 1 },
  extra_user:        { price: 79.90 },
  extra_company:     { price: 750 },
};

/**
 * POST /api/addons/purchase
 * Body: { type: 'extra_credit_pack' | 'extra_full_scan' | 'extra_user' | 'extra_company', quantity }
 *
 * Marks the add-on as purchased on the active subscription. This endpoint
 * should be called by the Stripe webhook on successful payment OR by an admin
 * for manual grants. System Admins can use it directly; other users go through
 * the billing flow.
 */
router.post('/purchase', requireAuth, async (req, res) => {
  try {
    const { type, quantity = 1, payment_ref } = req.body;
    if (!ADDONS[type]) {
      return res.status(400).json({ error: `Unknown add-on type: ${type}` });
    }

    // Only System Admin / Owner can directly grant; everyone else must go via
    // billing (which calls this endpoint from the Stripe webhook).
    // For now, require any payment_ref OR admin role.
    if (!payment_ref && req.dbUser?.role !== 'owner' && req.dbUser?.role !== 'system_admin') {
      return res.status(403).json({ error: 'Add-ons must be purchased via the Billing page. Direct grant requires admin role.' });
    }

    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) return res.status(404).json({ error: 'No active subscription. Subscribe first.' });

    const addon = ADDONS[type];
    const updates = {};
    let txnType, txnDesc, creditsDelta = 0;

    if (type === 'extra_credit_pack') {
      const credits = (addon.credits || 0) * quantity;
      updates.topup_credits_purchased = (sub.topup_credits_purchased || 0) + credits;
      txnType = 'topup';
      txnDesc = `Extra Credit Pack ×${quantity} (+${credits} credits)`;
      creditsDelta = credits;
    } else if (type === 'extra_full_scan') {
      const tokens = (addon.scan_tokens || 0) * quantity;
      updates.scan_tokens_addon = (sub.scan_tokens_addon || 0) + tokens;
      txnType = 'scan_addon';
      txnDesc = `Full Scan token ×${quantity}`;
    } else if (type === 'extra_user' || type === 'extra_company') {
      // These are billed monthly via Stripe subscription items — no DB change
      // here; the subscription's user_seats / company_profiles count updates
      // via the billing webhook directly.
      txnType = 'bonus';
      txnDesc = `${type} ×${quantity} (handled by subscription billing)`;
    }

    if (Object.keys(updates).length > 0) {
      await supabaseAdmin.from('subscriptions').update(updates).eq('id', sub.id);
    }

    await supabaseAdmin.from('credit_transactions').insert({
      company_id: req.companyId,
      subscription_id: sub.id,
      type: txnType,
      feature: type,
      credits_delta: creditsDelta,
      credits_after: (sub.ai_credits_total || 0) + (sub.topup_credits_purchased || 0) + creditsDelta - (sub.ai_credits_used || 0),
      description: txnDesc,
      metadata: { addon: type, quantity, payment_ref: payment_ref || null, granted_by: req.dbUser?.email || null },
    });

    res.json({ success: true, type, quantity });
  } catch (err) {
    console.error('[addons/purchase]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/addons/cancel-annual
 * Cancels an annual subscription and computes the cancellation fee.
 * Fee = (monthly_price - annual_monthly_equivalent) × months_used
 * Refund = remaining_prepaid_months - fee
 */
router.post('/cancel-annual', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) return res.status(404).json({ error: 'No subscription found' });
    if (sub.billing_cycle !== 'annual') {
      return res.status(400).json({ error: 'Only annual subscriptions can use this endpoint.' });
    }

    // Plan price lookup — mirror frontend-src/lib/plans.js
    const PLAN_PRICES = {
      starter:    { monthly: 79.90, annual: 67.90 },
      growth:     { monthly: 298,   annual: 253.30 },
      scale:      { monthly: 785,   annual: 667.25 },
      enterprise: { monthly: 2350,  annual: 1997.50 },
    };
    const prices = PLAN_PRICES[sub.plan_id];
    if (!prices) return res.status(400).json({ error: `Plan ${sub.plan_id} has no pricing data` });

    const start = new Date(sub.annual_start_at || sub.created_at);
    const now = new Date();
    const monthsUsed = Math.max(0, Math.floor((now - start) / (30 * 86400_000)));

    let fee = 0, refund = 0;
    if (monthsUsed < 12) {
      // Recover discount on months used
      const monthlyDiscount = Math.max(0, prices.monthly - prices.annual);
      fee = +(monthlyDiscount * monthsUsed).toFixed(2);
      const remainingMonths = 12 - monthsUsed;
      const prepaidRefund = +(prices.annual * remainingMonths).toFixed(2);
      refund = Math.max(0, +(prepaidRefund - fee).toFixed(2));
    }

    // Mark sub cancelled + log the fee transaction
    await supabaseAdmin.from('subscriptions').update({
      status: 'cancelled',
      cancelled_at: now.toISOString(),
    }).eq('id', sub.id);

    await supabaseAdmin.from('credit_transactions').insert({
      company_id: req.companyId,
      subscription_id: sub.id,
      type: 'cancellation_fee',
      feature: 'annual_early_cancel',
      credits_delta: 0,
      credits_after: 0,
      description: `Annual cancellation after ${monthsUsed} months — fee R$ ${fee.toFixed(2)}, refund R$ ${refund.toFixed(2)}`,
      metadata: { fee, refund, months_used: monthsUsed, plan_id: sub.plan_id, cancelled_by: req.dbUser?.email },
    });

    res.json({
      cancelled: true,
      plan_id: sub.plan_id,
      months_used: monthsUsed,
      cancellation_fee_brl: fee,
      refund_brl: refund,
      message: monthsUsed >= 12
        ? 'Annual subscription cancelled — no fee (completed 12+ months).'
        : `Annual subscription cancelled after ${monthsUsed} months. Cancellation fee R$ ${fee.toFixed(2)} (recovers the 15% annual discount applied to months consumed). Net refund R$ ${refund.toFixed(2)}.`,
    });
  } catch (err) {
    console.error('[addons/cancel-annual]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
