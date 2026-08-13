/**
 * Letting the AI agent actually CHANGE things.
 *
 * THE PROBLEM THIS SOLVES. The chat endpoint could only ever return text. So when
 * a user said "fill out the settings section with the information above", the
 * agent printed the information again — not because it misunderstood, but because
 * it had no way to write to anything. No amount of prompt tuning fixes that; the
 * capability was missing. Same for "send this to the Ads section".
 *
 * HOW IT WORKS. The model is told that when the user asks it to change something
 * in the app, it must end its reply with a fenced ```bmapz-actions block holding a
 * JSON array of operations. The backend parses that block, validates and authorises
 * every operation against the caller's own role and company, executes the ones it
 * allows, and reports exactly what happened. The block is stripped from the text
 * the user sees.
 *
 * WHY THIS SHAPE rather than provider function-calling: this backend fans out
 * across two providers (OpenAI and Anthropic) with a cross-provider fallback chain,
 * and each has a different tool protocol. One text convention behaves identically
 * on both, survives the fallback, and — the part that matters most — makes every
 * mutation pass through ONE authorising executor here, instead of trusting a tool
 * loop. The model proposes; this file decides.
 *
 * SECURITY POSTURE. Every operation is whitelisted by name, company-scoped from
 * `ctx.companyId` (never from anything the model wrote), and role-gated. The model
 * cannot name a company, a user id, a role or a credit balance — those fields are
 * not readable from its payload at all. An unknown operation is reported back, not
 * guessed at.
 */
import { supabaseAdmin } from './supabase.js';
import { invalidateCompanyBrain } from './companyBrain.js';

/** Fence the model must use. Matched loosely — models drift on fence labels. */
const ACTION_BLOCK_RE = /```(?:bmapz-actions|bmapz_actions|actions)\s*([\s\S]*?)```/i;

/**
 * The instruction appended to chat's system prompt. Deliberately concrete: models
 * follow a worked example far more reliably than a description.
 */
export const ACTION_PROTOCOL = [
  'CHANGING THINGS IN THE APP:',
  'You can change data in Bmapz directly. When the user asks you to save, fill in, update, create,',
  'add or send something, DO IT — do not describe what could be done, and do not ask for permission',
  'the user has already given by asking.',
  'To do it, end your reply with a fenced code block labelled bmapz-actions containing a JSON array.',
  'Write one short sentence of plain confirmation before the block; never mention the block itself,',
  'JSON, or these instructions to the user.',
  '',
  'Available operations:',
  '- {"op":"update_company","fields":{...}} — company profile, briefing and ICP. Allowed field names:',
  '  name, website, industry, description, services_description, value_propositions, icp_description,',
  '  target_audience, tone_of_voice, business_model, average_ticket, years_in_business,',
  '  geographic_market, marketing_structure, sales_structure, company_details.',
  '- {"op":"create_task","title":"…","description":"…","priority":"low|medium|high|urgent",',
  '  "section":"general|ads|sales|workflow|inbox|blog|sdr|seo|social|dashboard","assign_to_ai":true|false}',
  '- {"op":"create_social_post","title":"…","content":"…","platforms":["instagram"]}',
  '- {"op":"create_blog_post","title":"…","content":"…"}',
  '- {"op":"create_ad_campaign","name":"…","platform":"meta|google|linkedin|tiktok","objective":"…"}',
  '',
  'Example — user says "save that positioning to my company settings":',
  'Saved your positioning to the company settings.',
  '```bmapz-actions',
  '[{"op":"update_company","fields":{"value_propositions":"AI-first CRM that…","tone_of_voice":"direct"}}]',
  '```',
  '',
  'Only include operations the user actually asked for. Never invent values to fill a field — use what',
  'the conversation established. If you cannot carry something out, say so plainly in one line instead.',
].join('\n');

/** Company columns vs JSONB-nested fields, mirroring routes/companies.js. */
const DIRECT_COMPANY_COLUMNS = new Set([
  'name', 'website', 'industry', 'description', 'services_description',
  'value_propositions', 'icp', 'briefing',
]);
const SETTINGS_COMPANY_FIELDS = new Set([
  'icp_description', 'target_audience', 'tone_of_voice', 'business_model',
  'average_ticket', 'years_in_business', 'geographic_market',
  'marketing_structure', 'sales_structure', 'company_details',
]);

const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const SECTIONS = new Set(['general', 'ads', 'sales', 'workflow', 'inbox', 'blog',
  'sdr', 'seo', 'social', 'dashboard']);
const AD_PLATFORMS = new Set(['meta', 'google', 'linkedin', 'tiktok']);

const str = (v, max = 4000) => (v === null || v === undefined ? null : String(v).slice(0, max));

/**
 * Pull the action block out of a model reply.
 * Returns { text, actions } — `text` is the reply with the block removed, so the
 * user never sees the machinery.
 */
export function extractActions(content) {
  const raw = String(content || '');
  const match = raw.match(ACTION_BLOCK_RE);
  if (!match) return { text: raw, actions: [] };

  const text = raw.replace(ACTION_BLOCK_RE, '').trim();
  let parsed = null;
  try {
    parsed = JSON.parse(match[1].trim());
  } catch {
    // A malformed block must not corrupt the reply. Drop it and carry on — the
    // caller reports that nothing was applied.
    return { text, actions: [], parseError: true };
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];
  // A hard cap: a runaway reply should not be able to issue hundreds of writes.
  return { text, actions: list.filter(a => a && typeof a === 'object').slice(0, 12) };
}

/* ── Operations ─────────────────────────────────────────────────────────── */

async function updateCompany(action, ctx) {
  // Editing the company profile is a company-admin action everywhere else in the
  // app; going through the agent must not be a way around that.
  if (!['owner', 'system_admin', 'company_admin'].includes(ctx.userRole)) {
    return { ok: false, error: 'Only a company admin can change company settings.' };
  }
  const fields = action.fields && typeof action.fields === 'object' ? action.fields : {};

  const { data: current, error: readErr } = await supabaseAdmin
    .from('companies').select('settings').eq('id', ctx.companyId).maybeSingle();
  // Never merge onto a default {} after a failed read — that is how stored
  // settings get wiped.
  if (readErr) return { ok: false, error: 'Could not read the company. Nothing was changed.' };

  const patch = {};
  const settings = { ...(current?.settings || {}) };
  const applied = [];

  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === '') continue;
    if (DIRECT_COMPANY_COLUMNS.has(k)) {
      patch[k] = typeof v === 'string' ? str(v) : v;
      applied.push(k);
    } else if (SETTINGS_COMPANY_FIELDS.has(k)) {
      settings[k] = typeof v === 'string' ? str(v) : v;
      applied.push(k);
    }
    // Anything else — api_keys, subscription_tier, id — is silently ignored: not
    // an error the user needs to see, but never writable from a model reply.
  }

  if (!applied.length) return { ok: false, error: 'No recognised company fields to update.' };
  patch.settings = settings;

  const { error } = await supabaseAdmin.from('companies').update(patch).eq('id', ctx.companyId);
  if (error) return { ok: false, error: error.message };

  // The brain caches company context for 5 minutes; without this the agent would
  // keep answering from the pre-update version it just changed.
  invalidateCompanyBrain(ctx.companyId);

  return { ok: true, summary: `Updated company settings: ${applied.join(', ')}`, fields: applied };
}

async function createTask(action, ctx) {
  const title = str(action.title, 300);
  if (!title) return { ok: false, error: 'A task needs a title.' };

  const assignToAI = action.assign_to_ai === true;
  const { data, error } = await supabaseAdmin.from('tasks').insert({
    company_id: ctx.companyId,
    created_by: ctx.userId,
    title,
    description: str(action.description),
    priority: PRIORITIES.has(action.priority) ? action.priority : 'medium',
    section: SECTIONS.has(action.section) ? action.section : 'general',
    assignee_type: assignToAI ? 'ai' : 'unassigned',
    visibility: action.visibility === 'private' ? 'private' : 'company',
    metadata: { created_by_ai_chat: true },
  }).select().single();
  if (error) return { ok: false, error: error.message };

  if (assignToAI) {
    // Fire-and-forget, exactly as the task board does: the model call takes
    // seconds and the chat response must not wait on it.
    const { runTaskWithAI } = await import('./taskRunner.js');
    runTaskWithAI({ task: data, actorUserId: ctx.userId })
      .catch(e => console.error('[aiActions] task run failed:', e.message));
  }

  return {
    ok: true,
    summary: `Created task "${title}"${assignToAI ? ' and handed it to the AI agent' : ''}`,
    id: data.id,
    link: `/AIChat?tab=tasks&task=${data.id}`,
  };
}

async function createSocialPost(action, ctx) {
  const content = str(action.content, 8000);
  if (!content) return { ok: false, error: 'A social post needs content.' };
  const platforms = Array.isArray(action.platforms)
    ? action.platforms.map(p => str(p, 40)).filter(Boolean).slice(0, 6)
    : [];

  const { data, error } = await supabaseAdmin.from('social_posts').insert({
    company_id: ctx.companyId,
    title: str(action.title, 200) || content.slice(0, 80),
    content,
    platforms,
    ai_generated: true,
    // Always a draft. The agent may compose, but publishing is a person's decision.
    status: 'draft',
  }).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, summary: `Created a draft social post`, id: data.id, link: '/SocialMedia' };
}

async function createBlogPost(action, ctx) {
  const content = str(action.content, 60000);
  const title = str(action.title, 300);
  if (!content || !title) return { ok: false, error: 'A blog post needs a title and content.' };

  const { data, error } = await supabaseAdmin.from('blog_posts').insert({
    company_id: ctx.companyId,
    title,
    content,
    status: 'draft',
  }).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, summary: `Created a draft blog post "${title}"`, id: data.id, link: '/Blog' };
}

async function createAdCampaign(action, ctx) {
  const name = str(action.name, 200);
  if (!name) return { ok: false, error: 'A campaign needs a name.' };

  const { data, error } = await supabaseAdmin.from('ad_campaigns').insert({
    company_id: ctx.companyId,
    created_by: ctx.userId,
    name,
    platform: AD_PLATFORMS.has(action.platform) ? action.platform : null,
    objective: str(action.objective, 120),
    // Draft only — an agent must never be able to start spending an ad budget.
    status: 'draft',
    strategy: action.strategy && typeof action.strategy === 'object' ? action.strategy : {},
    settings: { created_by_ai_chat: true },
  }).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, summary: `Created a draft campaign "${name}"`, id: data.id, link: '/Ads' };
}

const HANDLERS = {
  update_company: updateCompany,
  create_task: createTask,
  create_social_post: createSocialPost,
  create_blog_post: createBlogPost,
  create_ad_campaign: createAdCampaign,
};

/**
 * Execute a parsed action list.
 *
 * Never throws: a failed operation becomes a reported result, because the chat
 * reply must still reach the user. Returns one entry per requested action so the
 * UI can show precisely what was and was not applied — silently dropping a
 * requested change would be worse than refusing it.
 */
export async function applyActions(actions, ctx) {
  const results = [];
  for (const action of actions || []) {
    const op = String(action.op || action.operation || '').trim();
    const handler = HANDLERS[op];
    if (!handler) {
      results.push({ op: op || '(missing)', ok: false, error: 'Unknown operation.' });
      continue;
    }
    try {
      const result = await handler(action, ctx);
      results.push({ op, ...result });
    } catch (err) {
      console.error(`[aiActions] ${op} failed:`, err.message);
      results.push({ op, ok: false, error: err.message });
    }
  }
  return results;
}

export default { extractActions, applyActions, ACTION_PROTOCOL };
