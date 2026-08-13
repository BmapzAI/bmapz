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
const MAX_ADDON_QUANTITY = 100;

export async function grantAddon({ companyId, type, quantity = 1, paymentRef = null, grantedBy = null, provider = 'stripe' }) {
  if (!ADDONS[type]) throw new Error(`Unknown add-on type: ${type}`);

  // Quantity was taken from the caller unchecked and multiplied straight into the
  // credit grant, so `quantity: 1000` minted 15,000,000 credits in one request.
  // Validated here rather than in the route so the Stripe webhook path is covered
  // by the same bound.
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_ADDON_QUANTITY) {
    throw new Error(`quantity must be a whole number between 1 and ${MAX_ADDON_QUANTITY}`);
  }
  quantity = qty;

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

  // ── Write the LEDGER FIRST, then the balance. ──────────────────────────────
  // The order used to be reversed, and the insert's error was discarded entirely
  // (supabase-js returns { error } rather than throwing). Two bad consequences:
  // a grant could be applied while its audit row silently failed the
  // `uq_credit_tx_payment_ref` unique index from migration 028, leaving credits
  // added with NO record — which also defeated the idempotency check above,
  // because that check looks for exactly the row that failed to be written. The
  // same payment_ref could then be replayed indefinitely.
  //
  // Inserting first turns that unique index into a durable CLAIM: the check above
  // is a fast, friendly path, and this insert is the authority. A duplicate here
  // means another delivery already granted it, so we stop before touching the
  // balance. Writing the ledger and then failing to grant is the safe direction to
  // fail; granting and failing to log is not.
  const { error: txnErr } = await supabaseAdmin.from('credit_transactions').insert({
    company_id: companyId,
    subscription_id: sub.id,
    type: txnType,
    feature: type,
    credits_delta: creditsDelta,
    credits_after: (sub.ai_credits_total || 0) + (sub.topup_credits_purchased || 0) + creditsDelta - (sub.ai_credits_used || 0),
    description: txnDesc,
    metadata: { addon: type, quantity, payment_ref: paymentRef, granted_by: grantedBy, provider },
  });
  if (txnErr) {
    if (/duplicate key|uq_credit_tx_payment_ref/i.test(txnErr.message || '')) {
      console.log(`[addons] payment_ref ${paymentRef} already granted (unique index) — skipping duplicate`);
      return { success: true, type, quantity, credits_granted: 0, duplicate: true };
    }
    throw txnErr;
  }

  if (Object.keys(updates).length > 0) {
    const { error: subErr } = await supabaseAdmin
      .from('subscriptions').update(updates).eq('id', sub.id);
    if (subErr) throw subErr;
  }

  return { success: true, type, quantity, credits_granted: creditsDelta };
}

/**
 * POST /api/addons/purchase — MANUAL GRANT, platform staff only.
 *
 * This was the worst hole in the billing path. The gate read:
 *
 *   if (!payment_ref && role !== 'owner' && role !== 'system_admin') -> 403
 *
 * `payment_ref` is an arbitrary client string that was never checked against
 * Stripe, against `billing_purchases`, or against anything at all — merely being
 * PRESENT satisfied the condition. So any authenticated customer (any role, since
 * the route carried no role middleware) could POST
 * `{"type":"extra_credit_pack","quantity":1000,"payment_ref":"anything"}` and
 * grant themselves 15,000,000 spendable AI credits, then repeat with a different
 * ref for as many as they wanted. `extra_full_scan` was worse: it granted the
 * R$ 800 Full Scan, the most provider-expensive action in the product, to trial
 * users for whom it is deliberately disabled.
 *
 * A client-supplied payment reference can never be evidence of payment. Only the
 * signature-verified Stripe webhook may assert that, and it calls grantAddon()
 * directly (routes/stripeWebhook.js) rather than coming through HTTP — so nothing
 * legitimate needs this route to accept `payment_ref` from a customer.
 */
router.post('/purchase', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { type, quantity = 1 } = req.body;
    if (!ADDONS[type]) {
      return res.status(400).json({ error: `Unknown add-on type: ${type}` });
    }

    const result = await grantAddon({
      companyId: req.companyId,
      type,
      quantity,
      // A manual staff grant is not a payment. Recording a client-supplied string
      // as the payment reference would also poison the idempotency key that the
      // real webhook depends on.
      paymentRef: null,
      grantedBy: req.dbUser?.email || null,
      provider: 'manual',
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
