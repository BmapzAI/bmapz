import { Router } from 'express';
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
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe webhook] signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
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
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: sub.status,
            stripe_subscription_id: sub.id,
          })
          .eq('stripe_customer_id', sub.customer);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'canceled', plan: 'trial', ai_credits_total: 100 })
          .eq('stripe_customer_id', sub.customer);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_customer_id', invoice.customer);
        break;
      }
    }
  } catch (err) {
    console.error('[stripe webhook] handler error:', err.message);
  }

  res.json({ received: true });
});

export default router;
