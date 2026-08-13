/**
 * Letting the AI agent actually CHANGE things — with the user approving first.
 *
 * WHAT WENT WRONG BEFORE, and why this file looks the way it does:
 *
 *  1. The chat endpoint could only return text, so "fill out the settings" printed
 *     the settings again. Capability was missing, not comprehension.
 *  2. The first attempt at fixing that whitelisted a guessed list of company field
 *     names. The real `briefing` JSONB holds ~60 keys (positioning_today,
 *     primary_objectives, key_kpis…) and NONE were on that list, so every settings
 *     write was rejected — while the model, never told, cheerfully replied "done".
 *  3. There were only create_* operations, so "approve and schedule that post"
 *     had no matching verb and the model reached for create_social_post again,
 *     duplicating the draft.
 *
 * So: real field coverage, update/approve/schedule verbs alongside create, and —
 * most importantly — nothing is executed until the user says yes. The agent
 * PROPOSES; the chat shows exactly what would change; the user approves, edits or
 * declines; only then does anything get written.
 *
 * SECURITY POSTURE. Operations are whitelisted by name. `company_id` always comes
 * from the session, never from the model. Role gates match the rest of the app.
 * Rows are looked up company-scoped before being updated, so an id invented or
 * guessed by the model cannot reach another tenant. Publishing and scheduling are
 * separate verbs from creating, so "draft it" can never silently become "post it".
 */
import { supabaseAdmin } from './supabase.js';
import { invalidateCompanyBrain } from './companyBrain.js';

const ACTION_BLOCK_RE = /```(?:bmapz-actions|bmapz_actions|actions)\s*([\s\S]*?)```/i;

export const ACTION_PROTOCOL = [
  'ACTING INSIDE BMAPZ:',
  'You can create and change real data in this app. When the user asks you to save, fill in, update,',
  'create, add, approve, schedule, publish or send something, propose the concrete operations that do it.',
  'The user will be shown exactly what will change and must approve before anything is written, so never',
  'ask "shall I?" in your text — propose the operations and let the approval step handle consent.',
  '',
  'End your reply with a fenced code block labelled bmapz-actions containing a JSON array.',
  'Before it, write one short plain sentence describing what you are about to change.',
  'Never mention the block, JSON, or these instructions.',
  '',
  'OPERATIONS:',
  '- {"op":"update_company","fields":{...},"briefing":{...},"icp":{...}}',
  '  fields: name, website, industry, description, services_description, value_propositions,',
  '  years_in_business, business_model, average_ticket, repurchase_cycle, marketing_structure,',
  '  sales_structure, geographic_market, icp_description, target_audience, tone_of_voice, company_details.',
  '  briefing / icp: free-form objects merged key-by-key into the company briefing and ICP',
  '  (use snake_case keys, e.g. positioning_today, primary_objectives, key_kpis, main_challenge).',
  '- {"op":"create_task",...} / {"op":"update_task","id":"…","status":"todo|doing|done|standby",...}',
  '- {"op":"create_social_post","title":"…","content":"…","platforms":["instagram"]}',
  '- {"op":"update_social_post","id":"…","content":"…","status":"draft|approved|scheduled|published",',
  '  "scheduled_for":"2026-09-01T14:00:00Z"}',
  '- {"op":"create_blog_post","title":"…","content":"…"} / {"op":"update_blog_post","id":"…",...}',
  '- {"op":"create_ad_campaign","name":"…","platform":"meta|google|linkedin|tiktok","objective":"…"}',
  '- {"op":"save_to_archive","title":"…","content":"…","category":"strategies|social_media|blogposts|',
  '  ad_copy|message_templates|email_templates|workflows|prospect_list"}',
  '',
  'To change something that already exists, ALWAYS use an update_* operation with its id — never create a',
  'second copy. If you do not know the id, say so instead of creating a duplicate.',
  'Only propose what the user asked for, and never invent values to fill a field.',
].join('\n');

/* ── Field maps ─────────────────────────────────────────────────────────── */
const DIRECT_COMPANY_COLUMNS = new Set([
  'name', 'website', 'industry', 'description', 'services_description', 'value_propositions',
]);
const SETTINGS_COMPANY_FIELDS = new Set([
  'icp_description', 'target_audience', 'tone_of_voice', 'business_model',
  'average_ticket', 'years_in_business', 'geographic_market', 'repurchase_cycle',
  'marketing_structure', 'sales_structure', 'company_details', 'owner_email',
]);

const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const TASK_STATUSES = new Set(['standby', 'todo', 'doing', 'done', 'blocked', 'cancelled']);
const SECTIONS = new Set(['general', 'ads', 'sales', 'workflow', 'inbox', 'blog',
  'sdr', 'seo', 'social', 'dashboard']);
const AD_PLATFORMS = new Set(['meta', 'google', 'linkedin', 'tiktok']);
const SOCIAL_STATUSES = new Set(['draft', 'approved', 'scheduled', 'published', 'failed']);
const BLOG_STATUSES = new Set(['draft', 'published', 'archived']);
const ARCHIVE_CATEGORIES = new Set(['strategies', 'social_media', 'blogposts', 'ad_copy',
  'message_templates', 'email_templates', 'workflows', 'prospect_list']);

const str = (v, max = 4000) => (v === null || v === undefined ? null : String(v).slice(0, max));
/** Keys inside the free-form briefing/icp blobs. Snake-cased, length-capped. */
const safeKey = (k) => String(k || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 60);

const isoOrNull = (v) => {
  if (!v) return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
};

/* ── Parsing + preview ──────────────────────────────────────────────────── */

/**
 * Best-effort JSON recovery.
 *
 * Models produce JSON that is *nearly* valid with tiresome regularity: a trailing
 * comma, a nested ```json fence, smart quotes pasted from the conversation. A
 * strict parse turns each of those into "nothing was proposed", which is
 * indistinguishable to the user from the agent ignoring them — so try the cheap
 * repairs before giving up.
 */
function parseLoose(src) {
  const attempts = [
    (s) => s,
    (s) => s.replace(/```[a-z]*\s*/gi, '').replace(/```/g, ''),   // a fence inside the fence
    (s) => s.replace(/,(\s*[}\]])/g, '$1'),                        // trailing commas
    (s) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'"),
    (s) => {
      // Last resort: take the outermost [...] or {...} and ignore any prose
      // the model wrapped around it.
      const arr = s.match(/\[[\s\S]*\]/);
      if (arr) return arr[0];
      const obj = s.match(/\{[\s\S]*\}/);
      return obj ? obj[0] : s;
    },
  ];
  let current = src;
  for (const step of attempts) {
    current = step(current);
    try { return JSON.parse(current); } catch { /* try the next repair */ }
  }
  return null;
}

export function extractActions(content) {
  const raw = String(content || '');
  const match = raw.match(ACTION_BLOCK_RE);
  if (!match) return { text: raw, actions: [] };

  const text = raw.replace(ACTION_BLOCK_RE, '').trim();
  const parsed = parseLoose(match[1].trim());

  if (!parsed) {
    // LOG THE RAW BLOCK. Without this the failure is invisible in production —
    // which is exactly why the first round of this bug could not be diagnosed
    // from the logs and had to be guessed at.
    console.error('[aiActions] could not parse action block:', match[1].trim().slice(0, 800));
    return { text, actions: [], parseError: true };
  }

  const list = Array.isArray(parsed) ? parsed : [parsed];
  const actions = list.filter(a => a && typeof a === 'object').slice(0, 12);
  console.log(`[aiActions] parsed ${actions.length} proposed action(s): ${actions.map(a => a.op).join(', ')}`);
  return { text, actions };
}

/**
 * A plain-language summary of what an operation WOULD do, for the approval card.
 * The user should never have to read JSON to decide.
 */
export function describeAction(action) {
  const op = String(action?.op || action?.operation || '');
  const changes = [];

  switch (op) {
    case 'update_company': {
      for (const k of Object.keys(action.fields || {})) changes.push(k.replace(/_/g, ' '));
      for (const k of Object.keys(action.briefing || {})) changes.push(`briefing: ${k.replace(/_/g, ' ')}`);
      for (const k of Object.keys(action.icp || {})) changes.push(`ICP: ${k.replace(/_/g, ' ')}`);
      return { op, title: 'Update company settings', changes, destructive: false };
    }
    case 'create_task':
      return { op, title: `Create task "${str(action.title, 120) || ''}"`,
        changes: [action.assign_to_ai ? 'assigned to the AI agent' : 'unassigned'], destructive: false };
    case 'update_task':
      return { op, title: `Update task`, changes: Object.keys(action).filter(k => !['op', 'id'].includes(k)), destructive: false };
    case 'create_social_post':
      return { op, title: 'Create a social post draft',
        changes: [(action.platforms || []).join(', ') || 'no platform set'], destructive: false };
    case 'update_social_post':
      return { op, title: `Update social post${action.status ? ` → ${action.status}` : ''}`,
        changes: [action.scheduled_for ? `scheduled for ${action.scheduled_for}` : null,
          action.content ? 'new content' : null].filter(Boolean),
        // Publishing is the one thing the user should look twice at.
        destructive: action.status === 'published' };
    case 'create_blog_post':
      return { op, title: `Create blog draft "${str(action.title, 120) || ''}"`, changes: [], destructive: false };
    case 'update_blog_post':
      return { op, title: `Update blog post${action.status ? ` → ${action.status}` : ''}`,
        changes: [], destructive: action.status === 'published' };
    case 'create_ad_campaign':
      return { op, title: `Create draft campaign "${str(action.name, 120) || ''}"`,
        changes: [action.platform || 'no platform'], destructive: false };
    case 'save_to_archive':
      return { op, title: `Save "${str(action.title, 120) || ''}" to AI Outputs`, changes: [], destructive: false };
    default:
      return { op: op || '(unknown)', title: 'Unrecognised operation', changes: [], unknown: true };
  }
}

export const describeActions = (actions) => (actions || []).map(describeAction);

/* ── Archive ────────────────────────────────────────────────────────────── */
/**
 * File a piece of work into AI Outputs.
 *
 * Called after a create/update succeeds, because "the archive was not updated" was
 * a real complaint: work done from chat vanished. ai_outputs has no top-level
 * title/content/category/status columns — they live in metadata (inserting them
 * top-level makes PostgREST reject the row).
 */
async function archive({ companyId, userId, title, content, category, type, meta = {} }) {
  if (!content) return null;
  const { data, error } = await supabaseAdmin.from('ai_outputs').insert({
    company_id: companyId,
    type: type || 'ai_chat_action',
    output: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
    metadata: {
      title: title || 'AI chat result',
      content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
      category: ARCHIVE_CATEGORIES.has(category) ? category : 'strategies',
      status: 'pending',
      created_by: userId || null,
      source: 'ai_chat',
      ...meta,
    },
  }).select('id').single();
  if (error) {
    console.error('[aiActions] archive failed:', error.message);
    return null;
  }
  return data?.id || null;
}

/* ── Operations ─────────────────────────────────────────────────────────── */

async function updateCompany(action, ctx) {
  if (!['owner', 'system_admin', 'company_admin'].includes(ctx.userRole)) {
    return { ok: false, error: 'Only a company admin can change company settings.' };
  }

  const { data: current, error: readErr } = await supabaseAdmin
    .from('companies').select('settings, briefing, icp').eq('id', ctx.companyId).maybeSingle();
  // Never merge onto a default {} after a failed read — that is how stored
  // settings get wiped.
  if (readErr) return { ok: false, error: 'Could not read the company. Nothing was changed.' };

  const patch = {};
  const settings = { ...(current?.settings || {}) };
  const briefing = { ...(current?.briefing || {}) };
  const icp = { ...(current?.icp || {}) };
  const applied = [];

  for (const [k, v] of Object.entries(action.fields || {})) {
    if (v === undefined || v === null || v === '') continue;
    if (DIRECT_COMPANY_COLUMNS.has(k)) { patch[k] = typeof v === 'string' ? str(v) : v; applied.push(k); }
    else if (SETTINGS_COMPANY_FIELDS.has(k)) { settings[k] = typeof v === 'string' ? str(v) : v; applied.push(k); }
    // Unknown keys are ignored: api_keys, subscription_tier and id must never be
    // writable from a model reply.
  }

  // briefing and icp are free-form company content, not privileged fields, so any
  // key is allowed inside them — MERGED key-by-key, never replaced wholesale, so
  // filling one field cannot wipe the other fifty.
  for (const [k, v] of Object.entries(action.briefing || {})) {
    const key = safeKey(k);
    if (!key || v === undefined || v === null || v === '') continue;
    briefing[key] = typeof v === 'string' ? str(v) : v;
    applied.push(`briefing.${key}`);
  }
  for (const [k, v] of Object.entries(action.icp || {})) {
    const key = safeKey(k);
    if (!key || v === undefined || v === null || v === '') continue;
    icp[key] = typeof v === 'string' ? str(v) : v;
    applied.push(`icp.${key}`);
  }

  if (!applied.length) return { ok: false, error: 'No recognised company fields were supplied.' };

  patch.settings = settings;
  if (applied.some(a => a.startsWith('briefing.'))) patch.briefing = briefing;
  if (applied.some(a => a.startsWith('icp.'))) patch.icp = icp;

  const { error } = await supabaseAdmin.from('companies').update(patch).eq('id', ctx.companyId);
  if (error) return { ok: false, error: error.message };

  // The brain caches company context for 5 minutes; without this the agent keeps
  // answering from the version it just replaced.
  invalidateCompanyBrain(ctx.companyId);
  return { ok: true, summary: `Updated ${applied.length} company field(s)`, fields: applied, link: '/Settings' };
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
    due_at: isoOrNull(action.due_at || action.deadline),
    metadata: { created_by_ai_chat: true },
  }).select().single();
  if (error) return { ok: false, error: error.message };

  if (assignToAI) {
    const { runTaskWithAI } = await import('./taskRunner.js');
    runTaskWithAI({ task: data, actorUserId: ctx.userId })
      .catch(e => console.error('[aiActions] task run failed:', e.message));
  }
  return { ok: true, summary: `Created task "${title}"${assignToAI ? ', AI is on it' : ''}`,
    id: data.id, link: `/AIChat?tab=tasks&task=${data.id}` };
}

/** Look a row up inside THIS company before touching it. */
async function ownRow(table, id, companyId, columns = '*') {
  if (!id) return { error: 'No id supplied.' };
  const { data, error } = await supabaseAdmin
    .from(table).select(columns).eq('id', id).eq('company_id', companyId).maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: 'Not found in this company.' };
  return { data };
}

async function updateTask(action, ctx) {
  const found = await ownRow('tasks', action.id, ctx.companyId, 'id, title');
  if (found.error) return { ok: false, error: found.error };

  const patch = {};
  if (action.title) patch.title = str(action.title, 300);
  if (action.description !== undefined) patch.description = str(action.description);
  if (TASK_STATUSES.has(action.status)) patch.status = action.status;
  if (PRIORITIES.has(action.priority)) patch.priority = action.priority;
  if (SECTIONS.has(action.section)) patch.section = action.section;
  if (action.due_at !== undefined) patch.due_at = isoOrNull(action.due_at);
  if (!Object.keys(patch).length) return { ok: false, error: 'Nothing to update.' };

  // Completion bookkeeping is decided here, never taken from the model.
  if (patch.status === 'done') {
    patch.completed_at = new Date().toISOString();
    patch.completed_by_type = 'user';
    patch.completed_by = ctx.userId;
  }

  const { error } = await supabaseAdmin.from('tasks').update(patch).eq('id', action.id).eq('company_id', ctx.companyId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, summary: `Updated task "${found.data.title}"`, id: action.id,
    link: `/AIChat?tab=tasks&task=${action.id}` };
}

async function createSocialPost(action, ctx) {
  const content = str(action.content, 8000);
  if (!content) return { ok: false, error: 'A social post needs content.' };
  const title = str(action.title, 200) || content.slice(0, 80);

  const { data, error } = await supabaseAdmin.from('social_posts').insert({
    company_id: ctx.companyId,
    title,
    content,
    platforms: Array.isArray(action.platforms) ? action.platforms.map(p => str(p, 40)).filter(Boolean).slice(0, 6) : [],
    ai_generated: true,
    status: 'draft',          // creating never publishes — that is a separate verb
  }).select().single();
  if (error) return { ok: false, error: error.message };

  const outputId = await archive({
    companyId: ctx.companyId, userId: ctx.userId, title,
    content, category: 'social_media', type: 'social_post',
    meta: { social_post_id: data.id },
  });
  return { ok: true, summary: `Created social post draft "${title}"`, id: data.id,
    link: '/SocialMedia', archived: !!outputId };
}

async function updateSocialPost(action, ctx) {
  const found = await ownRow('social_posts', action.id, ctx.companyId, 'id, title');
  if (found.error) return { ok: false, error: found.error };

  const patch = {};
  if (action.title) patch.title = str(action.title, 200);
  if (action.content) patch.content = str(action.content, 8000);
  if (Array.isArray(action.platforms)) patch.platforms = action.platforms.map(p => str(p, 40)).filter(Boolean).slice(0, 6);
  if (SOCIAL_STATUSES.has(action.status)) patch.status = action.status;
  const when = isoOrNull(action.scheduled_for);
  if (when) {
    patch.scheduled_for = when;
    // Asking for a time implies scheduling, unless a status was named explicitly.
    if (!patch.status) patch.status = 'scheduled';
  }
  if (!Object.keys(patch).length) return { ok: false, error: 'Nothing to update.' };

  const { error } = await supabaseAdmin.from('social_posts')
    .update(patch).eq('id', action.id).eq('company_id', ctx.companyId);
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    summary: `Updated "${found.data.title}"${patch.status ? ` → ${patch.status}` : ''}${when ? ` for ${when.slice(0, 16).replace('T', ' ')}` : ''}`,
    id: action.id, link: '/SocialMedia',
  };
}

async function createBlogPost(action, ctx) {
  const content = str(action.content, 60000);
  const title = str(action.title, 300);
  if (!content || !title) return { ok: false, error: 'A blog post needs a title and content.' };

  const { data, error } = await supabaseAdmin.from('blog_posts').insert({
    company_id: ctx.companyId, title, content, status: 'draft',
  }).select().single();
  if (error) return { ok: false, error: error.message };

  await archive({ companyId: ctx.companyId, userId: ctx.userId, title, content,
    category: 'blogposts', type: 'blog_post', meta: { blog_post_id: data.id } });
  return { ok: true, summary: `Created blog draft "${title}"`, id: data.id, link: '/Blog' };
}

async function updateBlogPost(action, ctx) {
  const found = await ownRow('blog_posts', action.id, ctx.companyId, 'id, title');
  if (found.error) return { ok: false, error: found.error };

  const patch = {};
  if (action.title) patch.title = str(action.title, 300);
  if (action.content) patch.content = str(action.content, 60000);
  if (BLOG_STATUSES.has(action.status)) patch.status = action.status;
  if (patch.status === 'published') patch.published_at = new Date().toISOString();
  if (!Object.keys(patch).length) return { ok: false, error: 'Nothing to update.' };

  const { error } = await supabaseAdmin.from('blog_posts')
    .update(patch).eq('id', action.id).eq('company_id', ctx.companyId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, summary: `Updated "${found.data.title}"${patch.status ? ` → ${patch.status}` : ''}`,
    id: action.id, link: '/Blog' };
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
    status: 'draft',          // an agent must never start spending an ad budget
    strategy: action.strategy && typeof action.strategy === 'object' ? action.strategy : {},
    settings: { created_by_ai_chat: true },
  }).select().single();
  if (error) return { ok: false, error: error.message };

  await archive({ companyId: ctx.companyId, userId: ctx.userId, title: name,
    content: action.strategy ? JSON.stringify(action.strategy, null, 2) : name,
    category: 'strategies', type: 'campaign_plan', meta: { ad_campaign_id: data.id } });
  return { ok: true, summary: `Created draft campaign "${name}"`, id: data.id, link: '/Ads' };
}

async function saveToArchive(action, ctx) {
  const title = str(action.title, 300);
  const content = str(action.content, 60000);
  if (!content) return { ok: false, error: 'Nothing to save.' };
  const id = await archive({
    companyId: ctx.companyId, userId: ctx.userId, title: title || 'AI chat result',
    content, category: action.category, type: 'ai_chat_action',
  });
  if (!id) return { ok: false, error: 'Could not save to the archive.' };
  return { ok: true, summary: `Saved "${title || 'result'}" to AI Outputs`, id, link: '/AIOutputs' };
}

const HANDLERS = {
  update_company: updateCompany,
  create_task: createTask,
  update_task: updateTask,
  create_social_post: createSocialPost,
  update_social_post: updateSocialPost,
  create_blog_post: createBlogPost,
  update_blog_post: updateBlogPost,
  create_ad_campaign: createAdCampaign,
  save_to_archive: saveToArchive,
};

export const isKnownOp = (op) => Object.prototype.hasOwnProperty.call(HANDLERS, String(op || ''));

/**
 * Execute an approved action list.
 *
 * Never throws: a failed operation becomes a reported result, and one entry is
 * returned per requested action so the UI can show exactly what did and did not
 * happen. Silently dropping a requested change is worse than refusing it — that is
 * precisely how "the chat said it saved but nothing changed" happened.
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
      // Logged either way: a refused write ("no recognised fields") is the exact
      // failure that previously reached the user as a cheerful confirmation, and it
      // must be visible in the server logs.
      console.log(`[aiActions] ${op} → ${result.ok ? 'ok' : 'REFUSED'}: ${result.summary || result.error}`);
      results.push({ op, ...result });
    } catch (err) {
      console.error(`[aiActions] ${op} threw:`, err.message);
      results.push({ op, ok: false, error: err.message });
    }
  }
  return results;
}

export default { extractActions, describeActions, applyActions, ACTION_PROTOCOL, isKnownOp };
