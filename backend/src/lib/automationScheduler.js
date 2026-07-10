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

async function executeAutomation(a) {
  const startedAt = new Date();
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
      // Claim first (set next_run_at forward) so a crash mid-run can't
      // cause a tight retry loop.
      const nextRun = computeNextRunAt(a, new Date());
      await supabaseAdmin
        .from('ai_automations')
        .update({ next_run_at: nextRun.toISOString() })
        .eq('id', a.id);

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
