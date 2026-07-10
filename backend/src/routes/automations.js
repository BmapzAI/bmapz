/**
 * AI Automations — CRUD + run-now for scheduled AI tasks (cron jobs).
 * Execution itself happens in lib/automationScheduler.js.
 */
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { computeNextRunAt } from '../lib/automationScheduler.js';
import { runAIChat } from './ai.js';

const router = Router();

const SCHEDULE_TYPES = new Set(['every_minutes', 'hourly', 'daily', 'weekly', 'monthly']);

function sanitize(body) {
  const out = {};
  if (body.name !== undefined) out.name = String(body.name).slice(0, 120);
  if (body.description !== undefined) out.description = body.description ? String(body.description).slice(0, 500) : null;
  if (body.prompt !== undefined) out.prompt = String(body.prompt).slice(0, 8000);
  if (body.output_category !== undefined) out.output_category = body.output_category;
  if (body.schedule_type !== undefined && SCHEDULE_TYPES.has(body.schedule_type)) out.schedule_type = body.schedule_type;
  if (body.interval_minutes !== undefined) out.interval_minutes = Math.max(5, parseInt(body.interval_minutes, 10) || 60);
  if (body.run_minute !== undefined) out.run_minute = Math.min(59, Math.max(0, parseInt(body.run_minute, 10) || 0));
  if (body.run_hour !== undefined) out.run_hour = Math.min(23, Math.max(0, parseInt(body.run_hour, 10) || 9));
  if (body.run_day_of_week !== undefined) out.run_day_of_week = Math.min(6, Math.max(0, parseInt(body.run_day_of_week, 10) || 0));
  if (body.run_day_of_month !== undefined) out.run_day_of_month = Math.min(28, Math.max(1, parseInt(body.run_day_of_month, 10) || 1));
  if (body.enabled !== undefined) out.enabled = !!body.enabled;
  return out;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_automations')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const fields = sanitize(req.body);
    if (!fields.name || !fields.prompt) {
      return res.status(400).json({ error: 'name and prompt are required' });
    }
    const row = {
      ...fields,
      company_id: req.companyId,
      created_by: req.dbUser?.id || null,
      enabled: fields.enabled !== false,
    };
    row.next_run_at = computeNextRunAt(row, new Date()).toISOString();

    const { data, error } = await supabaseAdmin
      .from('ai_automations')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const fields = sanitize(req.body);
    // Load current row so schedule changes recompute next_run_at correctly
    const { data: current, error: loadErr } = await supabaseAdmin
      .from('ai_automations')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (loadErr || !current) return res.status(404).json({ error: 'Automation not found' });

    const merged = { ...current, ...fields };
    fields.next_run_at = computeNextRunAt(merged, new Date()).toISOString();
    fields.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('ai_automations')
      .update(fields)
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
      .from('ai_automations')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/run — execute immediately (doesn't shift the schedule)
router.post('/:id/run', requireAuth, async (req, res) => {
  try {
    const { data: a, error } = await supabaseAdmin
      .from('ai_automations')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (error || !a) return res.status(404).json({ error: 'Automation not found' });

    const result = await runAIChat({
      companyId: req.companyId,
      userId: req.dbUser?.id,
      userRole: req.dbUser?.role,
      userEmail: req.dbUser?.email,
      messages: [{ role: 'user', content: a.prompt }],
      action: 'ai_automation',
      system:
        'You are executing a SCHEDULED automation for this company (triggered manually). Produce the deliverable directly (no chit-chat, no questions).',
    });

    await supabaseAdmin.from('ai_outputs').insert({
      company_id: req.companyId,
      type: 'automation',
      prompt: a.prompt,
      output: result.content || '',
      model: result.model_used || null,
      tokens_used: result.usage?.total_tokens || null,
      metadata: {
        title: `⏰ ${a.name} — manual run`,
        content: result.content || '',
        category: a.output_category || 'strategies',
        status: 'pending',
        automation_id: a.id,
      },
    });

    await supabaseAdmin
      .from('ai_automations')
      .update({
        last_run_at: new Date().toISOString(),
        last_status: 'success',
        last_result: { status: 'success', manual: true, model: result.model_used },
        run_count: (a.run_count || 0) + 1,
      })
      .eq('id', a.id);

    res.json({ success: true, content: result.content, model: result.model_used });
  } catch (err) {
    res.status(err.code === 'CREDITS_EXHAUSTED' ? 402 : 500).json({
      error: err.publicMessage || err.message,
      code: err.code,
    });
  }
});

export default router;
