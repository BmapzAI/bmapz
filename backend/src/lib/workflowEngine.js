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
import { createNotification } from './notify.js';
import { startSdrConversation, notifyHandover, handleInboundForSdr, FUNNEL_STAGES } from './sdrEngine.js';
import { logLeadActivity, LEAD_ACTIVITY_TYPES } from './leadActivity.js';

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v24.0';
const TICK_MS = 60 * 1000;
const MAX_STEPS_PER_TICK = 12; // guard against loops within one run per tick
const MAX_TOTAL_STEPS = 250; // fail malformed cyclic graphs instead of running forever
let running = false;

// ── helpers ────────────────────────────────────────────────────────────────
// The live builder (WorkflowBuilderModal) stores nodes/connections as JSON
// STRINGS inside JSONB[] — normalize both formats so the engine always works
// with objects regardless of how the workflow was saved.
const parseItem = (x) => {
  if (typeof x !== 'string') return x;
  try { return JSON.parse(x); } catch { return null; }
};
const nodesOf = (wf) => (wf.nodes || []).map(parseItem).filter(Boolean);
const connsOf = (wf) => (wf.connections || []).map(parseItem).filter(Boolean);

function nodeById(wf, id) {
  return nodesOf(wf).find(n => n.id === id) || null;
}

function nextNodeId(wf, fromId, port = 'default') {
  const conns = connsOf(wf);
  // Exact port first. A conditional branch must never silently take the
  // opposite branch when its requested edge is missing.
  const exact = conns.find(c => c.from?.nodeId === fromId && (c.from?.port || 'default') === port);
  if (exact) return exact.to;
  if (port !== 'default') {
    const fallback = conns.find(c => c.from?.nodeId === fromId && (c.from?.port || 'default') === 'default');
    return fallback?.to || null;
  }
  return null;
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

const leadName = (lead) => lead?.lead_name || lead?.lead_company_name || 'A lead';

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
  const outbound = (msgs || []).filter(m => m.direction === 'outbound' && (!since || new Date(m.created_at) >= new Date(since)));

  // Qualified/disqualified CHECK the lead's real CRM state — the same fields the
  // Lead-Qualification action, the Sales board, and the SDR all write. So the
  // 'qualified' condition branches on whatever qualified the lead (SDR, a workflow,
  // or a human on the Sales board). Condition = read/branch; qualify action = write.
  if (cond === 'qualified' || cond === 'disqualified') {
    // Company-scoped: unscoped, this turned a `condition` node into an oracle for
    // a foreign lead's funnel_stage/status, readable via the run's current_node_id.
    const { data: lead } = await supabaseAdmin
      .from('leads').select('funnel_stage, status')
      .eq('id', run.lead_id).eq('company_id', run.company_id)
      .maybeSingle();
    const stageIdx = FUNNEL_STAGES.indexOf(lead?.funnel_stage || 'awareness');
    const isQualified = (lead?.status === 'qualified') || stageIdx >= FUNNEL_STAGES.indexOf('mql');
    const isDisqualified = ['disqualified', 'lost'].includes(lead?.status);
    if (cond === 'qualified') return isQualified ? 'yes' : 'no';
    return isDisqualified ? 'yes' : 'no';
  }

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
        const r = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: lead.phone.replace(/\D/g, ''), type: 'text', text: { body } }),
        });
        const d = await r.json();
        if (d.error) throw new Error(d.error.message || 'WhatsApp send failed');
        status = 'sent';
      } else {
        throw new Error('WhatsApp is not configured or the lead has no phone number');
      }
    } else {
      throw new Error(`Automatic workflow sends are not supported for ${channel}`);
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
  if (steps >= MAX_TOTAL_STEPS) {
    await updateRun(run.id, { status: 'failed', error: `workflow exceeded ${MAX_TOTAL_STEPS} steps (possible loop)` });
    return;
  }
  let lead = null;
  if (run.lead_id) {
    // Company-scoped deliberately. enrollLead now refuses a foreign lead, but this
    // read is what actually loaded another tenant's contact and fed it into message
    // personalization, so it is scoped too: any run that predates that fix, or is
    // created by some future path that forgets to validate, finds nothing here
    // instead of leaking. The backend runs as service_role, so RLS is no backstop.
    const { data } = await supabaseAdmin
      .from('leads').select('*')
      .eq('id', run.lead_id).eq('company_id', run.company_id)
      .maybeSingle();
    lead = data;
  }

  for (let i = 0; i < MAX_STEPS_PER_TICK; i++) {
    if (steps >= MAX_TOTAL_STEPS) {
      await updateRun(run.id, { status: 'failed', current_node_id: currentId, steps_completed: steps, error: `workflow exceeded ${MAX_TOTAL_STEPS} steps (possible loop)` });
      return;
    }
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
      const sendResult = await executeSend(node, run, lead, companyKeys);
      if (sendResult.status === 'failed') {
        throw new Error(sendResult.error || `The ${node.channel || 'email'} message failed`);
      }
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

    // SDR node — hand this lead's conversation to the client-facing SDR bot
    // (sends the opener; subsequent inbound replies are handled automatically).
    if (node.type === 'sdr') {
      try {
        await startSdrConversation({
          companyId: run.company_id,
          leadId: run.lead_id,
          lead,
          channel: node.channel || 'email',
          openingText: node.content || null,
        });
      } catch (e) { console.error('[workflowEngine] sdr node failed:', e.message); }
      steps += 1;
      currentId = nextNodeId(wf, node.id, 'default');
      continue;
    }

    // Hand-over to sales — notify the team via the configured channels.
    if (node.type === 'handover') {
      const who = lead?.lead_name || lead?.lead_company_name || 'A lead';
      await notifyHandover({
        companyId: run.company_id,
        who, leadId: run.lead_id,
        note: personalize(node.content || 'A workflow handed this lead to the sales team.', lead),
        channels: node.handover_channels || { notification: true },
        recipients: node.handover_recipients || '',
      });
      if (run.lead_id && node.set_stage_on_handover !== false) {
        await supabaseAdmin.from('leads').update({ funnel_stage: 'sql', status: 'qualified' })
          .eq('id', run.lead_id).eq('company_id', run.company_id);
      }
      await logLeadActivity({
        companyId: run.company_id, leadId: run.lead_id,
        activityType: LEAD_ACTIVITY_TYPES.HANDOVER,
        summary: `Workflow "${wf.name}" handed the lead to the sales team`,
        details: { workflow_id: run.workflow_id, run_id: run.id, node_id: node.id },
        actorType: 'workflow', actorLabel: wf.name,
      });
      steps += 1;
      currentId = nextNodeId(wf, node.id, 'default');
      continue;
    }

    // Lead qualification — move stage next/previous or set a specific stage.
    if (node.type === 'qualify') {
      if (run.lead_id) {
        const action = node.qualify_action || 'set'; // next | previous | set
        let target = null;
        const cur = lead?.funnel_stage || 'prospect';
        const idx = FUNNEL_STAGES.indexOf(cur);
        if (action === 'next') target = FUNNEL_STAGES[Math.min(FUNNEL_STAGES.length - 1, (idx < 0 ? 0 : idx) + 1)];
        else if (action === 'previous') target = FUNNEL_STAGES[Math.max(0, (idx < 0 ? 0 : idx) - 1)];
        else if (FUNNEL_STAGES.includes(node.qualify_stage)) target = node.qualify_stage;
        if (target && target !== cur) {
          await supabaseAdmin.from('leads').update({ funnel_stage: target }).eq('id', run.lead_id).eq('company_id', run.company_id);
          await supabaseAdmin.from('activities').insert({
            company_id: run.company_id, lead_id: run.lead_id, type: 'stage_change',
            title: `Moved to ${target}`, description: `Workflow "${wf.name}" set funnel stage → ${target}`,
            metadata: { workflow_id: run.workflow_id, run_id: run.id, node_id: node.id, from: cur, to: target },
          });
          await logLeadActivity({
            companyId: run.company_id, leadId: run.lead_id,
            activityType: LEAD_ACTIVITY_TYPES.STAGE_CHANGED,
            summary: `Workflow "${wf.name}" moved the lead from "${cur}" to "${target}"`,
            details: { from: cur, to: target, workflow_id: run.workflow_id, run_id: run.id },
            actorType: 'workflow', actorLabel: wf.name,
          });
          await createNotification({
            companyId: run.company_id, type: 'qualification', icon: '📈', leadId: run.lead_id,
            title: `${leadName(lead)} → ${target}`, body: `Workflow "${wf.name}" advanced this lead.`, link: '/Sales',
          });
        }
      }
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

/** Run states that end the run — nothing further will happen on its own. */
const TERMINAL_RUN_STATES = new Set(['completed', 'failed', 'canceled', 'cancelled']);

/**
 * Put a finished run into the lead's own history, with WHY it ended.
 *
 * Until now a run's outcome lived only on the run row, so opening a lead gave no
 * sign that a workflow had reached them, succeeded, or failed — the timeline is
 * where someone actually looks when asking "what happened to this lead?".
 *
 * Never throws: a history entry must not be able to fail a workflow.
 */
async function recordRunOutcome(runId, fields) {
  try {
    const { data: run, error } = await supabaseAdmin
      .from('workflow_runs')
      .select('id, company_id, lead_id, workflow_id, status, error, steps_completed, current_node_id, started_at')
      .eq('id', runId)
      .maybeSingle();
    if (error || !run?.lead_id || !run.company_id) return;

    const { data: wf } = await supabaseAdmin
      .from('workflows').select('name').eq('id', run.workflow_id).maybeSingle();
    const name = wf?.name || 'Workflow';

    const status = fields.status;
    const reason = fields.error || run.error || null;
    const succeeded = status === 'completed';

    const summary = succeeded
      ? `${name} completed — ${run.steps_completed || 0} step(s) run`
      : `${name} ${status === 'failed' ? 'failed' : 'was cancelled'}${reason ? `: ${String(reason).slice(0, 200)}` : ''}`;

    await logLeadActivity({
      companyId: run.company_id,
      leadId: run.lead_id,
      activityType: LEAD_ACTIVITY_TYPES.WORKFLOW,
      summary,
      actorType: 'workflow',
      actorLabel: name,
      details: {
        workflow_id: run.workflow_id,
        run_id: run.id,
        status,
        outcome: succeeded ? 'success' : 'failure',
        reason,
        // Where it stopped, so a failure can be traced to a step rather than
        // just reported as "failed".
        stopped_at_node: run.current_node_id || null,
        steps_completed: run.steps_completed || 0,
      },
    });
  } catch (err) {
    console.error('[workflowEngine] could not record run outcome:', err.message);
  }
}

async function updateRun(id, fields) {
  const { error } = await supabaseAdmin
    .from('workflow_runs')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;

  // Every terminal transition goes through here, so this is the one place that
  // catches all of them — success, failure, loop guard, deleted workflow, cancel.
  if (fields.status && TERMINAL_RUN_STATES.has(fields.status)) {
    await recordRunOutcome(id, fields);
  }
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

  // THE LEAD MUST BELONG TO THE SAME COMPANY AS THE WORKFLOW.
  //
  // Only the WORKFLOW was scoped before, never the lead, so any caller could
  // enroll an arbitrary lead UUID from another tenant. The run was then stored
  // with the attacker's company_id, and the engine loaded the foreign lead and
  // personalized a message with it — copying another company's contact name,
  // company and email into a `messages` row the attacker can read in their own
  // inbox. With a sendable channel it also messaged that contact using this
  // company's own credentials.
  //
  // Checked here because this is the single choke point for all three entry
  // paths: POST /workflows/:id/enroll, POST /workflows/:id/run, and
  // POST /workflow-runs.
  if (leadId) {
    const { data: ownLead, error: leadErr } = await supabaseAdmin
      .from('leads').select('id').eq('id', leadId).eq('company_id', companyId).maybeSingle();
    if (leadErr) throw leadErr;               // never enrol on a failed check
    if (!ownLead) throw new Error('Lead not found in this company');
  }

  if (leadId) {
    // The "already enrolled" guard must not be able to fail open. maybeSingle()
    // ERRORS when a lead somehow has two active runs, and the discarded error
    // meant the guard silently passed and enrolled a THIRD — each new run then
    // making the next check fail too. .limit(1) plus an explicit error check
    // keeps the guard closed.
    const { data: existing, error: guardErr } = await supabaseAdmin
      .from('workflow_runs')
      .select('id')
      .eq('workflow_id', workflowId)
      .eq('lead_id', leadId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (guardErr) throw guardErr;
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

// ── event-driven triggers ────────────────────────────────────────────────────
/**
 * Enroll a lead into every ACTIVE workflow whose trigger_type matches `event`.
 * This is how "new inbound lead", "message received" and "new conversation"
 * auto-start workflows. Returns the number of enrollments.
 */
export async function enrollByTrigger({ companyId, event, leadId, context = {} }) {
  if (!companyId || !event) return 0;
  const { data: workflows } = await supabaseAdmin
    .from('workflows')
    .select('id, trigger_type, trigger_config')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .eq('is_template', false)
    .eq('trigger_type', event);
  if (!workflows?.length) return 0;
  let n = 0;
  for (const wf of workflows) {
    try { await enrollLead({ workflowId: wf.id, companyId, leadId, context: { ...context, trigger: event } }); n++; }
    catch (e) { console.error('[workflowEngine] trigger enroll failed:', e.message); }
  }
  return n;
}

/**
 * Central handler for an inbound message from a prospect/customer. Called from
 * the WhatsApp webhook and the messaging sync. It:
 *   1. resolves or creates the lead,
 *   2. fires the matching workflow triggers (new_lead / inbound_message /
 *      new_conversation),
 *   3. lets the SDR bot answer if it's enabled for the channel,
 *   4. raises a notification for a brand-new inbound lead.
 * `isNewLead` / `isNewConversation` are computed by the caller where cheap, but
 * this function will resolve the lead if only a handle is supplied.
 */
export async function handleInboundEvent({ companyId, channel, contactHandle, contactName, text, leadId, isNewConversation, alreadyLogged = false }) {
  if (!companyId) return;
  try {
    let lead = null;
    if (leadId) {
      const { data } = await supabaseAdmin.from('leads').select('*').eq('id', leadId).eq('company_id', companyId).maybeSingle();
      lead = data;
    }
    // Resolve by contact handle (email/phone) if we don't have the lead yet
    if (!lead && contactHandle) {
      const isEmail = /@/.test(contactHandle);
      const col = isEmail ? 'email' : 'phone';
      // .limit(1) is required: maybeSingle() ERRORS on multiple matches, and two
      // leads sharing a phone/email is ordinary (CSV import duplicates, a
      // contact who also messages in). Without it the lookup failed and the
      // block below created a NEW lead for every inbound message from that
      // person — unbounded duplicate leads from one duplicate contact.
      const { data, error } = await supabaseAdmin.from('leads').select('*')
        .eq('company_id', companyId).eq(col, contactHandle)
        .order('created_at', { ascending: true }).limit(1).maybeSingle();
      // A failed read must not be read as "no such lead" — that creates data.
      if (error) throw error;
      lead = data;
    }
    let brandNewLead = false;
    if (!lead && contactHandle) {
      const isEmail = /@/.test(contactHandle);
      const { data: created } = await supabaseAdmin.from('leads').insert({
        company_id: companyId,
        lead_name: contactName || (isEmail ? contactHandle.split('@')[0] : 'Inbound lead'),
        email: isEmail ? contactHandle : null,
        phone: isEmail ? null : contactHandle,
        source: `inbound_${channel}`,
        funnel_stage: 'awareness',
        status: 'new',
      }).select().single();
      lead = created;
      brandNewLead = true;
    }

    const ctx = { channel, contact_handle: contactHandle, contact_name: contactName };

    // Fire triggers
    if (brandNewLead) await enrollByTrigger({ companyId, event: 'new_lead', leadId: lead?.id, context: ctx });
    if (isNewConversation) await enrollByTrigger({ companyId, event: 'new_conversation', leadId: lead?.id, context: ctx });
    await enrollByTrigger({ companyId, event: 'inbound_message', leadId: lead?.id, context: ctx });

    // Notify on a brand-new inbound lead
    if (brandNewLead) {
      await createNotification({
        companyId, type: 'lead', icon: '🆕', priority: 'normal', leadId: lead?.id,
        title: `New inbound lead: ${lead?.lead_name || contactHandle}`,
        body: text ? `“${String(text).slice(0, 120)}”` : `via ${channel}`,
        link: '/Sales',
      });
    }

    // Let the SDR answer (if enabled for this channel)
    if (text) {
      await handleInboundForSdr({ companyId, channel, contactHandle, contactName, leadId: lead?.id, text, alreadyLogged }).catch(e =>
        console.error('[workflowEngine] SDR inbound failed:', e.message));
    }
  } catch (err) {
    console.error('[workflowEngine] handleInboundEvent failed:', err.message);
  }
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
