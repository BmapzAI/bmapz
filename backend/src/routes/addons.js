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
/**
 * Grant an add-on to a company. Shared by the authenticated route below AND by
 * the Stripe webhook.
 *
 * The webhook could never call POST /api/addons/purchase — that route sits
 * behind requireAuth and a webhook has no user session — so the comment
 * claiming "the Stripe webhook calls this endpoint" was never true and paid
 * add-ons were never granted. Exporting the logic fixes that without giving the
 * webhook a fake session.
 */
export async function grantAddon({ companyId, type, quantity = 1, paymentRef = null, grantedBy = null, provider = 'stripe' }) {
  if (!ADDONS[type]) throw new Error(`Unknown add-on type: ${type}`);

  // IDEMPOTENCY. Stripe delivers webhooks at-least-once, so a replayed
  // checkout.session.completed would grant the same credit pack again — free
  // credits for a single payment. The payment reference is the natural key:
  // if a transaction already recorded it, this grant already happened.
  if (paymentRef) {
    const { data: already, error: dupErr } = await supabaseAdmin
      .from('credit_transactions')
      .select('id')
      .eq('company_id', companyId)
      .eq('metadata->>payment_ref', paymentRef)
      .limit(1)
      .maybeSingle();
    if (dupErr) throw dupErr; // never grant on a failed duplicate check
    if (already) {
      console.log(`[addons] payment_ref ${paymentRef} already granted — skipping duplicate`);
      return { success: true, type, quantity, credits_granted: 0, duplicate: true };
    }
  }

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) throw new Error('No active subscription for this company.');

  const addon = ADDONS[type];
  const updates = {};
  let txnType = 'bonus';
  let txnDesc = `${type} ×${quantity}`;
  let creditsDelta = 0;

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
    txnDesc = `${type} ×${quantity} (handled by subscription billing)`;
  }

  if (Object.keys(updates).length > 0) {
    await supabaseAdmin.from('subscriptions').update(updates).eq('id', sub.id);
  }

  await supabaseAdmin.from('credit_transactions').insert({
    company_id: companyId,
    subscription_id: sub.id,
    type: txnType,
    feature: type,
    credits_delta: creditsDelta,
    credits_after: (sub.ai_credits_total || 0) + (sub.topup_credits_purchased || 0) + creditsDelta - (sub.ai_credits_used || 0),
    description: txnDesc,
    metadata: { addon: type, quantity, payment_ref: paymentRef, granted_by: grantedBy, provider },
  });

  return { success: true, type, quantity, credits_granted: creditsDelta };
}

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

    const result = await grantAddon({
      companyId: req.companyId,
      type,
      quantity,
      paymentRef: payment_ref || null,
      grantedBy: req.dbUser?.email || null,
    });

    res.json(result);
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
    // sub.plan_id does not exist in the schema — the column is `plan`.
    const planId = sub.plan_id || sub.plan || 'trial';
    const prices = PLAN_PRICES[planId];
    if (!prices) return res.status(400).json({ error: `Plan ${planId} has no pricing data` });

    const start = new Date(sub.annual_start_at || sub.created_at);
    const now = new Date();
    const monthsUsed = Math.max(0, Math.floor((now - start) / (30 * 86400_000)));

    // Revenue-safe policy: refund only REFUND_PERCENTAGE of unused months,
    // minus the discount-recovery fee. Keep in sync with
    // frontend-src/lib/plans.js → ANNUAL_CANCELLATION_POLICY.
    const REFUND_PERCENTAGE = 0.30;
    let fee = 0, refund = 0, prepaidRemaining = 0, refundable = 0;
    if (monthsUsed < 12) {
      const monthlyDiscount = Math.max(0, prices.monthly - prices.annual);
      fee = +(monthlyDiscount * monthsUsed).toFixed(2);
      const remainingMonths = 12 - monthsUsed;
      prepaidRemaining = +(prices.annual * remainingMonths).toFixed(2);
      refundable = +(prepaidRemaining * REFUND_PERCENTAGE).toFixed(2);
      refund = Math.max(0, +(refundable - fee).toFixed(2));
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
      metadata: { fee, refund, months_used: monthsUsed, plan_id: planId, cancelled_by: req.dbUser?.email },
    });

    res.json({
      cancelled: true,
      plan_id: planId,
      months_used: monthsUsed,
      cancellation_fee_brl: fee,
      prepaid_remaining_brl: prepaidRemaining,
      refundable_at_30pct_brl: refundable,
      refund_brl: refund,
      refund_percentage: REFUND_PERCENTAGE,
      message: monthsUsed >= 12
        ? 'Annual subscription cancelled — no fee (completed 12+ months).'
        : `Annual subscription cancelled after ${monthsUsed} months. Cancellation fee R$ ${fee.toFixed(2)} (recovers the 15% annual discount on months consumed). 30% of unused prepaid is refundable: R$ ${refundable.toFixed(2)}. Net refund R$ ${refund.toFixed(2)}.`,
    });
  } catch (err) {
    console.error('[addons/cancel-annual]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
