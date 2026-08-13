/**
 * Task management — the "My Tasks" surface.
 *
 * Serves the tab in the AI Chat section (kanban / list / calendar), the Home
 * widget (To do / Doing / Done), and the table-entry mode in AI chat. Tasks can be
 * assigned to a teammate or to the AI agent, followed, prioritised, scheduled, and
 * connected to the section they came from so the agent can act on them.
 *
 * ── NO IMPLICIT EMBEDS ──────────────────────────────────────────────────────
 * `tasks` has THREE foreign keys to `users` (created_by, assignee_id,
 * completed_by), so `select('*, users(*)')` is ambiguous and fails — the same
 * failure that took the app down in migration 021. People are resolved in one
 * extra query and merged by `attachPeople`, the pattern middleware/auth.js
 * adopted after that outage.
 *
 * ── VISIBILITY ──────────────────────────────────────────────────────────────
 * A 'private' task is visible only to its creator and its assignee. Enforced here,
 * in the backend, because every query runs as service_role and therefore bypasses
 * RLS entirely — the policy in migration 031 is a second layer, not the guard.
 */
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, filterCompanyMembers } from '../middleware/auth.js';
import { createNotification } from '../lib/notify.js';
import { runTaskWithAI } from '../lib/taskRunner.js';
import { runAIChat } from './ai.js';

const router = Router();

// Must match the CHECK constraint on tasks.status (migrations 031 + 033).
const STATUSES = ['standby', 'todo', 'doing', 'done', 'blocked', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VISIBILITIES = ['company', 'private'];
const ASSIGNEE_TYPES = ['user', 'ai', 'unassigned'];
const SECTIONS = ['general', 'ads', 'sales', 'workflow', 'inbox', 'blog', 'sdr',
  'seo', 'social', 'design', 'dashboard'];

/** Fields a client may write. Everything else is ignored rather than trusted. */
const WRITABLE = ['title', 'description', 'status', 'priority', 'due_at', 'position',
  'visibility', 'assignee_type', 'assignee_id', 'section', 'linked_type', 'linked_id'];

/**
 * Never writable by a client, even though they are real columns: company_id and
 * created_by are tenancy, and the ai_* / completed_* fields are the record of what
 * actually happened — a client that could set `completed_by_type: 'ai'` could
 * fake work it never did.
 */
const pickTaskFields = (body) => {
  const out = {};
  for (const k of WRITABLE) if (body && k in body) out[k] = body[k];
  return out;
};

/** Empty strings from form inputs are not valid timestamps/uuids — send null. */
const nullIfBlank = (v) => (v === '' || v === undefined ? null : v);

function validateTaskFields(f) {
  if ('status' in f && !STATUSES.includes(f.status)) return `status must be one of: ${STATUSES.join(', ')}`;
  if ('priority' in f && !PRIORITIES.includes(f.priority)) return `priority must be one of: ${PRIORITIES.join(', ')}`;
  if ('visibility' in f && !VISIBILITIES.includes(f.visibility)) return `visibility must be one of: ${VISIBILITIES.join(', ')}`;
  if ('assignee_type' in f && !ASSIGNEE_TYPES.includes(f.assignee_type)) return `assignee_type must be one of: ${ASSIGNEE_TYPES.join(', ')}`;
  if ('section' in f && f.section && !SECTIONS.includes(f.section)) return `section must be one of: ${SECTIONS.join(', ')}`;
  if ('title' in f && !String(f.title || '').trim()) return 'title is required';
  if ('due_at' in f && f.due_at && Number.isNaN(Date.parse(f.due_at))) return 'due_at is not a valid date';
  if ('position' in f && f.position !== null && !Number.isFinite(Number(f.position))) return 'position must be a number';
  return null;
}

/**
 * Normalise the assignee pair so they can never disagree: a user assignment needs
 * an id, an AI assignment must not have one.
 *
 * Returns an error string if the named assignee is not a member of this company —
 * validated with filterCompanyMembers rather than a `users.company_id` comparison,
 * so a legitimate guest member (accessible_company_ids) is still accepted.
 */
async function resolveAssignee(fields, companyId) {
  if (!('assignee_type' in fields) && !('assignee_id' in fields)) return null;

  let type = fields.assignee_type;
  const id = nullIfBlank(fields.assignee_id);

  // An id with no explicit type means "assign to this person".
  if (!type) type = id ? 'user' : 'unassigned';

  if (type === 'user') {
    if (!id) return 'assignee_id is required when assigning to a person';
    const members = await filterCompanyMembers([id], companyId);
    if (!members.includes(id)) return 'That person is not a member of this company.';
    fields.assignee_type = 'user';
    fields.assignee_id = id;
  } else {
    // 'ai' and 'unassigned' never carry a user id.
    fields.assignee_type = type;
    fields.assignee_id = null;
  }
  return null;
}

/**
 * Attach creator / assignee / completer profiles to task rows.
 *
 * One query for every person referenced across the whole batch, then merged in
 * memory. This is what replaces the (impossible) embed.
 */
async function attachPeople(rows) {
  const list = Array.isArray(rows) ? rows : [rows].filter(Boolean);
  if (!list.length) return rows;

  const ids = [...new Set(list.flatMap(t => [t.created_by, t.assignee_id, t.completed_by]).filter(Boolean))];
  let byId = {};
  if (ids.length) {
    const { data, error } = await supabaseAdmin
      .from('users').select('id, full_name, email, username, profile_picture').in('id', ids);
    // A failed lookup must not fail the board — the task list is still useful
    // without avatars. Log and carry on with ids only.
    if (error) console.error('[tasks] person lookup failed:', error.message);
    for (const u of data || []) byId[u.id] = u;
  }

  const shape = (u) => (u ? {
    id: u.id, full_name: u.full_name, email: u.email,
    username: u.username, profile_picture: u.profile_picture,
  } : null);

  const decorate = (t) => ({
    ...t,
    creator: shape(byId[t.created_by]),
    assignee: shape(byId[t.assignee_id]),
    completer: shape(byId[t.completed_by]),
    // What the UI shows as "who did it": the AI, or a person.
    done_by_label: t.status === 'done'
      ? (t.completed_by_type === 'ai'
        ? 'Bmapz AI'
        : (byId[t.completed_by]?.username
          ? `@${byId[t.completed_by].username}`
          : byId[t.completed_by]?.full_name || byId[t.completed_by]?.email || 'Someone'))
      : null,
  });

  return Array.isArray(rows) ? list.map(decorate) : decorate(list[0]);
}

/**
 * A task this user may see: in their company, and either public or theirs.
 *
 * `.or()` is applied on top of the company filter, so it cannot widen the tenant
 * scope — only narrow within it.
 */
const visibleTo = (query, userId) =>
  query.or(`visibility.eq.company,created_by.eq.${userId},assignee_id.eq.${userId}`);

/** Fetch one task the caller is allowed to see, or null. */
async function getVisibleTask(id, companyId, userId) {
  const { data, error } = await visibleTo(
    supabaseAdmin.from('tasks').select('*').eq('id', id).eq('company_id', companyId),
    userId,
  ).limit(1).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function logActivity({ taskId, companyId, type, summary, details = {}, actorType = 'user', actorUserId = null, actorLabel = null }) {
  const { error } = await supabaseAdmin.from('task_activity').insert({
    task_id: taskId, company_id: companyId, activity_type: type,
    summary: summary || null, details,
    actor_type: actorType, actor_user_id: actorUserId, actor_label: actorLabel,
  });
  if (error) console.error('[tasks] activity log failed:', error.message);
}

/** Everyone who should hear about a change: assignee, creator and followers. */
async function audienceFor(task, { exclude = null } = {}) {
  const ids = new Set();
  if (task.assignee_id) ids.add(task.assignee_id);
  if (task.created_by) ids.add(task.created_by);

  const { data, error } = await supabaseAdmin
    .from('task_followers').select('user_id').eq('task_id', task.id);
  if (error) console.error('[tasks] follower lookup failed:', error.message);
  for (const f of data || []) ids.add(f.user_id);

  if (exclude) ids.delete(exclude);
  return [...ids];
}

async function notifyAudience(task, { exclude, title, body, icon = '🗂️', type = 'task', priority = 'normal' }) {
  const audience = await audienceFor(task, { exclude });
  await Promise.all(audience.map(userId => createNotification({
    companyId: task.company_id,
    userId,
    type,
    title,
    body,
    icon,
    priority,
    link: '/AIChat?tab=tasks&task=' + task.id,
    metadata: { task_id: task.id },
  })));
}

// ─── Board / list ────────────────────────────────────────────────────────────
// GET /api/tasks?status=todo&assignee=me&section=ads&view=board
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, section, assignee, priority, mine, due_before, due_after, limit = 500 } = req.query;

    let q = supabaseAdmin.from('tasks').select('*').eq('company_id', req.companyId);
    q = visibleTo(q, req.dbUser.id);

    if (status && STATUSES.includes(status)) q = q.eq('status', status);
    if (priority && PRIORITIES.includes(priority)) q = q.eq('priority', priority);
    if (section && SECTIONS.includes(section)) q = q.eq('section', section);
    if (assignee === 'ai') q = q.eq('assignee_type', 'ai');
    else if (assignee === 'unassigned') q = q.eq('assignee_type', 'unassigned');
    else if (assignee === 'me' || mine === 'true') q = q.eq('assignee_id', req.dbUser.id);
    if (due_before) q = q.lte('due_at', due_before);
    if (due_after) q = q.gte('due_at', due_after);

    const { data, error } = await q
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(limit) || 500, 1000));
    if (error) throw error;

    res.json({ data: await attachPeople(data || []) });
  } catch (err) {
    console.error('[tasks] list failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/summary — counts for the Home widget.
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const { data, error } = await visibleTo(
      supabaseAdmin.from('tasks')
        .select('id, status, due_at, priority, assignee_type, assignee_id')
        .eq('company_id', req.companyId),
      req.dbUser.id,
    ).limit(1000);
    if (error) throw error;

    const rows = data || [];
    const now = Date.now();
    const count = (fn) => rows.filter(fn).length;

    res.json({
      standby: count(t => t.status === 'standby'),
      todo: count(t => t.status === 'todo'),
      doing: count(t => t.status === 'doing'),
      done: count(t => t.status === 'done'),
      blocked: count(t => t.status === 'blocked'),
      mine: count(t => t.assignee_id === req.dbUser.id && t.status !== 'done'),
      with_ai: count(t => t.assignee_type === 'ai' && !['done', 'cancelled'].includes(t.status)),
      overdue: count(t => t.due_at && !['done', 'cancelled'].includes(t.status) && Date.parse(t.due_at) < now),
      total: rows.length,
    });
  } catch (err) {
    console.error('[tasks] summary failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Create ──────────────────────────────────────────────────────────────────
async function createOneTask({ body, req }) {
  const fields = pickTaskFields(body);
  fields.due_at = nullIfBlank(fields.due_at);
  fields.linked_id = nullIfBlank(fields.linked_id);

  const invalid = validateTaskFields(fields);
  if (invalid) return { error: invalid, status: 400 };

  const assigneeErr = await resolveAssignee(fields, req.companyId);
  if (assigneeErr) return { error: assigneeErr, status: 400 };

  // AUTO-ASSIGN TO AI. When the creator has the setting on and named no assignee,
  // the agent takes it — that is the whole point of the toggle.
  const autoToAI = !!req.dbUser?.auto_assign_tasks_to_ai
    && (!fields.assignee_type || fields.assignee_type === 'unassigned');
  if (autoToAI) {
    fields.assignee_type = 'ai';
    fields.assignee_id = null;
  }

  const { data, error } = await supabaseAdmin.from('tasks').insert({
    ...fields,
    company_id: req.companyId,
    created_by: req.dbUser.id,
  }).select().single();
  if (error) return { error: error.message, status: 500 };

  await logActivity({
    taskId: data.id, companyId: req.companyId, type: 'created',
    summary: `Task created${data.assignee_type === 'ai' ? ' and handed to the AI agent' : ''}`,
    details: { auto_assigned_to_ai: autoToAI },
    actorUserId: req.dbUser.id,
    actorLabel: req.dbUser.full_name || req.dbUser.email,
  });

  // Tagging someone notifies them. Never notify yourself for your own action.
  if (data.assignee_type === 'user' && data.assignee_id && data.assignee_id !== req.dbUser.id) {
    await createNotification({
      companyId: req.companyId,
      userId: data.assignee_id,
      type: 'task',
      title: 'You were assigned a task',
      body: data.title,
      icon: '🗂️',
      priority: data.priority === 'urgent' ? 'high' : 'normal',
      link: '/AIChat?tab=tasks&task=' + data.id,
      metadata: { task_id: data.id, assigned_by: req.dbUser.id },
    });
  }

  return { data };
}

router.post('/', requireAuth, async (req, res) => {
  try {
    const result = await createOneTask({ body: req.body, req });
    if (result.error) return res.status(result.status).json({ error: result.error });

    // Hand it to the agent immediately when the AI owns it. Fired and awaited
    // separately so a slow model never blocks the create response.
    if (result.data.assignee_type === 'ai') {
      runTaskWithAI({ task: result.data, actorUserId: req.dbUser.id }).catch(e =>
        console.error('[tasks] AI run failed:', e.message));
    }

    res.json(await attachPeople(result.data));
  } catch (err) {
    console.error('[tasks] create failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tasks/bulk — the AI-chat TABLE entry mode.
 * Body: { tasks: [{ title|task, owner, priority, deadline|due_at, ... }] }
 *
 * `owner` accepts a @username, an email or a user id so the table can be typed
 * naturally. An owner that cannot be resolved leaves the task unassigned and is
 * reported back rather than failing the whole table.
 */
router.post('/bulk', requireAuth, async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.tasks) ? req.body.tasks : null;
    if (!rows?.length) return res.status(400).json({ error: 'tasks must be a non-empty array' });
    const MAX = 100;
    if (rows.length > MAX) {
      return res.status(413).json({ error: `Add up to ${MAX} tasks at a time (received ${rows.length}).`, max: MAX });
    }

    // Resolve every named owner in ONE query rather than per row.
    const handles = [...new Set(rows.map(r => String(r.owner ?? r.assignee ?? '').trim()).filter(Boolean))];
    const ownerByKey = {};
    if (handles.length) {
      const cleaned = handles.map(h => h.replace(/^@+/, ''));
      const { data: found, error: lookErr } = await supabaseAdmin
        .from('users').select('id, username, email, full_name, company_id, accessible_company_ids, role')
        .or(`username.in.(${cleaned.map(c => JSON.stringify(c)).join(',')}),email.in.(${cleaned.map(c => JSON.stringify(c)).join(',')})`);
      if (lookErr) throw lookErr;
      // Only people who are actually in this company may be assigned.
      const allowed = new Set(await filterCompanyMembers((found || []).map(u => u.id), req.companyId));
      for (const u of found || []) {
        if (!allowed.has(u.id)) continue;
        if (u.username) ownerByKey[u.username.toLowerCase()] = u.id;
        if (u.email) ownerByKey[u.email.toLowerCase()] = u.id;
      }
    }

    const created = [];
    const problems = [];
    for (const [i, r] of rows.entries()) {
      const rawOwner = String(r.owner ?? r.assignee ?? '').trim().replace(/^@+/, '').toLowerCase();
      const wantsAI = /^(ai|bmapz|agent|bmapz ai)$/i.test(rawOwner);
      const ownerId = wantsAI ? null : (ownerByKey[rawOwner] || null);
      if (rawOwner && !wantsAI && !ownerId) {
        problems.push({ row: i + 1, owner: r.owner, reason: 'not a member of this company — left unassigned' });
      }

      const body = {
        title: r.title ?? r.task ?? r.name,
        description: r.description ?? r.notes ?? null,
        priority: PRIORITIES.includes(String(r.priority || '').toLowerCase())
          ? String(r.priority).toLowerCase() : 'medium',
        due_at: nullIfBlank(r.due_at ?? r.deadline ?? r.due ?? null),
        section: SECTIONS.includes(String(r.section || '').toLowerCase())
          ? String(r.section).toLowerCase() : 'general',
        visibility: r.visibility === 'private' ? 'private' : 'company',
        assignee_type: wantsAI ? 'ai' : (ownerId ? 'user' : 'unassigned'),
        assignee_id: ownerId,
        position: i,
      };

      const result = await createOneTask({ body, req });
      if (result.error) problems.push({ row: i + 1, title: body.title, reason: result.error });
      else created.push(result.data);
    }

    // Kick off everything the AI owns, after the response is prepared.
    for (const t of created.filter(t => t.assignee_type === 'ai')) {
      runTaskWithAI({ task: t, actorUserId: req.dbUser.id }).catch(e =>
        console.error('[tasks] AI run failed:', e.message));
    }

    res.json({
      created: created.length,
      data: await attachPeople(created),
      ...(problems.length ? { problems } : {}),
    });
  } catch (err) {
    console.error('[tasks] bulk failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tasks/suggest — the agent PROPOSES tasks; it does not create them.
 * Body: { prompt } or { messages: [{ role, content }] }
 *
 * Deliberately read-only. The AI is good at breaking work down and bad at knowing
 * what the user actually wants on their board, so this returns candidates for the
 * user to accept (which then go through POST /bulk like any other table entry).
 * Suggesting and creating in one step would fill someone's board with work they
 * never asked for.
 */
router.post('/suggest', requireAuth, async (req, res) => {
  try {
    const { prompt, messages } = req.body || {};
    // Accept either a direct instruction or the tail of a conversation, so AI chat
    // can ask "turn what we just discussed into tasks".
    const conversation = Array.isArray(messages) && messages.length
      ? messages.slice(-12).map(m => `${m.role === 'assistant' ? 'AI' : 'User'}: ${String(m.content || '').slice(0, 2000)}`).join('\n')
      : null;
    const basis = conversation || String(prompt || '').trim();
    if (!basis) return res.status(400).json({ error: 'Send a prompt or some messages to work from.' });

    const system = [
      'You break work down into a short list of concrete, actionable tasks for a',
      'marketing and sales team. Reply with JSON ONLY, in this exact shape:',
      '{"tasks":[{"title":"…","description":"…","priority":"low|medium|high|urgent",',
      '"section":"general|ads|sales|workflow|inbox|blog|sdr|seo|social|dashboard",',
      '"due_in_days":0,"suggest_ai":true}]}',
      'Rules: at most 8 tasks. Each title is one clear action under 90 characters.',
      'Set suggest_ai true only when the agent could genuinely finish it alone',
      '(writing, planning, drafting) and false when it needs a human (calls, approvals,',
      'spending money, anything touching a real account).',
      'Never invent people or assign owners.',
    ].join(' ');

    const result = await runAIChat({
      companyId: req.companyId,
      userId: req.dbUser.id,
      userRole: req.dbUser.role,
      userEmail: req.dbUser.email,
      messages: [{ role: 'user', content: `Break this down into tasks:\n\n${basis}` }],
      system,
      action: 'task_suggest',
      temperature: 0.4,
      max_tokens: 1200,
      // Suggestions are throwaway candidates, not a deliverable — keep them out of
      // the AI Outputs archive so it stays a record of real work.
      skipArchive: true,
    });

    // Models wrap JSON in prose or fences no matter how firmly you ask. Recover the
    // object rather than failing the request.
    const raw = String(result?.content || '');
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) { try { parsed = JSON.parse(match[0]); } catch { parsed = null; } }
    }
    if (!parsed?.tasks || !Array.isArray(parsed.tasks)) {
      return res.status(502).json({
        error: 'The AI did not return a usable task list. Try rephrasing.',
        code: 'SUGGEST_UNPARSEABLE',
      });
    }

    // Normalise to exactly what the create endpoints accept, dropping anything else
    // the model decided to include.
    const suggestions = parsed.tasks.slice(0, 8).map(t => ({
      title: String(t.title || '').slice(0, 300),
      description: t.description ? String(t.description).slice(0, 2000) : null,
      priority: PRIORITIES.includes(t.priority) ? t.priority : 'medium',
      section: SECTIONS.includes(t.section) ? t.section : 'general',
      due_in_days: Number.isFinite(Number(t.due_in_days))
        ? Math.min(365, Math.max(0, parseInt(t.due_in_days, 10))) : null,
      suggest_ai: !!t.suggest_ai,
    })).filter(t => t.title);

    res.json({ data: suggestions });
  } catch (err) {
    if (err?.code === 'CREDITS_EXHAUSTED') {
      return res.status(402).json({ error: 'Out of AI credits.', code: 'CREDITS_EXHAUSTED' });
    }
    console.error('[tasks] suggest failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Read one ────────────────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const task = await getVisibleTask(req.params.id, req.companyId, req.dbUser.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(await attachPeople(task));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/activity', requireAuth, async (req, res) => {
  try {
    const task = await getVisibleTask(req.params.id, req.companyId, req.dbUser.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const { data, error } = await supabaseAdmin
      .from('task_activity').select('*')
      .eq('task_id', task.id).eq('company_id', req.companyId)
      .order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Update ──────────────────────────────────────────────────────────────────
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const before = await getVisibleTask(req.params.id, req.companyId, req.dbUser.id);
    if (!before) return res.status(404).json({ error: 'Task not found' });

    const fields = pickTaskFields(req.body);
    if ('due_at' in fields) fields.due_at = nullIfBlank(fields.due_at);
    if ('linked_id' in fields) fields.linked_id = nullIfBlank(fields.linked_id);

    const invalid = validateTaskFields(fields);
    if (invalid) return res.status(400).json({ error: invalid });

    const assigneeErr = await resolveAssignee(fields, req.companyId);
    if (assigneeErr) return res.status(400).json({ error: assigneeErr });

    if (!Object.keys(fields).length) return res.json(await attachPeople(before));

    // Completion bookkeeping is decided here, never taken from the client.
    const movingToDone = fields.status === 'done' && before.status !== 'done';
    if (movingToDone) {
      fields.completed_at = new Date().toISOString();
      fields.completed_by_type = 'user';
      fields.completed_by = req.dbUser.id;
    } else if ('status' in fields && fields.status !== 'done' && before.status === 'done') {
      // Reopening clears the record of completion rather than leaving a stale one.
      fields.completed_at = null;
      fields.completed_by_type = null;
      fields.completed_by = null;
    }

    const { data, error } = await supabaseAdmin
      .from('tasks').update(fields)
      .eq('id', before.id).eq('company_id', req.companyId)
      .select().single();
    if (error) throw error;

    const actorLabel = req.dbUser.full_name || req.dbUser.email;
    if ('status' in fields && fields.status !== before.status) {
      await logActivity({
        taskId: data.id, companyId: req.companyId, type: 'status_changed',
        summary: `Status ${before.status} → ${data.status}`,
        details: { from: before.status, to: data.status },
        actorUserId: req.dbUser.id, actorLabel,
      });
      await notifyAudience(data, {
        exclude: req.dbUser.id,
        title: `Task moved to ${data.status}`,
        body: data.title,
        icon: data.status === 'done' ? '✅' : '🗂️',
      });
    }

    if (fields.assignee_id && fields.assignee_id !== before.assignee_id) {
      await logActivity({
        taskId: data.id, companyId: req.companyId, type: 'assigned',
        summary: 'Assignee changed',
        details: { from: before.assignee_id, to: data.assignee_id },
        actorUserId: req.dbUser.id, actorLabel,
      });
      if (fields.assignee_id !== req.dbUser.id) {
        await createNotification({
          companyId: req.companyId, userId: fields.assignee_id, type: 'task',
          title: 'You were assigned a task', body: data.title, icon: '🗂️',
          link: '/AIChat?tab=tasks&task=' + data.id, metadata: { task_id: data.id },
        });
      }
    }

    // Newly handed to the AI — start the work.
    if (fields.assignee_type === 'ai' && before.assignee_type !== 'ai'
        && !['done', 'cancelled'].includes(data.status)) {
      runTaskWithAI({ task: data, actorUserId: req.dbUser.id }).catch(e =>
        console.error('[tasks] AI run failed:', e.message));
    }

    res.json(await attachPeople(data));
  } catch (err) {
    console.error('[tasks] update failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/run-ai — hand this task to the agent now.
router.post('/:id/run-ai', requireAuth, async (req, res) => {
  try {
    const task = await getVisibleTask(req.params.id, req.companyId, req.dbUser.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { data, error } = await supabaseAdmin.from('tasks')
      .update({ assignee_type: 'ai', assignee_id: null, status: 'doing', ai_error: null })
      .eq('id', task.id).eq('company_id', req.companyId)
      .select().single();
    if (error) throw error;

    runTaskWithAI({ task: data, actorUserId: req.dbUser.id }).catch(e =>
      console.error('[tasks] AI run failed:', e.message));

    res.json({ success: true, task: await attachPeople(data) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Follow / unfollow ───────────────────────────────────────────────────────
router.post('/:id/follow', requireAuth, async (req, res) => {
  try {
    const task = await getVisibleTask(req.params.id, req.companyId, req.dbUser.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    // upsert, so following twice is not an error the UI has to handle.
    const { error } = await supabaseAdmin.from('task_followers')
      .upsert({ task_id: task.id, user_id: req.dbUser.id }, { onConflict: 'task_id,user_id' });
    if (error) throw error;
    res.json({ success: true, following: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/follow', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('task_followers')
      .delete().eq('task_id', req.params.id).eq('user_id', req.dbUser.id);
    if (error) throw error;
    res.json({ success: true, following: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/followed/ids — which of my visible tasks I follow (for the UI).
router.get('/followed/ids', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('task_followers').select('task_id').eq('user_id', req.dbUser.id);
    if (error) throw error;
    res.json({ data: (data || []).map(r => r.task_id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Delete ──────────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const task = await getVisibleTask(req.params.id, req.companyId, req.dbUser.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    // Only the creator, the assignee, or a company admin may delete.
    const isPrivileged = ['owner', 'system_admin', 'company_admin'].includes(req.dbUser.role);
    if (!isPrivileged && task.created_by !== req.dbUser.id && task.assignee_id !== req.dbUser.id) {
      return res.status(403).json({ error: 'Only the creator, the assignee or a company admin can delete this task.' });
    }
    const { error } = await supabaseAdmin.from('tasks')
      .delete().eq('id', task.id).eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
