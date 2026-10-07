import { Router } from 'express';
import { toLocalSubscriptionStatus } from '../lib/stripeStatus.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { grantAddon } from './addons.js';
import { PLAN_MONTHLY_CREDITS, PLAN_SCAN_TOKENS } from '../lib/aiCredits.js';
import { planForPriceId } from '../lib/stripePlans.js';

const router = Router();

// Credit grants MUST match what the plans actually promise. This table listed
// starter: 1000 (the plan sells 15,000) and a "professional" plan that does not
// exist, while growth/scale were missing entirely and silently fell back to
// 1000 — so every paying customer was granted a fraction of what they bought.
// PLAN_MONTHLY_CREDITS in lib/aiCredits.js is the single source of truth.

// billing_purchases.type is CHECK-constrained to credit_topup|full_scan|extra_user|extra_company_profile|plan_upgrade, while the add-on
// ids are extra_credit_pack|extra_full_scan|extra_user|extra_company. Inserting the add-on id violated the CHECK for three of the four
// and the error was discarded, so those purchases left no record.
const ADDON_PURCHASE_TYPE = {
  extra_credit_pack: 'credit_topup',
  extra_full_scan: 'full_scan',
  extra_user: 'extra_user',
  extra_company: 'extra_company_profile',
};

const PLAN_CONTACTS_MAP = {
  trial: 1500,
  starter: 1500,
  growth: 10000,
  scale: 50000,
  enterprise: 100000,
};

router.post('/api/stripe/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: process.env.STRIPE_API_VERSION || '2024-06-20' });
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe webhook] signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Signature verification proves the event is GENUINE. It says nothing about
  // whether we have already acted on it — and Stripe retries anything we do not
  // answer 2xx to, so a slow response or a transient error re-delivered
  // checkout.session.completed and re-granted a full month of plan credits,
  // duplicating the ledger rows with it.
  //
  // The insert IS the lock: the primary key rejects a duplicate, and that rejection
  // means "already handled". Recorded BEFORE the work, so a retry cannot race the
  // first delivery still in flight.
  const { error: seenErr } = await supabaseAdmin
    .from('webhook_events')
    .insert({ id: event.id, provider: 'stripe', event_type: event.type });
  if (seenErr) {
    if (/duplicate key|already exists/i.test(seenErr.message || '')) {
      console.log(`[stripe webhook] ${event.id} (${event.type}) already processed — skipping`);
      return res.json({ received: true, duplicate: true });
    }
    // Anything else and we cannot prove this is a first delivery. Fail so Stripe
    // retries, rather than risk granting twice.
    console.error('[stripe webhook] idempotency check failed:', seenErr.message);
    return res.status(503).json({ error: 'temporarily unable to process' });
  }

  // Give the event back so Stripe's RETRY is processed. The row above means "already handled", so any
  // path that answers failure after recording it must remove it, or the retry is acknowledged as a duplicate
  // and the work is never done. Only safe where nothing has been written yet, or the write is idempotent.
  const unlock = () => supabaseAdmin.from('webhook_events').delete().eq('id', event.id);

  try {
    switch (event.type) {
      // A delayed-notification payment method completes the Checkout session UNPAID and pays later,
      // announcing it with async_payment_succeeded. Granting on 'completed' alone gave the plan away
      // before the money arrived, and nothing handled the later event.
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        if (session.payment_status === 'unpaid') break;
        const companyId = session.metadata?.company_id;
        const plan = session.metadata?.plan || 'starter';
        if (!companyId) break;

        // Add-on purchases (credit packs, scan tokens) are one-off payments,
        // not plan changes. Nothing handled them before: addons.js claimed the
        // webhook called POST /api/addons/purchase, but that route is behind
        // requireAuth and a webhook has no session — so paid add-ons were
        // charged and never granted.
        const addonType = session.metadata?.addon_type;
        if (addonType) {
          const quantity = Number(session.metadata?.quantity || 1);
          let granted;
          try {
            granted = await grantAddon({
              companyId,
              type: addonType,
              quantity,
              paymentRef: session.payment_intent || session.id,
              grantedBy: 'stripe_webhook',
              provider: 'stripe',
            });
          } catch (e) {
            // Swallowed deliberately: grantAddon claims its ledger row FIRST, so a Stripe retry would be told
            // "already granted" and the credits would still be missing. Make it loud and greppable instead.
            console.error(`[stripe webhook] NEEDS MANUAL RECONCILIATION: paid add-on not granted for ${event.id} (${e.message})`);
            break;
          }
          // The purchase record is bookkeeping for a grant that already happened, so a failure here is logged, never retried
          // (a retry would only be told "already granted"). One row per checkout session.
          const purchaseType = ADDON_PURCHASE_TYPE[addonType] || addonType;
          const { data: haveRow, error: haveErr } = await supabaseAdmin
            .from('billing_purchases')
            .select('id')
            .eq('company_id', companyId)
            .eq('provider_reference', session.id)
            .eq('type', purchaseType)
            .limit(1)
            .maybeSingle();
          if (!haveErr && !haveRow) {
            const { error: purchaseErr } = await supabaseAdmin.from('billing_purchases').insert({
              company_id: companyId,
              type: purchaseType,
              quantity,
              amount_brl: (session.amount_total || 0) / 100,
              status: 'paid',
              credits_granted: granted?.credits_granted || 0,
              scan_tokens_granted: addonType === 'extra_full_scan' ? quantity : 0,
              stripe_payment_intent_id: session.payment_intent,
              payment_provider: 'stripe',
              provider_reference: session.id,
            });
            if (purchaseErr) console.error(`[stripe webhook] add-on ${addonType} was granted for ${event.id} but its billing_purchases row failed: ${purchaseErr.message}`);
          } else if (haveErr) {
            console.error(`[stripe webhook] add-on purchase lookup failed for ${event.id}: ${haveErr.message}`);
          }
          break;
        }

        const credits = PLAN_MONTHLY_CREDITS[plan] ?? PLAN_MONTHLY_CREDITS.starter;
        const contactsLimit = PLAN_CONTACTS_MAP[plan] || 1500;
        const scanTokens = PLAN_SCAN_TOKENS[plan] || 0;

        // Upsert subscription.
        // .limit(1) + explicit error check: .single() errors both when there is
        // no row AND when there are two, and the discarded error made all three
        // outcomes look like "no subscription" → INSERT. Stripe delivers events
        // at-least-once, so a replayed checkout would then add another row.
        const { data: existing, error: subReadErr } = await supabaseAdmin
          .from('subscriptions')
          .select('id')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        // Fail the webhook so Stripe RETRIES, rather than writing on a bad read.
        if (subReadErr) {
          console.error('[stripe webhook] subscription read failed, asking Stripe to retry:', subReadErr.message);
          // Nothing has been written yet, so the event can safely be handed back. Without this the 503
          // was followed by a retry that hit the duplicate row and was acknowledged "already processed".
          await unlock();
          return res.status(503).json({ error: 'subscription read failed' });
        }

        // Paying starts the billing cycle. Without these the subscription has no
        // cycle end, the monthly reset can never fire, and the customer would
        // receive their first month's credits and never another.
        const cycleStart = new Date();
        const cycleEnd = new Date(cycleStart.getTime() + 30 * 86400_000);
        const cycleFields = {
          cycle_started_at: cycleStart.toISOString(),
          cycle_ends_at: cycleEnd.toISOString(),
          last_reset_at: cycleStart.toISOString(),
        };

        // RETRY-SAFE BY CONSTRUCTION, so a failure here can hand the event back to Stripe (see unlock):
        //  - the subscription write SETS a final state, so repeating it is harmless;
        //  - the credit-ledger row carries a deterministic payment_ref and the unique index
        //    uq_credit_tx_payment_ref turns it into a durable claim: "this payment was granted";
        //  - the purchase row is only inserted when none exists for this session.
        // Every write is CHECKED. supabase-js resolves with { error } instead of throwing, and these
        // errors used to be discarded, so a failed grant answered 200 and Stripe never retried.
        const planRef = `plan:${session.id}`;
        const { data: claimed, error: claimErr } = await supabaseAdmin
          .from('credit_transactions')
          .select('id')
          .eq('company_id', companyId)
          .eq('metadata->>payment_ref', planRef)
          .limit(1)
          .maybeSingle();
        if (claimErr) {
          console.error('[stripe webhook] ledger read failed, asking Stripe to retry:', claimErr.message);
          await unlock();
          return res.status(503).json({ error: 'ledger read failed' });
        }

        if (!claimed) {
          const subFields = {
            plan,
            status: 'active',
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            ai_credits_total: credits,
            ai_credits_used: 0,
            contacts_limit: contactsLimit,
            scan_tokens_total: scanTokens,
            scan_tokens_used: 0,
            ...cycleFields,
          };
          const { error: subWriteErr } = existing
            ? await supabaseAdmin.from('subscriptions').update(subFields).eq('id', existing.id)
            : await supabaseAdmin.from('subscriptions').insert({ company_id: companyId, ...subFields });
          if (subWriteErr) throw subWriteErr;

          const { error: ledgerErr } = await supabaseAdmin.from('credit_transactions').insert({
            company_id: companyId,
            type: 'monthly_grant',
            feature: 'subscription',
            credits_delta: credits,
            credits_after: credits,
            metadata: { payment_ref: planRef, stripe_session_id: session.id },
          });
          // 23505 = another delivery already recorded this grant. That IS the claim, not a failure.
          if (ledgerErr && ledgerErr.code !== '23505') throw ledgerErr;
        }

        // Log the purchase once per session.
        const { data: boughtAlready, error: boughtErr } = await supabaseAdmin
          .from('billing_purchases')
          .select('id')
          .eq('company_id', companyId)
          .eq('provider_reference', session.id)
          .eq('type', 'plan_upgrade')
          .limit(1)
          .maybeSingle();
        if (boughtErr) throw boughtErr;
        if (!boughtAlready) {
          const { error: purchaseErr } = await supabaseAdmin.from('billing_purchases').insert({
            company_id: companyId,
            type: 'plan_upgrade',
            amount_brl: (session.amount_total || 0) / 100,
            status: 'paid',
            stripe_payment_intent_id: session.payment_intent,
            credits_granted: credits,
            payment_provider: 'stripe',
            provider_reference: session.id,
          });
          if (purchaseErr) throw purchaseErr;
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        // The table accepts five statuses and Stripe has eight (see lib/stripeStatus.js). Writing the raw
        // value violated the constraint and the error was discarded, so an unpaid customer stayed active.
        const localStatus = toLocalSubscriptionStatus(sub.status);
        if (!localStatus) {
          console.error(`[stripe webhook] unrecognised subscription status "${sub.status}" on ${sub.id}; not writing it`);
          break;
        }
        const { error: subUpdErr } = await supabaseAdmin
          .from('subscriptions')
          .update({
            status: localStatus,
            stripe_subscription_id: sub.id,
          })
          .eq('stripe_customer_id', sub.customer);
        if (subUpdErr) throw subUpdErr;

        // A plan change made in the Stripe Customer Portal produces ONLY this event, carrying the new price id; nothing here used to
        // look at it, so the customer paid for the new plan and kept the old plan's credits and limits. Map the price back to a plan
        // (lib/stripePlans.js, from the same env vars checkout is built from) and apply it. Only for a live subscription, only for a
        // configured price (an unknown price changes nothing), and only when the plan really differs, so replays are no-ops.
        if (localStatus === 'active' || localStatus === 'trialing') {
          const newPlan = (sub.items?.data || []).map((item) => planForPriceId(item?.price?.id)).find(Boolean);
          if (newPlan) {
            const { data: current, error: curErr } = await supabaseAdmin
              .from('subscriptions')
              .select('id, company_id, plan, ai_credits_total, ai_credits_used, topup_credits_purchased')
              .eq('stripe_customer_id', sub.customer)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (curErr) throw curErr;
            if (current && current.plan !== newPlan) {
              const credits = PLAN_MONTHLY_CREDITS[newPlan];
              const { error: planErr } = await supabaseAdmin
                .from('subscriptions')
                .update({
                  plan: newPlan,
                  // Used credits are kept: an upgrade is headroom right away, a downgrade takes effect now.
                  ai_credits_total: credits,
                  contacts_limit: PLAN_CONTACTS_MAP[newPlan] || 1500,
                  scan_tokens_total: PLAN_SCAN_TOKENS[newPlan] || 0,
                })
                .eq('id', current.id);
              if (planErr) throw planErr;
              const delta = credits - (current.ai_credits_total || 0);
              console.log(`[stripe webhook] plan change from the portal: company ${current.company_id} ${current.plan} -> ${newPlan} (${delta >= 0 ? '+' : ''}${delta} credits)`);
              // Audit row only for an increase (the ledger has no type for a reduction). The plan write above already happened and is
              // a repeatable SET, so a failure here is logged rather than retried.
              if (delta > 0) {
                const { error: ledgerErr } = await supabaseAdmin.from('credit_transactions').insert({
                  company_id: current.company_id,
                  subscription_id: current.id,
                  type: 'monthly_grant',
                  feature: 'plan_change',
                  credits_delta: delta,
                  credits_after: credits + (current.topup_credits_purchased || 0) - (current.ai_credits_used || 0),
                  description: `Plan changed in the Stripe portal: ${current.plan} -> ${newPlan} (+${delta} credits)`,
                  metadata: { from_plan: current.plan, to_plan: newPlan, stripe_event_id: event.id },
                });
                if (ledgerErr) console.error(`[stripe webhook] plan-change ledger row failed for ${event.id}: ${ledgerErr.message}`);
              }
            }
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const { error: subDelErr } = await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'canceled', plan: 'trial', ai_credits_total: 100 })
          .eq('stripe_customer_id', sub.customer);
        if (subDelErr) throw subDelErr;
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const { error: invErr } = await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_customer_id', invoice.customer);
        if (invErr) throw invErr;
        break;
      }
    }
  } catch (err) {
    console.error('[stripe webhook] handler error:', err.message);
    // This used to fall through to 200, so a failed handler was acknowledged and never retried. Every branch
    // above is now safe to run again (status updates set a final state; the plan grant is claim-keyed), so
    // the event is given back and Stripe is told to retry.
    await unlock();
    return res.status(500).json({ error: 'handler failed, retry' });
  }

  res.json({ received: true });
});

export default router;
