/**
 * Running a task with the AI agent.
 *
 * Every task assigned to the AI ends up here: from creation with "Auto-assign to
 * AI" on, from the Run-with-AI button, from being reassigned to the agent, and
 * from an AI automation schedule.
 *
 * Work goes through `runAIChat`, the single choke point for all AI generation, so
 * a task inherits credit accounting, plan gating, BYOK, the company brain and
 * archiving into AI Outputs for free — rather than re-implementing any of it.
 *
 * Deliberately fire-and-forget from the HTTP handlers: a model call takes seconds
 * and the board must respond immediately. The task row IS the progress indicator
 * (status doing → done, or ai_error set), so the UI reflects the outcome by
 * refetching rather than by holding a request open.
 */
import { supabaseAdmin } from './supabase.js';
import { createNotification } from './notify.js';
import { runAIChat } from '../routes/ai.js';

/**
 * What the agent should keep in mind per section, so a task raised from Ads is
 * answered like an ads task rather than generic prose. The company brain is
 * injected by runAIChat on top of this.
 */
const SECTION_BRIEF = {
  ads: 'This task came from the Ads section. Think in terms of campaigns, audiences, budget, objectives and ad copy.',
  sales: 'This task came from Sales/CRM. Think in terms of leads, funnel stages, qualification and follow-up.',
  workflow: 'This task came from Workflows/automation. Think in terms of triggers, steps, conditions and timing.',
  inbox: 'This task came from the Inbox. Think in terms of replying to a conversation clearly and briefly.',
  blog: 'This task came from the Blog. Think in terms of outlines, drafts, structure and SEO.',
  sdr: 'This task came from the SDR agent. Think in terms of outbound qualification and hand-over to a human.',
  seo: 'This task came from SEO. Think in terms of keywords, on-page issues, content gaps and priorities.',
  social: 'This task came from Social Media. Think in terms of platform, hook, caption and call to action.',
  dashboard: 'This task came from the Dashboard. Think in terms of metrics, trends and what to do about them.',
  general: '',
  design: '',
};

/** Map a task's section to the archive action, so results land in the right place. */
const ACTION_BY_SECTION = {
  ads: 'campaign_plan',
  seo: 'seo_plan',
  social: 'social_post',
  blog: 'blog_post',
  workflow: 'workflow_build',
  inbox: 'inbox_reply',
  sales: 'sales_marketing_plan',
  sdr: 'message_template',
};

/**
 * Work out which part of the product a task belongs to when the user did not say.
 *
 * Keyword matching rather than an extra model call: it is free, instant and
 * predictable, and getting it wrong only changes which brief the agent gets and
 * where the result is filed — not whether the work happens. The section is what
 * lets a result be sent on to the right section afterwards, so guessing beats
 * leaving everything as 'general'.
 *
 * Ordered most-specific first: "ad copy for instagram" is an ads task, not a
 * social one.
 */
const SECTION_HINTS = [
  ['ads', /\b(ad|ads|advert|campaign|adwords|google ads|meta ads|facebook ads|cpc|cpm|roas|creative|ad copy|anúncio|anuncios|campanha)\b/i],
  ['seo', /\b(seo|keyword|keywords|backlink|serp|ranking|meta description|on-page|palavra-chave)\b/i],
  ['blog', /\b(blog|article|post de blog|artigo|long-form)\b/i],
  ['social', /\b(social|instagram|linkedin|tiktok|twitter|reels|carousel|caption|hashtag|rede social|postagem)\b/i],
  ['sdr', /\b(sdr|qualify|qualification|outbound|prospect|cold call|qualificar)\b/i],
  ['inbox', /\b(inbox|reply|respond|email response|caixa de entrada|responder)\b/i],
  ['workflow', /\b(workflow|automation|sequence|cadence|nurture|automação|fluxo)\b/i],
  ['sales', /\b(lead|leads|pipeline|crm|deal|funnel|follow[- ]?up|venda|vendas|funil)\b/i],
  ['dashboard', /\b(dashboard|metric|metrics|report|kpi|painel|relatório)\b/i],
];

export function inferSection(task) {
  const text = `${task?.title || ''} ${task?.description || ''}`;
  for (const [section, re] of SECTION_HINTS) {
    if (re.test(text)) return section;
  }
  return 'general';
}

async function setTask(taskId, patch) {
  const { data, error } = await supabaseAdmin
    .from('tasks').update(patch).eq('id', taskId).select().single();
  if (error) {
    console.error('[taskRunner] could not update task:', error.message);
    return null;
  }
  return data;
}

async function logActivity({ taskId, companyId, type, summary, details = {} }) {
  const { error } = await supabaseAdmin.from('task_activity').insert({
    task_id: taskId, company_id: companyId, activity_type: type,
    summary: summary || null, details,
    actor_type: 'ai', actor_label: 'Bmapz AI',
  });
  if (error) console.error('[taskRunner] activity log failed:', error.message);
}

/**
 * Who hears about the outcome: the creator, the person the task is for, and
 * anyone following it. The requirement is explicit — a task completed by the AI
 * notifies the creator or the person responsible.
 */
async function notifyOutcome(task, { title, body, icon, priority = 'normal' }) {
  const ids = new Set();
  if (task.created_by) ids.add(task.created_by);
  if (task.assignee_id) ids.add(task.assignee_id);

  const { data, error } = await supabaseAdmin
    .from('task_followers').select('user_id').eq('task_id', task.id);
  if (error) console.error('[taskRunner] follower lookup failed:', error.message);
  for (const f of data || []) ids.add(f.user_id);

  await Promise.all([...ids].map(userId => createNotification({
    companyId: task.company_id,
    userId,
    type: 'task',
    title,
    body,
    icon,
    priority,
    link: '/AIChat?tab=tasks&task=' + task.id,
    metadata: { task_id: task.id, by: 'ai' },
  })));
}

/**
 * Execute one task with the AI agent and record the outcome.
 *
 * Never throws at the caller: an AI failure must leave a readable task, not an
 * unhandled rejection. Failures set `ai_error`, move the task to 'blocked' and
 * notify, so nothing silently disappears.
 */
export async function runTaskWithAI({ task, actorUserId = null }) {
  if (!task?.id || !task?.company_id) return null;

  // Guard against double-running the same task (two clicks, a retry, an automation
  // firing while a manual run is in flight).
  if (task.status === 'done' || task.status === 'cancelled') return null;

  await setTask(task.id, { status: 'doing', ai_error: null });

  // The user may not have picked a section — infer one so the agent gets the right
  // brief and the finished result can be routed to the right place afterwards.
  const section = (task.section && task.section !== 'general')
    ? task.section
    : inferSection(task);
  const action = ACTION_BY_SECTION[section] || 'task_execution';

  const system = [
    'You are the Bmapz AI agent COMPLETING a work task for this company — not advising on it.',
    SECTION_BRIEF[section] || '',
    'Return the finished deliverable itself, ready for someone to use or publish as-is.',
    'Do not describe your approach, do not list the steps you would take, and do not ask',
    'clarifying questions — the task has already been assigned to you.',
    'If part of the task needs real data you genuinely do not have, complete every part you',
    'can and add one short final line naming exactly what is missing. Never fill a gap with',
    'invented names, companies, contacts, links or numbers.',
  ].filter(Boolean).join(' ');

  const prompt = [
    `Task: ${task.title}`,
    task.description ? `Details: ${task.description}` : null,
    task.due_at ? `Due: ${new Date(task.due_at).toISOString().slice(0, 10)}` : null,
    task.priority ? `Priority: ${task.priority}` : null,
  ].filter(Boolean).join('\n');

  try {
    const result = await runAIChat({
      companyId: task.company_id,
      userId: task.created_by || actorUserId || null,
      // The agent acts for the company, not with a person's privileges. Passing a
      // plain role here keeps a task from becoming a way to reach owner-only
      // behaviour through the agent.
      userRole: 'user',
      messages: [{ role: 'user', content: prompt }],
      system,
      action,
      archiveTitle: task.title,
      temperature: 0.6,
      max_tokens: 2000,
    });

    const content = result?.content ?? '';
    const updated = await setTask(task.id, {
      status: 'done',
      completed_at: new Date().toISOString(),
      completed_by_type: 'ai',
      completed_by: null,
      ai_result: { content, model: result?.model || null, at: new Date().toISOString() },
      ai_error: null,
      // Write the inferred section back, so the card shows where this belongs and
      // "send to section" has a target without asking the user again.
      ...(section !== task.section ? { section } : {}),
    });

    await logActivity({
      taskId: task.id, companyId: task.company_id, type: 'ai_completed',
      summary: 'Completed by the Bmapz AI agent',
      details: { model: result?.model || null, section, action },
    });

    await notifyOutcome(updated || task, {
      title: 'The AI finished a task',
      body: task.title,
      icon: '✅',
    });

    return updated;
  } catch (err) {
    // Out of credits is a normal, actionable state — not a crash. Say so plainly
    // so the person knows what to do instead of seeing a stuck task.
    const outOfCredits = err?.code === 'CREDITS_EXHAUSTED';
    const message = outOfCredits
      ? 'Not enough AI credits to complete this task.'
      : (err?.message || 'The AI could not complete this task.');

    console.error(`[taskRunner] task ${task.id} failed:`, message);

    const updated = await setTask(task.id, { status: 'blocked', ai_error: message });

    await logActivity({
      taskId: task.id, companyId: task.company_id, type: 'ai_failed',
      summary: message, details: { code: err?.code || null, section },
    });

    await notifyOutcome(updated || task, {
      title: outOfCredits ? 'A task needs AI credits' : 'The AI could not finish a task',
      body: `${task.title} — ${message}`,
      icon: '⚠️',
      priority: 'high',
    });

    return updated;
  }
}

export default runTaskWithAI;
