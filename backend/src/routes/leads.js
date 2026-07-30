import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { runAIChat } from './ai.js';
import { logLeadActivity, logLeadChanges, LEAD_ACTIVITY_TYPES } from '../lib/leadActivity.js';

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

router.get('/lists/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('lead_lists')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Lead list not found' });
  }
});

router.patch('/lists/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('lead_lists')
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

    // Embed the owner so the whole company can see who handles each lead. The
    // embed (and owner filter) only work once migration 010 has been applied, so
    // fall back to a plain select rather than breaking the Sales board.
    const build = (withOwner) => {
      let q = supabaseAdmin
        .from('leads')
        .select(withOwner ? '*, owner:owner_id (id, full_name, email, profile_picture)' : '*', { count: 'exact' })
        .eq('company_id', req.companyId)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (list_id) q = q.eq('list_id', list_id);
      if (withOwner && req.query.owner_id) q = q.eq('owner_id', req.query.owner_id);
      if (status) q = q.eq('status', status);
      if (stage) q = q.eq('pipeline_stage', stage);
      if (search) q = q.or(`lead_name.ilike.%${search}%,email.ilike.%${search}%,lead_company_name.ilike.%${search}%`);
      return q;
    };

    let { data, error, count } = await build(true);
    if (error && /owner_id|owner/i.test(error.message || '')) {
      ({ data, error, count } = await build(false));
    }
    if (error) throw error;
    res.json({ data, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const payload = { ...req.body, company_id: req.companyId };
    if (payload.owner_id) payload.owner_assigned_at = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

    // Open the lead's history with how it entered the system.
    await logLeadActivity({
      companyId: req.companyId,
      leadId: data.id,
      activityType: LEAD_ACTIVITY_TYPES.CREATED,
      summary: `Lead created${data.source ? ` from ${data.source}` : ''}`,
      details: { source: data.source || null },
      actorUserId: req.dbUser?.id || null,
      actorType: 'user',
      actorLabel: req.dbUser?.full_name || req.dbUser?.email || null,
    });
    if (data.owner_id) {
      await logLeadChanges({
        companyId: req.companyId, leadId: data.id,
        before: { owner_id: null }, after: { owner_id: data.owner_id },
        actorUserId: req.dbUser?.id || null, actorType: 'user',
        actorLabel: req.dbUser?.full_name || req.dbUser?.email || null,
      });
    }

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
    // Read the current row first so the change can be described in the history.
    const { data: before } = await supabaseAdmin
      .from('leads').select('*')
      .eq('id', req.params.id).eq('company_id', req.companyId).maybeSingle();

    const patch = { ...req.body };
    // A lead has exactly one owner; stamp when that ownership changed.
    if ('owner_id' in patch && patch.owner_id !== before?.owner_id) {
      patch.owner_assigned_at = patch.owner_id ? new Date().toISOString() : null;
    }

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update(patch)
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select()
      .single();
    if (error) throw error;

    await logLeadChanges({
      companyId: req.companyId,
      leadId: req.params.id,
      before: before || {},
      after: data,
      actorUserId: req.dbUser?.id || null,
      actorType: 'user',
      actorLabel: req.dbUser?.full_name || req.dbUser?.email || null,
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Ownership ───────────────────────────────────────────────────────────────
// PATCH /api/leads/:id/owner — assign the lead to exactly one teammate.
// Body: { owner_id: <user id> | null }
router.patch('/:id/owner', requireAuth, async (req, res) => {
  try {
    const ownerId = req.body?.owner_id || null;

    // The new owner must belong to this company — never allow cross-company assignment.
    if (ownerId) {
      const { data: owner } = await supabaseAdmin
        .from('users').select('id, company_id, full_name, email')
        .eq('id', ownerId).maybeSingle();
      if (!owner || owner.company_id !== req.companyId) {
        return res.status(400).json({ error: 'That user is not part of this company' });
      }
    }

    const { data: before } = await supabaseAdmin
      .from('leads').select('owner_id')
      .eq('id', req.params.id).eq('company_id', req.companyId).maybeSingle();
    if (!before) return res.status(404).json({ error: 'Lead not found' });

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update({ owner_id: ownerId, owner_assigned_at: ownerId ? new Date().toISOString() : null })
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select('*, owner:owner_id (id, full_name, email, profile_picture)')
      .single();
    if (error) {
      // Migration 010 not applied yet — say so plainly instead of a raw DB error.
      if (/owner_id|owner_assigned_at|owner/i.test(error.message || '')) {
        return res.status(503).json({ error: 'Lead ownership is not enabled yet — the database update (migration 010) still needs to be applied.' });
      }
      throw error;
    }

    await logLeadChanges({
      companyId: req.companyId,
      leadId: req.params.id,
      before: { owner_id: before.owner_id },
      after: { owner_id: ownerId },
      actorUserId: req.dbUser?.id || null,
      actorType: 'user',
      actorLabel: req.dbUser?.full_name || req.dbUser?.email || null,
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── History ─────────────────────────────────────────────────────────────────
// GET /api/leads/:id/activities — the full handling timeline, visible to the
// whole company (not just the owner).
router.get('/:id/activities', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('lead_activities')
      .select('*, actor:actor_user_id (id, full_name, email, profile_picture)')
      .eq('lead_id', req.params.id)
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .limit(Math.min(300, Number(req.query.limit) || 100));
    // Before migration 010 the table does not exist — show an empty timeline
    // rather than an error page.
    if (error) {
      if (/lead_activities|relation|does not exist/i.test(error.message || '')) return res.json([]);
      throw error;
    }
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/:id/activities — add a manual note to the timeline.
router.post('/:id/activities', requireAuth, async (req, res) => {
  try {
    const summary = String(req.body?.summary || '').trim();
    if (!summary) return res.status(400).json({ error: 'summary is required' });
    const entry = await logLeadActivity({
      companyId: req.companyId,
      leadId: req.params.id,
      activityType: req.body?.activity_type || LEAD_ACTIVITY_TYPES.NOTE,
      summary,
      details: req.body?.details || {},
      actorUserId: req.dbUser?.id || null,
      actorType: 'user',
      actorLabel: req.dbUser?.full_name || req.dbUser?.email || null,
    });
    if (!entry) throw new Error('Could not save the note');
    res.json(entry);
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

    const icp_description = company?.settings?.icp_description;
    const target_audience = company?.settings?.target_audience;

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

    // Use unified AI helper — supports bidirectional fallback between OpenAI and Anthropic
    const aiResult = await runAIChat({
      companyId: req.companyId,
      userId: req.dbUser?.id,
      userRole: req.dbUser?.role,
      userEmail: req.dbUser?.email,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      action: 'lead_scoring',
    });

    const result = JSON.parse(aiResult.content);

    // Save score to lead
    await supabaseAdmin
      .from('leads')
      .update({ icp_score: result.score, icp_reasoning: result.reasoning })
      .eq('id', req.params.id);

    res.json(result);
  } catch (err) {
    console.error('[leads/:id/score]', err.message);
    const status = err.code === 'MISSING_API_KEY' || err.code === 'AUTH' || err.code === 'QUOTA' ? 402 : 500;
    res.status(status).json({ error: err.publicMessage || err.message, code: err.code });
  }
});

export default router;
