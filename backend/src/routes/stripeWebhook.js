import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

const PLAN_CREDIT_MAP = {
  starter: 1000,
  professional: 5000,
  enterprise: 20000,
};

const PLAN_CONTACTS_MAP = {
  starter: 1000,
  professional: 10000,
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

        const credits = PLAN_CREDIT_MAP[plan] || 1000;
        const contactsLimit = PLAN_CONTACTS_MAP[plan] || 1000;

        // Upsert subscription
        const { data: existing } = await supabaseAdmin
          .from('subscriptions')
          .select('id')
          .eq('company_id', companyId)
          .single();

        if (existing) {
          await supabaseAdmin.from('subscriptions').update({
            plan,
            status: 'active',
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            ai_credits_total: credits,
            ai_credits_used: 0,
            contacts_limit: contactsLimit,
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
          });
        }

        // Log purchase
        await supabaseAdmin.from('billing_purchases').insert({
          company_id: companyId,
          type: 'subscription',
          amount_usd: (session.amount_total || 0) / 100,
          status: 'completed',
          stripe_payment_intent_id: session.payment_intent,
          credits_granted: credits,
          plan,
        });

        // Credit transaction
        await supabaseAdmin.from('credit_transactions').insert({
          company_id: companyId,
          type: 'subscription_grant',
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
          .update({ status: 'cancelled', plan: 'free', ai_credits_total: 100 })
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
