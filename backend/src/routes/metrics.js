/**
 * Operational metrics for the Dashboards section.
 *
 * Answers the questions a sales manager actually asks, computed from the data
 * the account already holds rather than from vanity counters:
 *
 *   - how fast do we reply to a lead, and how much faster is the SDR than a human
 *   - how long until a lead is first contacted at all
 *   - who is available right now, and how much of the day the team was online
 *   - how many messages we exchange per lead, and across which channels
 *   - how long a lead takes to move stage, and to become a customer
 *   - which touchpoints a lead receives before converting
 *
 * Everything is company-scoped. Each block is computed independently so one
 * missing table (a migration not yet run) degrades that block to null instead of
 * failing the whole dashboard.
 */
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { FUNNEL_STAGES } from '../lib/sdrEngine.js';

const router = Router();

const MS_MIN = 60 * 1000;
const MS_HOUR = 60 * MS_MIN;

const safe = async (fn, fallback = null) => {
  try { return await fn(); } catch (err) {
    console.error('[metrics]', err.message);
    return fallback;
  }
};

const minutes = (ms) => (Number.isFinite(ms) ? Math.round(ms / MS_MIN) : null);
const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
const median = (nums) => {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Window in days, defaulting to 30. */
const windowStart = (days) => new Date(Date.now() - (Number(days) || 30) * 24 * MS_HOUR).toISOString();

// GET /api/metrics/overview?days=30
router.get('/overview', requireAuth, async (req, res) => {
  const companyId = req.companyId;
  const since = windowStart(req.query.days);

  /* ── Messages: response time, volume per lead, channel mix, SDR vs human ── */
  const messaging = await safe(async () => {
    const { data: msgs } = await supabaseAdmin
      .from('messages')
      .select('lead_id, direction, channel, content, sent_at, created_at, metadata')
      .eq('company_id', companyId)
      .gte('created_at', since)
      .order('created_at', { ascending: true });
    if (!msgs?.length) return { total: 0 };

    const at = (m) => new Date(m.sent_at || m.created_at).getTime();
    const byLead = new Map();
    for (const m of msgs) {
      if (!m.lead_id) continue;
      if (!byLead.has(m.lead_id)) byLead.set(m.lead_id, []);
      byLead.get(m.lead_id).push(m);
    }

    // Pair each inbound message with the next outbound reply to that lead.
    const replyAll = [];
    const replySdr = [];
    const replyHuman = [];
    for (const thread of byLead.values()) {
      thread.sort((a, b) => at(a) - at(b));
      for (let i = 0; i < thread.length; i++) {
        if (thread[i].direction !== 'inbound') continue;
        const reply = thread.slice(i + 1).find(m => m.direction === 'outbound');
        if (!reply) continue;
        const delta = at(reply) - at(thread[i]);
        if (!Number.isFinite(delta) || delta < 0) continue;
        replyAll.push(delta);
        // metadata.sdr marks a message the SDR agent sent; human = a person.
        if (reply.metadata?.human) replyHuman.push(delta);
        else if (reply.metadata?.sdr) replySdr.push(delta);
      }
    }

    const channels = {};
    for (const m of msgs) {
      const c = m.channel || 'unknown';
      channels[c] = (channels[c] || 0) + 1;
    }

    return {
      total: msgs.length,
      inbound: msgs.filter(m => m.direction === 'inbound').length,
      outbound: msgs.filter(m => m.direction === 'outbound').length,
      leads_messaged: byLead.size,
      messages_per_lead: byLead.size ? Number((msgs.length / byLead.size).toFixed(1)) : null,
      response_time_minutes: {
        average: minutes(avg(replyAll)),
        median: minutes(median(replyAll)),
        // The comparison the user asked for: SDR speed vs a person's.
        sdr_average: minutes(avg(replySdr)),
        human_average: minutes(avg(replyHuman)),
        sdr_replies: replySdr.length,
        human_replies: replyHuman.length,
      },
      channels,
    };
  }, { total: 0 });

  /* ── Time from lead created to its FIRST outbound contact ── */
  const firstContact = await safe(async () => {
    const { data: leads } = await supabaseAdmin
      .from('leads').select('id, created_at').eq('company_id', companyId).gte('created_at', since);
    if (!leads?.length) return null;

    const { data: outbound } = await supabaseAdmin
      .from('messages').select('lead_id, sent_at, created_at, metadata')
      .eq('company_id', companyId).eq('direction', 'outbound').gte('created_at', since);

    const firstByLead = new Map();
    for (const m of outbound || []) {
      if (!m.lead_id) continue;
      const t = new Date(m.sent_at || m.created_at).getTime();
      const prev = firstByLead.get(m.lead_id);
      if (!prev || t < prev.t) firstByLead.set(m.lead_id, { t, sdr: !m.metadata?.human });
    }

    const all = []; const withSdr = []; const withoutSdr = [];
    for (const l of leads) {
      const first = firstByLead.get(l.id);
      if (!first) continue;
      const delta = first.t - new Date(l.created_at).getTime();
      if (!Number.isFinite(delta) || delta < 0) continue;
      all.push(delta);
      (first.sdr ? withSdr : withoutSdr).push(delta);
    }

    return {
      average_minutes: minutes(avg(all)),
      median_minutes: minutes(median(all)),
      with_sdr_minutes: minutes(avg(withSdr)),
      without_sdr_minutes: minutes(avg(withoutSdr)),
      contacted: all.length,
      never_contacted: leads.length - all.length,
      total_leads: leads.length,
    };
  });

  /* ── Sales team availability, now and recently ── */
  const availability = await safe(async () => {
    const { data: team } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, sales_status, sales_status_updated_at, is_sales_team')
      .eq('company_id', companyId).eq('is_sales_team', true);
    if (!team) return null;

    const counts = { online: 0, standby: 0, offline: 0 };
    for (const u of team) counts[u.sales_status || 'offline'] = (counts[u.sales_status || 'offline'] || 0) + 1;

    return {
      team_size: team.length,
      ...counts,
      // Who is covering right now, so a manager can see the gap at a glance.
      members: team.map(u => ({
        id: u.id,
        name: u.full_name || u.email,
        email: u.email,
        status: u.sales_status || 'offline',
        since: u.sales_status_updated_at,
        // How long they have held the current status.
        held_minutes: u.sales_status_updated_at
          ? minutes(Date.now() - new Date(u.sales_status_updated_at).getTime())
          : null,
      })),
      new_leads_go_to: counts.online > 0 ? 'sales_team' : 'sdr_agent',
    };
  });

  /* ── Funnel velocity: time per stage, and time to customer ── */
  const velocity = await safe(async () => {
    const { data: acts } = await supabaseAdmin
      .from('lead_activities')
      .select('lead_id, activity_type, details, created_at')
      .eq('company_id', companyId)
      .in('activity_type', ['created', 'stage_changed', 'status_changed', 'qualified'])
      .gte('created_at', since)
      .order('created_at', { ascending: true });
    if (!acts?.length) return null;

    // Group each lead's stage moves, then measure the gaps between them.
    const byLead = new Map();
    for (const a of acts) {
      if (!a.lead_id) continue;
      if (!byLead.has(a.lead_id)) byLead.set(a.lead_id, []);
      byLead.get(a.lead_id).push(a);
    }

    const perStage = {};       // stage → [ms spent before leaving it]
    const toCustomer = [];
    for (const events of byLead.values()) {
      let openedAt = null; let currentStage = null;
      for (const e of events) {
        const t = new Date(e.created_at).getTime();
        if (e.activity_type === 'created') { openedAt = t; currentStage = e.details?.to || 'awareness'; continue; }
        if (e.activity_type !== 'stage_changed') continue;
        const from = e.details?.from || currentStage;
        const to = e.details?.to;
        if (from && openedAt !== null) {
          const spent = t - (perStage[`_last_${from}`] ?? openedAt);
          if (Number.isFinite(spent) && spent >= 0) {
            perStage[from] = perStage[from] || [];
            perStage[from].push(spent);
          }
        }
        perStage[`_last_${to}`] = t;
        currentStage = to;
        if (to === 'customer' && openedAt !== null) toCustomer.push(t - openedAt);
      }
    }

    const stageAverages = {};
    for (const stage of FUNNEL_STAGES) {
      const list = perStage[stage];
      if (Array.isArray(list) && list.length) {
        stageAverages[stage] = { average_hours: Number((avg(list) / MS_HOUR).toFixed(1)), samples: list.length };
      }
    }

    return {
      stage_averages: stageAverages,
      time_to_customer_hours: toCustomer.length ? Number((avg(toCustomer) / MS_HOUR).toFixed(1)) : null,
      customers_won: toCustomer.length,
      leads_tracked: byLead.size,
    };
  });

  /* ── Touchpoints before a lead converts ── */
  const touchpoints = await safe(async () => {
    const { data: acts } = await supabaseAdmin
      .from('lead_activities')
      .select('lead_id, activity_type, actor_type, created_at')
      .eq('company_id', companyId).gte('created_at', since);
    if (!acts?.length) return null;

    const byLead = new Map();
    const byType = {};
    const byActor = {};
    for (const a of acts) {
      if (a.lead_id) byLead.set(a.lead_id, (byLead.get(a.lead_id) || 0) + 1);
      byType[a.activity_type] = (byType[a.activity_type] || 0) + 1;
      byActor[a.actor_type || 'user'] = (byActor[a.actor_type || 'user'] || 0) + 1;
    }
    const counts = [...byLead.values()];
    return {
      average_per_lead: counts.length ? Number(avg(counts).toFixed(1)) : null,
      median_per_lead: counts.length ? median(counts) : null,
      by_type: byType,
      // Human vs SDR vs workflow — who is actually doing the touching.
      by_actor: byActor,
      total: acts.length,
    };
  });

  /* ── Pipeline shape + SDR workload ── */
  const pipeline = await safe(async () => {
    const { data: leads } = await supabaseAdmin
      .from('leads').select('funnel_stage, status, owner_id, source, created_at')
      .eq('company_id', companyId);
    if (!leads) return null;

    const stages = {}; const statuses = {}; const sources = {};
    let unassigned = 0;
    for (const l of leads) {
      stages[l.funnel_stage || 'unknown'] = (stages[l.funnel_stage || 'unknown'] || 0) + 1;
      statuses[l.status || 'new'] = (statuses[l.status || 'new'] || 0) + 1;
      sources[l.source || 'direct'] = (sources[l.source || 'direct'] || 0) + 1;
      if (!l.owner_id) unassigned += 1;
    }
    const recent = leads.filter(l => new Date(l.created_at).toISOString() >= since).length;
    return { total: leads.length, new_in_window: recent, unassigned, stages, statuses, sources };
  });

  const sdr = await safe(async () => {
    const { data: convos } = await supabaseAdmin
      .from('sdr_conversations').select('status, outcome, human_takeover, created_at, last_message_at')
      .eq('company_id', companyId).gte('created_at', since);
    if (!convos) return null;
    const outcomes = {};
    for (const c of convos) outcomes[c.outcome || 'none'] = (outcomes[c.outcome || 'none'] || 0) + 1;
    return {
      conversations: convos.length,
      handed_to_human: convos.filter(c => c.human_takeover).length,
      qualified: convos.filter(c => c.status === 'qualified').length,
      handed_over: convos.filter(c => c.status === 'handed_over').length,
      outcomes,
    };
  });

  res.json({
    window_days: Number(req.query.days) || 30,
    generated_at: new Date().toISOString(),
    messaging, first_contact: firstContact, availability, velocity, touchpoints, pipeline, sdr,
  });
});

export default router;
