import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

// POST /api/data-deletion — public endpoint (no auth required for GDPR requests)
router.post('/', async (req, res) => {
  try {
    const { email, instagram_username, reason, status = 'pending' } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const { data, error } = await supabaseAdmin
      .from('data_deletion_requests')
      .insert({ email, instagram_username, reason, status })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
