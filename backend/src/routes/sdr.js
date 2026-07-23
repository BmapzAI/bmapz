/**
 * SDR API — config (Settings tab), conversations (Chats tab), Company-Brain
 * autofill, and a test-chat endpoint so users can try the SDR from the app.
 */
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { getSdrAgent, autofillSdrConfig, handleInboundForSdr, sdrRespond } from '../lib/sdrEngine.js';

const router = Router();

// GET /api/sdr/agent — the company's SDR config (created disabled if missing)
router.get('/agent', requireAuth, async (req, res) => {
  try {
    res.json(await getSdrAgent(req.companyId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/sdr/agent — save config
router.patch('/agent', requireAuth, async (req, res) => {
  try {
    await getSdrAgent(req.companyId); // ensure a row exists
    const allowed = ['enabled', 'name', 'greeting', 'goal', 'persona', 'guardrails', 'show_prices',
      'products', 'qualifying_questions', 'conversation_flow', 'handoff_conditions',
      'handoff_channels', 'handoff_recipients', 'outcomes', 'channels', 'ai_configured'];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
    patch.updated_at = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from('sdr_agents')
      .update(patch).eq('company_id', req.companyId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sdr/autofill — fill the whole config with the Company Brain
router.post('/autofill', requireAuth, async (req, res) => {
  try {
    const { cfg, usage } = await autofillSdrConfig(req.companyId);
    await getSdrAgent(req.companyId);
    const { data, error } = await supabaseAdmin.from('sdr_agents').update({
      name: cfg.name || null,
      greeting: cfg.greeting || null,
      goal: cfg.goal || null,
      persona: cfg.persona || null,
      guardrails: cfg.guardrails || null,
      show_prices: !!cfg.show_prices,
      products: cfg.products || [],
      qualifying_questions: cfg.qualifying_questions || [],
      conversation_flow: cfg.conversation_flow || [],
      handoff_conditions: cfg.handoff_conditions || null,
      ai_configured: true,
      updated_at: new Date().toISOString(),
    }).eq('company_id', req.companyId).select().single();
    if (error) throw error;
    res.json({ agent: data, tokens_used: usage?.total_tokens || 0 });
  } catch (err) {
    const status = err.code === 'CREDITS_EXHAUSTED' ? 402 : err.code === 'MISSING_API_KEY' ? 402 : 500;
    res.status(status).json({ error: err.publicMessage || err.message, code: err.code });
  }
});

// GET /api/sdr/conversations — Chats tab list
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;
    let q = supabaseAdmin.from('sdr_conversations').select('*')
      .eq('company_id', req.companyId)
      .order('last_message_at', { ascending: false })
      .limit(Math.min(300, Number(limit) || 100));
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sdr/conversations/:id
router.get('/conversations/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('sdr_conversations').select('*')
      .eq('id', req.params.id).eq('company_id', req.companyId).single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Conversation not found' });
  }
});

// POST /api/sdr/test — run one SDR turn without sending anything externally.
// Body: { messages:[{role:'client'|'sdr',content}], text } — used by the in-app tester.
router.post('/test', requireAuth, async (req, res) => {
  try {
    const agent = await getSdrAgent(req.companyId);
    const { data: facts } = await supabaseAdmin.from('companies')
      .select('name, industry, services_description, value_propositions, icp, briefing, website, personal_agent_name')
      .eq('id', req.companyId).single();
    const history = Array.isArray(req.body.messages) ? req.body.messages : [];
    if (req.body.text) history.push({ role: 'client', content: req.body.text });
    const decision = await sdrRespond({ companyId: req.companyId, agent, facts: facts || {}, conversationMessages: history });
    res.json(decision);
  } catch (err) {
    const status = err.code === 'CREDITS_EXHAUSTED' || err.code === 'MISSING_API_KEY' ? 402 : 500;
    res.status(status).json({ error: err.publicMessage || err.message, code: err.code });
  }
});

// POST /api/sdr/inbound — simulate/route an inbound prospect message through the
// full SDR loop (used by the web widget + internal wiring). Body: { channel,
// contact_handle, contact_name, lead_id, text }.
router.post('/inbound', requireAuth, async (req, res) => {
  try {
    const out = await handleInboundForSdr({
      companyId: req.companyId,
      channel: req.body.channel || 'web',
      contactHandle: req.body.contact_handle,
      contactName: req.body.contact_name,
      leadId: req.body.lead_id,
      text: req.body.text,
    });
    if (!out) return res.status(409).json({ error: 'SDR is disabled or not active on this channel' });
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
