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
import { dueInstant } from './regions.js';

const ACTION_BLOCK_RE = /```(?:bmapz-actions|bmapz_actions|actions)\s*([\s\S]*?)```/i;

/**
 * Turn a database error into something a person can act on.
 *
 * Users were being shown raw Postgres, e.g. 'null value in column "platform" of
 * relation "ad_campaigns" violates not-null constraint'. That names the defect
 * but tells the reader nothing about what to do, and leaks the schema.
 */
export function friendlyError(err) {
  const msg = String(err?.message || err || '');

  const missing = msg.match(/null value in column "([^"]+)"/i);
  if (missing) return `This needs a ${missing[1].replace(/_/g, ' ')} before it can be created.`;

  if (/duplicate key|already exists/i.test(msg)) return 'That already exists.';
  if (/violates foreign key/i.test(msg)) return 'Something it refers to no longer exists.';
  if (/violates check constraint/i.test(msg)) return 'One of the values is not allowed here.';
  if (/permission denied|row-level security/i.test(msg)) return 'You do not have access to do that.';
  if (/invalid input syntax|malformed/i.test(msg)) return 'One of the values is in the wrong format.';

  // Anything still shaped like raw Postgres is withheld rather than shown.
  if (/relation "|column "|constraint/i.test(msg)) return 'That could not be saved.';
  return msg || 'That could not be saved.';
}

/**
 * The operation catalogue. Shared by the in-reply protocol and the second-pass
 * extractor so the two can never describe different capabilities.
 */
export const ACTION_PROTOCOL_OPS = [
  'OPERATIONS:',
  '- {"op":"update_company","fields":{...},"briefing":{...},"icp":{...}}',
  '  fields: name, website, industry, description, services_description, value_propositions,',
  '  years_in_business, business_model, average_ticket, repurchase_cycle, marketing_structure,',
  '  sales_structure, geographic_market, icp_description, target_audience, tone_of_voice, company_details.',
  '  icp: use EXACTLY these keys, which are the ones the ICP Settings screen reads —',
  '    primary_audience (text), secondary_audience (text), main_desires (text),',
  '    common_objections (text), awareness_level (text), budget_range (text),',
  '    industries (array), company_sizes (array), locations (array), job_titles (array),',
  '    pain_points (array), decision_criteria (array),',
  '    decision_maker_profile (array from: Founder, Director, CMO, CTO, VP Marketing, Buyer,',
  '    End consumer, Manager).',
  '  briefing: free-form snake_case keys, e.g. positioning_today, primary_objectives, key_kpis,',
  '    main_challenge, target_market, messaging_strategy, channel_strategy, success_metrics.',
  '  When asked to "fill in the settings" from a discussion, populate EVERY field the conversation',
  '  supports across fields, icp and briefing — not just one or two.',
  // Spelled out in full: live testing showed "assign it to the AI agent" produced
  // an unassigned task, because the abbreviated entry never named assign_to_ai.
  '- {"op":"create_task","title":"…","description":"…","priority":"low|medium|high|urgent",',
  '  "section":"general|ads|sales|workflow|inbox|blog|sdr|seo|social|dashboard",',
  '  "assign_to_ai":true|false,"visibility":"company|private","due_at":"2026-09-01"}',
  '  Set assign_to_ai TRUE whenever the user says to give it to the AI, the agent, or to do it automatically.',
  '- {"op":"update_task","id":"…","status":"standby|todo|doing|done","priority":"…","title":"…"}',
  '- {"op":"create_social_post","title":"…","content":"…","platforms":["instagram"]}',
  '- {"op":"update_social_post","id":"…","content":"…","status":"draft|approved|scheduled|published",',
  '  "scheduled_for":"2026-09-01T14:00:00Z"}',
  '- {"op":"create_blog_post","title":"…","content":"…"} / {"op":"update_blog_post","id":"…",...}',
  '- {"op":"create_ad_campaign","name":"…","platform":"meta|google|linkedin|tiktok","objective":"…"}',
  '- {"op":"save_to_archive","title":"…","content":"…","category":"strategies|social_media|blogposts|',
  '  ad_copy|message_templates|email_templates|workflows|prospect_list"}',
  // Spelled out because the model kept refusing outright — "I have no access to
  // external tools to run a real-time SEO analysis" — when the capability was
  // simply not in this catalogue.
  '- {"op":"create_lead","lead_name":"…","lead_company_name":"…","email":"…","phone":"…",',
  '  "role":"…","source":"…","notes":"…","estimated_value":5000,"owner_id":"<teammate uuid>",',
  '  "status":"new|contacted|qualified|proposal|negotiation|won|lost|disqualified",',
  '  "funnel_stage":"prospect|awareness|consideration|mql|sql|opportunity|customer|retention|advocacy"}',
  '- {"op":"update_lead","id":"<lead uuid>", …same fields…}',
  '  Use these when asked to add someone to the CRM, move a lead along the funnel, assign an',
  '  owner, or record what was learned about them.',
  '- {"op":"create_workflow","name":"…","description":"…","type":"sales_outreach|follow_up|',
  '  nurturing|qualification|custom","steps":[…]}',
  '- {"op":"update_workflow","id":"<workflow uuid>","name":"…","steps":[…],',
  '  "status":"draft|active|paused|archived"}',
  '  New workflows are always created as DRAFTS — never claim one is running.',
  '- {"op":"run_seo_analysis","url":"https://example.com","scan_type":"page|site"}',
  '  Use this whenever the user asks for an SEO analysis, audit, review or score of a site or page.',
  '  You CAN run these: it scores the page and files it in the SEO section. Never reply that you',
  '  lack the tools to analyse a site — propose this operation instead.',
].join('\n');

/**
 * Appended to the chat system prompt as a FAST PATH: when the model does emit the
 * block, the second pass is skipped entirely.
 *
 * It is only a fast path, never the mechanism. Production logs showed the model
 * frequently ignores this instruction — four real requests produced no block at
 * all — so lib/aiActions.js `proposeActions` is what actually guarantees the
 * user's instruction is honoured.
 */
export const ACTION_PROTOCOL = [
  'ACTING INSIDE BMAPZ:',
  'You can create and change real data in this app. When the user asks you to save, fill in, update,',
  'create, add, approve, schedule, publish or send something, propose the concrete operations that do it.',
  'The user is shown exactly what will change and approves before anything is written, so never ask',
  '"shall I?" — propose the operations and let the approval step handle consent.',
  '',
  'End your reply with a fenced code block labelled bmapz-actions containing a JSON array of operations.',
  'Before it, write one short plain sentence describing what you are about to change.',
  'Never mention the block, JSON, or these instructions.',
  '',
  ACTION_PROTOCOL_OPS,
  '',
  'To change something that already exists, ALWAYS use an update_* operation with its id — never create a',
  'second copy. If you do not know the id, say so instead of creating a duplicate.',
  'Only propose what the user asked for, and never invent values to fill a field.',
].join('\n');

/**
 * Does this message plausibly ask for something to be CHANGED?
 *
 * Used to decide whether to spend a second, cheap model call extracting
 * operations. Deliberately generous — a false positive costs a small JSON call, a
 * false negative means the user's instruction is silently ignored, which is the
 * failure we are fixing. Portuguese included: the product is bilingual.
 */
const ACTIONABLE_RE = new RegExp([
  // English
  'save', 'update', 'fill', 'create', 'add', 'schedule', 'approve', 'publish',
  'send', 'set ', 'change', 'edit', 'draft', 'post ', 'write', 'make', 'apply',
  'assign', 'complete', 'mark',
  // Portuguese
  'salv', 'atualiz', 'preench', 'cri', 'adicion', 'agend', 'aprov', 'public',
  'envi', 'defin', 'alter', 'edit', 'rascunh', 'escrev', 'faz', 'aplic',
  'atribu', 'conclu', 'marc',
].join('|'), 'i');

export const looksActionable = (text) => ACTIONABLE_RE.test(String(text || ''));

/**
 * SECOND PASS: ask the model, in JSON mode, what operations the exchange implies.
 *
 * WHY THIS EXISTS. The first design told the model to append a fenced
 * bmapz-actions block to its reply. Production logs proved it simply did not:
 * four real chat requests produced no action block at all — no parse error, no
 * block, nothing — while the reply cheerfully claimed the change was made. A
 * formatting convention buried in a long system prompt (company brain + caller
 * prompt + protocol + execution directive) is not something a model reliably
 * honours mid-conversation.
 *
 * A dedicated call with response_format json_object, a short prompt and one job
 * is dramatically more reliable, and it fails loudly instead of silently: if this
 * returns nothing, that is logged.
 *
 * Cost is contained by only running when the user's message looks like a request
 * to change something, and by skipping the company brain — this pass needs the
 * conversation, not the company's whole context.
 */
/**
 * Recent records the user might be referring to, with their real ids.
 *
 * WITHOUT THIS, update_* can never work. "approve and schedule the post for 3pm"
 * gives the model no id, so it emitted a placeholder — literally `"..."` — and
 * Postgres answered "invalid input syntax for type uuid". Handing it the last few
 * records by id and title is what turns "the post" into a real target.
 *
 * Company-scoped, tiny, and titles only — never content.
 */
async function recentRecordsContext(companyId) {
  const [posts, blogs, tasks] = await Promise.all([
    supabaseAdmin.from('social_posts').select('id, title, status, scheduled_for')
      .eq('company_id', companyId).order('created_at', { ascending: false }).limit(8),
    supabaseAdmin.from('blog_posts').select('id, title, status')
      .eq('company_id', companyId).order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('tasks').select('id, title, status')
      .eq('company_id', companyId).order('created_at', { ascending: false }).limit(8),
  ]);

  const lines = [];
  const add = (label, rows, extra = () => '') => {
    for (const r of rows || []) {
      lines.push(`- ${label} id=${r.id} · "${String(r.title || '').slice(0, 80)}" · ${r.status || ''}${extra(r)}`);
    }
  };
  add('SOCIAL_POST', posts.data, (r) => (r.scheduled_for ? ` · scheduled ${r.scheduled_for}` : ''));
  add('BLOG_POST', blogs.data);
  add('TASK', tasks.data);

  if (!lines.length) return '';
  return [
    'EXISTING RECORDS you may reference by id (most recent first).',
    'Use the id EXACTLY as written. If what the user means is not in this list, omit the operation.',
    ...lines,
  ].join('\n');
}

export async function proposeActions({ runAIChat, companyId, userId, userRole, userEmail, userMessage, assistantReply }) {
  const system = [
    'You convert a user request into Bmapz operations. Reply with JSON ONLY:',
    '{"actions":[ ... ]}. Use an empty array when the exchange does not ask for anything to be changed.',
    '',
    ACTION_PROTOCOL_OPS,
    '',
    'Rules: include ONLY what the user actually asked for. Take values from the conversation —',
    'never invent them. To change something that already exists use an update_* op with its id;',
    'if the id is not in the conversation, omit the operation rather than creating a duplicate.',
  ].join('\n');

  // Real ids, so "schedule the post" can resolve to an actual row instead of a
  // placeholder the database rejects.
  let records = '';
  try {
    records = await recentRecordsContext(companyId);
  } catch (e) {
    console.error('[aiActions] record context failed:', e.message);
  }

  const prompt = [
    records,
    records ? '' : null,
    `USER REQUEST:\n${String(userMessage || '').slice(0, 4000)}`,
    '',
    `ASSISTANT REPLY (the content to save/use, if the request was to save something):\n${String(assistantReply || '').slice(0, 8000)}`,
  ].filter(v => v !== null).join('\n');

  const result = await runAIChat({
    companyId, userId, userRole, userEmail,
    messages: [{ role: 'user', content: prompt }],
    system,
    action: 'action_extract',
    temperature: 0,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
    skipBrain: true,        // this pass needs the exchange, not the company context
    skipArchive: true,      // never a deliverable
  });

  const parsed = parseLoose(String(result?.content || ''));
  const list = Array.isArray(parsed?.actions) ? parsed.actions
    : Array.isArray(parsed) ? parsed : [];
  const actions = list.filter(a => a && typeof a === 'object' && isKnownOp(a.op || a.operation)).slice(0, 12);

  console.log(`[aiActions] second-pass extracted ${actions.length} action(s)${actions.length ? ': ' + actions.map(a => a.op).join(', ') : ''}`);
  return actions;
}

/* ── Field maps ─────────────────────────────────────────────────────────── */
const DIRECT_COMPANY_COLUMNS = new Set([
  'name', 'website', 'industry', 'description', 'services_description', 'value_propositions',
]);
const SETTINGS_COMPANY_FIELDS = new Set([
  'icp_description', 'target_audience', 'tone_of_voice', 'business_model',
  'average_ticket', 'years_in_business', 'geographic_market', 'repurchase_cycle',
  'marketing_structure', 'sales_structure', 'company_details', 'owner_email',
  'competitors',
]);

/**
 * Competitors are a ranked list of objects, so they need shaping rather than the
 * text/array coercion the other settings fields get: capped at 5, only the fields
 * the Competitors tab actually renders, and re-indexed so rank always reflects
 * position rather than whatever the model sent.
 */
function toCompetitors(v) {
  // Accept the shapes a model actually produces, not just the ideal one.
  //
  // The model frequently sends plain names — ["HubSpot", "RD Station"] — or a
  // single comma-separated string. This previously required objects, filtered
  // every string out, and stored an EMPTY list while still reporting "1 field
  // updated": the user was told their competitors were saved and the list was
  // silently wiped instead.
  const raw = Array.isArray(v)
    ? v
    : typeof v === 'string'
      ? v.split(/\s*[;,\n]\s*/)          // "HubSpot, RD Station"
      : (v && typeof v === 'object' ? [v] : []);

  const looksLikeUrl = (s) => /^(https?:\/\/|www\.)/i.test(s) || /\.[a-z]{2,}(\/|$)/i.test(s);

  return raw
    .map((c) => {
      // A bare string is a name — unless it is obviously a URL, in which case it
      // is the site and the name is left for the user to fill in.
      if (typeof c === 'string') {
        const s = c.trim();
        if (!s) return null;
        return looksLikeUrl(s) ? { website: s } : { name: s };
      }
      return c && typeof c === 'object' ? c : null;
    })
    .filter(c => c && (c.name || c.website))
    .slice(0, 5)
    .map((c, i) => ({
      rank: i + 1,
      name: str(c.name, 120) || '',
      website: str(c.website, 200) || '',
      social: str(c.social, 300) || '',
      notes: str(c.notes, 500) || '',
    }));
}

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

/**
 * Company columns that are Postgres ARRAYS (text[]), not text.
 *
 * `value_propositions` is text[]. The model naturally writes prose — "AI-driven
 * insights, increased lead conversion, streamlined sales" — and Postgres answered
 * `malformed array literal`, failing the whole settings update. Verified against
 * the live schema rather than assumed.
 */
const ARRAY_COMPANY_COLUMNS = new Set(['value_propositions']);

/**
 * ICP keys the Settings screen renders with .map()/.join().
 *
 * A string here would not error in the database — icp is JSONB and accepts
 * anything — it would crash the ICP Settings tab at render time. Coerced for the
 * same reason the column list above exists: the model writes prose, the UI needs
 * a list.
 */
const ARRAY_ICP_KEYS = new Set(['industries', 'company_sizes', 'locations', 'job_titles',
  'pain_points', 'decision_criteria', 'decision_maker_profile']);

/** Prose or a list → a clean array of trimmed, non-empty strings. */
function toArray(v) {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  if (v === null || v === undefined || v === '') return [];
  return String(v)
    .split(/\s*[;\n]\s*|\s*,\s*/)     // commas, semicolons or newlines
    .map(s => s.trim().replace(/\.$/, ''))   // drop a trailing full stop
    .filter(Boolean);
}

/** An array where the UI or column expects text → a readable sentence. */
const toText = (v) => (Array.isArray(v) ? v.filter(Boolean).join(', ') : v);
/** Keys inside the free-form briefing/icp blobs. Snake-cased, length-capped. */
const safeKey = (k) => String(k || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 60);

const isoOrNull = (v) => {
  if (!v) return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
};

/**
 * A due date, resolved in the company's market.
 *
 * The model writes plain dates ("2026-09-01"). `Date.parse` reads those as UTC
 * midnight, which in São Paulo is 21:00 the previous evening — so the task showed
 * a day early and went overdue before its day had started.
 */
const dueAt = (v, regionCode) => {
  const d = dueInstant(v, regionCode);
  return d ? d.toISOString() : null;
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

/**
 * Remove operation JSON from the text the USER sees.
 *
 * Observed in live testing: the model writes the operations as a plain ```json
 * fence, or as bare JSON, instead of the labelled bmapz-actions fence. The
 * labelled-fence strip then misses it and the user reads a wall of
 * `{"op":"create_task",...}` under an otherwise normal sentence.
 *
 * So strip by CONTENT, not by label: any fenced block, or bare JSON object/array,
 * that parses and mentions a known operation is machinery and never belongs in the
 * reply. Anything that does not parse is left alone — a code block the user
 * actually asked for must survive.
 */
function stripOperationJson(text) {
  let out = String(text || '');

  const mentionsOp = (s) => /"\s*(op|operation)\s*"\s*:/.test(s);
  const parsesToOps = (s) => {
    if (!mentionsOp(s)) return false;
    const parsed = parseLoose(s.trim());
    if (!parsed) return false;
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.some(a => a && typeof a === 'object' && isKnownOp(a.op || a.operation));
  };

  // 1. Fenced blocks of any label.
  out = out.replace(/```[a-z-]*\s*([\s\S]*?)```/gi, (whole, inner) => (parsesToOps(inner) ? '' : whole));

  // 2. Bare JSON array or object sitting on its own in the prose.
  out = out.replace(/(^|\n)\s*(\[[\s\S]*?\]|\{[\s\S]*?\})\s*(?=\n|$)/g,
    (whole, lead, json) => (parsesToOps(json) ? lead : whole));

  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function extractActions(content) {
  const raw = String(content || '');
  const match = raw.match(ACTION_BLOCK_RE);
  // No labelled block: the operations may still be in the text as a plain json
  // fence. Strip anything that parses to real operations so it never reaches the
  // user, and let the second pass do the extracting.
  if (!match) return { text: stripOperationJson(raw), actions: [] };

  // Strip the labelled block, then sweep for any stray operation JSON the model
  // also left in the prose.
  const text = stripOperationJson(raw.replace(ACTION_BLOCK_RE, ''));

  // The lazy capture stops at the FIRST closing fence, which captures nothing when
  // the model nests a ```json fence inside the action block — a real case caught by
  // the unit tests. Fall back to a greedy capture that runs to the last fence.
  let parsed = parseLoose(match[1].trim());
  if (!parsed) {
    const greedy = raw.match(/```(?:bmapz-actions|bmapz_actions|actions)\s*([\s\S]*)```/i);
    if (greedy) parsed = parseLoose(greedy[1].trim());
  }

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
    case 'save_seo_analysis':
      return { op, title: 'File this as an SEO analysis', changes: [], destructive: false };
    case 'create_lead':
      return { op, title: `Add lead "${str(action.lead_name || action.lead_company_name || action.email, 120) || ''}"`,
        changes: [action.owner_id ? 'assigned to a teammate' : 'unassigned',
          action.funnel_stage || null].filter(Boolean),
        destructive: false };
    case 'update_lead':
      return { op, title: 'Update lead',
        changes: Object.keys(action).filter(k => !['op', 'id'].includes(k)),
        // Marking someone lost or disqualified ends the pursuit — worth a second look.
        destructive: ['lost', 'disqualified'].includes(action.status) };
    case 'create_workflow':
      return { op, title: `Create workflow "${str(action.name || action.title, 120) || ''}"`,
        changes: [`${(action.steps || []).length} step(s)`, 'created as a draft — not running'],
        destructive: false };
    case 'update_workflow':
      return { op, title: `Update workflow${action.status ? ` → ${action.status}` : ''}`,
        changes: [action.status === 'active'
          ? 'ACTIVATING: enrolled leads will start receiving real messages'
          : null,
        Array.isArray(action.steps) ? `${action.steps.length} step(s) replaced` : null].filter(Boolean),
        // Turning a workflow on sends real messages to real people.
        destructive: action.status === 'active' };
    case 'run_seo_analysis':
      return { op, title: `Run an SEO analysis of ${str(action.url, 200) || '(no URL)'}`,
        changes: [action.scan_type === 'site' ? 'entire site' : 'single page', 'uses AI credits'],
        destructive: false };
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
/**
 * ...continued: `status` defaults to 'approved', NOT 'pending'.
 *
 * Everything that reaches this function has already been approved by the user on
 * the chat card — applyActions runs only after that. Filing it as 'pending' made
 * AI Outputs demand a SECOND approval for work the user had just authorised, which
 * is the confusing double-approval that made the whole flow feel broken. The
 * archive should record what happened, not gate it again.
 *
 * 'pending' remains correct for content the agent produced on its own initiative —
 * scheduled automations, background generations — which archive through
 * routes/ai.js, not through here.
 */
async function archive({ companyId, userId, title, content, category, type, meta = {}, status = 'approved' }) {
  if (!content) return null;
  const { data, error } = await supabaseAdmin.from('ai_outputs').insert({
    company_id: companyId,
    type: type || 'ai_chat_action',
    output: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
    metadata: {
      title: title || 'AI chat result',
      content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
      category: ARCHIVE_CATEGORIES.has(category) ? category : 'strategies',
      status,
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
    if (DIRECT_COMPANY_COLUMNS.has(k)) {
      // Match the column's real type, or Postgres rejects the whole update.
      patch[k] = ARRAY_COMPANY_COLUMNS.has(k) ? toArray(v) : str(toText(v));
      applied.push(k);
    } else if (k === 'competitors') {
      const parsed = toCompetitors(v);
      // Refuse rather than wipe. An empty result here means nothing in the payload
      // could be read as a competitor, and overwriting a real list with [] while
      // reporting success is exactly how "it said it saved and nothing changed"
      // happens. Clearing the list is a deliberate act, done from the Competitors
      // tab.
      if (!parsed.length) {
        return { ok: false, error: 'Could not read any competitor from that — name them explicitly, or edit the Competitors tab directly.' };
      }
      settings.competitors = parsed;
      applied.push('competitors');
    } else if (SETTINGS_COMPANY_FIELDS.has(k)) {
      settings[k] = str(toText(v));   // the rest of settings is free text
      applied.push(k);
    }
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
    // Keys the ICP screen renders as lists must BE lists, or the tab crashes on
    // .map(). Everything else is text.
    icp[key] = ARRAY_ICP_KEYS.has(key) ? toArray(v) : str(toText(v));
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

  // File it in AI Outputs. A settings change made through the agent is work the
  // user should be able to review later like any other output — it was reported
  // missing from the archive.
  await archive({
    companyId: ctx.companyId,
    userId: ctx.userId,
    title: `Company settings updated (${applied.length} field${applied.length === 1 ? '' : 's'})`,
    content: applied.map(f => `• ${f}`).join('\n'),
    category: 'strategies',
    type: 'settings_update',
    meta: { fields: applied },
  });

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
    due_at: dueAt(action.due_at || action.deadline, ctx.regionCode),
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Look a row up inside THIS company before touching it. */
async function ownRow(table, id, companyId, columns = '*') {
  if (!id) return { error: 'No id supplied.' };
  // The model will happily emit a placeholder like "..." or "<post id>" when it
  // does not know the real id. Postgres then rejects it with "invalid input syntax
  // for type uuid", which is both ugly and useless to the user. Catch it here and
  // say what actually went wrong.
  if (!UUID_RE.test(String(id))) {
    return { error: 'I do not know which record you mean — open it, or say its exact name, and try again.' };
  }
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
  if (action.due_at !== undefined) patch.due_at = dueAt(action.due_at, ctx.regionCode);
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

  // ad_campaigns.platform is NOT NULL, so passing null failed EVERY create with a
  // raw constraint error — which is what "send to section → Ads" hit every time.
  // A draft that has not picked a platform yet is a real state, so it is recorded
  // as multi-platform (the term the Ads screens already use) rather than guessing
  // a network on the user's behalf. getPlatform() returns null for it and every
  // caller optional-chains, so it renders safely.
  const platform = AD_PLATFORMS.has(action.platform) ? action.platform : 'multi';

  const { data, error } = await supabaseAdmin.from('ad_campaigns').insert({
    company_id: ctx.companyId,
    created_by: ctx.userId,
    name,
    platform,
    objective: str(action.objective, 120),
    status: 'draft',          // an agent must never start spending an ad budget
    strategy: action.strategy && typeof action.strategy === 'object' ? action.strategy : {},
    settings: { created_by_ai_chat: true },
  }).select().single();
  if (error) return { ok: false, error: friendlyError(error) };

  await archive({ companyId: ctx.companyId, userId: ctx.userId, title: name,
    content: action.strategy ? JSON.stringify(action.strategy, null, 2) : name,
    category: 'strategies', type: 'campaign_plan', meta: { ad_campaign_id: data.id } });
  return {
    ok: true,
    summary: `Created draft campaign "${name}"`
      + (platform === 'multi' ? ' — pick a platform in Ads Manager' : ` on ${platform}`),
    id: data.id,
    link: '/Ads',
  };
}

/**
 * Run a real SEO analysis and file it in the SEO section.
 *
 * Unlike the other handlers this one costs AI credits and takes seconds rather
 * than milliseconds, which is precisely why it goes through the approval step
 * like everything else — the user sees the URL before it runs.
 *
 * The library is imported at call time: routes/ai.js imports this file, and the
 * library reaches back into routes/ai.js for runAIChat, so a static import here
 * would close that cycle.
 */
/**
 * File an analysis that already exists into the SEO section.
 *
 * This is what "send to section → SEO" runs. It used to map to save_to_archive,
 * so the banner said the work had been sent while the SEO section stayed empty —
 * the report was simply filed back into the archive it came from.
 *
 * If the text is not a report but does carry a URL, the analysis is run for real
 * rather than refusing on a technicality.
 */
async function saveSeoAnalysisAction(action, ctx) {
  const body = str(action.content, 60000);
  if (!body) return { ok: false, error: 'There is nothing here to file as an SEO analysis.' };

  const { parseAnalysis, storeAnalysis, runSeoAnalysis } = await import('./seoAnalysis.js');
  const { analysis, url } = parseAnalysis(body);
  const target = str(action.url, 500) || url;

  if (!target) {
    return {
      ok: false,
      error: analysis
        // A real report that never names the page it scored.
        ? 'This analysis does not say which page it was for, so it cannot be filed under SEO. '
          + 'Add the website address and try again.'
        : 'SEO is not an editable section — it holds analyses, not documents. This text has no '
          + 'website address to analyse, so send it to another section, or run an SEO analysis.',
    };
  }

  try {
    const saved = analysis
      ? await storeAnalysis({ companyId: ctx.companyId, url: target, scanType: action.scan_type, analysis })
      : await runSeoAnalysis({ companyId: ctx.companyId, userId: ctx.userId, userRole: ctx.userRole, url: target });
    const score = saved?.overall_score;
    return {
      ok: true,
      summary: `${analysis ? 'Filed' : 'Ran'} an SEO analysis for ${saved?.url || target}`
        + `${score != null ? ` — score ${score}/100` : ''}`,
      id: saved?.id,
      link: '/SEO',
    };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}

async function runSeoAnalysisAction(action, ctx) {
  const url = str(action.url, 500);
  if (!url) return { ok: false, error: 'No URL to analyse.' };
  try {
    const { runSeoAnalysis } = await import('./seoAnalysis.js');
    const saved = await runSeoAnalysis({
      companyId: ctx.companyId,
      userId: ctx.userId,
      userRole: ctx.userRole,
      url,
      scanType: action.scan_type === 'site' ? 'site' : 'page',
    });
    const score = saved?.overall_score;
    return {
      ok: true,
      summary: `Analysed ${saved?.url || url}${score != null ? ` — score ${score}/100` : ''}`,
      id: saved?.id,
      link: '/SEO',
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* ── Leads ──────────────────────────────────────────────────────────────── */

const LEAD_STATUSES = new Set(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'disqualified']);
const FUNNEL_STAGES = new Set(['prospect', 'awareness', 'consideration', 'mql', 'sql', 'opportunity', 'customer', 'retention', 'advocacy']);

/** Fields the agent may set on a lead. Everything else is ignored. */
const LEAD_FIELDS = ['lead_name', 'lead_company_name', 'email', 'phone', 'role',
  'website', 'company_website', 'linkedin_url', 'company_linkedin', 'source',
  'notes', 'estimated_value', 'is_decision_maker'];

function leadPatch(action) {
  const patch = {};
  for (const k of LEAD_FIELDS) {
    if (action[k] === undefined || action[k] === null) continue;
    patch[k] = k === 'estimated_value' ? Number(action[k]) || null
      : k === 'is_decision_maker' ? !!action[k]
        : str(action[k], 500);
  }
  if (LEAD_STATUSES.has(action.status)) patch.status = action.status;
  if (FUNNEL_STAGES.has(action.funnel_stage)) patch.funnel_stage = action.funnel_stage;
  if (Array.isArray(action.tags)) patch.tags = action.tags.map(t => str(t, 60)).filter(Boolean).slice(0, 20);
  return patch;
}

/**
 * The owner must be a real member of THIS company.
 *
 * An id invented or guessed by the model would otherwise attach a lead to a
 * stranger, and `owner_id` is what the whole ownership model hangs off.
 */
async function resolveOwner(ownerId, companyId) {
  if (!ownerId || !UUID_RE.test(String(ownerId))) return null;
  const { filterCompanyMembers } = await import('../middleware/auth.js');
  const ok = await filterCompanyMembers([ownerId], companyId);
  return ok?.length ? ownerId : null;
}

async function createLead(action, ctx) {
  const patch = leadPatch(action);
  if (!patch.lead_name && !patch.lead_company_name && !patch.email) {
    return { ok: false, error: 'A lead needs at least a name, a company or an email.' };
  }

  const owner_id = await resolveOwner(action.owner_id, ctx.companyId);
  const { data, error } = await supabaseAdmin.from('leads').insert({
    ...patch,
    company_id: ctx.companyId,          // always the session's company, never the model's
    owner_id,
    owner_assigned_at: owner_id ? new Date().toISOString() : null,
  }).select().single();
  if (error) return { ok: false, error: friendlyError(error) };

  await logLeadHistory(data.id, ctx, 'created', 'Lead created by the Bmapz AI agent');
  return {
    ok: true,
    summary: `Created lead "${patch.lead_name || patch.lead_company_name || patch.email}"`,
    id: data.id,
    link: `/LeadDetails?id=${data.id}`,
  };
}

async function updateLead(action, ctx) {
  const id = str(action.id, 60);
  if (!UUID_RE.test(id)) return { ok: false, error: 'A real lead id is required.' };

  // Company-scoped read FIRST: an id alone must never reach another tenant's lead.
  const { data: existing, error: findErr } = await supabaseAdmin
    .from('leads').select('id, status, funnel_stage')
    .eq('id', id).eq('company_id', ctx.companyId).maybeSingle();
  if (findErr) return { ok: false, error: friendlyError(findErr) };
  if (!existing) return { ok: false, error: 'That lead does not exist in this company.' };

  const patch = leadPatch(action);
  if (action.owner_id !== undefined) {
    patch.owner_id = await resolveOwner(action.owner_id, ctx.companyId);
    patch.owner_assigned_at = patch.owner_id ? new Date().toISOString() : null;
  }
  if (!Object.keys(patch).length) return { ok: false, error: 'Nothing to update.' };

  const { error } = await supabaseAdmin.from('leads')
    .update(patch).eq('id', id).eq('company_id', ctx.companyId);
  if (error) return { ok: false, error: friendlyError(error) };

  const moved = patch.funnel_stage && patch.funnel_stage !== existing.funnel_stage;
  await logLeadHistory(id, ctx, moved ? 'stage_changed' : 'updated',
    moved
      ? `Moved ${existing.funnel_stage} → ${patch.funnel_stage} by the Bmapz AI agent`
      : `Updated by the Bmapz AI agent: ${Object.keys(patch).join(', ')}`);

  return { ok: true, summary: `Updated lead (${Object.keys(patch).join(', ')})`, id, link: `/LeadDetails?id=${id}` };
}

/** A lead's timeline should show the agent's edits like anyone else's. */
async function logLeadHistory(leadId, ctx, type, summary) {
  try {
    const { logLeadActivity, LEAD_ACTIVITY_TYPES } = await import('./leadActivity.js');
    await logLeadActivity({
      companyId: ctx.companyId,
      leadId,
      activityType: LEAD_ACTIVITY_TYPES[type.toUpperCase()] || LEAD_ACTIVITY_TYPES.UPDATED,
      summary,
      actorType: 'ai',
      actorLabel: 'Bmapz AI',
      actorUserId: ctx.userId || null,
    });
  } catch (err) {
    console.error('[aiActions] lead history entry failed:', err.message);
  }
}

/* ── Workflows ──────────────────────────────────────────────────────────── */

const WORKFLOW_TYPES = new Set(['sales_outreach', 'follow_up', 'nurturing', 'qualification', 'custom']);
const WORKFLOW_STATUSES = new Set(['draft', 'active', 'paused', 'archived']);

async function createWorkflow(action, ctx) {
  const name = str(action.name || action.title, 200);
  if (!name) return { ok: false, error: 'A workflow needs a name.' };

  const { data, error } = await supabaseAdmin.from('workflows').insert({
    company_id: ctx.companyId,
    created_by: ctx.userId,
    name,
    description: str(action.description, 2000),
    type: WORKFLOW_TYPES.has(action.type) ? action.type : 'custom',
    // ALWAYS a draft. An active workflow sends real messages to real prospects on a
    // schedule; the agent proposes the shape, a human turns it on. This mirrors ad
    // campaigns, where the agent must never start spending a budget.
    status: 'draft',
    trigger_type: 'manual',
    steps: Array.isArray(action.steps) ? action.steps.slice(0, 30) : [],
    is_template: false,
  }).select().single();
  if (error) return { ok: false, error: friendlyError(error) };

  return {
    ok: true,
    summary: `Created workflow "${name}" as a draft — review its steps, then activate it`,
    id: data.id,
    link: '/Workflows',
  };
}

async function updateWorkflow(action, ctx) {
  const id = str(action.id, 60);
  if (!UUID_RE.test(id)) return { ok: false, error: 'A real workflow id is required.' };

  const { data: existing, error: findErr } = await supabaseAdmin
    .from('workflows').select('id, name, status')
    .eq('id', id).eq('company_id', ctx.companyId).maybeSingle();
  if (findErr) return { ok: false, error: friendlyError(findErr) };
  if (!existing) return { ok: false, error: 'That workflow does not exist in this company.' };

  const patch = {};
  if (action.name) patch.name = str(action.name, 200);
  if (action.description !== undefined) patch.description = str(action.description, 2000);
  if (WORKFLOW_TYPES.has(action.type)) patch.type = action.type;
  if (Array.isArray(action.steps)) patch.steps = action.steps.slice(0, 30);
  // Status IS settable here, including 'active' — but only because this runs after
  // the user has approved a card that says so in plain words (see describeAction,
  // which marks activation destructive).
  if (WORKFLOW_STATUSES.has(action.status)) patch.status = action.status;
  if (!Object.keys(patch).length) return { ok: false, error: 'Nothing to update.' };

  const { error } = await supabaseAdmin.from('workflows')
    .update(patch).eq('id', id).eq('company_id', ctx.companyId);
  if (error) return { ok: false, error: friendlyError(error) };

  return {
    ok: true,
    summary: `Updated workflow "${existing.name}"${patch.status ? ` → ${patch.status}` : ''}`,
    id,
    link: '/Workflows',
  };
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
  run_seo_analysis: runSeoAnalysisAction,
  save_seo_analysis: saveSeoAnalysisAction,
  create_lead: createLead,
  update_lead: updateLead,
  create_workflow: createWorkflow,
  update_workflow: updateWorkflow,
};

export const isKnownOp = (op) => Object.prototype.hasOwnProperty.call(HANDLERS, String(op || ''));

/**
 * Turn a title + body into the operation that puts it in a given section.
 *
 * Shared by "send a task to its section" and "send an approved AI Output to its
 * section" so both produce the same record from the same input. Sections that own
 * a concrete entity get one; the rest file into the archive under the right
 * category, because "send it to SEO" has no SEO row to create while the
 * deliverable still needs a home.
 *
 * Returns null for an unknown section, so callers can reject rather than guess.
 */
export function buildSectionAction({ section, title, content }) {
  const t = str(title, 300) || 'Untitled';
  const body = str(content, 60000) || '';
  if (!body) return null;

  switch (section) {
    case 'social': return { op: 'create_social_post', title: t, content: body, platforms: [] };
    case 'blog': return { op: 'create_blog_post', title: t, content: body };
    case 'ads': return { op: 'create_ad_campaign', name: t, strategy: { summary: body } };
    case 'workflow': return { op: 'save_to_archive', title: t, content: body, category: 'workflows' };
    case 'inbox':
    case 'sdr': return { op: 'save_to_archive', title: t, content: body, category: 'message_templates' };
    // SEO holds analyses, not documents. Sending here used to archive the text
    // under "strategies" and report success, which is why a task could say it had
    // sent an analysis while the SEO section stayed empty.
    case 'seo': return { op: 'save_seo_analysis', title: t, content: body };
    case 'sales':
    case 'dashboard':
    case 'general': return { op: 'save_to_archive', title: t, content: body, category: 'strategies' };
    default: return null;
  }
}

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

  // Resolved once for the whole batch: due dates are wall-clock dates in the
  // company's market, and "1 September" must not become 21:00 on 31 August.
  if (!ctx.regionCode) {
    const { regionCodeForCompany } = await import('./regions.js');
    ctx = { ...ctx, regionCode: await regionCodeForCompany(supabaseAdmin, ctx.companyId) };
  }

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
