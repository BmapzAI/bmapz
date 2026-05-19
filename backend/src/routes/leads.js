import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ─── Lead Lists ──────────────────────────────────────────────────────────────

router.get('/lists', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('lead_lists')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/lists', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const { data, error } = await supabaseAdmin
      .from('lead_lists')
      .insert({ name, description, company_id: req.companyId })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/lists/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('lead_lists')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Leads ───────────────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const { list_id, status, stage, search, limit = 100, offset = 0 } = req.query;

    let query = supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (list_id) query = query.eq('list_id', list_id);
    if (status) query = query.eq('status', status);
    if (stage) query = query.eq('pipeline_stage', stage);
    if (search) query = query.or(`lead_name.ilike.%${search}%,email.ilike.%${search}%,lead_company_name.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert({ ...req.body, company_id: req.companyId })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bulk', requireAuth, async (req, res) => {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads)) return res.status(400).json({ error: 'leads must be an array' });

    const rows = leads.map(l => ({
      ...l,
      company_id: req.companyId,
    }));

    const { data, error } = await supabaseAdmin.from('leads').insert(rows).select();
    if (error) throw error;
    res.json({ inserted: data.length, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Lead not found' });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('leads')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/:id/score — AI-powered ICP lead scoring
router.post('/:id/score', requireAuth, async (req, res) => {
  try {
    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('api_keys, settings')
      .eq('id', req.companyId)
      .single();

    const openaiApiKey = company?.api_keys?.openai_api_key;
    const icp_description = company?.settings?.icp_description;
    const target_audience = company?.settings?.target_audience;

    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({
      apiKey: openaiApiKey || process.env.OPENAI_API_KEY,
    });

    const prompt = `You are a B2B sales expert. Score this lead against the company's ICP.
Company ICP: ${icp_description || 'Not defined'}
Target Audience: ${target_audience || 'Not defined'}

Lead:
- Name: ${lead.lead_name || 'Unknown'}
- Company: ${lead.lead_company_name || 'Unknown'}
- Title: ${lead.role || 'Unknown'}
- Industry: ${lead.industry || 'Unknown'}
- Email: ${lead.email || ''}
- Website: ${lead.website || ''}
- Notes: ${lead.notes || ''}

Return JSON: { "score": 0-100, "fit": "high|medium|low", "reasoning": "...", "next_actions": ["..."] }`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content);

    // Save score to lead
    await supabaseAdmin
      .from('leads')
      .update({ icp_score: result.score, icp_reasoning: result.reasoning })
      .eq('id', req.params.id);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
