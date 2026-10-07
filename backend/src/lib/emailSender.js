/**
 * Shared email sender — used by the /api/email route AND the workflow engine,
 * so scheduled workflow steps can actually send mail (not just record intent).
 *
 * Priority: Gmail OAuth → SMTP → company Resend → platform Resend.
 * `apiKeys` is the company's api_keys JSONB.
 */
export async function sendCompanyEmail(apiKeys, { to, subject, html, text, from, replyTo }) {
  const company = apiKeys || {};
  if (!to || !subject) throw new Error('to and subject are required');

  if (company.google_access_token && company.google_connected_email) {
    return sendViaGmail(company, { to, subject, html, text, from, replyTo });
  }
  if (company.smtp_host && company.smtp_user) {
    return sendViaSMTP(company, { to, subject, html, text, from, replyTo });
  }
  if (company.resend_api_key) {
    return sendViaResend(company.resend_api_key, company.resend_from_email, { to, subject, html, text, from, replyTo });
  }
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(process.env.RESEND_API_KEY, process.env.RESEND_FROM_EMAIL, { to, subject, html, text, from, replyTo });
  }
  const err = new Error('No email provider configured. Connect Gmail, SMTP, or Resend.');
  err.code = 'NO_EMAIL_PROVIDER';
  throw err;
}

export async function sendViaGmail(company, { to, subject, html, text, from, replyTo }) {
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

export async function sendViaSMTP(company, { to, subject, html, text, from, replyTo }) {
  const nodemailer = (await import('nodemailer')).default;
  const transporter = nodemailer.createTransport({
    host: company.smtp_host,
    port: Number(company.smtp_port) || 587,
    secure: Number(company.smtp_port) === 465,
    auth: { user: company.smtp_user, pass: company.smtp_pass },
  });

  await transporter.sendMail({
    from: from || company.smtp_from || company.smtp_user,
    to, subject, html, text, replyTo,
  });
}

export async function sendViaResend(apiKey, fromEmail, { to, subject, html, text, from, replyTo }) {
  const sender = from || fromEmail;
  // This used to fall back to noreply@bmapzai.com. That domain does not resolve (NXDOMAIN, checked
  // 2026-10-06), so it can never be verified in Resend and every send that used it was refused.
  if (!sender) {
    const e = new Error('No From address is configured for Resend. Set RESEND_FROM_EMAIL to an address on a domain verified in Resend.');
    e.code = 'NO_FROM_ADDRESS';
    throw e;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: sender,
      to: Array.isArray(to) ? to : [to],
      subject, html, text,
      // Resend's field is reply_to; replyTo was accepted by this function and dropped on the floor.
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  const d = await r.json().catch(() => ({}));
  // Resend does NOT use an `error` key. Failures are { statusCode, name, message } with a 4xx/5xx status
  // (probed: a bad key is HTTP 401 {"message":"API key is invalid","name":"validation_error"}), so the old
  // `if (d.error)` check treated EVERY failed send - bad key, unverified domain, rate limit - as sent.
  if (!r.ok || !d.id) {
    const e = new Error(d.message || `Resend failed (HTTP ${r.status})`);
    e.status = r.status;
    e.code = d.name;
    throw e;
  }
  return d;
}
