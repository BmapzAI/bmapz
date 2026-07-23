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

export const FUNNEL_STAGES = ['prospect', 'awareness', 'consideration', 'mql', 'sql', 'opportunity', 'customer', 'retention', 'advocacy'];

/** Load the company's SDR config, creating a disabled default if none exists. */
export async function getSdrAgent(companyId) {
  const { data } = await supabaseAdmin.from('sdr_agents').select('*').eq('company_id', companyId).maybeSingle();
  if (data) return data;
  const { data: created } = await supabaseAdmin.from('sdr_agents')
    .insert({ company_id: companyId, enabled: false })
    .select().single();
  return created;
}

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
    `\nHARD RULES: Never reveal internal metrics, pipeline numbers, or other customers. Never invent products, prices, or promises. Stay strictly on topics about ${facts.name || 'the company'} and its offering. If the prospect is ready to buy, is high-value, or explicitly asks for a human, HAND OVER to sales. If they need technical support, route to support.`,
    `\nYou MUST reply with a JSON object ONLY, no prose around it, shaped exactly:`,
    `{"reply": "<the message to send to the prospect>", "outcome": "none|offer_product|handover|qualified|not_qualified|support", "recommended_product": "<product name or null>", "qualification": {"<question or attribute>": "<their answer/observation>"}, "internal_note": "<one sentence: which flow step you're on and why this outcome>", "stage": "prospect|awareness|consideration|mql|sql|opportunity|null"}`,
    `Set outcome to "handover" only when it's time for a human; "qualified" when they clearly fit and are interested; "not_qualified" when they're clearly out of scope; "support" for support requests; otherwise "none". Keep "reply" natural and channel-appropriate (short for chat/WhatsApp).`,
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
  return { ...parsed, _usage: result.usage, _model: result.model_used };
}

/**
 * Full inbound loop for one client message. Finds/creates the SDR conversation,
 * generates the reply, sends it on the channel, persists, and fires outcome
 * side-effects (notifications + CRM stage moves).
 * Returns { conversation, reply, outcome } or null if the SDR is disabled.
 */
export async function handleInboundForSdr({ companyId, channel = 'web', contactHandle, contactName, leadId, text }) {
  const agent = await getSdrAgent(companyId);
  if (!agent?.enabled) return null;
  const channels = Array.isArray(agent.channels) ? agent.channels : [];
  if (channels.length && !channels.includes(channel)) return null;

  const facts = await getCompanyFacts(companyId);

  // Find or create the conversation (by lead or contact handle)
  let convo = null;
  if (leadId) {
    const { data } = await supabaseAdmin.from('sdr_conversations').select('*')
      .eq('company_id', companyId).eq('lead_id', leadId).in('status', ['active', 'qualified'])
      .order('last_message_at', { ascending: false }).limit(1).maybeSingle();
    convo = data;
  }
  if (!convo && contactHandle) {
    const { data } = await supabaseAdmin.from('sdr_conversations').select('*')
      .eq('company_id', companyId).eq('contact_handle', contactHandle).in('status', ['active', 'qualified'])
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

  await supabaseAdmin.from('sdr_conversations').update({
    messages, qualification, notes, status,
    outcome: decision.outcome || convo.outcome || 'none',
    last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', convo.id);

  // Send the reply on the channel it came from
  await sendSdrReply({ companyId, channel, contactHandle, leadId, reply });

  // Outcome side-effects
  await applySdrOutcome({ companyId, agent, convo, leadId, decision, contactName: contactName || convo.contact_name });

  return { conversation: convo, reply, outcome: decision.outcome || 'none' };
}

/**
 * Proactively start an SDR conversation with a lead (used by the workflow 'sdr'
 * node). Sends the configured greeting (or a short AI opener) on the channel,
 * and opens an sdr_conversation so the lead's replies are handled by the SDR.
 */
export async function startSdrConversation({ companyId, leadId, lead, channel = 'email', openingText }) {
  const agent = await getSdrAgent(companyId);
  if (!agent?.enabled) return null;
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

  await sendSdrReply({ companyId, channel, contactHandle, leadId, reply: opener });
  return convo;
}

async function sendSdrReply({ companyId, channel, contactHandle, leadId, reply }) {
  try {
    // Log to the unified messages table so it shows in Inbox
    await supabaseAdmin.from('messages').insert({
      company_id: companyId, lead_id: leadId || null,
      direction: 'outbound', channel: channel === 'web' ? 'internal' : channel,
      content: reply, status: 'sent', sent_at: new Date().toISOString(),
      to_address: contactHandle || null, metadata: { sdr: true },
    });
    if (channel === 'email' && contactHandle) {
      const { data: c } = await supabaseAdmin.from('companies').select('api_keys').eq('id', companyId).single();
      await sendCompanyEmail(c?.api_keys || {}, { to: contactHandle, subject: 'Re: your enquiry', html: reply.replace(/\n/g, '<br>'), text: reply });
    } else if (channel === 'whatsapp' && contactHandle) {
      const { data: c } = await supabaseAdmin.from('companies').select('api_keys').eq('id', companyId).single();
      const keys = c?.api_keys || {};
      const token = keys.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneId = keys.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (token && phoneId) {
        await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: contactHandle.replace(/\D/g, ''), type: 'text', text: { body: reply } }),
        });
      }
    }
    // web channel: reply is returned to the caller (widget) — no external send
  } catch (err) {
    console.error('[sdr] sendReply failed:', err.message);
  }
}

async function applySdrOutcome({ companyId, agent, convo, leadId, decision, contactName }) {
  const outcome = decision.outcome;
  const who = contactName || 'A prospect';

  // Move the lead's funnel stage if the SDR recommended one
  if (leadId && decision.stage && FUNNEL_STAGES.includes(decision.stage)) {
    await supabaseAdmin.from('leads').update({ funnel_stage: decision.stage }).eq('id', leadId).eq('company_id', companyId);
  }

  if (outcome === 'handover') {
    if (leadId) await supabaseAdmin.from('leads').update({ funnel_stage: 'sql', status: 'qualified' }).eq('id', leadId).eq('company_id', companyId);
    await notifyHandover({ companyId, agent, who, leadId, note: decision.internal_note });
  } else if (outcome === 'qualified') {
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
          await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
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
