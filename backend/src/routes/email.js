import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { sendCompanyEmail } from '../lib/emailSender.js';

const router = Router();

router.post('/send', requireAuth, async (req, res) => {
  try {
    const { to, subject, html, text, from, replyTo } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ error: 'to and subject are required' });
    }

    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('api_keys')
      .eq('id', req.companyId)
      .single();

    await sendCompanyEmail(companyRow?.api_keys || {}, { to, subject, html, text, from, replyTo });
    res.json({ success: true });
  } catch (err) {
    console.error('[email/send]', err);
    const status = err.code === 'NO_EMAIL_PROVIDER' ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

export default router;
