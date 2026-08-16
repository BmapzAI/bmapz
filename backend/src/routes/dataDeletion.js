import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

// POST /api/data-deletion — public endpoint (no auth required for GDPR requests)
// Anyone on the internet can POST here (that is the point — GDPR / platform
// deletion callbacks are unauthenticated). So the value stored must be a real,
// single email address: an admin later runs a DELETE keyed off it, and a stored
// SQL-LIKE wildcard such as "%" would have matched every row in the table.
const EMAIL_RE = /^[^\s@%_]+@[^\s@%_]+\.[^\s@%_]{2,}$/;

router.post('/', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email is required' });
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Provide a single valid email address.' });
    }

    // This endpoint is UNAUTHENTICATED by law — a data-deletion request cannot
    // require an account. So the free-text fields are bounded rather than trusted:
    // they were unbounded up to the 10MB body cap, which is a cheap way to fill the
    // table. `status` is server-owned; accepting it from the body let a requester
    // file their own request as already completed.
    const instagram_username = String(req.body?.instagram_username || '').trim().slice(0, 120) || null;
    const reason = String(req.body?.reason || '').trim().slice(0, 2000) || null;

    const { data, error } = await supabaseAdmin
      .from('data_deletion_requests')
      .insert({ email, instagram_username, reason, status: 'pending' })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
