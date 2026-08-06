/**
 * Payment provider registry.
 *
 * Stripe is the primary method for taking customer payments. This layer exists
 * so a second provider (Mercado Pago, Pix, manual invoice) can be switched on
 * WITHOUT touching the billing routes: the routes ask the registry to create a
 * checkout, and the registry dispatches to whichever provider the App Owner has
 * made active (platform_settings.payments.active_provider, migration 023).
 *
 * A provider that is not implemented returns a clear NOT_IMPLEMENTED error
 * rather than silently pretending to take money.
 */
import { supabaseAdmin } from './supabase.js';

const SETTINGS_KEY = 'payments';
const CACHE_TTL_MS = 60_000;
let cache = { at: 0, value: null };

const DEFAULT_SETTINGS = {
  active_provider: 'stripe',
  providers: {
    stripe: { enabled: true, label: 'Stripe', currencies: ['BRL', 'USD', 'EUR'] },
    mercadopago: { enabled: false, label: 'Mercado Pago', currencies: ['BRL'] },
    pix: { enabled: false, label: 'Pix', currencies: ['BRL'] },
    manual: { enabled: false, label: 'Manual invoice', currencies: ['BRL', 'USD', 'EUR'] },
  },
};

/** Platform payment settings, cached briefly. Falls back to Stripe-only. */
export async function getPaymentSettings() {
  if (cache.value && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle();
    if (error) throw error;
    const value = data?.value && Object.keys(data.value).length ? data.value : DEFAULT_SETTINGS;
    cache = { at: Date.now(), value };
    return value;
  } catch {
    // Table missing until migration 023 runs — Stripe still works.
    return DEFAULT_SETTINGS;
  }
}

export function invalidatePaymentSettings() {
  cache = { at: 0, value: null };
}

/** Persist settings. Callers MUST have already checked role === 'owner'. */
export async function savePaymentSettings(value, updatedBy) {
  const { data, error } = await supabaseAdmin
    .from('platform_settings')
    .upsert({ key: SETTINGS_KEY, value, updated_by: updatedBy || null, updated_at: new Date().toISOString() },
      { onConflict: 'key' })
    .select()
    .single();
  if (error) throw error;
  invalidatePaymentSettings();
  return data?.value ?? value;
}

// ─── Providers ───────────────────────────────────────────────────────────────

const notImplemented = (name) => async () => {
  const err = new Error(
    `${name} is selected as the payment provider but is not implemented yet. Switch back to Stripe in Admin → Payments, or implement the adapter.`,
  );
  err.code = 'PROVIDER_NOT_IMPLEMENTED';
  err.publicMessage = err.message;
  throw err;
};

const providers = {
  stripe: {
    label: 'Stripe',
    /**
     * @param {object} args { stripe, priceId, companyId, plan, successUrl, cancelUrl, customerEmail, mode }
     * @returns {Promise<{url: string, reference: string}>}
     */
    async createCheckout({ stripe, priceId, companyId, plan, successUrl, cancelUrl, customerEmail, mode = 'subscription' }) {
      if (!stripe) {
        const err = new Error('Stripe is not configured on the server (STRIPE_SECRET_KEY missing).');
        err.code = 'PROVIDER_NOT_CONFIGURED';
        err.publicMessage = err.message;
        throw err;
      }
      const session = await stripe.checkout.sessions.create({
        mode,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: customerEmail || undefined,
        // company_id + plan are read back in the webhook to grant the plan —
        // without them a completed payment cannot be attributed.
        metadata: { company_id: companyId, plan },
        subscription_data: mode === 'subscription' ? { metadata: { company_id: companyId, plan } } : undefined,
      });
      return { url: session.url, reference: session.id };
    },
  },
  mercadopago: { label: 'Mercado Pago', createCheckout: notImplemented('Mercado Pago') },
  pix: { label: 'Pix', createCheckout: notImplemented('Pix') },
  manual: { label: 'Manual invoice', createCheckout: notImplemented('Manual invoice') },
};

/** The provider the App Owner has made active, with its adapter. */
export async function getActiveProvider() {
  const settings = await getPaymentSettings();
  const key = settings.active_provider || 'stripe';
  const config = settings.providers?.[key] || {};
  const adapter = providers[key];
  if (!adapter) {
    const err = new Error(`Unknown payment provider "${key}". Fix it in Admin → Payments.`);
    err.code = 'PROVIDER_UNKNOWN';
    err.publicMessage = err.message;
    throw err;
  }
  if (config.enabled === false) {
    const err = new Error(`${adapter.label} is the active payment provider but is switched off. Enable it in Admin → Payments.`);
    err.code = 'PROVIDER_DISABLED';
    err.publicMessage = err.message;
    throw err;
  }
  return { key, adapter, config };
}

export const PROVIDER_KEYS = Object.keys(providers);
