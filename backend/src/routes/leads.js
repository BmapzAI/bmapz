import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, filterCompanyMembers } from '../middleware/auth.js';
import { runAIChat } from './ai.js';
import { logLeadActivity, logLeadChanges, LEAD_ACTIVITY_TYPES } from '../lib/leadActivity.js';
import { pickNextOwner } from '../lib/leadAssignment.js';
import { sanitizeUpdate } from '../lib/safeUpdate.js';

const router = Router();

// Columns a client may write. Anything else is ignored rather than allowed to
// blow up the insert — an unknown field used to fail the whole request with a
// bare "Failed to add lead".
const LEAD_FIELDS = [
  'lead_name', 'lead_company_name', 'email', 'phone', 'role', 'website',
  'company_website', 'company_linkedin', 'linkedin_url', 'company_instagram',
  'company_facebook', 'company_tiktok', 'source', 'status', 'funnel_stage',
  'icp_score', 'icp_reasoning', 'icp_recommendation', 'estimated_value', 'tags',
  'notes', 'is_decision_maker', 'digital_presence_analysis', 'outreach_messages',
  'last_contacted_at', 'enriched_at', 'ad_platform', 'ad_form_id', 'ad_campaign_id',
  'disqualification_reason', 'disqualification_notes', 'owner_id',
];
// The UI calls the LinkedIn field `linkedin_profile`; the column is `linkedin_url`.
const LEAD_FIELD_ALIASES = { linkedin_profile: 'linkedin_url' };
// Empty strings are invalid for these types and reject the whole row.
const LEAD_NULLABLE_NUMBERS = ['estimated_value', 'icp_score'];
const LEAD_NULLABLE_TIMESTAMPS = ['last_contacted_at', 'enriched_at'];

function pickLeadFields(body) {
  const src = { ...(body || {}) };
  for (const [alias, column] of Object.entries(LEAD_FIELD_ALIASES)) {
    if (alias in src && !(column in src)) src[column] = src[alias];
  }
  const out = {};
  for (const field of LEAD_FIELDS) {
    if (!(field in src)) continue;
    let value = src[field];
    if (LEAD_NULLABLE_TIMESTAMPS.includes(field) && (value === '' || value === undefined)) value = null;
    if (LEAD_NULLABLE_NUMBERS.includes(field)) {
      if (value === '' || value === undefined || value === null) value = null;
      else {
        const n = Number(String(value).replace(/[^0-9.-]/g, ''));
        value = Number.isFinite(n) ? n : null;
      }
    }
    out[field] = value;
  }
  return out;
}

// Echo the UI's field name back so existing screens keep working.
const withLeadAliases = (row) => (row && typeof row === 'object')
  ? { ...row, linkedin_profile: row.linkedin_url ?? null }
  : row;

// ─── Lead Lists ──────────────────────────────────────────────────────────────

router.get('/lists', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('lead_lists')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/lists', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const { data, error } = await supabaseAdmin
      .from('lead_lists')
      .insert({ name, description, company_id: req.companyId })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/lists/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('lead_lists')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Lead list not found' });
  }
});

router.patch('/lists/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('lead_lists')
      // sanitizeUpdate strips company_id/id: .eq('company_id') limits WHICH row
      // is updated, not what the SET clause may contain — without this a client
      // could move its list into another company.
      .update(sanitizeUpdate(req.body))
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/lists/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('lead_lists')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Leads ───────────────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const { list_id, status, stage, search } = req.query;
    // Ceilinged. `limit` went straight into .range(), so `?limit=1000000` asked the
    // database for every lead in the tenant and serialised the lot — a one-request
    // memory and latency spike that needs no special privileges.
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    // Embed the owner so the whole company can see who handles each lead. The
    // embed (and owner filter) only work once migration 010 has been applied, so
    // fall back to a plain select rather than breaking the Sales board.
    const build = (withOwner) => {
      let q = supabaseAdmin
        .from('leads')
        .select(withOwner ? '*, owner:owner_id (id, full_name, email, profile_picture)' : '*', { count: 'exact' })
        .eq('company_id', req.companyId)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      // Honour an id filter. Without this, filter({ id }) silently returned the
      // WHOLE list and callers taking the first row opened the wrong lead.
      if (req.query.id) q = q.eq('id', req.query.id);
      if (list_id) q = q.eq('list_id', list_id);
      if (withOwner && req.query.owner_id) q = q.eq('owner_id', req.query.owner_id);
      if (status) q = q.eq('status', status);
      // The real column is funnel_stage — 'pipeline_stage' never existed, so
      // this filter 500'd for any caller. Dashboard drill-downs rely on it.
      if (stage) q = q.eq('funnel_stage', stage);
      if (req.query.funnel_stage) q = q.eq('funnel_stage', req.query.funnel_stage);
      if (req.query.source) q = q.eq('source', req.query.source);
      if (req.query.since) q = q.gte('created_at', req.query.since);
      if (req.query.unassigned === 'true') q = q.is('owner_id', null);
      // Sanitised before interpolation. This was the ONE search route that skipped
      // it — users.js, search.js, ai.js and tasks.js all strip these characters.
      // A comma starts another filter term and a paren closes the group, so an
      // unescaped search string rewrites the query's shape (the company_id .eq is
      // a separate clause and still holds, but the result set is not what was asked
      // for, and `%`/`_` silently turn into wildcards).
      if (search) {
        const s = String(search).replace(/[%_,()]/g, ' ').trim();
        if (s) q = q.or(`lead_name.ilike.%${s}%,email.ilike.%${s}%,lead_company_name.ilike.%${s}%`);
      }
      return q;
    };

    let { data, error, count } = await build(true);
    if (error && /owner_id|owner/i.test(error.message || '')) {
      ({ data, error, count } = await build(false));
    }
    if (error) throw error;
    res.json({ data: (data || []).map(withLeadAliases), total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * A client-supplied owner_id must belong to this company.
 *
 * `owner_id` is in LEAD_FIELDS, so it flows straight from the request body into
 * the insert. PATCH /:id and PATCH /:id/owner validate it; the two CREATE paths
 * did not. That let anyone plant an arbitrary platform user as the owner of a lead
 * in their own company and then read that user's EMAIL back out through the owner
 * embed on GET /api/leads — email is deliberately withheld by GET
 * /api/users/lookup, so this defeated that control and worked as reconnaissance
 * against owner/system_admin staff accounts.
 *
 * Uses filterCompanyMembers, not `users.company_id === req.companyId`: the strict
 * comparison wrongly rejects a legitimate guest member holding this company via
 * accessible_company_ids — the exact divergence documented in middleware/auth.js.
 */
async function keepOwnerIfMember(ownerId, companyId) {
  if (!ownerId) return null;
  const members = await filterCompanyMembers([ownerId], companyId);
  return members.includes(ownerId) ? ownerId : null;
}

router.post('/', requireAuth, async (req, res) => {
  try {
    const payload = { ...pickLeadFields(req.body), company_id: req.companyId };

    // Reject rather than silently drop: a caller who names an owner deserves to
    // know the assignment did not happen, and silently nulling it would hand the
    // lead to auto-routing under a different name.
    if (payload.owner_id && !(await keepOwnerIfMember(payload.owner_id, req.companyId))) {
      return res.status(400).json({
        error: 'That owner is not a member of this company.',
        code: 'OWNER_NOT_IN_COMPANY',
      });
    }

    // No explicit owner? Route it to an ONLINE sales team member. If nobody is
    // online (everyone standby/offline) the lead stays unassigned so the SDR
    // agent works it — that is what "stand by" means.
    let autoAssigned = false;
    if (!payload.owner_id) {
      const next = await pickNextOwner(req.companyId);
      if (next) { payload.owner_id = next.id; autoAssigned = true; }
    }
    if (payload.owner_id) payload.owner_assigned_at = new Date().toISOString();

    const insert = (body) => supabaseAdmin.from('leads').insert(body).select().single();
    let { data, error } = await insert(payload);
    // Drop columns that only exist after a migration rather than failing the add.
    if (error && /company_instagram|company_facebook|company_tiktok|owner_id|owner_assigned_at/i.test(error.message || '')) {
      const retry = { ...payload };
      for (const c of ['company_instagram', 'company_facebook', 'company_tiktok', 'owner_id', 'owner_assigned_at']) {
        if (new RegExp(c, 'i').test(error.message || '')) delete retry[c];
      }
      ({ data, error } = await insert(retry));
    }
    if (error) throw error;

    // Open the lead's history with how it entered the system.
    await logLeadActivity({
      companyId: req.companyId,
      leadId: data.id,
      activityType: LEAD_ACTIVITY_TYPES.CREATED,
      summary: `Lead created${data.source ? ` from ${data.source}` : ''}`,
      details: { source: data.source || null },
      actorUserId: req.dbUser?.id || null,
      actorType: 'user',
      actorLabel: req.dbUser?.full_name || req.dbUser?.email || null,
    });
    if (data.owner_id) {
      await logLeadChanges({
        companyId: req.companyId, leadId: data.id,
        before: { owner_id: null }, after: { owner_id: data.owner_id },
        // Auto-routing is the system acting, not the person who created the lead.
        actorUserId: autoAssigned ? null : (req.dbUser?.id || null),
        actorType: autoAssigned ? 'system' : 'user',
        actorLabel: autoAssigned ? 'Lead routing' : (req.dbUser?.full_name || req.dbUser?.email || null),
      });
    } else {
      await logLeadActivity({
        companyId: req.companyId, leadId: data.id,
        activityType: LEAD_ACTIVITY_TYPES.NOTE,
        summary: 'No sales team member is online — left unassigned for the SDR agent to handle',
        actorType: 'system', actorLabel: 'Lead routing',
      });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bulk', requireAuth, async (req, res) => {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads)) return res.status(400).json({ error: 'leads must be an array' });
    // Cap the batch. This mapped a client-supplied array straight into one
    // INSERT with only a type check, so a single request could attempt to write
    // an unbounded number of rows (accidentally, from a huge CSV, or on purpose).
    const MAX_BULK_LEADS = 1000;
    if (leads.length === 0) return res.status(400).json({ error: 'No leads supplied' });
    if (leads.length > MAX_BULK_LEADS) {
      return res.status(413).json({
        error: `Import up to ${MAX_BULK_LEADS} leads at a time (received ${leads.length}). Split the file and try again.`,
        code: 'BULK_TOO_LARGE',
        max: MAX_BULK_LEADS,
      });
    }

    const rows = leads.map(l => ({
      ...pickLeadFields(l),
      company_id: req.companyId,
    }));

    // Same unvalidated owner_id hole as POST /, but batched — and this path writes
    // no activity log, so a planted foreign owner left no trace at all. Resolve
    // membership ONCE for the distinct ids rather than per row, then drop any owner
    // that is not a member. Dropped (not rejected) here because one bad id in a
    // 1000-row CSV import should not fail the whole file; the response reports it.
    const requestedOwners = [...new Set(rows.map(r => r.owner_id).filter(Boolean))];
    let rejectedOwners = [];
    if (requestedOwners.length) {
      const allowed = new Set(await filterCompanyMembers(requestedOwners, req.companyId));
      rejectedOwners = requestedOwners.filter(id => !allowed.has(id));
      if (rejectedOwners.length) {
        for (const r of rows) {
          if (r.owner_id && !allowed.has(r.owner_id)) {
            delete r.owner_id;
            delete r.owner_assigned_at;
          }
        }
      }
    }

    const { data, error } = await supabaseAdmin.from('leads').insert(rows).select();
    if (error) throw error;
    res.json({
      inserted: data.length,
      data,
      ...(rejectedOwners.length
        ? {
          owner_warnings: `${rejectedOwners.length} owner id(s) are not members of this company and were left unassigned.`,
          rejected_owner_ids: rejectedOwners,
        }
        : {}),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Lead not found' });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    // Read the current row first so the change can be described in the history.
    const { data: before } = await supabaseAdmin
      .from('leads').select('*')
      .eq('id', req.params.id).eq('company_id', req.companyId).maybeSingle();

    const patch = pickLeadFields(req.body);
    // A lead has exactly one owner; stamp when that ownership changed.
    if ('owner_id' in patch && patch.owner_id !== before?.owner_id) {
      // Validate the target the same way PATCH /:id/owner does. Without this,
      // owner_id could be set to a user in ANOTHER company — and because
      // GET /leads embeds owner(id, full_name, email, profile_picture), that
      // user's name and email would then be read back by this company.
      if (patch.owner_id) {
        const { data: owner, error: ownerErr } = await supabaseAdmin
          .from('users').select('id, company_id')
          .eq('id', patch.owner_id).maybeSingle();
        if (ownerErr) return res.status(503).json({ error: 'Could not verify the owner. Nothing was saved.' });
        if (!owner || owner.company_id !== req.companyId) {
          return res.status(400).json({ error: 'That user is not part of this company' });
        }
      }
      patch.owner_assigned_at = patch.owner_id ? new Date().toISOString() : null;
    }

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update(patch)
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select()
      .single();
    if (error) throw error;

    await logLeadChanges({
      companyId: req.companyId,
      leadId: req.params.id,
      before: before || {},
      after: data,
      actorUserId: req.dbUser?.id || null,
      actorType: 'user',
      actorLabel: req.dbUser?.full_name || req.dbUser?.email || null,
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Ownership ───────────────────────────────────────────────────────────────
// PATCH /api/leads/:id/owner — assign the lead to exactly one teammate.
// Body: { owner_id: <user id> | null }
router.patch('/:id/owner', requireAuth, async (req, res) => {
  try {
    const ownerId = req.body?.owner_id || null;

    // The new owner must belong to this company — never allow cross-company assignment.
    if (ownerId) {
      const { data: owner } = await supabaseAdmin
        .from('users').select('id, company_id, full_name, email')
        .eq('id', ownerId).maybeSingle();
      if (!owner || owner.company_id !== req.companyId) {
        return res.status(400).json({ error: 'That user is not part of this company' });
      }
    }

    const { data: before } = await supabaseAdmin
      .from('leads').select('owner_id')
      .eq('id', req.params.id).eq('company_id', req.companyId).maybeSingle();
    if (!before) return res.status(404).json({ error: 'Lead not found' });

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update({ owner_id: ownerId, owner_assigned_at: ownerId ? new Date().toISOString() : null })
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select('*, owner:owner_id (id, full_name, email, profile_picture)')
      .single();
    if (error) {
      // Migration 010 not applied yet — say so plainly instead of a raw DB error.
      if (/owner_id|owner_assigned_at|owner/i.test(error.message || '')) {
        return res.status(503).json({ error: 'Lead ownership is not enabled yet — the database update (migration 010) still needs to be applied.' });
      }
      throw error;
    }

    await logLeadChanges({
      companyId: req.companyId,
      leadId: req.params.id,
      before: { owner_id: before.owner_id },
      after: { owner_id: ownerId },
      actorUserId: req.dbUser?.id || null,
      actorType: 'user',
      actorLabel: req.dbUser?.full_name || req.dbUser?.email || null,
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── History ─────────────────────────────────────────────────────────────────
// GET /api/leads/:id/activities — the full handling timeline, visible to the
// whole company (not just the owner).
router.get('/:id/activities', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('lead_activities')
      .select('*, actor:actor_user_id (id, full_name, email, profile_picture)')
      .eq('lead_id', req.params.id)
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .limit(Math.min(300, Number(req.query.limit) || 100));
    // Before migration 010 the table does not exist — show an empty timeline
    // rather than an error page.
    if (error) {
      if (/lead_activities|relation|does not exist/i.test(error.message || '')) return res.json([]);
      throw error;
    }
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/:id/activities — add a manual note to the timeline.
router.post('/:id/activities', requireAuth, async (req, res) => {
  try {
    const summary = String(req.body?.summary || '').trim();
    if (!summary) return res.status(400).json({ error: 'summary is required' });

    // The lead id came straight from the URL and was written as a foreign key with
    // no check, so a caller could stamp timeline rows against another tenant's lead
    // ids. Nothing leaks back, but forged history is still forged history.
    const { data: lead, error: findErr } = await supabaseAdmin
      .from('leads').select('id')
      .eq('id', req.params.id).eq('company_id', req.companyId).maybeSingle();
    if (findErr) return res.status(503).json({ error: 'Could not verify that lead.' });
    if (!lead) return res.status(404).json({ error: 'Lead not found in this company.' });

    const entry = await logLeadActivity({
      companyId: req.companyId,
      leadId: req.params.id,
      activityType: req.body?.activity_type || LEAD_ACTIVITY_TYPES.NOTE,
      summary,
      details: req.body?.details || {},
      actorUserId: req.dbUser?.id || null,
      actorType: 'user',
      actorLabel: req.dbUser?.full_name || req.dbUser?.email || null,
    });
    if (!entry) throw new Error('Could not save the note');
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('leads')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/:id/score — AI-powered ICP lead scoring
router.post('/:id/score', requireAuth, async (req, res) => {
  try {
    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('api_keys, settings')
      .eq('id', req.companyId)
      .single();

    const icp_description = company?.settings?.icp_description;
    const target_audience = company?.settings?.target_audience;

    const prompt = `You are a B2B sales expert. Score this lead against the company's ICP.
Company ICP: ${icp_description || 'Not defined'}
Target Audience: ${target_audience || 'Not defined'}

Lead:
- Name: ${lead.lead_name || 'Unknown'}
- Company: ${lead.lead_company_name || 'Unknown'}
- Title: ${lead.role || 'Unknown'}
- Industry: ${lead.industry || 'Unknown'}
- Email: ${lead.email || ''}
- Website: ${lead.website || ''}
- Notes: ${lead.notes || ''}

Return JSON: { "score": 0-100, "fit": "high|medium|low", "reasoning": "...", "next_actions": ["..."] }`;

    // Use unified AI helper — supports bidirectional fallback between OpenAI and Anthropic
    const aiResult = await runAIChat({
      companyId: req.companyId,
      userId: req.dbUser?.id,
      userRole: req.dbUser?.role,
      userEmail: req.dbUser?.email,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      action: 'lead_scoring',
    });

    const result = JSON.parse(aiResult.content);

    // Save score to lead
    await supabaseAdmin
      .from('leads')
      .update({ icp_score: result.score, icp_reasoning: result.reasoning })
      .eq('id', req.params.id);

    res.json(result);
  } catch (err) {
    console.error('[leads/:id/score]', err.message);
    const status = err.code === 'MISSING_API_KEY' || err.code === 'AUTH' || err.code === 'QUOTA' ? 402 : 500;
    res.status(status).json({ error: err.publicMessage || err.message, code: err.code });
  }
});

export default router;
