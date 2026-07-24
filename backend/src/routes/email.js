import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { sendCompanyEmail } from '../lib/emailSender.js';

const router = Router();

// When a human replies to a lead from the Inbox, any active SDR conversation for
// that lead is handed to the human — the SDR stops auto-replying. The human
// message is also logged to `messages` so the thread stays complete.
async function humanTakeoverForLead(companyId, leadId, channel, content, to) {
  if (!leadId) return;
  try {
    await supabaseAdmin.from('sdr_conversations')
      .update({ human_takeover: true, status: 'handed_over', updated_at: new Date().toISOString() })
      .eq('company_id', companyId).eq('lead_id', leadId).in('status', ['active', 'qualified']);
  } catch (e) { console.error('[email] takeover flag failed:', e.message); }
  try {
    await supabaseAdmin.from('messages').insert({
      company_id: companyId, lead_id: leadId, direction: 'outbound', channel: channel || 'email',
      content, status: 'sent', sent_at: new Date().toISOString(), to_address: to || null,
      metadata: { human: true, source: 'inbox_reply' },
    });
  } catch (e) { console.error('[email] log human msg failed:', e.message); }
}

router.post('/send', requireAuth, async (req, res) => {
  try {
    const { to, subject, html, text, from, replyTo, message_id, reply_content } = req.body;
    const { data: companyRow } = await supabaseAdmin
      .from('companies').select('api_keys').eq('id', req.companyId).single();
    const keys = companyRow?.api_keys || {};

    // ── Inbox reply shape: reply to an existing message thread ──
    if (message_id && reply_content) {
      const { data: original } = await supabaseAdmin
        .from('messages').select('*').eq('id', message_id).eq('company_id', req.companyId).maybeSingle();
      if (!original) return res.status(404).json({ error: 'Original message not found' });
      const recipient = original.from_address || original.to_address;
      const channel = original.channel || 'email';

      if (channel === 'email') {
        if (!recipient) return res.status(400).json({ error: 'No recipient address on the original message' });
        await sendCompanyEmail(keys, {
          to: recipient,
          subject: original.subject ? `Re: ${original.subject.replace(/^re:\s*/i, '')}` : 'Re: your message',
          html: reply_content.replace(/\n/g, '<br>'), text: reply_content,
        });
      } else if (channel === 'whatsapp') {
        const token = keys.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN;
        const phoneId = keys.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
        const phone = (recipient || original.metadata?.from_phone || '').replace(/\D/g, '');
        if (token && phoneId && phone) {
          await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: reply_content } }),
          });
        }
      }
      // Log the human reply + hand the SDR conversation to the human
      await humanTakeoverForLead(req.companyId, original.lead_id, channel, reply_content, recipient);
      return res.json({ success: true });
    }

    // ── Direct send shape ──
    if (!to || !subject) return res.status(400).json({ error: 'to and subject are required' });
    await sendCompanyEmail(keys, { to, subject, html, text, from, replyTo });
    res.json({ success: true });
  } catch (err) {
    console.error('[email/send]', err);
    const status = err.code === 'NO_EMAIL_PROVIDER' ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

export default router;
