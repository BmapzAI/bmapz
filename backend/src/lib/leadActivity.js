/**
 * Lead history — an append-only timeline of everything that happens to a lead.
 *
 * Every part of the lead-handling process writes here: manual edits from the
 * Sales board, SDR conversations, workflow steps, stage/status changes and
 * owner assignment. The timeline is company-wide readable so the whole team can
 * see who is handling a lead and what has already been done.
 *
 * Logging must never break the operation it is describing, so failures are
 * swallowed and reported to the server log only.
 */
import { supabaseAdmin } from './supabase.js';

export const LEAD_ACTIVITY_TYPES = {
  CREATED: 'created',
  ASSIGNED: 'assigned',
  UNASSIGNED: 'unassigned',
  STAGE_CHANGED: 'stage_changed',
  STATUS_CHANGED: 'status_changed',
  MESSAGE_SENT: 'message_sent',
  MESSAGE_RECEIVED: 'message_received',
  NOTE: 'note',
  QUALIFIED: 'qualified',
  DISQUALIFIED: 'disqualified',
  HANDOVER: 'handover',
  WORKFLOW: 'workflow',
  SDR: 'sdr',
  UPDATED: 'updated',
};

/**
 * Append one entry to a lead's history.
 * @param {object}  p
 * @param {string}  p.companyId
 * @param {string}  p.leadId
 * @param {string}  p.activityType  one of LEAD_ACTIVITY_TYPES
 * @param {string}  p.summary       short human sentence shown in the timeline
 * @param {string} [p.actorUserId]  the acting user, when a human did it
 * @param {string} [p.actorType]    user | sdr | workflow | system | ai
 * @param {string} [p.actorLabel]   display name for non-user actors ("SDR: Alex")
 * @param {object} [p.details]      structured extras (from/to values, ids…)
 */
export async function logLeadActivity({
  companyId, leadId, activityType, summary,
  actorUserId = null, actorType = 'user', actorLabel = null, details = {},
}) {
  if (!companyId || !leadId || !activityType || !summary) return null;
  try {
    const { data, error } = await supabaseAdmin.from('lead_activities').insert({
      company_id: companyId,
      lead_id: leadId,
      actor_user_id: actorUserId,
      actor_type: actorType,
      actor_label: actorLabel,
      activity_type: activityType,
      summary: String(summary).slice(0, 500),
      details: details || {},
    }).select().single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[leadActivity] log failed:', err.message);
    return null;
  }
}

/**
 * Compare a lead before/after an update and record the meaningful changes.
 * Keeps the timeline readable by logging one entry per significant field rather
 * than a raw diff of everything.
 */
export async function logLeadChanges({ companyId, leadId, before = {}, after = {}, actorUserId = null, actorType = 'user', actorLabel = null }) {
  const base = { companyId, leadId, actorUserId, actorType, actorLabel };

  if (after.funnel_stage && after.funnel_stage !== before.funnel_stage) {
    await logLeadActivity({
      ...base,
      activityType: LEAD_ACTIVITY_TYPES.STAGE_CHANGED,
      summary: `Stage changed from "${before.funnel_stage || 'none'}" to "${after.funnel_stage}"`,
      details: { from: before.funnel_stage || null, to: after.funnel_stage },
    });
  }

  if (after.status && after.status !== before.status) {
    const type = after.status === 'qualified' ? LEAD_ACTIVITY_TYPES.QUALIFIED
      : ['disqualified', 'lost'].includes(after.status) ? LEAD_ACTIVITY_TYPES.DISQUALIFIED
        : LEAD_ACTIVITY_TYPES.STATUS_CHANGED;
    await logLeadActivity({
      ...base,
      activityType: type,
      summary: `Status changed from "${before.status || 'none'}" to "${after.status}"`,
      details: { from: before.status || null, to: after.status },
    });
  }

  if ('owner_id' in after && after.owner_id !== before.owner_id) {
    if (after.owner_id) {
      const { data: owner } = await supabaseAdmin.from('users').select('full_name, email').eq('id', after.owner_id).maybeSingle();
      await logLeadActivity({
        ...base,
        activityType: LEAD_ACTIVITY_TYPES.ASSIGNED,
        summary: `Assigned to ${owner?.full_name || owner?.email || 'a team member'}`,
        details: { from: before.owner_id || null, to: after.owner_id },
      });
    } else {
      await logLeadActivity({
        ...base,
        activityType: LEAD_ACTIVITY_TYPES.UNASSIGNED,
        summary: 'Owner removed',
        details: { from: before.owner_id || null, to: null },
      });
    }
  }
}
