import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/send', requireAuth, async (req, res) => {
  try {
    const { to, subject, html, text, from, replyTo, attachments } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ error: 'to and subject are required' });
    }

    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, resend_api_key, resend_from_email, google_access_token, google_connected_email')
      .eq('id', req.companyId)
      .single();

    // Priority: Gmail OAuth → SMTP → Resend → Platform Resend
    if (company?.google_access_token && company?.google_connected_email) {
      await sendViaGmail(company, { to, subject, html, text, from, replyTo });
    } else if (company?.smtp_host && company?.smtp_user) {
      await sendViaSMTP(company, { to, subject, html, text, from, replyTo });
    } else if (company?.resend_api_key) {
      await sendViaResend(company.resend_api_key, company.resend_from_email, { to, subject, html, text, from });
    } else if (process.env.RESEND_API_KEY) {
      await sendViaResend(process.env.RESEND_API_KEY, process.env.RESEND_FROM_EMAIL, { to, subject, html, text, from });
    } else {
      return res.status(500).json({ error: 'No email provider configured. Please connect Gmail, SMTP, or Resend.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[email/send]', err);
    res.status(500).json({ error: err.message });
  }
});

async function sendViaGmail(company, { to, subject, html, text, from, replyTo }) {
  const accessToken = company.google_access_token;
  const fromEmail = from || company.google_connected_email;

  const boundary = 'bmapz_boundary_' + Date.now();
  const emailParts = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    replyTo ? `Reply-To: ${replyTo}` : '',
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    '',
    text || html?.replace(/<[^>]*>/g, '') || '',
    '',
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    '',
    html || `<p>${text}</p>`,
    '',
    `--${boundary}--`,
  ].filter(Boolean).join('\r\n');

  const encoded = Buffer.from(emailParts).toString('base64url');

  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encoded }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'Gmail send failed');
  return d;
}

async function sendViaSMTP(company, { to, subject, html, text, from, replyTo }) {
  const nodemailer = (await import('nodemailer')).default;
  const transporter = nodemailer.createTransport({
    host: company.smtp_host,
    port: Number(company.smtp_port) || 587,
    secure: Number(company.smtp_port) === 465,
    auth: { user: company.smtp_user, pass: company.smtp_pass },
  });

  await transporter.sendMail({
    from: from || company.smtp_from || company.smtp_user,
    to,
    subject,
    html,
    text,
    replyTo,
  });
}

async function sendViaResend(apiKey, fromEmail, { to, subject, html, text, from }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: from || fromEmail || 'noreply@bmapzai.com',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'Resend failed');
  return d;
}

export default router;
