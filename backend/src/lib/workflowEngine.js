/**
 * Workflow execution engine.
 *
 * This is what makes SCHEDULED workflow steps actually run. Previously a run
 * record was created but nothing advanced it, so waits/delays and the steps
 * after them never fired. Now a 60-second ticker walks every active run
 * through its nodes, honouring `wait` delays via `next_action_at`.
 *
 * Node model (stored on workflows.nodes / workflows.connections):
 *   node:       { id, type, name, channel?, subject?, content?, delay_days?,
 *                 delay_hours?, condition?, auto_send? }
 *   types:      trigger | send_message | wait | condition | schedule_meeting |
 *               end_success | end_failed
 *   connection: { from: { nodeId, port }, to: nodeId }   port: default|yes|no
 *
 * Run row (workflow_runs): tracks current_node_id, next_action_at, status,
 *   steps_completed, error, context.
 */
import { supabaseAdmin } from './supabase.js';
import { sendCompanyEmail } from './emailSender.js';

const TICK_MS = 60 * 1000;
const MAX_STEPS_PER_TICK = 12; // guard against loops within one run per tick
let running = false;

// ── helpers ────────────────────────────────────────────────────────────────
const nodesOf = (wf) => (wf.nodes || []);
const connsOf = (wf) => (wf.connections || []);

function nodeById(wf, id) {
  return nodesOf(wf).find(n => n.id === id) || null;
}

function nextNodeId(wf, fromId, port = 'default') {
  const conns = connsOf(wf);
  // exact port match first, then fall back to a default/only edge
  const exact = conns.find(c => c.from?.nodeId === fromId && (c.from?.port || 'default') === port);
  if (exact) return exact.to;
  const any = conns.find(c => c.from?.nodeId === fromId);
  return any ? any.to : null;
}

function triggerNodeId(wf) {
  const trig = nodesOf(wf).find(n => n.type === 'trigger');
  if (trig) return trig.id;
  // no explicit trigger — start from the first node with no incoming edge
  const targets = new Set(connsOf(wf).map(c => c.to));
  const root = nodesOf(wf).find(n => !targets.has(n.id));
  return root?.id || nodesOf(wf)[0]?.id || null;
}

function delayMsFor(node) {
  const days = Number(node.delay_days) || 0;
  const hours = Number(node.delay_hours) || 0;
  const mins = Number(node.delay_minutes) || 0;
  const ms = ((days * 24 + hours) * 60 + mins) * 60 * 1000;
  return ms > 0 ? ms : 60 * 1000; // never 0 — a wait with no value pauses 1 min
}

function personalize(text, lead) {
  if (!text) return '';
  const name = lead?.lead_name || '';
  const first = name.split(/\s+/)[0] || 'there';
  return String(text)
    .replace(/\{\{\s*lead_name\s*\}\}/gi, name)
    .replace(/\{\{\s*first_name\s*\}\}/gi, first)
    .replace(/\{\{\s*company\s*\}\}/gi, lead?.lead_company_name || '')
    .replace(/\{\{\s*email\s*\}\}/gi, lead?.email || '');
}

// ── condition evaluation ─────────────────────────────────────────────────────
// Returns 'yes' or 'no'. Unknown/untrackable signals resolve to 'no' so the
// nurture path continues rather than dead-ending.
async function evalCondition(node, run) {
  const cond = node.condition;
  if (!run.lead_id) return 'no';
  const since = run.started_at || run.created_at;

  const { data: msgs } = await supabaseAdmin
    .from('messages')
    .select('direction, metadata, created_at')
    .eq('company_id', run.company_id)
    .eq('lead_id', run.lead_id);

  const inbound = (msgs || []).filter(m => m.direction === 'inbound' && (!since || new Date(m.created_at) >= new Date(since)));
  const outbound = (msgs || []).filter(m => m.direction === 'outbound');

  switch (cond) {
    case 'replied':          return inbound.length > 0 ? 'yes' : 'no';
    case 'no_response':      return inbound.length === 0 ? 'yes' : 'no';
    case 'opened':           return outbound.some(m => m.metadata?.opened) ? 'yes' : 'no';
    case 'clicked':          return outbound.some(m => m.metadata?.clicked) ? 'yes' : 'no';
    case 'meeting_booked': {
      const { data: acts } = await supabaseAdmin
        .from('activities').select('type').eq('company_id', run.company_id).eq('lead_id', run.lead_id);
      return (acts || []).some(a => /meeting/i.test(a.type || '')) ? 'yes' : 'no';
    }
    default:                 return inbound.length > 0 ? 'yes' : 'no';
  }
}

// ── send a message node ──────────────────────────────────────────────────────
async function executeSend(node, run, lead, companyKeys) {
  const channel = node.channel || 'email';
  const subject = personalize(node.subject || node.name || 'Message', lead);
  const body = personalize(node.content || '', lead);
  const autoSend = node.auto_send !== false;

  // Idempotency key for retries after a provider accepted a send but the
  // worker crashed before advancing the run.
  const { data: existing } = await supabaseAdmin
    .from('messages')
    .select('id, status, metadata')
    .eq('company_id', run.company_id)
    .contains('metadata', { run_id: run.id, node_id: node.id })
    .limit(1)
    .maybeSingle();
  if (existing) return { status: existing.status || 'queued', error: existing.metadata?.error || null, duplicate: true };

  let status = 'queued';
  let error = null;

  try {
    if (!autoSend) {
      status = 'queued'; // left for human review/send in Inbox
    } else if (channel === 'email') {
      if (!lead?.email) throw new Error('lead has no email');
      await sendCompanyEmail(companyKeys, { to: lead.email, subject, html: body.replace(/\n/g, '<br>'), text: body });
      status = 'sent';
    } else if (channel === 'whatsapp') {
      const token = companyKeys.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneId = companyKeys.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (token && phoneId && lead?.phone) {
        const r = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: lead.phone.replace(/\D/g, ''), type: 'text', text: { body } }),
        });
        const d = await r.json();
        if (d.error) throw new Error(d.error.message || 'WhatsApp send failed');
        status = 'sent';
      } else {
        status = 'queued'; // not configured — queue for manual send
      }
    } else {
      // linkedin / other: no server-side send API — queue for manual action
      status = 'queued';
    }
  } catch (e) {
    status = 'failed';
    error = e.message;
  }

  // Record the message so it shows in Inbox and analytics
  await supabaseAdmin.from('messages').insert({
    company_id: run.company_id,
    lead_id: run.lead_id,
    direction: 'outbound',
    channel,
    subject: channel === 'email' ? subject : null,
    content: body,
    status,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
    to_address: lead?.email || lead?.phone || null,
    metadata: { workflow_id: run.workflow_id, run_id: run.id, node_id: node.id, auto_send: autoSend, error },
  });

  return { status, error };
}

// ── advance a single run ─────────────────────────────────────────────────────
async function advanceRun(run, wf, companyKeys) {
  // Ensure the workflow is still runnable
  if (wf.status === 'archived') {
    await updateRun(run.id, { status: 'canceled', error: 'workflow archived' });
    return;
  }
  if (wf.status === 'paused') {
    // hold the run until the workflow is re-activated
    await updateRun(run.id, { next_action_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
    return;
  }

  let currentId = run.current_node_id || nextNodeId(wf, triggerNodeId(wf)) || triggerNodeId(wf);
  let steps = run.steps_completed || 0;
  let lead = null;
  if (run.lead_id) {
    const { data } = await supabaseAdmin.from('leads').select('*').eq('id', run.lead_id).single();
    lead = data;
  }

  for (let i = 0; i < MAX_STEPS_PER_TICK; i++) {
    const node = currentId ? nodeById(wf, currentId) : null;
    if (!node) {
      await updateRun(run.id, { status: 'completed', current_node_id: null, completed_at: new Date().toISOString(), steps_completed: steps });
      return;
    }

    if (node.type === 'end_success' || node.type === 'end_failed') {
      await updateRun(run.id, {
        status: node.type === 'end_success' ? 'completed' : 'failed',
        current_node_id: node.id,
        completed_at: new Date().toISOString(),
        steps_completed: steps,
      });
      return;
    }

    if (node.type === 'wait') {
      // THE scheduled-step fix: park the run until the delay elapses, positioned
      // at the node AFTER the wait so it resumes there.
      const resumeAt = new Date(Date.now() + delayMsFor(node));
      const afterWait = nextNodeId(wf, node.id, 'default');
      await updateRun(run.id, {
        current_node_id: afterWait,
        next_action_at: resumeAt.toISOString(),
        steps_completed: steps + 1,
      });
      return;
    }

    if (node.type === 'trigger') {
      currentId = nextNodeId(wf, node.id, 'default');
      continue;
    }

    if (node.type === 'send_message') {
      await executeSend(node, run, lead, companyKeys);
      steps += 1;
      currentId = nextNodeId(wf, node.id, 'default');
      continue;
    }

    if (node.type === 'condition') {
      const port = await evalCondition(node, run);
      steps += 1;
      currentId = nextNodeId(wf, node.id, port);
      continue;
    }

    if (node.type === 'schedule_meeting') {
      await supabaseAdmin.from('activities').insert({
        company_id: run.company_id,
        lead_id: run.lead_id,
        type: 'meeting_scheduled',
        title: node.name || 'Schedule meeting',
        description: personalize(node.content || 'Meeting scheduling step reached.', lead),
        metadata: { workflow_id: run.workflow_id, run_id: run.id, node_id: node.id },
      });
      steps += 1;
      currentId = nextNodeId(wf, node.id, 'default');
      continue;
    }

    // Unknown node type — skip forward so a run never gets stuck
    currentId = nextNodeId(wf, node.id, 'default');
  }

  // Hit the per-tick step cap — resume next tick from where we are
  await updateRun(run.id, { current_node_id: currentId, next_action_at: new Date().toISOString(), steps_completed: steps });
}

async function updateRun(id, fields) {
  const { error } = await supabaseAdmin
    .from('workflow_runs')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── enrollment ───────────────────────────────────────────────────────────────
/**
 * Enroll a lead into a workflow: create an active run positioned at the node
 * after the trigger, due immediately. Skips if an active run already exists.
 */
export async function enrollLead({ workflowId, companyId, leadId, context = {} }) {
  const { data: wf } = await supabaseAdmin.from('workflows').select('*').eq('id', workflowId).eq('company_id', companyId).single();
  if (!wf) throw new Error('Workflow not found');
  if (wf.status !== 'active') throw new Error('Workflow must be active before enrolling leads');

  if (leadId) {
    const { data: existing } = await supabaseAdmin
      .from('workflow_runs')
      .select('id')
      .eq('workflow_id', workflowId)
      .eq('lead_id', leadId)
      .eq('status', 'active')
      .maybeSingle();
    if (existing) return existing;
  }

  const startId = nextNodeId(wf, triggerNodeId(wf)) || triggerNodeId(wf);
  const { data: run, error } = await supabaseAdmin
    .from('workflow_runs')
    .insert({
      workflow_id: workflowId,
      company_id: companyId,
      lead_id: leadId || null,
      status: 'active',
      current_node_id: startId,
      next_action_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      steps_completed: 0,
      context,
    })
    .select()
    .single();
  if (error) throw error;

  // bump the workflow's enrolled counter
  await supabaseAdmin
    .from('workflows')
    .update({ leads_enrolled: (wf.leads_enrolled || 0) + 1 })
    .eq('id', workflowId);

  return run;
}

// ── ticker ───────────────────────────────────────────────────────────────────
async function tick() {
  if (running) return;
  running = true;
  try {
    const nowIso = new Date().toISOString();
    const { data: due } = await supabaseAdmin
      .from('workflow_runs')
      .select('*')
      .eq('status', 'active')
      .lte('next_action_at', nowIso)
      .order('next_action_at', { ascending: true })
      .limit(25);
    if (!due?.length) return;

    // cache workflows + company keys within the tick
    const wfCache = new Map();
    const keyCache = new Map();

    for (const run of due) {
      try {
        // Claim atomically so two Railway workers cannot execute the same run.
        const claimed = await claimRun(run);
        if (!claimed) continue;

        let wf = wfCache.get(run.workflow_id);
        if (!wf) {
          const { data } = await supabaseAdmin.from('workflows').select('*').eq('id', run.workflow_id).single();
          wf = data; wfCache.set(run.workflow_id, wf);
        }
        if (!wf) { await updateRun(run.id, { status: 'failed', error: 'workflow deleted' }); continue; }

        let keys = keyCache.get(run.company_id);
        if (!keys) {
          const { data } = await supabaseAdmin.from('companies').select('api_keys').eq('id', run.company_id).single();
          keys = data?.api_keys || {}; keyCache.set(run.company_id, keys);
        }

        await advanceRun(run, wf, keys);
      } catch (err) {
        console.error(`[workflowEngine] run ${run.id} failed:`, err.message);
        await updateRun(run.id, { status: 'failed', error: err.message?.slice(0, 500) });
      }
    }
    console.log(`[workflowEngine] processed ${due.length} due run(s)`);
  } catch (err) {
    console.error('[workflowEngine] tick failed:', err.message);
  } finally {
    running = false;
  }
}

export function startWorkflowEngine() {
  setInterval(tick, TICK_MS).unref?.();
  setTimeout(tick, 15 * 1000).unref?.();
  console.log('[workflowEngine] started (60s tick)');
}

// exported for manual/test execution from routes
export { advanceRun, tick as runWorkflowTick };

async function claimRun(run) {
  const { data, error } = await supabaseAdmin
    .from('workflow_runs')
    .update({ next_action_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() })
    .eq('id', run.id)
    .eq('status', 'active')
    .eq('next_action_at', run.next_action_at)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
