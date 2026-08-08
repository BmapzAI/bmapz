/**
 * SDR engine — the client-facing Sales Development Representative bot.
 *
 * Distinct from the internal AI Chat agent: the SDR talks to PROSPECTS. It is
 * driven by a per-company `sdr_agents` config (persona, products, qualifying
 * questions, conversation flow, guardrails) and answers using company facts —
 * but NEVER the raw internal Company Brain (which leaks funnel numbers), so a
 * prospect can't see internal metrics.
 *
 * Each turn returns a structured decision: the reply to send, an outcome
 * (offer_product | handover | qualified | not_qualified | support | none),
 * extracted qualification answers, an internal-only note, and a funnel-stage
 * recommendation. Outcomes drive notifications + CRM stage changes.
 */
import { supabaseAdmin } from './supabase.js';
import { runAIChat } from '../routes/ai.js';
import { sendCompanyEmail } from './emailSender.js';
import { createNotification } from './notify.js';
import { logLeadActivity, LEAD_ACTIVITY_TYPES } from './leadActivity.js';

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v24.0';
export const FUNNEL_STAGES = ['prospect', 'awareness', 'consideration', 'mql', 'sql', 'opportunity', 'customer', 'retention', 'advocacy'];
export const ALL_OUTCOMES = ['offer_product', 'handover', 'qualified', 'not_qualified', 'support'];

// Metadata for the built-in outcomes (label + when-to-use description), shared by
// the SDR prompt and surfaced to users in the SDR Settings "Acceptable outcomes" UI.
export const PREDEFINED_OUTCOMES = [
  { key: 'qualified',     label: 'Mark lead as qualified', description: 'The prospect clearly fits and is interested — mark them qualified and advance the funnel stage.' },
  { key: 'handover',      label: 'Hand over to sales',     description: 'The lead is hot/ready — move them to SQL and notify the human sales team.' },
  { key: 'offer_product', label: 'Offer a product/service', description: 'Recommend a specific product or service that fits the prospect.' },
  { key: 'not_qualified', label: 'Mark as not qualified',   description: 'The prospect is clearly out of scope / not a fit.' },
  { key: 'support',       label: 'Route to support',        description: 'This is a support or help request, not a sales conversation.' },
];

// Slug an arbitrary label into a stable machine key the SDR can emit.
const outcomeSlug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
const RESERVED_OUTCOME_KEYS = new Set([...ALL_OUTCOMES, 'none']);

async function defaultSdrName(companyId) {
  const { data } = await supabaseAdmin.from('companies').select('personal_agent_name').eq('id', companyId).single();
  return data?.personal_agent_name || 'Sales Assistant';
}

/**
 * Load a user's SDR config (per-user so each user names/tunes their own),
 * creating a disabled default seeded from the company agent name if missing.
 * Pass userId = null for the company-default row (used by inbound automation).
 */
export async function getSdrAgent(companyId, userId = null) {
  let q = supabaseAdmin.from('sdr_agents').select('*').eq('company_id', companyId);
  q = userId ? q.eq('user_id', userId) : q.is('user_id', null);
  // .limit(1) matters: maybeSingle() ERRORS when more than one row matches, and
  // this is a get-or-create — so the first duplicate row would make every later
  // call fail the read and insert yet another, compounding on every inbound
  // message. Ordering makes the pick deterministic.
  const { data, error } = await q.order('created_at', { ascending: true }).limit(1).maybeSingle();
  // Never create on a failed read: that is how one transient error becomes an
  // unbounded row count on a path that runs per inbound message.
  if (error) throw error;
  if (data) return data;

  const name = await defaultSdrName(companyId);
  const { data: created, error: insErr } = await supabaseAdmin.from('sdr_agents')
    .insert({ company_id: companyId, user_id: userId, enabled: false, name })
    .select().single();
  if (insErr) {
    // Lost a race with a concurrent create — re-read rather than failing.
    let retry = supabaseAdmin.from('sdr_agents').select('*').eq('company_id', companyId);
    retry = userId ? retry.eq('user_id', userId) : retry.is('user_id', null);
    const { data: existing } = await retry.order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (existing) return existing;
    throw insErr;
  }
  return created;
}

/** The SDR config used for inbound automation: any enabled agent, else the company default. */
export async function getCompanySdrAgent(companyId) {
  const { data } = await supabaseAdmin.from('sdr_agents').select('*')
    .eq('company_id', companyId).eq('enabled', true)
    .order('user_id', { ascending: true, nullsFirst: true }).limit(1).maybeSingle();
  if (data) return data;
  return getSdrAgent(companyId, null);
}

// Which built-in outcomes are enabled. An UNSET value (never configured) defaults
// to all; an explicit [] means the user turned them all off (only custom/none remain).
const allowedOutcomesOf = (agent) => {
  const a = agent?.allowed_outcomes;
  if (!Array.isArray(a)) return [...ALL_OUTCOMES];
  return a.filter(o => ALL_OUTCOMES.includes(o));
};

// Normalize the user-defined custom outcomes into { key, label, description, effects }.
// Keys are slugged, de-duplicated, and never collide with the built-in keys, so the
// key the SDR emits is stable and unambiguous.
export function customOutcomesOf(agent) {
  const arr = Array.isArray(agent?.custom_outcomes) ? agent.custom_outcomes : [];
  const seen = new Set();
  const out = [];
  for (const o of arr) {
    if (!o || (!o.label && !o.key)) continue;
    let base = outcomeSlug(o.key || o.label) || 'outcome';
    if (RESERVED_OUTCOME_KEYS.has(base)) base = `custom_${base}`;
    let key = base, n = 2;
    while (seen.has(key)) key = `${base}_${n++}`;
    seen.add(key);
    const e = o.effects || {};
    out.push({
      key,
      label: o.label || o.key,
      description: o.description || '',
      effects: {
        mark_qualified: !!e.mark_qualified,
        set_stage: (FUNNEL_STAGES.includes(e.set_stage) || e.set_stage === 'next') ? e.set_stage : null,
        handover: !!e.handover,
        redirect_url: (typeof e.redirect_url === 'string' && e.redirect_url.trim()) ? e.redirect_url.trim() : null,
      },
    });
  }
  return out;
}

// Every outcome key the SDR is allowed to emit this turn (built-in enabled + custom).
export function allOutcomeKeys(agent) {
  return [...allowedOutcomesOf(agent), ...customOutcomesOf(agent).map(o => o.key)];
}

const nextFunnelStage = (current) => {
  const i = FUNNEL_STAGES.indexOf(current);
  return i >= 0 && i < FUNNEL_STAGES.length - 1 ? FUNNEL_STAGES[i + 1] : (current || 'mql');
};

async function getCompanyFacts(companyId) {
  const { data: c } = await supabaseAdmin
    .from('companies')
    .select('name, industry, services_description, value_propositions, icp, briefing, website, personal_agent_name')
    .eq('id', companyId).single();
  return c || {};
}

const trunc = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');

/** Build the client-safe system prompt from config + company facts. */
export function buildSdrSystemPrompt(agent, facts) {
  const allowed = allowedOutcomesOf(agent);
  const customOutcomes = customOutcomesOf(agent);
  const allKeys = [...allowed, ...customOutcomes.map(o => o.key)];
  const outcomeDescLines = [
    ...allowed.map(k => {
      const m = PREDEFINED_OUTCOMES.find(o => o.key === k);
      return `- "${k}": ${m?.description || k}`;
    }),
    ...customOutcomes.map(o => {
      const eff = [];
      if (o.effects.mark_qualified) eff.push('marks the lead as qualified');
      if (o.effects.set_stage) eff.push(o.effects.set_stage === 'next' ? 'advances them one funnel stage' : `moves them to the "${o.effects.set_stage}" stage`);
      if (o.effects.handover) eff.push('hands the lead to the human sales team');
      if (o.effects.redirect_url) eff.push(`you MUST share this link in your reply: ${o.effects.redirect_url}`);
      const effStr = eff.length ? ` — when you choose this, the system ${eff.join(', ')}` : '';
      return `- "${o.key}": ${o.description || o.label}${effStr}`;
    }),
  ];
  const icp = facts.icp || {};
  const briefing = facts.briefing || {};
  const name = agent.name || facts.personal_agent_name || 'Sales Assistant';
  const products = Array.isArray(agent.products) ? agent.products : [];
  const questions = Array.isArray(agent.qualifying_questions) ? agent.qualifying_questions : [];
  const flow = Array.isArray(agent.conversation_flow) && agent.conversation_flow.length
    ? agent.conversation_flow
    : ['greeting', 'ask reason for contact', 'ask qualifying questions', 'recommend product or hand over to sales'];

  const productLines = products.length
    ? products.map(p => `- ${p.name}${agent.show_prices && p.price ? ` (${p.price})` : ''}: ${trunc(p.description || '', 160)}${p.how_to_pitch ? ` | Pitch: ${trunc(p.how_to_pitch, 120)}` : ''}${p.conditions ? ` | Offer when: ${trunc(p.conditions, 120)}` : ''}`).join('\n')
    : '- (No specific products configured — describe the company\'s services generally.)';

  return [
    `You are ${name}, a friendly, professional Sales Development Representative (SDR) for ${facts.name || 'the company'}${facts.industry ? ` (industry: ${facts.industry})` : ''}. You are chatting with a PROSPECT/CUSTOMER, not an internal user.`,
    facts.services_description ? `What the company offers: ${trunc(facts.services_description, 400)}` : null,
    facts.value_propositions?.length ? `Key value propositions: ${trunc(facts.value_propositions.join('; '), 300)}` : null,
    icp.primary_audience ? `Typical customer: ${trunc(icp.primary_audience, 200)}` : null,
    icp.pain_points?.length ? `Pains you solve: ${trunc(icp.pain_points.join('; '), 250)}` : null,
    briefing.tone_of_voice?.length ? `Tone of voice: ${briefing.tone_of_voice.join(', ')}.` : 'Tone: warm, concise, helpful.',
    agent.persona ? `Persona: ${trunc(agent.persona, 300)}` : null,
    agent.goal ? `Your goal: ${trunc(agent.goal, 200)}` : 'Your goal: understand the prospect\'s need, qualify them, and either recommend the right product or hand them to the human sales team.',
    `\nProducts/services you may discuss:\n${productLines}`,
    agent.show_prices ? 'You MAY share prices when asked.' : 'Do NOT quote specific prices — if asked, say the sales team will share a tailored quote.',
    questions.length ? `\nQualifying questions to work in naturally (don't interrogate — one at a time):\n${questions.map((q, i) => `${i + 1}. ${typeof q === 'string' ? q : q.question}`).join('\n')}` : '',
    `\nConversation flow to follow: ${flow.map(f => (typeof f === 'string' ? f : f.step)).join(' → ')}.`,
    agent.guardrails ? `\nGuardrails: ${trunc(agent.guardrails, 400)}` : '',
    `\nHARD RULES: Never reveal internal metrics, pipeline numbers, or other customers. Never invent products, prices, or promises. Stay strictly on topics about ${facts.name || 'the company'} and its offering.`,
    `\nALLOWED OUTCOMES — the "outcome" field may ONLY ever be one of the keys listed below, or "none". These are the ONLY outcomes that have been defined for you; you cannot invent, rename, or combine outcomes. If a situation calls for an outcome that is not listed, choose "none" and keep helping or ask a clarifying question. This is a strict business rule.\n${outcomeDescLines.join('\n') || '- (no outcomes are configured — always use "none")'}`,
    `\nYou MUST reply with a JSON object ONLY, no prose around it, shaped exactly:`,
    `{"reply": "<the message to send to the prospect>", "outcome": "${['none', ...allKeys].join('|')}", "recommended_product": "<product name or null>", "qualification": {"<question or attribute>": "<their answer/observation>"}, "internal_note": "<one sentence: which flow step you're on and why this outcome>", "stage": "prospect|awareness|consideration|mql|sql|opportunity|null"}`,
    `The "outcome" value MUST be exactly one of: ${['none', ...allKeys].join(', ')} — nothing else. Keep "reply" natural and channel-appropriate (short for chat/WhatsApp).`,
  ].filter(Boolean).join('\n');
}

/** Generate one SDR turn. conversationMessages = [{role:'client'|'sdr', content}]. */
export async function sdrRespond({ companyId, agent, facts, conversationMessages }) {
  const system = buildSdrSystemPrompt(agent, facts);
  const messages = conversationMessages.map(m => ({
    role: m.role === 'sdr' ? 'assistant' : 'user',
    content: m.content,
  }));
  const result = await runAIChat({
    companyId,
    userRole: 'user',           // platform key + company credits (SDR is a billable feature)
    userEmail: 'sdr@bmapz',
    messages,
    system,
    action: 'sdr_chat',
    response_format: { type: 'json_object' },
    temperature: 0.6,
    skipBrain: true,            // SDR uses its own client-safe facts, NOT the internal brain
  });
  let parsed;
  try { parsed = JSON.parse(result.content); }
  catch { parsed = { reply: result.content, outcome: 'none', qualification: {}, internal_note: 'unstructured reply', stage: null }; }
  // Hard guardrail: clamp the outcome to the allowed set (built-in enabled + custom),
  // no matter what the model returned.
  const allowedKeys = allOutcomeKeys(agent);
  if (parsed.outcome && parsed.outcome !== 'none' && !allowedKeys.includes(parsed.outcome)) {
    parsed.internal_note = `${parsed.internal_note || ''} [outcome "${parsed.outcome}" not allowed → forced to none]`.trim();
    parsed.outcome = 'none';
  }
  return { ...parsed, _usage: result.usage, _model: result.model_used };
}

/**
 * Full inbound loop for one client message. Finds/creates the SDR conversation,
 * generates the reply, sends it on the channel, persists, and fires outcome
 * side-effects (notifications + CRM stage moves).
 * Returns { conversation, reply, outcome } or null if the SDR is disabled.
 */
export async function handleInboundForSdr({ companyId, channel = 'web', contactHandle, contactName, leadId, text, alreadyLogged = false }) {
  const agent = await getCompanySdrAgent(companyId);
  if (!agent?.enabled) return null;
  const channels = Array.isArray(agent.channels) ? agent.channels : [];
  if (channels.length && !channels.includes(channel)) return null;

  const facts = await getCompanyFacts(companyId);

  // Find or create the conversation (by lead or contact handle)
  let convo = null;
  if (leadId) {
    const { data } = await supabaseAdmin.from('sdr_conversations').select('*')
      .eq('company_id', companyId).eq('lead_id', leadId).in('status', ['active', 'qualified', 'handed_over', 'support'])
      .order('last_message_at', { ascending: false }).limit(1).maybeSingle();
    convo = data;
  }
  if (!convo && contactHandle) {
    const { data } = await supabaseAdmin.from('sdr_conversations').select('*')
      .eq('company_id', companyId).eq('contact_handle', contactHandle).in('status', ['active', 'qualified', 'handed_over', 'support'])
      .order('last_message_at', { ascending: false }).limit(1).maybeSingle();
    convo = data;
  }
  if (!convo) {
    const { data } = await supabaseAdmin.from('sdr_conversations').insert({
      company_id: companyId, lead_id: leadId || null, channel,
      contact_name: contactName || null, contact_handle: contactHandle || null,
      status: 'active', messages: [], qualification: {}, notes: [],
    }).select().single();
    convo = data;
  }

  const messages = [...(convo.messages || []), { role: 'client', content: text, at: new Date().toISOString() }];

  // Always log the client's inbound message to the unified Inbox thread.
  if (!alreadyLogged) {
    await logToInbox({ companyId, leadId: convo.lead_id || leadId, channel, direction: 'inbound', content: text, from: contactHandle, convoId: convo.id });
  }

  // If a human has taken over (replied from the Inbox), the SDR stands down —
  // it records the message but does NOT auto-reply.
  if (convo.human_takeover) {
    await supabaseAdmin.from('sdr_conversations').update({
      messages, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', convo.id);
    return { conversation: convo, reply: null, outcome: 'none', handedToHuman: true };
  }

  const decision = await sdrRespond({ companyId, agent, facts, conversationMessages: messages });
  const reply = decision.reply || "Thanks for reaching out! Someone from our team will follow up shortly.";

  messages.push({ role: 'sdr', content: reply, at: new Date().toISOString() });

  // Persist conversation
  const qualification = { ...(convo.qualification || {}), ...(decision.qualification || {}) };
  const notes = [...(convo.notes || [])];
  if (decision.internal_note) notes.push({ at: new Date().toISOString(), note: decision.internal_note, outcome: decision.outcome, product: decision.recommended_product || null });

  let status = convo.status;
  if (decision.outcome === 'qualified') status = 'qualified';
  else if (decision.outcome === 'not_qualified') status = 'not_qualified';
  else if (decision.outcome === 'handover') status = 'handed_over';
  else if (decision.outcome === 'support') status = 'support';
  else if (decision.outcome && decision.outcome !== 'none') {
    const custom = customOutcomesOf(agent).find(o => o.key === decision.outcome);
    if (custom?.effects?.handover) status = 'handed_over';
    else if (custom?.effects?.mark_qualified) status = 'qualified';
  }

  await supabaseAdmin.from('sdr_conversations').update({
    messages, qualification, notes, status,
    outcome: decision.outcome || convo.outcome || 'none',
    last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', convo.id);

  // Send the reply on the channel it came from (also logs to Inbox)
  await sendSdrReply({ companyId, channel, contactHandle, leadId: convo.lead_id || leadId, reply, convoId: convo.id });

  // Outcome side-effects
  await applySdrOutcome({ companyId, agent, convo, leadId: convo.lead_id || leadId, decision, contactName: contactName || convo.contact_name });

  return { conversation: convo, reply, outcome: decision.outcome || 'none' };
}

/**
 * Proactively start an SDR conversation with a lead (used by the workflow 'sdr'
 * node). Sends the configured greeting (or a short AI opener) on the channel,
 * and opens an sdr_conversation so the lead's replies are handled by the SDR.
 */
export async function startSdrConversation({ companyId, leadId, lead, channel = 'email', openingText }) {
  const agent = await getCompanySdrAgent(companyId);
  if (!agent?.enabled) throw new Error('The SDR agent is disabled');
  const facts = await getCompanyFacts(companyId);

  const contactHandle = channel === 'whatsapp' ? (lead?.phone || null) : (lead?.email || null);
  const contactName = lead?.lead_name || lead?.lead_company_name || null;

  // Don't double-open an active conversation for this lead
  if (leadId) {
    const { data: existing } = await supabaseAdmin.from('sdr_conversations').select('id')
      .eq('company_id', companyId).eq('lead_id', leadId).in('status', ['active', 'qualified']).maybeSingle();
    if (existing) return existing;
  }

  let opener = openingText || agent.greeting;
  if (!opener) {
    // Generate a brief, on-brand opener
    try {
      const decision = await sdrRespond({ companyId, agent, facts, conversationMessages: [{ role: 'client', content: '(The system is starting a new outreach — greet the prospect and ask how you can help.)' }] });
      opener = decision.reply;
    } catch { opener = `Hi${contactName ? ' ' + contactName.split(' ')[0] : ''}! Thanks for your interest in ${facts.name || 'us'}. How can I help you today?`; }
  }

  const { data: convo } = await supabaseAdmin.from('sdr_conversations').insert({
    company_id: companyId, lead_id: leadId || null, channel,
    contact_name: contactName, contact_handle: contactHandle,
    status: 'active', messages: [{ role: 'sdr', content: opener, at: new Date().toISOString() }],
    qualification: {}, notes: [{ at: new Date().toISOString(), note: 'SDR conversation started by workflow' }],
  }).select().single();

  try {
    await sendSdrReply({ companyId, channel, contactHandle, leadId, reply: opener, convoId: convo.id });
  } catch (error) {
    await supabaseAdmin.from('sdr_conversations').update({
      status: 'closed',
      notes: [...(convo.notes || []), { at: new Date().toISOString(), note: `Opening message failed: ${error.message}` }],
      updated_at: new Date().toISOString(),
    }).eq('id', convo.id);
    throw error;
  }
  return convo;
}

// Log an SDR message into the unified `messages` table so the Inbox shows the
// full client thread (both directions), lets sales pick it up, and keeps history.
async function logToInbox({ companyId, leadId, channel, direction, content, from, to, convoId, human, status, error }) {
  // Mirror the message onto the lead's history so the timeline shows the whole
  // conversation, not just CRM state changes.
  if (leadId) {
    logLeadActivity({
      companyId, leadId,
      activityType: direction === 'inbound' ? LEAD_ACTIVITY_TYPES.MESSAGE_RECEIVED : LEAD_ACTIVITY_TYPES.MESSAGE_SENT,
      summary: `${direction === 'inbound' ? 'Received' : 'Sent'} a ${channel} message${status === 'failed' ? ' (delivery failed)' : ''}: ${String(content || '').slice(0, 120)}`,
      details: { channel, status: status || null, error: error || null, sdr_conversation_id: convoId || null },
      actorType: human ? 'user' : 'sdr',
      actorLabel: human ? null : 'SDR',
    }).catch(() => {});
  }
  try {
    await supabaseAdmin.from('messages').insert({
      company_id: companyId, lead_id: leadId || null,
      direction, channel: channel === 'web' ? 'internal' : channel,
      content, status: status || (direction === 'inbound' ? 'received' : 'sent'),
      sent_at: status === 'failed' ? null : new Date().toISOString(),
      from_address: from || null, to_address: to || null,
      metadata: { sdr: !human, human: !!human, sdr_conversation_id: convoId || null, error: error || null },
    });
  } catch (err) { console.error('[sdr] logToInbox failed:', err.message); }
}

async function sendSdrReply({ companyId, channel, contactHandle, leadId, reply, convoId }) {
  let error = null;
  try {
    if (channel === 'email' && contactHandle) {
      const { data: c } = await supabaseAdmin.from('companies').select('api_keys').eq('id', companyId).single();
      await sendCompanyEmail(c?.api_keys || {}, { to: contactHandle, subject: 'Re: your enquiry', html: reply.replace(/\n/g, '<br>'), text: reply });
    } else if (channel === 'whatsapp') {
      const { data: c } = await supabaseAdmin.from('companies').select('api_keys').eq('id', companyId).single();
      const keys = c?.api_keys || {};
      const token = keys.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneId = keys.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (!token || !phoneId || !contactHandle) throw new Error('WhatsApp is not configured or the contact has no phone number');
      const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneId}/messages`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: contactHandle.replace(/\D/g, ''), type: 'text', text: { body: reply } }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) throw new Error(result.error?.message || `WhatsApp send failed (${response.status})`);
    } else if (channel === 'instagram') {
      const { data: c } = await supabaseAdmin.from('companies').select('api_keys').eq('id', companyId).single();
      const keys = c?.api_keys || {};
      const token = keys.facebook_page_access_token || keys.meta_access_token;
      const accountId = keys.instagram_business_account_id || keys.instagram_account_id;
      if (!token || !accountId || !contactHandle) throw new Error('Instagram messaging is not configured or the sender ID is missing');
      const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${accountId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: contactHandle }, message: { text: reply } }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) throw new Error(result.error?.message || `Instagram send failed (${response.status})`);
    } else if (channel !== 'web') {
      throw new Error(`Automatic SDR replies are not supported for ${channel}`);
    }
    // web channel: reply is returned to the caller (widget) — no external send
  } catch (err) {
    error = err;
    console.error('[sdr] sendReply failed:', err.message);
  }
  await logToInbox({
    companyId, leadId, channel, direction: 'outbound', content: reply,
    to: contactHandle, convoId, status: error ? 'failed' : 'sent', error: error?.message,
  });
  if (error) throw error;
}

async function applySdrOutcome({ companyId, agent, convo, leadId, decision, contactName }) {
  const outcome = decision.outcome;
  const who = contactName || 'A prospect';
  // Everything the SDR does to a lead is recorded on the lead's timeline, so the
  // sales team can see the automated handling alongside their own.
  const sdrLabel = `SDR${agent?.name ? `: ${agent.name}` : ''}`;
  const trace = (activityType, summary, details = {}) => leadId && logLeadActivity({
    companyId, leadId, activityType, summary, details,
    actorType: 'sdr', actorLabel: sdrLabel,
  });

  // Move the lead's funnel stage if the SDR recommended one
  if (leadId && decision.stage && FUNNEL_STAGES.includes(decision.stage)) {
    await supabaseAdmin.from('leads').update({ funnel_stage: decision.stage }).eq('id', leadId).eq('company_id', companyId);
    await trace(LEAD_ACTIVITY_TYPES.STAGE_CHANGED, `SDR moved the lead to "${decision.stage}"`, { to: decision.stage });
  }

  if (outcome === 'handover') {
    if (leadId) await supabaseAdmin.from('leads').update({ funnel_stage: 'sql', status: 'qualified' }).eq('id', leadId).eq('company_id', companyId);
    await trace(LEAD_ACTIVITY_TYPES.HANDOVER, 'SDR handed the lead over to the sales team', { note: decision.internal_note || null });
    await notifyHandover({ companyId, agent, who, leadId, note: decision.internal_note });
  } else if (outcome === 'qualified') {
    await trace(LEAD_ACTIVITY_TYPES.QUALIFIED, 'SDR marked the lead as qualified', { note: decision.internal_note || null });
    if (leadId) await supabaseAdmin.from('leads').update({ funnel_stage: decision.stage && FUNNEL_STAGES.includes(decision.stage) ? decision.stage : 'mql' }).eq('id', leadId).eq('company_id', companyId);
    await createNotification({ companyId, type: 'qualification', icon: '✅', priority: 'normal', leadId,
      title: `SDR qualified ${who}`, body: decision.internal_note || 'Marked as qualified by the SDR.', link: '/SDR' });
  } else if (outcome === 'not_qualified') {
    await createNotification({ companyId, type: 'qualification', icon: '⛔', priority: 'low', leadId,
      title: `SDR marked ${who} not qualified`, body: decision.internal_note || '', link: '/SDR' });
  } else if (outcome === 'support') {
    await createNotification({ companyId, type: 'sdr', icon: '🛟', priority: 'high', leadId,
      title: `Support request from ${who}`, body: decision.internal_note || 'The SDR routed a support request.', link: '/SDR' });
  } else if (outcome === 'offer_product' && decision.recommended_product) {
    await createNotification({ companyId, type: 'sdr', icon: '🎯', priority: 'low', leadId,
      title: `SDR offered "${decision.recommended_product}" to ${who}`, body: decision.internal_note || '', link: '/SDR' });
  } else if (outcome && outcome !== 'none') {
    // Custom, user-defined outcome — run its configured effects (mark qualified,
    // move funnel stage, hand over, share a link) and notify the team.
    const custom = customOutcomesOf(agent).find(o => o.key === outcome);
    if (custom) {
      const eff = custom.effects || {};
      if (leadId && (eff.mark_qualified || eff.set_stage)) {
        const patch = {};
        if (eff.mark_qualified) patch.status = 'qualified';
        if (eff.set_stage === 'next') {
          const { data: lead } = await supabaseAdmin.from('leads').select('funnel_stage').eq('id', leadId).eq('company_id', companyId).maybeSingle();
          patch.funnel_stage = nextFunnelStage(lead?.funnel_stage);
        } else if (eff.set_stage) {
          patch.funnel_stage = eff.set_stage;
        }
        if (Object.keys(patch).length) await supabaseAdmin.from('leads').update(patch).eq('id', leadId).eq('company_id', companyId);
      }
      if (eff.handover) await notifyHandover({ companyId, agent, who, leadId, note: decision.internal_note });
      await createNotification({ companyId, type: 'sdr', icon: '🎯', priority: 'normal', leadId,
        title: `SDR: ${custom.label} — ${who}`,
        body: `${decision.internal_note || custom.description || ''}${eff.redirect_url ? `\nShared link: ${eff.redirect_url}` : ''}`.trim(),
        link: '/SDR' });
    }
  }
}

/** Notify the sales team of a hand-over via the configured channels. */
export async function notifyHandover({ companyId, agent, who, leadId, note, channels, recipients }) {
  const ch = channels || agent?.handoff_channels || { notification: true };
  const to = recipients || agent?.handoff_recipients || '';
  const title = `🤝 Hand-over: ${who} is ready for sales`;
  const body = note || 'The SDR qualified this lead and handed it to the sales team.';

  if (ch.notification !== false) {
    await createNotification({ companyId, type: 'handover', icon: '🤝', priority: 'high', leadId, title, body, link: leadId ? '/Sales' : '/SDR' });
  }
  try {
    const { data: c } = await supabaseAdmin.from('companies').select('api_keys').eq('id', companyId).single();
    const keys = c?.api_keys || {};
    const emails = to.split(',').map(s => s.trim()).filter(e => /@/.test(e));
    if (ch.email && emails.length) {
      for (const em of emails) await sendCompanyEmail(keys, { to: em, subject: title, html: `${body}<br><br>Open Bmapz to follow up.`, text: body }).catch(() => {});
    }
    if (ch.whatsapp && to) {
      const token = keys.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneId = keys.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
      const phones = to.split(',').map(s => s.replace(/\D/g, '')).filter(p => p.length >= 8);
      if (token && phoneId) {
        for (const ph of phones) {
          await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneId}/messages`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: ph, type: 'text', text: { body: `${title}\n${body}` } }),
          }).catch(() => {});
        }
      }
    }
    // sms channel: reserved (Twilio wiring exists elsewhere); notification+email cover it for now
  } catch (err) {
    console.error('[sdr] notifyHandover channel send failed:', err.message);
  }
}

/**
 * Company Brain autofill for the SDR settings. One high-quality structured call
 * that reads company context and returns a complete, precise SDR config.
 */
export async function autofillSdrConfig(companyId) {
  const facts = await getCompanyFacts(companyId);
  const system = 'You are an elite sales enablement consultant configuring a client-facing SDR (Sales Development Representative) chatbot for THIS specific company. Use the company context (Company Brain) to produce a COMPLETE, PRECISE, high-quality configuration grounded in sales/marketing best practices AND this company\'s industry and specifics. No placeholders, no generic filler. Return JSON only.';
  const prompt = `Configure the SDR for ${facts.name || 'this company'}${facts.industry ? ` (${facts.industry})` : ''}.
Company offering: ${trunc(facts.services_description || '', 500)}
Value props: ${(facts.value_propositions || []).join('; ')}
ICP: ${JSON.stringify(facts.icp || {}).slice(0, 600)}
Briefing: ${JSON.stringify(facts.briefing || {}).slice(0, 600)}

Return JSON shaped EXACTLY:
{
  "name": "<a fitting SDR name>",
  "greeting": "<the opening message the SDR sends first>",
  "goal": "<one-sentence objective>",
  "persona": "<2-3 sentence persona + tone>",
  "guardrails": "<what it must never do>",
  "show_prices": true|false,
  "products": [{"name":"","description":"","price":"","how_to_pitch":"","conditions":"<when to offer this>"}],
  "qualifying_questions": [{"question":"","purpose":"","maps_to":"<budget|timeline|authority|need|channel>"}],
  "conversation_flow": ["greeting","ask reason for contact","ask qualifying questions","recommend product or hand over to sales"],
  "handoff_conditions": "<when to hand to a human>"
}
Make products/questions specific to this company. 3-6 qualifying questions. 1-5 products/services.`;

  const result = await runAIChat({
    companyId, userRole: 'user', userEmail: 'sdr-setup@bmapz',
    messages: [{ role: 'user', content: prompt }],
    system, action: 'sdr_setup',
    response_format: { type: 'json_object' },
    temperature: 0.4,
    skipBrain: false, // setup DOES use the full internal brain for max precision
  });
  let cfg;
  try { cfg = JSON.parse(result.content); } catch { throw new Error('AI returned an unparseable configuration'); }
  return { cfg, usage: result.usage };
}
