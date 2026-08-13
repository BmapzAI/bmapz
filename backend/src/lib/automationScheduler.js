/**
 * AI Automation scheduler — the cron engine behind the "AI Automations" tab.
 *
 * Every minute, picks up enabled automations whose next_run_at is due,
 * executes their prompt through runAIChat (which injects the Company Brain,
 * enforces plan/credit rules, and tracks token usage like any other AI call),
 * stores the result in ai_outputs for review/approval, then computes the
 * next occurrence.
 *
 * Railway runs a single always-on Node process, so an in-process interval
 * is sufficient — no external cron infra needed. A simple `running` flag
 * prevents overlapping ticks if a batch runs long.
 */
import { supabaseAdmin } from './supabase.js';

const TICK_MS = 60 * 1000;
let running = false;
let runAIChatRef = null; // injected at start to avoid a circular import

/** Compute the next run time strictly AFTER `from` for an automation row. */
export function computeNextRunAt(a, from = new Date()) {
  const next = new Date(from);
  next.setSeconds(0, 0);

  switch (a.schedule_type) {
    case 'every_minutes': {
      const interval = Math.max(5, Number(a.interval_minutes) || 60); // 5-min floor
      return new Date(from.getTime() + interval * 60 * 1000);
    }
    case 'hourly': {
      next.setMinutes(a.run_minute ?? 0);
      if (next <= from) next.setHours(next.getHours() + 1);
      return next;
    }
    case 'daily': {
      next.setHours(a.run_hour ?? 9, a.run_minute ?? 0);
      if (next <= from) next.setDate(next.getDate() + 1);
      return next;
    }
    case 'weekly': {
      const targetDow = a.run_day_of_week ?? 1; // Monday default
      next.setHours(a.run_hour ?? 9, a.run_minute ?? 0);
      let delta = (targetDow - next.getDay() + 7) % 7;
      if (delta === 0 && next <= from) delta = 7;
      next.setDate(next.getDate() + delta);
      return next;
    }
    case 'monthly': {
      const dom = Math.min(28, Math.max(1, a.run_day_of_month ?? 1));
      next.setDate(dom);
      next.setHours(a.run_hour ?? 9, a.run_minute ?? 0);
      if (next <= from) next.setMonth(next.getMonth() + 1, dom);
      return next;
    }
    default:
      return new Date(from.getTime() + 24 * 60 * 60 * 1000);
  }
}

/**
 * A scheduled automation whose job is to RAISE A TASK rather than write an output.
 *
 * This is how "tasks can be scheduled in AI automations" works: the automation
 * carries a `task_template`, and each run creates a real task from it. If the
 * template assigns the agent, the task is executed immediately through the same
 * runner the My Tasks board uses — so a scheduled task and a hand-created one
 * behave identically, including credits, the company brain, archiving and
 * notifications.
 *
 * `taskRunner` is imported dynamically, not at module load. The scheduler already
 * takes runAIChat by injection specifically to avoid an ai.js ↔ scheduler import
 * cycle, and taskRunner imports ai.js — so importing it lazily keeps that
 * guarantee intact regardless of module load order.
 */
async function executeTaskAutomation(a) {
  const tpl = a.task_template || {};
  const title = String(tpl.title || a.name || 'Scheduled task').slice(0, 300);

  const dueInDays = Number(tpl.due_in_days);
  const due_at = Number.isFinite(dueInDays) && dueInDays >= 0
    ? new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Only 'ai' and 'user' are honoured; anything else becomes unassigned. A
  // template naming a person who has since left the company would otherwise
  // insert a dangling assignee — validated below.
  let assigneeType = ['ai', 'user'].includes(tpl.assignee_type) ? tpl.assignee_type : 'unassigned';
  let assigneeId = assigneeType === 'user' ? (tpl.assignee_id || null) : null;
  if (assigneeType === 'user' && assigneeId) {
    const { filterCompanyMembers } = await import('../middleware/auth.js');
    const members = await filterCompanyMembers([assigneeId], a.company_id);
    if (!members.includes(assigneeId)) {
      console.warn(`[automations] task_template assignee ${assigneeId} is not in company ${a.company_id} — leaving unassigned`);
      assigneeType = 'unassigned';
      assigneeId = null;
    }
  }

  const { data: task, error } = await supabaseAdmin.from('tasks').insert({
    company_id: a.company_id,
    title,
    description: tpl.description || a.prompt || null,
    priority: ['low', 'medium', 'high', 'urgent'].includes(tpl.priority) ? tpl.priority : 'medium',
    section: tpl.section || 'general',
    visibility: tpl.visibility === 'private' ? 'private' : 'company',
    assignee_type: assigneeType,
    assignee_id: assigneeId,
    due_at,
    created_by: a.created_by || null,
    metadata: { created_by_automation: a.id, automation_name: a.name },
  }).select().single();
  if (error) return { status: 'error', error: error.message };

  await supabaseAdmin.from('task_activity').insert({
    task_id: task.id,
    company_id: a.company_id,
    activity_type: 'created',
    summary: `Raised by the scheduled automation "${a.name}"`,
    details: { automation_id: a.id },
    actor_type: 'system',
    actor_label: 'AI automation',
  });

  // The agent owns it — do the work now.
  if (task.assignee_type === 'ai') {
    const { runTaskWithAI } = await import('./taskRunner.js');
    const done = await runTaskWithAI({ task, actorUserId: a.created_by || null });
    return {
      status: done?.status === 'done' ? 'success' : 'error',
      task_id: task.id,
      task_status: done?.status || task.status,
      error: done?.ai_error || null,
    };
  }

  // Assigned to a person (or nobody): tell them it exists.
  if (task.assignee_id) {
    const { createNotification } = await import('./notify.js');
    await createNotification({
      companyId: a.company_id,
      userId: task.assignee_id,
      type: 'task',
      title: 'A scheduled task was assigned to you',
      body: task.title,
      icon: '⏰',
      link: '/AIChat?tab=tasks&task=' + task.id,
      metadata: { task_id: task.id, automation_id: a.id },
    });
  }

  return { status: 'success', task_id: task.id, task_status: task.status };
}

async function executeAutomation(a) {
  const startedAt = new Date();

  // Task-producing automations take a different path entirely.
  if (a.task_type === 'create_task') {
    try {
      return await executeTaskAutomation(a);
    } catch (err) {
      console.error(`[automations] task automation "${a.name}" (${a.id}) failed:`, err.message);
      return { status: 'error', error: err.publicMessage || err.message, code: err.code || null };
    }
  }

  try {
    const result = await runAIChatRef({
      companyId: a.company_id,
      userId: a.created_by || null,
      userRole: 'user', // platform keys + credit rules always apply to automations
      userEmail: 'automation@bmapz',
      messages: [{ role: 'user', content: a.prompt }],
      action: 'ai_automation',
      system:
        'You are executing a SCHEDULED automation for this company. Produce the deliverable directly (no chit-chat, no questions). If the task asks for content, output the finished content ready for review.',
    });

    // Store output for review in AI Outputs (same metadata-flattening shape
    // the /api/ai/outputs route uses).
    await supabaseAdmin.from('ai_outputs').insert({
      company_id: a.company_id,
      type: 'automation',
      prompt: a.prompt,
      output: result.content || '',
      model: result.model_used || null,
      tokens_used: result.usage?.total_tokens || null,
      metadata: {
        title: `⏰ ${a.name} — ${startedAt.toISOString().slice(0, 16).replace('T', ' ')}`,
        content: result.content || '',
        category: a.output_category || 'strategies',
        status: 'pending',
        automation_id: a.id,
      },
    });

    return { status: 'success', model: result.model_used, tokens: result.usage?.total_tokens || 0 };
  } catch (err) {
    console.error(`[automations] "${a.name}" (${a.id}) failed:`, err.publicMessage || err.message);
    return { status: 'error', error: err.publicMessage || err.message, code: err.code || null };
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const nowIso = new Date().toISOString();
    const { data: due, error } = await supabaseAdmin
      .from('ai_automations')
      .select('*')
      .eq('enabled', true)
      .lte('next_run_at', nowIso)
      .limit(10); // cap per tick; leftovers picked up next minute
    if (error) throw error;
    if (!due?.length) return;

    for (const a of due) {
      // CONDITIONAL claim. Pushing next_run_at forward is what stops a crash
      // mid-run turning into a tight retry loop — but the update's success was
      // never checked, and the claim was unconditional. So two instances (or a
      // restart overlapping a tick) could each "claim" the same automation and
      // both run it: duplicate ai_outputs rows and double the AI spend, every
      // 60 seconds.
      //
      // `.eq('next_run_at', a.next_run_at)` makes this a compare-and-swap: only
      // the worker that still sees the value it read wins the claim.
      const nextRun = computeNextRunAt(a, new Date());
      const { data: claimed, error: claimErr } = await supabaseAdmin
        .from('ai_automations')
        .update({ next_run_at: nextRun.toISOString() })
        .eq('id', a.id)
        .eq('next_run_at', a.next_run_at)
        .select('id');
      if (claimErr) {
        console.error(`[automations] claim failed for ${a.id}, skipping this tick:`, claimErr.message);
        continue;
      }
      if (!claimed || claimed.length === 0) {
        // Someone else claimed it first — do NOT run it again.
        console.log(`[automations] ${a.id} already claimed by another worker, skipping`);
        continue;
      }

      const result = await executeAutomation(a);

      await supabaseAdmin
        .from('ai_automations')
        .update({
          last_run_at: new Date().toISOString(),
          last_status: result.status,
          last_result: result,
          run_count: (a.run_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', a.id);

      console.log(`[automations] ran "${a.name}" → ${result.status}; next at ${nextRun.toISOString()}`);
    }
  } catch (err) {
    console.error('[automations] tick failed:', err.message);
  } finally {
    running = false;
  }
}

/**
 * Start the scheduler. Called once from index.js with the runAIChat function
 * injected (avoids ai.js ↔ scheduler circular import).
 */
export function startAutomationScheduler(runAIChat) {
  runAIChatRef = runAIChat;
  setInterval(tick, TICK_MS).unref?.();
  // First tick shortly after boot so overdue automations catch up fast.
  setTimeout(tick, 10 * 1000).unref?.();
  console.log('[automations] scheduler started (60s tick)');
}
