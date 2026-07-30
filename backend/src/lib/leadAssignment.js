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
    let q = supabaseAdmin
      .from('users')
      .select('id, full_name, email, profile_picture, sales_status, is_sales_team')
      .eq('company_id', companyId)
      .eq('is_sales_team', true);
    if (status) q = q.eq('sales_status', status);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  } catch (err) {
    // Before migration 011 these columns do not exist — behave as "no team set up".
    console.error('[leadAssignment] getSalesTeam failed:', err.message);
    return [];
  }
}

/**
 * Choose the next owner for a new lead: the ONLINE sales member currently
 * holding the fewest open leads (a simple, fair round-robin that self-balances).
 * Returns null when nobody is online — the caller should then let the SDR work
 * the lead and leave it unassigned.
 */
export async function pickNextOwner(companyId) {
  const available = await getSalesTeam(companyId, { status: 'online' });
  if (!available.length) return null;

  // Count each member's open (not won/lost/disqualified) leads.
  let counts = {};
  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('owner_id, status')
      .eq('company_id', companyId)
      .not('owner_id', 'is', null);
    if (error) throw error;
    const closed = new Set(['won', 'lost', 'disqualified']);
    counts = (data || []).reduce((acc, l) => {
      if (closed.has(l.status)) return acc;
      acc[l.owner_id] = (acc[l.owner_id] || 0) + 1;
      return acc;
    }, {});
  } catch (err) {
    // If the count fails, still assign — just without load balancing.
    console.error('[leadAssignment] load count failed:', err.message);
  }

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
