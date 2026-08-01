/**
 * Lead routing — who should own an incoming lead right now.
 *
 * A company admin decides who is on the sales team; each member then sets their
 * own availability, and that availability is what this module honours:
 *
 *   online   → can receive new leads
 *   standby  → does NOT receive new leads; the SDR agent handles them instead
 *   offline  → does not receive new leads
 *
 * When nobody is online, the lead is left unassigned and the SDR agent picks it
 * up (that is exactly what "standby" is for), so a lead is never silently
 * dropped just because the team stepped away.
 */
import { supabaseAdmin } from './supabase.js';

/** Sales team members of a company, optionally filtered by availability. */
export async function getSalesTeam(companyId, { status } = {}) {
  try {
    const run = (cols) => {
      let q = supabaseAdmin.from('users').select(cols)
        .eq('company_id', companyId).eq('is_sales_team', true);
      if (status) q = q.eq('sales_status', status);
      return q;
    };
    let { data, error } = await run('id, full_name, email, profile_picture, sales_status, is_sales_team, lead_queue_position');
    // lead_queue_position only exists after migration 014.
    if (error && /lead_queue_position/i.test(error.message || '')) {
      ({ data, error } = await run('id, full_name, email, profile_picture, sales_status, is_sales_team'));
    }
    if (error) throw error;
    return data || [];
  } catch (err) {
    // Before migration 011 these columns do not exist — behave as "no team set up".
    console.error('[leadAssignment] getSalesTeam failed:', err.message);
    return [];
  }
}

export const ROUTING_METHODS = ['random', 'balanced', 'queued'];
export const DEFAULT_ROUTING_METHOD = 'balanced';

/** The company's chosen routing method (falls back to balanced). */
export async function getRoutingMethod(companyId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('companies').select('lead_routing_method').eq('id', companyId).maybeSingle();
    if (error) throw error;
    const m = data?.lead_routing_method;
    return ROUTING_METHODS.includes(m) ? m : DEFAULT_ROUTING_METHOD;
  } catch {
    // Column missing (before migration 014) — keep the previous behaviour.
    return DEFAULT_ROUTING_METHOD;
  }
}

/** Open-lead count per owner (won/lost/disqualified don't count as workload). */
async function openLeadCounts(companyId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('owner_id, status')
      .eq('company_id', companyId)
      .not('owner_id', 'is', null);
    if (error) throw error;
    const closed = new Set(['won', 'lost', 'disqualified']);
    return (data || []).reduce((acc, l) => {
      if (closed.has(l.status)) return acc;
      acc[l.owner_id] = (acc[l.owner_id] || 0) + 1;
      return acc;
    }, {});
  } catch (err) {
    console.error('[leadAssignment] load count failed:', err.message);
    return {};
  }
}

/**
 * Choose the next owner for a new lead from the members who are ONLINE, using
 * the company's routing method. Returns null when nobody is online — the caller
 * then leaves the lead unassigned for the SDR agent (that is what "stand by"
 * means), so a lead is never silently dropped.
 */
export async function pickNextOwner(companyId, { method } = {}) {
  const available = await getSalesTeam(companyId, { status: 'online' });
  if (!available.length) return null;
  if (available.length === 1) return available[0];

  const chosen = method || await getRoutingMethod(companyId);

  if (chosen === 'random') {
    // Deliberately uniform: no memory, every online member equally likely.
    return available[Math.floor(Math.random() * available.length)];
  }

  if (chosen === 'queued') {
    // Strict round-robin: whoever has been waiting longest since they became
    // available (or since they were last handed a lead) goes next. A member with
    // no stamp yet has never been served, so they take priority.
    const sorted = [...available].sort((a, b) => {
      const ta = a.lead_queue_position ? Date.parse(a.lead_queue_position) : 0;
      const tb = b.lead_queue_position ? Date.parse(b.lead_queue_position) : 0;
      if (ta !== tb) return ta - tb;
      return String(a.id).localeCompare(String(b.id)); // stable tie-break
    });
    const next = sorted[0];
    // Move them to the back of the queue.
    try {
      await supabaseAdmin.from('users')
        .update({ lead_queue_position: new Date().toISOString() })
        .eq('id', next.id).eq('company_id', companyId);
    } catch (err) {
      console.error('[leadAssignment] queue advance failed:', err.message);
    }
    return next;
  }

  // balanced (default): fewest open leads wins.
  const counts = await openLeadCounts(companyId);
  let best = available[0];
  let bestCount = counts[best.id] || 0;
  for (const member of available.slice(1)) {
    const c = counts[member.id] || 0;
    if (c < bestCount) { best = member; bestCount = c; }
  }
  return best;
}

/**
 * Describe how a company's leads are currently being handled — used to explain
 * routing to the user and by the support assistant's diagnostics.
 */
export async function describeRouting(companyId) {
  const team = await getSalesTeam(companyId);
  const online = team.filter(m => m.sales_status === 'online');
  const standby = team.filter(m => m.sales_status === 'standby');
  const offline = team.filter(m => m.sales_status === 'offline');
  return {
    team_size: team.length,
    online: online.length,
    standby: standby.length,
    offline: offline.length,
    // With nobody online, new leads stay unassigned for the SDR to work.
    new_leads_go_to: online.length ? 'sales_team' : 'sdr_agent',
  };
}
