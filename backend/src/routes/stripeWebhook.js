import { Router } from 'express';
import { toLocalSubscriptionStatus } from '../lib/stripeStatus.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { grantAddon } from './addons.js';
import { PLAN_MONTHLY_CREDITS, PLAN_SCAN_TOKENS } from '../lib/aiCredits.js';

const router = Router();

// Credit grants MUST match what the plans actually promise. This table listed
// starter: 1000 (the plan sells 15,000) and a "professional" plan that does not
// exist, while growth/scale were missing entirely and silently fell back to
// 1000 — so every paying customer was granted a fraction of what they bought.
// PLAN_MONTHLY_CREDITS in lib/aiCredits.js is the single source of truth.

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
          try {
            await grantAddon({
              companyId,
              type: addonType,
              quantity,
              paymentRef: session.payment_intent || session.id,
              grantedBy: 'stripe_webhook',
              provider: 'stripe',
            });
            await supabaseAdmin.from('billing_purchases').insert({
              company_id: companyId,
              type: addonType,
              amount_brl: (session.amount_total || 0) / 100,
              status: 'paid',
              stripe_payment_intent_id: session.payment_intent,
              payment_provider: 'stripe',
              provider_reference: session.id,
            });
          } catch (e) {
            console.error('[stripe webhook] add-on grant failed:', e.message);
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

        if (existing) {
          await supabaseAdmin.from('subscriptions').update({
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
          }).eq('id', existing.id);
        } else {
          await supabaseAdmin.from('subscriptions').insert({
            company_id: companyId,
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
          });
        }

        // Log purchase
        await supabaseAdmin.from('billing_purchases').insert({
          company_id: companyId,
          type: 'plan_upgrade',
          amount_brl: (session.amount_total || 0) / 100,
          status: 'paid',
          stripe_payment_intent_id: session.payment_intent,
          credits_granted: credits,
          payment_provider: 'stripe',
          provider_reference: session.id,
        });

        // Credit transaction
        await supabaseAdmin.from('credit_transactions').insert({
          company_id: companyId,
          type: 'monthly_grant',
          feature: 'subscription',
          credits_delta: credits,
          credits_after: credits,
        });
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
    // This used to fall through to 200, so a failed handler was acknowledged and never retried.
    // The status updates above are idempotent, so for those the event is given back and Stripe is told to
    // retry. checkout.session.* performs several NON-atomic writes: unlocking after a partial failure could
    // grant twice, so for those the row is kept (never double-grant) but the failure is made loud and
    // greppable instead of vanishing. Making that path transactional is the open fix (AGENT_HANDOFF.md).
    if (/^checkout\.session\./.test(event.type)) {
      console.error(`[stripe webhook] NEEDS MANUAL RECONCILIATION: ${event.type} ${event.id} failed partway (${err.message})`);
    } else {
      await unlock();
      return res.status(500).json({ error: 'handler failed, retry' });
    }
  }

  res.json({ received: true });
});

export default router;
