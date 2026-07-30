/**
 * Support assistant — the READ-ONLY help agent behind the chat bubble.
 *
 * Deliberately different from the two other agents:
 *   - Company Brain agent (/api/ai/chat): internal, knows company data, can act.
 *   - SDR agent (/api/sdr):               client-facing, talks to prospects.
 *   - THIS one:                           talks to the logged-in Bmapz user about
 *                                         how to use Bmapz, and can only READ.
 *
 * It never creates or edits anything. It reads a small diagnostic snapshot of the
 * account (what is connected, what is configured, what is missing) so it can give
 * precise answers and point at the exact screen to fix a problem.
 */
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { runAIChat } from './ai.js';

const router = Router();

// The app's screens, so the assistant links users to real destinations only.
const APP_PAGES = [
  ['/Home', 'Home — overview and notifications'],
  ['/Sales', 'Sales — lead pipeline (Kanban), lead owners'],
  ['/LeadDetails', 'Lead Details — one lead, its owner and full history'],
  ['/Inbox', 'Inbox — all client conversations across channels'],
  ['/SDR', 'SDR — the client-facing AI agent: Chats and Settings'],
  ['/Workflows', 'Workflows — automation builder and templates'],
  ['/Design', 'Design — image/carousel studio, brand templates'],
  ['/SocialMedia', 'Social Media — posts, drafts, scheduling, calendar'],
  ['/Ads', 'Ads — ad strategies, copy and creatives'],
  ['/Blog', 'Blog — long-form content'],
  ['/AIChat', 'AI Chat — the internal Company Brain assistant'],
  ['/AIAutomations', 'AI Automations — scheduled AI jobs'],
  ['/Integrations', 'Integrations — connect Meta, Google, LinkedIn, WhatsApp, Canva'],
  ['/Settings', 'Settings — profile, company, API keys, model choice'],
  ['/Billing', 'Billing — plan, credits and invoices'],
  ['/Notifications', 'Notifications — everything that needs attention'],
  ['/Help', 'Help — guides and this assistant'],
];

/**
 * A compact, privacy-safe snapshot of the account so the assistant can diagnose
 * before answering. Counts and booleans only — never message bodies or contacts.
 */
async function buildDiagnostics(companyId, userId) {
  const safeCount = async (table, build) => {
    try {
      let q = supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('company_id', companyId);
      if (build) q = build(q);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    } catch { return null; }
  };

  const [company, leads, activeWorkflows, draftWorkflows, posts, drafts, sdrAgent, unreadNotifs, integrations] = await Promise.all([
    supabaseAdmin.from('companies')
      .select('name, industry, services_description, briefing, icp, integration_status, personal_agent_name, ai_model')
      .eq('id', companyId).maybeSingle().then(r => r.data).catch(() => null),
    safeCount('leads'),
    safeCount('workflows', q => q.eq('status', 'active')),
    safeCount('workflows', q => q.eq('status', 'draft')),
    safeCount('social_posts'),
    safeCount('social_posts', q => q.eq('status', 'draft')),
    supabaseAdmin.from('sdr_agents').select('enabled, name, channels, allowed_outcomes')
      .eq('company_id', companyId).eq('user_id', userId).maybeSingle().then(r => r.data).catch(() => null),
    safeCount('notifications', q => q.eq('read', false)),
    supabaseAdmin.from('companies').select('integration_status').eq('id', companyId).maybeSingle().then(r => r.data?.integration_status || {}).catch(() => ({})),
  ]);

  const connected = Object.entries(integrations || {}).filter(([, v]) => !!v).map(([k]) => k);
  const brainFilled = !!(company?.services_description || company?.briefing?.tone_of_voice?.length || company?.icp?.primary_audience);

  return {
    company_name: company?.name || null,
    industry: company?.industry || null,
    company_brain_filled: brainFilled,
    ai_model: company?.ai_model || 'default',
    counts: { leads, active_workflows: activeWorkflows, draft_workflows: draftWorkflows, social_posts: posts, social_drafts: drafts, unread_notifications: unreadNotifs },
    sdr: sdrAgent ? { enabled: !!sdrAgent.enabled, name: sdrAgent.name || null, channels: sdrAgent.channels || [] } : { enabled: false, configured: false },
    integrations_connected: connected,
    integrations_missing: ['meta', 'google', 'linkedin', 'whatsapp', 'canva'].filter(k => !connected.includes(k)),
  };
}

function buildSystemPrompt(diag, userRole) {
  return [
    'You are the Bmapz AI Support Assistant. You help the logged-in Bmapz USER understand and use the Bmapz platform.',
    '',
    'STRICT LIMITS — these are absolute:',
    '- You are READ-ONLY. You cannot create, edit, delete, send, publish or change ANYTHING.',
    '- If the user asks you to perform an action, explain that you can only guide them, then give exact click-by-click steps to do it themselves.',
    '- Creating and editing is done by the other agents: the Company Brain AI Chat (internal work) and the SDR agent (talking to prospects). Mention them when relevant, but never claim to act yourself.',
    '- Never invent features, screens or settings that are not in the list below.',
    '- Never reveal API keys, tokens, or another company\'s data.',
    '',
    'HOW TO ANSWER:',
    '1. First check the account snapshot below and diagnose the likely cause.',
    '2. Give a short, plain-language answer a non-technical person can follow.',
    '3. Give numbered click-by-click steps when there is something to do.',
    '4. Link to the exact screen using markdown links with the app paths below, e.g. [Settings](/Settings).',
    '5. If the snapshot shows the real blocker (for example an integration is not connected, or the SDR is disabled), say so directly instead of giving generic advice.',
    '',
    `APP SCREENS (only link to these):\n${APP_PAGES.map(([p, d]) => `- ${p} — ${d}`).join('\n')}`,
    '',
    `THIS ACCOUNT RIGHT NOW (diagnostic snapshot, already checked for you):\n${JSON.stringify(diag, null, 2)}`,
    '',
    `The user's role is "${userRole || 'user'}".`,
    'Be concise, warm and practical. Prefer 3-8 short lines plus steps over long essays.',
  ].join('\n');
}

// POST /api/help/assistant — one support turn. Body: { messages: [{role, content}] }
router.post('/assistant', requireAuth, async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-20) : [];
    if (!messages.length) return res.status(400).json({ error: 'messages is required' });

    const diag = await buildDiagnostics(req.companyId, req.dbUser?.id || null);
    const result = await runAIChat({
      companyId: req.companyId,
      userId: req.dbUser?.id,
      userRole: req.dbUser?.role || 'user',
      userEmail: req.dbUser?.email,
      messages: messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '').slice(0, 4000),
      })),
      system: buildSystemPrompt(diag, req.dbUser?.role),
      action: 'help_assistant',
      temperature: 0.3,
      // The support agent must NOT receive the internal Company Brain dump; it
      // gets its own purpose-built, read-only snapshot instead.
      skipBrain: true,
    });

    res.json({ content: result.content, model_used: result.model_used, usage: result.usage });
  } catch (err) {
    const status = err.code === 'CREDITS_EXHAUSTED' || err.code === 'MISSING_API_KEY' ? 402 : 500;
    res.status(status).json({ error: err.publicMessage || err.message, code: err.code });
  }
});

// GET /api/help/diagnostics — the same snapshot, for the "check my account" button.
router.get('/diagnostics', requireAuth, async (req, res) => {
  try {
    res.json(await buildDiagnostics(req.companyId, req.dbUser?.id || null));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
