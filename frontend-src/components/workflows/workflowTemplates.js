/**
 * SINGLE SOURCE OF TRUTH for workflow templates.
 *
 * Both surfaces use this file so there is exactly ONE library:
 *  - Workflows page "Templates" tab (gallery)  → opens the builder pre-loaded
 *  - Builder modal "Templates" popover         → loads onto the canvas
 *
 * Every template is a COMPLETE working graph (real nodes + connections), so a
 * user who picks any template lands on a ready-to-run workflow — never a blank
 * one. Each entry adds display metadata (category, description) for the gallery.
 *
 * Node shape: { id, type, name, x, y, ...typeSpecificFields }
 * Connection: { from: { nodeId, port }, to }   // port: default | yes | no
 */

export const WORKFLOW_TEMPLATES = {
  lead_qualification: {
    name: 'Inbound Lead Qualification (SDR)', type: 'qualification',
    category: 'Qualification',
    description: 'A new inbound lead is greeted and qualified by the SDR, then routed to sales if qualified or nurtured if not.',
    trigger_type: 'new_lead',
    nodes: [
      { id: 't',  type: 'trigger',  name: 'New inbound lead', x: 380, y: 40, trigger_type: 'new_lead' },
      { id: 'sdr',type: 'sdr',      name: 'SDR greets & qualifies', x: 380, y: 170, channel: 'email' },
      { id: 'w1', type: 'wait',     name: 'Give the lead time', x: 380, y: 300, delay_days: 2 },
      { id: 'c1', type: 'condition',name: 'Qualified?', x: 380, y: 430, condition: 'qualified' },
      { id: 'q',  type: 'qualify',  name: 'Move to SQL', x: 200, y: 560, qualify_action: 'set', qualify_stage: 'sql' },
      { id: 'h',  type: 'handover', name: 'Hand to sales', x: 200, y: 690, handover_channels: { notification: true, email: true }, set_stage_on_handover: true },
      { id: 'nq', type: 'qualify',  name: 'Nurture (Awareness)', x: 560, y: 560, qualify_action: 'set', qualify_stage: 'awareness' },
      { id: 'ok', type: 'end_success', name: 'Done', x: 200, y: 820 },
      { id: 'end2', type: 'end_success', name: 'Nurturing', x: 560, y: 690 },
    ],
    connections: [
      { from: { nodeId: 't', port: 'default' }, to: 'sdr' },
      { from: { nodeId: 'sdr', port: 'default' }, to: 'w1' },
      { from: { nodeId: 'w1', port: 'default' }, to: 'c1' },
      { from: { nodeId: 'c1', port: 'yes' }, to: 'q' },
      { from: { nodeId: 'q', port: 'default' }, to: 'h' },
      { from: { nodeId: 'h', port: 'default' }, to: 'ok' },
      { from: { nodeId: 'c1', port: 'no' }, to: 'nq' },
      { from: { nodeId: 'nq', port: 'default' }, to: 'end2' },
    ]
  },
  email_sequence: {
    name: 'Email Outreach Sequence', type: 'sales_outreach',
    category: 'Outreach',
    description: 'A classic 3-touch cold email cadence with waits between each message.',
    nodes: [
      { id: 't', type: 'trigger', name: 'Start', x: 380, y: 40 },
      { id: 'e1', type: 'send_message', name: 'Initial Email', x: 380, y: 170, channel: 'email' },
      { id: 'w1', type: 'wait', name: 'Wait 3 days', x: 380, y: 300, delay_days: 3 },
      { id: 'e2', type: 'send_message', name: 'Follow-up', x: 380, y: 430, channel: 'email' },
      { id: 'w2', type: 'wait', name: 'Wait 5 days', x: 380, y: 560, delay_days: 5 },
      { id: 'e3', type: 'send_message', name: 'Final Touch', x: 380, y: 690, channel: 'email' },
      { id: 'ok', type: 'end_success', name: 'Success', x: 380, y: 820 },
    ],
    connections: [
      { from: { nodeId: 't', port: 'default' }, to: 'e1' }, { from: { nodeId: 'e1', port: 'default' }, to: 'w1' },
      { from: { nodeId: 'w1', port: 'default' }, to: 'e2' }, { from: { nodeId: 'e2', port: 'default' }, to: 'w2' },
      { from: { nodeId: 'w2', port: 'default' }, to: 'e3' }, { from: { nodeId: 'e3', port: 'default' }, to: 'ok' },
    ]
  },
  multi_channel: {
    name: 'Multi-Channel Outreach', type: 'sales_outreach',
    category: 'Outreach',
    description: 'LinkedIn + email + WhatsApp touches that branch on whether the email was opened.',
    nodes: [
      { id: 't', type: 'trigger', name: 'Start', x: 380, y: 40 },
      { id: 'li', type: 'send_message', name: 'LinkedIn Connect', x: 380, y: 170, channel: 'linkedin' },
      { id: 'w1', type: 'wait', name: 'Wait 2 days', x: 380, y: 300, delay_days: 2 },
      { id: 'e1', type: 'send_message', name: 'Email Intro', x: 380, y: 430, channel: 'email' },
      { id: 'w2', type: 'wait', name: 'Wait 3 days', x: 380, y: 560, delay_days: 3 },
      { id: 'c1', type: 'condition', name: 'Email Opened?', x: 380, y: 690, condition: 'opened' },
      { id: 'wa', type: 'send_message', name: 'WhatsApp Follow-up', x: 200, y: 820, channel: 'whatsapp' },
      { id: 'li2', type: 'send_message', name: 'LinkedIn DM', x: 560, y: 820, channel: 'linkedin' },
      { id: 'ok', type: 'end_success', name: 'Success', x: 380, y: 950 },
    ],
    connections: [
      { from: { nodeId: 't', port: 'default' }, to: 'li' }, { from: { nodeId: 'li', port: 'default' }, to: 'w1' },
      { from: { nodeId: 'w1', port: 'default' }, to: 'e1' }, { from: { nodeId: 'e1', port: 'default' }, to: 'w2' },
      { from: { nodeId: 'w2', port: 'default' }, to: 'c1' },
      { from: { nodeId: 'c1', port: 'yes' }, to: 'li2' }, { from: { nodeId: 'c1', port: 'no' }, to: 'wa' },
      { from: { nodeId: 'wa', port: 'default' }, to: 'ok' }, { from: { nodeId: 'li2', port: 'default' }, to: 'ok' },
    ]
  },
  social_warming: {
    name: 'Social Warming + Outreach', type: 'sales_outreach',
    category: 'Social Selling',
    description: 'Enrich the lead, warm them on LinkedIn (connect, like, comment), then reach out on the best channel.',
    nodes: [
      { id: 't',   type: 'trigger',       name: 'Start',                        x: 380, y: 40  },
      { id: 'e1',  type: 'enrich_lead',   name: 'Enrich Lead Data',             x: 380, y: 170, enrich_provider: 'apollo', enrich_fields: ['email','linkedin_profile','phone'] },
      { id: 'w0',  type: 'wait',          name: 'Wait 1 day',                   x: 380, y: 300, delay_days: 1 },
      { id: 's1',  type: 'social_action', name: 'LinkedIn Connect',             x: 380, y: 430, social_platform: 'linkedin', social_action_type: 'connect', timing_mode: 'business_hours', skip_if_done: true },
      { id: 'w1',  type: 'wait',          name: 'Wait 2 days',                  x: 380, y: 560, delay_days: 2 },
      { id: 's2',  type: 'social_action', name: 'Like LinkedIn Post',           x: 380, y: 690, social_platform: 'linkedin', social_action_type: 'like_post', post_target: 'most_recent', timing_mode: 'business_hours' },
      { id: 'w2',  type: 'wait',          name: 'Wait 1 day',                   x: 380, y: 820, delay_days: 1 },
      { id: 's3',  type: 'social_action', name: 'Comment on LinkedIn Post',     x: 380, y: 950, social_platform: 'linkedin', social_action_type: 'comment_post', post_target: 'most_recent', timing_mode: 'business_hours' },
      { id: 'w3',  type: 'wait',          name: 'Wait 2 days',                  x: 380, y: 1080, delay_days: 2 },
      { id: 'c1',  type: 'condition',     name: 'Connection Accepted?',         x: 380, y: 1210, condition: 'connected_linkedin' },
      { id: 'li1', type: 'send_message',  name: 'LinkedIn DM (warm)',           x: 200, y: 1340, channel: 'linkedin' },
      { id: 'em1', type: 'send_message',  name: 'Email Intro',                  x: 560, y: 1340, channel: 'email' },
      { id: 'ok',  type: 'end_success',   name: 'Success',                      x: 380, y: 1470 },
    ],
    connections: [
      { from: { nodeId: 't',   port: 'default' }, to: 'e1'  },
      { from: { nodeId: 'e1',  port: 'default' }, to: 'w0'  },
      { from: { nodeId: 'w0',  port: 'default' }, to: 's1'  },
      { from: { nodeId: 's1',  port: 'default' }, to: 'w1'  },
      { from: { nodeId: 'w1',  port: 'default' }, to: 's2'  },
      { from: { nodeId: 's2',  port: 'default' }, to: 'w2'  },
      { from: { nodeId: 'w2',  port: 'default' }, to: 's3'  },
      { from: { nodeId: 's3',  port: 'default' }, to: 'w3'  },
      { from: { nodeId: 'w3',  port: 'default' }, to: 'c1'  },
      { from: { nodeId: 'c1',  port: 'yes'     }, to: 'li1' },
      { from: { nodeId: 'c1',  port: 'no'      }, to: 'em1' },
      { from: { nodeId: 'li1', port: 'default' }, to: 'ok'  },
      { from: { nodeId: 'em1', port: 'default' }, to: 'ok'  },
    ]
  },
  instagram_warm: {
    name: 'Instagram Warm → DM', type: 'sales_outreach',
    category: 'Social Selling',
    description: 'Follow, like a few posts over several days to warm the prospect, then open with a DM.',
    nodes: [
      { id: 't',  type: 'trigger',       name: 'Start',                    x: 380, y: 40  },
      { id: 's1', type: 'social_action', name: 'Follow on Instagram',      x: 380, y: 170, social_platform: 'instagram', social_action_type: 'follow', timing_mode: 'business_hours' },
      { id: 'w1', type: 'wait',          name: 'Wait 2 days',              x: 380, y: 300, delay_days: 2 },
      { id: 's2', type: 'social_action', name: 'Like Recent Post',         x: 380, y: 430, social_platform: 'instagram', social_action_type: 'like_post', post_target: 'most_recent' },
      { id: 'w2', type: 'wait',          name: 'Wait 1 day',               x: 380, y: 560, delay_days: 1 },
      { id: 's3', type: 'social_action', name: 'Like Another Post',        x: 380, y: 690, social_platform: 'instagram', social_action_type: 'like_post', post_target: 'last_7_days_2' },
      { id: 'w3', type: 'wait',          name: 'Wait 3 days',              x: 380, y: 820, delay_days: 3 },
      { id: 'm1', type: 'send_message',  name: 'Send Initial DM',          x: 380, y: 950, channel: 'whatsapp' },
      { id: 'ok', type: 'end_success',   name: 'Success',                  x: 380, y: 1080 },
    ],
    connections: [
      { from: { nodeId: 't',  port: 'default' }, to: 's1' },
      { from: { nodeId: 's1', port: 'default' }, to: 'w1' },
      { from: { nodeId: 'w1', port: 'default' }, to: 's2' },
      { from: { nodeId: 's2', port: 'default' }, to: 'w2' },
      { from: { nodeId: 'w2', port: 'default' }, to: 's3' },
      { from: { nodeId: 's3', port: 'default' }, to: 'w3' },
      { from: { nodeId: 'w3', port: 'default' }, to: 'm1' },
      { from: { nodeId: 'm1', port: 'default' }, to: 'ok' },
    ]
  },
  meeting_scheduler: {
    name: 'Meeting Scheduler', type: 'sales_outreach',
    category: 'Meetings',
    description: 'Invite the lead to book a meeting, then either schedule it or send a reminder if they have not booked.',
    nodes: [
      { id: 't', type: 'trigger', name: 'Start', x: 380, y: 40 },
      { id: 'e1', type: 'send_message', name: 'Meeting Invite', x: 380, y: 170, channel: 'email' },
      { id: 'w1', type: 'wait', name: 'Wait 3 days', x: 380, y: 300, delay_days: 3 },
      { id: 'c1', type: 'condition', name: 'Booked?', x: 380, y: 430, condition: 'meeting_booked' },
      { id: 'sm', type: 'schedule_meeting', name: 'Schedule Meeting', x: 200, y: 560 },
      { id: 'e2', type: 'send_message', name: 'Reminder Email', x: 560, y: 560, channel: 'email' },
      { id: 'ok', type: 'end_success', name: 'Success', x: 200, y: 690 },
      { id: 'fail', type: 'end_failed', name: 'No Show', x: 560, y: 690 },
    ],
    connections: [
      { from: { nodeId: 't', port: 'default' }, to: 'e1' }, { from: { nodeId: 'e1', port: 'default' }, to: 'w1' },
      { from: { nodeId: 'w1', port: 'default' }, to: 'c1' },
      { from: { nodeId: 'c1', port: 'yes' }, to: 'sm' }, { from: { nodeId: 'c1', port: 'no' }, to: 'e2' },
      { from: { nodeId: 'sm', port: 'default' }, to: 'ok' }, { from: { nodeId: 'e2', port: 'default' }, to: 'fail' },
    ]
  },
  nurturing: {
    name: 'Lead Nurturing Campaign', type: 'nurturing',
    category: 'Nurturing',
    description: 'Warm up cold leads with value content over a week, branching on engagement.',
    nodes: [
      { id: 't', type: 'trigger', name: 'Start', x: 380, y: 40 },
      { id: 'e1', type: 'send_message', name: 'Welcome Email', x: 380, y: 170, channel: 'email' },
      { id: 'w1', type: 'wait', name: 'Wait 3 days', x: 380, y: 300, delay_days: 3 },
      { id: 'e2', type: 'send_message', name: 'Value Content', x: 380, y: 430, channel: 'email' },
      { id: 'w2', type: 'wait', name: 'Wait 4 days', x: 380, y: 560, delay_days: 4 },
      { id: 'c1', type: 'condition', name: 'Engaged?', x: 380, y: 690, condition: 'clicked' },
      { id: 'e3', type: 'send_message', name: 'Case Study', x: 200, y: 820, channel: 'email' },
      { id: 'wa', type: 'send_message', name: 'Personal Touch', x: 560, y: 820, channel: 'whatsapp' },
      { id: 'ok', type: 'end_success', name: 'Success', x: 380, y: 950 },
    ],
    connections: [
      { from: { nodeId: 't', port: 'default' }, to: 'e1' }, { from: { nodeId: 'e1', port: 'default' }, to: 'w1' },
      { from: { nodeId: 'w1', port: 'default' }, to: 'e2' }, { from: { nodeId: 'e2', port: 'default' }, to: 'w2' },
      { from: { nodeId: 'w2', port: 'default' }, to: 'c1' },
      { from: { nodeId: 'c1', port: 'yes' }, to: 'e3' }, { from: { nodeId: 'c1', port: 'no' }, to: 'wa' },
      { from: { nodeId: 'e3', port: 'default' }, to: 'ok' }, { from: { nodeId: 'wa', port: 'default' }, to: 'ok' },
    ]
  },
  new_conversation_sdr: {
    name: 'New Conversation → SDR Auto-Reply', type: 'qualification',
    category: 'Inbound',
    description: 'When a new conversation starts on any channel, the SDR replies, qualifies, and hands hot leads to sales.',
    trigger_type: 'new_conversation',
    nodes: [
      { id: 't',   type: 'trigger',    name: 'New conversation', x: 380, y: 40, trigger_type: 'new_conversation' },
      { id: 'sdr', type: 'sdr',        name: 'SDR handles the chat', x: 380, y: 170, channel: 'whatsapp' },
      { id: 'c1',  type: 'condition',  name: 'Qualified?', x: 380, y: 300, condition: 'qualified' },
      { id: 'h',   type: 'handover',   name: 'Hand to sales', x: 200, y: 430, handover_channels: { notification: true, whatsapp: true }, set_stage_on_handover: true },
      { id: 'ok',  type: 'end_success', name: 'Handed over', x: 200, y: 560 },
      { id: 'end2', type: 'end_success', name: 'Keep nurturing', x: 560, y: 430 },
    ],
    connections: [
      { from: { nodeId: 't', port: 'default' }, to: 'sdr' },
      { from: { nodeId: 'sdr', port: 'default' }, to: 'c1' },
      { from: { nodeId: 'c1', port: 'yes' }, to: 'h' },
      { from: { nodeId: 'h', port: 'default' }, to: 'ok' },
      { from: { nodeId: 'c1', port: 'no' }, to: 'end2' },
    ]
  },
  reengagement: {
    name: 'Re-Engagement / Win-Back', type: 'follow_up',
    category: 'Retention',
    description: 'Reach back out to a cold or lapsed lead with a fresh reason to talk, escalating channels if ignored.',
    nodes: [
      { id: 't',  type: 'trigger',      name: 'Start', x: 380, y: 40 },
      { id: 'e1', type: 'send_message', name: 'We miss you email', x: 380, y: 170, channel: 'email' },
      { id: 'w1', type: 'wait',         name: 'Wait 4 days', x: 380, y: 300, delay_days: 4 },
      { id: 'c1', type: 'condition',    name: 'Replied?', x: 380, y: 430, condition: 'replied' },
      { id: 'ok', type: 'end_success',  name: 'Re-engaged', x: 200, y: 560 },
      { id: 'wa', type: 'send_message', name: 'WhatsApp nudge', x: 560, y: 560, channel: 'whatsapp' },
      { id: 'w2', type: 'wait',         name: 'Wait 5 days', x: 560, y: 690, delay_days: 5 },
      { id: 'end2', type: 'end_failed', name: 'Gone cold', x: 560, y: 820 },
    ],
    connections: [
      { from: { nodeId: 't', port: 'default' }, to: 'e1' },
      { from: { nodeId: 'e1', port: 'default' }, to: 'w1' },
      { from: { nodeId: 'w1', port: 'default' }, to: 'c1' },
      { from: { nodeId: 'c1', port: 'yes' }, to: 'ok' },
      { from: { nodeId: 'c1', port: 'no' }, to: 'wa' },
      { from: { nodeId: 'wa', port: 'default' }, to: 'w2' },
      { from: { nodeId: 'w2', port: 'default' }, to: 'end2' },
    ]
  },
};

/** Count the meaningful steps (everything except the trigger and terminal nodes). */
export function templateStepCount(tmpl) {
  return (tmpl.nodes || []).filter(n => n.type !== 'trigger' && !String(n.type).startsWith('end')).length;
}

/** Flat, ordered list for gallery rendering. Each item includes its key. */
export const WORKFLOW_TEMPLATE_LIST = Object.entries(WORKFLOW_TEMPLATES).map(([key, t]) => ({
  key,
  ...t,
  steps: templateStepCount(t),
}));
