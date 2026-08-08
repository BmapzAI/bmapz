/**
 * WhatsApp Business API webhook for the Bmapz AI Agent.
 *
 * Flow:
 *   1. User clicks "WhatsApp Agent" on the Bmapz homepage → opens wa.me link
 *      with personalized intro message that includes their email.
 *   2. They send the message to Bmapz's WhatsApp Business number.
 *   3. Meta forwards the message to this webhook.
 *   4. We look up the user by email (from intro message OR a phone-mapping
 *      table), pull their company context, run runAIChat with the user's
 *      role and credit budget, and reply via the WhatsApp Send Messages API.
 *
 * Setup required at Meta Business:
 *   - WhatsApp Business account + phone number
 *   - System User with `whatsapp_business_messaging` permission
 *   - Webhook URL: https://<your-railway-host>/api/whatsapp/webhook
 *   - Verify Token: matches WHATSAPP_VERIFY_TOKEN env var
 *   - Required env vars:
 *       WHATSAPP_VERIFY_TOKEN       (any random string you set in Meta)
 *       WHATSAPP_ACCESS_TOKEN       (long-lived from Meta Business)
 *       WHATSAPP_PHONE_NUMBER_ID    (from WhatsApp → API Setup)
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { runAIChat } from './ai.js';

const router = Router();
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v24.0';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

// GET /api/whatsapp/webhook — Meta verification handshake on first setup
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN && VERIFY_TOKEN) {
    console.log('[whatsapp] webhook verified');
    return res.status(200).send(challenge);
  }
  return res.status(403).send('verify_token mismatch');
});

/**
 * Send a WhatsApp text message via Meta Cloud API.
 */
async function sendWhatsAppMessage(toPhone, text) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('[whatsapp] cannot send — WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set');
    return false;
  }
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toPhone,
    type: 'text',
    text: { preview_url: false, body: text.slice(0, 4096) }, // WhatsApp 4096 char limit
  };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      console.error('[whatsapp] send failed:', r.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[whatsapp] send error:', e.message);
    return false;
  }
}

/**
 * Look up a Bmapz user by phone OR by email parsed from intro message.
 * Returns { userId, companyId, userRole, email } or null.
 */
async function identifyUser(fromPhone, messageText) {
  // 1. Try phone match first (if we ever store user phone numbers)
  // For now, look up by email extracted from message
  const emailMatch = messageText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (!emailMatch) return null;

  // The regex's local-part class allows % and _, which are SQL-LIKE wildcards.
  // Combined with .ilike() that let anyone texting the business number send
  // "%@bmapz.com" and be matched as whichever user happened to sort first —
  // adopting that user's identity and company. Reject wildcards and match
  // exactly instead.
  const candidateEmail = emailMatch[1].toLowerCase();
  if (/[%_]/.test(candidateEmail)) return null;

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, role, company_id')
    .eq('email', candidateEmail)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  // Treat a failed read as "unidentified" rather than letting it fall through.
  if (error) {
    console.error('[whatsapp] identify lookup failed:', error.message);
    return null;
  }
  if (!user) return null;

  return { userId: user.id, companyId: user.company_id, userRole: user.role, email: user.email };
}

/**
 * Verify Meta's X-Hub-Signature-256: HMAC-SHA256 of the RAW request body keyed
 * with the app secret. Without this, anyone who knows the URL can POST fake
 * inbound messages — which would drive the SDR agent, create leads and burn AI
 * credits on attacker-supplied text. Meta also requires it for app review.
 *
 * Needs req.rawBody, captured by the express.json verify hook in index.js.
 * If META_APP_SECRET is not configured we REJECT rather than accept blindly.
 */
function verifyMetaSignature(req) {
  const appSecret = process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET || '';
  if (!appSecret) {
    console.error('[whatsapp] META_APP_SECRET not set — rejecting webhook payload');
    return false;
  }
  const header = req.get('x-hub-signature-256') || '';
  const [algo, supplied] = header.split('=');
  if (algo !== 'sha256' || !supplied) return false;
  if (!req.rawBody) {
    console.error('[whatsapp] raw body unavailable — cannot verify signature');
    return false;
  }
  const expected = crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(supplied, 'utf8');
  // timingSafeEqual throws on length mismatch — compare lengths first.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// POST /api/whatsapp/webhook — incoming messages from Meta
router.post('/webhook', async (req, res) => {
  if (!verifyMetaSignature(req)) {
    return res.status(401).send('invalid signature');
  }
  // Respond 200 immediately — Meta retries if we don't ack fast
  res.status(200).send('OK');

  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message || message.type !== 'text') return; // ignore status updates, media, etc. for now

    const fromPhone = message.from;
    const text = message.text?.body || '';
    if (!text) return;

    console.log(`[whatsapp] incoming from ${fromPhone}: ${text.slice(0, 100)}`);

    // Identify user
    const user = await identifyUser(fromPhone, text);
    if (!user) {
      await sendWhatsAppMessage(
        fromPhone,
        "Hi! I couldn't find your Bmapz account from this message. Please include your Bmapz account email in your message so I can connect to your AI agent. Or open https://ai.bmapz.com and click 'WhatsApp Agent' to get a personalized link."
      );
      return;
    }

    // Run through the unified AI agent — full credit deduction, plan gating, etc.
    let reply;
    try {
      const systemPrompt = `You are the Bmapz AI Sales & Marketing Agent talking to ${user.email} via WhatsApp. Be concise (WhatsApp users prefer short messages — keep replies under 1500 characters when possible). You have full read access to their CRM. They're chatting from their phone, so optimize for quick actionable answers.`;

      const result = await runAIChat({
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.userRole,
        userEmail: user.email,
        messages: [{ role: 'user', content: text }],
        system: systemPrompt,
        action: 'whatsapp_chat',
        temperature: 0.7,
        max_tokens: 1024,
      });
      reply = result.content;
    } catch (aiErr) {
      console.error('[whatsapp] AI error:', aiErr.code, aiErr.message);
      if (aiErr.code === 'CREDITS_EXHAUSTED') {
        reply = '⚠️ Your Bmapz account is out of AI credits. Visit ai.bmapz.com to upgrade your plan or buy a credit pack.';
      } else {
        reply = "Sorry, I couldn't process that right now. Please try again in a moment, or use the app at ai.bmapz.com.";
      }
    }

    await sendWhatsAppMessage(fromPhone, reply);

    // Optionally log to messages table for the inbox view
    try {
      await supabaseAdmin.from('messages').insert([
        {
          company_id: user.companyId,
          direction: 'inbound',
          channel: 'whatsapp',
          content: text,
          platform_message_id: message.id,
          sent_at: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString(),
          metadata: { from: fromPhone, from_phone: fromPhone, source: 'whatsapp_webhook' },
        },
        {
          company_id: user.companyId,
          direction: 'outbound',
          channel: 'whatsapp',
          content: reply,
          thread_id: message.id,
          sent_at: new Date().toISOString(),
          metadata: { to: fromPhone, from_phone: fromPhone, source: 'whatsapp_webhook', ai_generated: true },
        },
      ]);
    } catch (logErr) {
      console.warn('[whatsapp] message log skipped:', logErr.message);
    }
  } catch (err) {
    console.error('[whatsapp] webhook handler error:', err.message);
  }
});

export default router;
