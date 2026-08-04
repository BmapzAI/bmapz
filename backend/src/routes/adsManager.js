/**
 * Ads Manager API — the real campaign → ad group → ad hierarchy.
 *
 * Replaces the old "save a loose record" behaviour with a structured object
 * tree that can actually be created, edited, validated, published and optimised.
 *
 * Connected to the rest of the app:
 *   - Company Brain feeds every AI generation (runAIChat with the company's
 *     context, not a blank prompt)
 *   - generated work is written to ai_outputs so it appears in AI Outputs
 *   - platform leads can be handed to the sales team (single or bulk), which
 *     routes them through the same owner-assignment + lead history as everywhere
 */
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { runAIChat } from './ai.js';
import { publishCampaign, resolveCredentials, PublishError } from '../lib/adPublisher.js';
import { getPlatform, validateLevel, PLATFORM_KEYS } from '../lib/adPlatforms.js';
import { pickNextOwner } from '../lib/leadAssignment.js';
import { logLeadActivity, LEAD_ACTIVITY_TYPES } from '../lib/leadActivity.js';
import { createNotification } from '../lib/notify.js';

const router = Router();

const CAMPAIGN_FIELDS = ['platform', 'name', 'objective', 'status', 'budget', 'budget_type',
  'bid_strategy', 'starts_at', 'ends_at', 'timezone', 'settings', 'strategy'];
const GROUP_FIELDS = ['campaign_id', 'name', 'status', 'targeting', 'optimization_goal',
  'bid_amount', 'budget', 'budget_type', 'starts_at', 'ends_at', 'settings'];
const AD_FIELDS = ['ad_group_id', 'name', 'status', 'format', 'headline', 'primary_text',
  'description', 'call_to_action', 'destination_url', 'display_url', 'media_urls', 'copy_data', 'settings'];

const NUMERIC = new Set(['budget', 'bid_amount']);
const TIMESTAMP = new Set(['starts_at', 'ends_at']);

/** Keep only known columns and coerce empty strings, which Postgres rejects. */
const pick = (body, fields) => {
  const out = {};
  for (const f of fields) {
    if (!(f in (body || {}))) continue;
    let v = body[f];
    if (TIMESTAMP.has(f) && (v === '' || v === undefined)) v = null;
    if (NUMERIC.has(f)) {
      if (v === '' || v === undefined || v === null) v = null;
      else { const n = Number(String(v).replace(/[^0-9.-]/g, '')); v = Number.isFinite(n) ? n : null; }
    }
    out[f] = v;
  }
  return out;
};

const scoped = (table) => (id, companyId) =>
  supabaseAdmin.from(table).select('*').eq('id', id).eq('company_id', companyId).maybeSingle();

/* ───────────────────────── Platform metadata ───────────────────────── */

// GET /api/ads-manager/platforms — spec + whether each is really connected.
router.get('/platforms', requireAuth, async (req, res) => {
  try {
    const { data: co } = await supabaseAdmin.from('companies').select('api_keys').eq('id', req.companyId).single();
    const apiKeys = co?.api_keys || {};
    const platforms = PLATFORM_KEYS.map(key => {
      let connected = true; let reason = null;
      try { resolveCredentials(key, apiKeys); } catch (e) { connected = false; reason = e.message; }
      return { ...getPlatform(key), connected, reason };
    });
    res.json(platforms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ───────────────────────── Campaign tree ───────────────────────── */

// GET /api/ads-manager/campaigns — every campaign with its groups and ads.
router.get('/campaigns', requireAuth, async (req, res) => {
  try {
    let q = supabaseAdmin.from('ad_campaigns').select('*')
      .eq('company_id', req.companyId).order('created_at', { ascending: false });
    if (req.query.platform) q = q.eq('platform', req.query.platform);
    if (req.query.status) q = q.eq('status', req.query.status);
    const { data: campaigns, error } = await q;
    if (error) throw error;
    if (!campaigns?.length) return res.json([]);

    const ids = campaigns.map(c => c.id);
    const { data: groups } = await supabaseAdmin.from('ad_groups').select('*')
      .in('campaign_id', ids).order('created_at', { ascending: true });
    const groupIds = (groups || []).map(g => g.id);
    const { data: ads } = groupIds.length
      ? await supabaseAdmin.from('ads').select('*').in('ad_group_id', groupIds).order('created_at', { ascending: true })
      : { data: [] };

    const tree = campaigns.map(c => ({
      ...c,
      ad_groups: (groups || []).filter(g => g.campaign_id === c.id).map(g => ({
        ...g,
        ads: (ads || []).filter(a => a.ad_group_id === g.id),
      })),
    }));
    res.json(tree);
  } catch (err) {
    // Before migration 015 the tables do not exist — say so plainly.
    if (/ad_campaigns|ad_groups|relation .* does not exist/i.test(err.message || '')) {
      return res.status(503).json({ error: 'The Ads tables are not created yet — run migration 015.', code: 'MIGRATION_PENDING' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/campaigns', requireAuth, async (req, res) => {
  try {
    const payload = pick(req.body, CAMPAIGN_FIELDS);
    if (!payload.platform || !getPlatform(payload.platform)) return res.status(400).json({ error: 'Choose a valid ad platform.' });
    if (!payload.name?.trim()) return res.status(400).json({ error: 'The campaign needs a name.' });

    // Building FROM a strategy: inherit it, and let its audience segments become
    // the starting ad groups so the hierarchy actually follows the plan.
    let strategy = payload.strategy;
    if (req.body?.strategy_id && !strategy) {
      const { data: fromCampaign } = await supabaseAdmin.from('ad_campaigns')
        .select('strategy').eq('id', req.body.strategy_id).eq('company_id', req.companyId).maybeSingle();
      if (fromCampaign?.strategy) strategy = fromCampaign.strategy;
      if (!strategy) {
        const { data: fromRecord } = await supabaseAdmin.from('ad_records')
          .select('strategy').eq('id', req.body.strategy_id).eq('company_id', req.companyId).maybeSingle();
        if (fromRecord?.strategy) strategy = fromRecord.strategy;
      }
    }
    if (strategy) payload.strategy = strategy;

    const { data, error } = await supabaseAdmin.from('ad_campaigns')
      .insert({ ...payload, company_id: req.companyId, created_by: req.dbUser?.id || null })
      .select().single();
    if (error) throw error;

    const groups = [];
    if (strategy && req.body?.scaffold_from_strategy !== false) {
      const segments = Array.isArray(strategy.audience_segments) ? strategy.audience_segments.slice(0, 5) : [];
      for (const seg of segments) {
        const { data: g } = await supabaseAdmin.from('ad_groups').insert({
          company_id: req.companyId, campaign_id: data.id,
          name: seg.name || 'Audience', status: 'draft',
          targeting: {}, strategy_notes: seg.message || seg.who || null,
        }).select().single();
        if (g) groups.push({ ...g, ads: [] });
      }
    }

    res.json({ ...data, ad_groups: groups });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/campaigns/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('ad_campaigns')
      .update({ ...pick(req.body, CAMPAIGN_FIELDS), updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('company_id', req.companyId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/campaigns/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('ad_campaigns')
      .delete().eq('id', req.params.id).eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ───────────────────────── Ad groups ───────────────────────── */

router.post('/ad-groups', requireAuth, async (req, res) => {
  try {
    const payload = pick(req.body, GROUP_FIELDS);
    if (!payload.campaign_id) return res.status(400).json({ error: 'An ad group must belong to a campaign.' });
    const { data: parent } = await scoped('ad_campaigns')(payload.campaign_id, req.companyId);
    if (!parent) return res.status(404).json({ error: 'Campaign not found.' });
    const { data, error } = await supabaseAdmin.from('ad_groups')
      .insert({ ...payload, company_id: req.companyId }).select().single();
    if (error) throw error;
    res.json({ ...data, ads: [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/ad-groups/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('ad_groups')
      .update({ ...pick(req.body, GROUP_FIELDS), updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('company_id', req.companyId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/ad-groups/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('ad_groups')
      .delete().eq('id', req.params.id).eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ───────────────────────── Ads ───────────────────────── */

router.post('/ads', requireAuth, async (req, res) => {
  try {
    const payload = pick(req.body, AD_FIELDS);
    if (!payload.ad_group_id) return res.status(400).json({ error: 'An ad must belong to an ad group.' });
    const { data: parent } = await scoped('ad_groups')(payload.ad_group_id, req.companyId);
    if (!parent) return res.status(404).json({ error: 'Ad group not found.' });
    const { data, error } = await supabaseAdmin.from('ads')
      .insert({ ...payload, company_id: req.companyId }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/ads/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('ads')
      .update({ ...pick(req.body, AD_FIELDS), updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('company_id', req.companyId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/ads/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('ads')
      .delete().eq('id', req.params.id).eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ───────────────────────── Validate & publish ───────────────────────── */

async function loadTree(campaignId, companyId) {
  const { data: campaign } = await scoped('ad_campaigns')(campaignId, companyId);
  if (!campaign) return null;
  const { data: groups } = await supabaseAdmin.from('ad_groups').select('*').eq('campaign_id', campaign.id);
  const groupIds = (groups || []).map(g => g.id);
  const { data: ads } = groupIds.length
    ? await supabaseAdmin.from('ads').select('*').in('ad_group_id', groupIds)
    : { data: [] };
  return {
    campaign,
    adGroups: (groups || []).map(g => ({ ...g, ads: (ads || []).filter(a => a.ad_group_id === g.id) })),
  };
}

// POST /api/ads-manager/campaigns/:id/validate — what would block publishing.
router.post('/campaigns/:id/validate', requireAuth, async (req, res) => {
  try {
    const tree = await loadTree(req.params.id, req.companyId);
    if (!tree) return res.status(404).json({ error: 'Campaign not found.' });
    const levels = req.body?.levels || { campaign: true, ad_groups: true, ads: true };
    const problems = [];

    if (levels.campaign) {
      validateLevel('campaign', tree.campaign, tree.campaign.platform)
        .forEach(m => problems.push({ level: 'campaign', name: tree.campaign.name, message: m }));
    }
    for (const g of tree.adGroups) {
      if (levels.ad_groups) {
        validateLevel('ad_group', g, tree.campaign.platform)
          .forEach(m => problems.push({ level: 'ad_group', name: g.name, message: m }));
      }
      if (levels.ads) {
        for (const ad of g.ads) {
          validateLevel('ad', ad, tree.campaign.platform)
            .forEach(m => problems.push({ level: 'ad', name: ad.name, message: m }));
        }
      }
    }

    // Connection is part of "can this publish?"
    let connected = true; let connectionMessage = null;
    try {
      const { data: co } = await supabaseAdmin.from('companies').select('api_keys').eq('id', req.companyId).single();
      resolveCredentials(tree.campaign.platform, co?.api_keys || {});
    } catch (e) { connected = false; connectionMessage = e.message; }

    res.json({ ok: problems.length === 0 && connected, problems, connected, connectionMessage });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/ads-manager/campaigns/:id/publish
// Body: { levels: { campaign, ad_groups, ads } }
router.post('/campaigns/:id/publish', requireAuth, async (req, res) => {
  try {
    const tree = await loadTree(req.params.id, req.companyId);
    if (!tree) return res.status(404).json({ error: 'Campaign not found.' });
    const levels = {
      campaign: !!req.body?.levels?.campaign,
      ad_groups: !!req.body?.levels?.ad_groups,
      ads: !!req.body?.levels?.ads,
    };
    if (!levels.campaign && !levels.ad_groups && !levels.ads) {
      return res.status(400).json({ error: 'Choose at least one level to publish.' });
    }

    const out = await publishCampaign({
      companyId: req.companyId,
      campaign: tree.campaign,
      adGroups: tree.adGroups,
      levels,
      userId: req.dbUser?.id || null,
    });

    await createNotification({
      companyId: req.companyId,
      type: 'ads',
      icon: out.failed ? '⚠️' : '🚀',
      priority: out.failed ? 'high' : 'normal',
      title: out.failed
        ? `Ads publish finished with ${out.failed} problem(s)`
        : `Published ${out.published} item(s) to ${getPlatform(tree.campaign.platform)?.short}`,
      body: `Campaign "${tree.campaign.name}".`,
      link: '/Ads',
    });

    res.json(out);
  } catch (err) {
    const status = err instanceof PublishError && err.code === 'NOT_CONNECTED' ? 409 : 500;
    res.status(status).json({ error: err.message, code: err.code });
  }
});

/* ───────────────────────── AI generation (Company Brain) ───────────────────────── */

async function companyContext(companyId) {
  const { data: c } = await supabaseAdmin.from('companies')
    .select('name, industry, services_description, value_propositions, icp, briefing')
    .eq('id', companyId).single();
  const icp = c?.icp || {};
  const b = c?.briefing || {};
  return [
    `Company: ${c?.name || 'n/a'}`,
    `Industry: ${c?.industry || 'n/a'}`,
    `What they sell: ${c?.services_description || 'n/a'}`,
    `Value propositions: ${(c?.value_propositions || []).join('; ') || 'n/a'}`,
    `Ideal customer: ${icp.primary_audience || (icp.job_titles || []).join(', ') || 'n/a'}`,
    `Pain points: ${(icp.pain_points || []).join('; ') || 'n/a'}`,
    `Tone of voice: ${(b.tone_of_voice || []).join(', ') || 'professional'}`,
  ].join('\n');
}

/** Persist AI work so it also shows up in the AI Outputs section. */
async function saveOutput(companyId, userId, title, content, action) {
  try {
    await supabaseAdmin.from('ai_outputs').insert({
      company_id: companyId, created_by: userId || null,
      type: 'ads', title, content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
      metadata: { action },
    });
  } catch (err) { console.error('[adsManager] saveOutput failed:', err.message); }
}

// POST /api/ads-manager/generate — build a whole campaign from a short brief.
// Body: { platform, objective, budget, product, audience, goal_notes }
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const platform = getPlatform(req.body?.platform);
    if (!platform) return res.status(400).json({ error: 'Choose an ad platform first.' });

    const ctx = await companyContext(req.companyId);
    const schema = {
      type: 'object',
      required: ['campaign'],
      properties: {
        campaign: {
          type: 'object',
          required: ['name', 'objective', 'ad_groups'],
          properties: {
            name: { type: 'string' },
            objective: { type: 'string', enum: platform.objectives.map(o => o.key) },
            rationale: { type: 'string' },
            ad_groups: {
              type: 'array',
              items: {
                type: 'object',
                required: ['name', 'targeting', 'ads'],
                properties: {
                  name: { type: 'string' },
                  optimization_goal: { type: 'string', enum: platform.optimizationGoals.map(o => o.key) },
                  targeting: {
                    type: 'object',
                    properties: {
                      locations: { type: 'array', items: { type: 'string' } },
                      interests: { type: 'array', items: { type: 'string' } },
                      keywords: { type: 'array', items: { type: 'string' } },
                      job_titles: { type: 'array', items: { type: 'string' } },
                      age: { type: 'array', items: { type: 'number' } },
                    },
                  },
                  ads: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['name', 'format'],
                      properties: {
                        name: { type: 'string' },
                        format: { type: 'string', enum: platform.formats.map(f => f.key) },
                        headline: { type: 'string' },
                        primary_text: { type: 'string' },
                        description: { type: 'string' },
                        call_to_action: { type: 'string', enum: platform.callToActions },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const limits = platform.copyFields.map(f => `${f.label} max ${f.max} characters`).join('; ');
    const result = await runAIChat({
      companyId: req.companyId,
      userId: req.dbUser?.id,
      userRole: req.dbUser?.role || 'user',
      userEmail: req.dbUser?.email,
      action: 'ads_generate',
      response_format: { type: 'json_object' },
      temperature: 0.6,
      system: `You are a senior performance marketer building a ready-to-launch ${platform.label} campaign.
Structure it exactly as ${platform.levels.campaign} → ${platform.levels.ad_group} → ${platform.levels.ad}.
Create 2-3 ${platform.levels.ad_group.toLowerCase()}s, each targeting a genuinely DIFFERENT audience angle, and 2 ads each.
Respect these limits strictly: ${limits}.
Return ONLY JSON matching this schema, using these exact key names:
${JSON.stringify(schema)}`,
      messages: [{
        role: 'user',
        content: `${ctx}

Objective: ${req.body.objective || platform.objectives[0].key}
Budget: ${req.body.budget || 'not specified'} (${req.body.budget_type || 'daily'}, in the ad account's own currency)
Product/offer focus: ${req.body.product || 'the company\'s main offer'}
Audience notes: ${req.body.audience || 'use the ideal customer above'}
${req.body.goal_notes ? `Extra notes: ${req.body.goal_notes}` : ''}`,
      }],
    });

    let parsed;
    try { parsed = JSON.parse(result.content); }
    catch { return res.status(502).json({ error: 'The AI returned something we could not read. Try again.' }); }
    const plan = parsed.campaign || parsed;
    if (!plan?.ad_groups?.length) return res.status(502).json({ error: 'The AI did not return any ad groups. Try again.' });

    await saveOutput(req.companyId, req.dbUser?.id, `Ads plan — ${plan.name || 'campaign'}`, parsed, 'ads_generate');
    res.json({ plan, usage: result.usage });
  } catch (err) {
    const status = err.code === 'CREDITS_EXHAUSTED' || err.code === 'MISSING_API_KEY' ? 402 : 500;
    res.status(status).json({ error: err.publicMessage || err.message, code: err.code });
  }
});

// POST /api/ads-manager/generate/apply — persist a generated plan as real rows.
router.post('/generate/apply', requireAuth, async (req, res) => {
  try {
    const { plan, platform, budget, budget_type, starts_at, ends_at, timezone } = req.body || {};
    const spec = getPlatform(platform);
    if (!spec || !plan?.name) return res.status(400).json({ error: 'Nothing to apply.' });

    const { data: campaign, error: cErr } = await supabaseAdmin.from('ad_campaigns').insert({
      company_id: req.companyId, platform: spec.key, name: plan.name,
      objective: plan.objective || spec.objectives[0].key, status: 'draft',
      budget: budget ?? null, budget_type: budget_type || 'daily',
      starts_at: starts_at || null, ends_at: ends_at || null, timezone: timezone || null,
      strategy: { rationale: plan.rationale || '', generated: true },
      created_by: req.dbUser?.id || null,
    }).select().single();
    if (cErr) throw cErr;

    const groups = [];
    for (const g of plan.ad_groups || []) {
      const { data: group } = await supabaseAdmin.from('ad_groups').insert({
        company_id: req.companyId, campaign_id: campaign.id, name: g.name, status: 'draft',
        targeting: g.targeting || {}, optimization_goal: g.optimization_goal || null,
      }).select().single();
      if (!group) continue;
      const ads = [];
      for (const a of g.ads || []) {
        const { data: ad } = await supabaseAdmin.from('ads').insert({
          company_id: req.companyId, ad_group_id: group.id, name: a.name, status: 'draft',
          format: a.format || spec.formats[0].key,
          headline: a.headline || null, primary_text: a.primary_text || null,
          description: a.description || null, call_to_action: a.call_to_action || null,
          copy_data: a,
        }).select().single();
        if (ad) ads.push(ad);
      }
      groups.push({ ...group, ads });
    }

    res.json({ ...campaign, ad_groups: groups });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ─────────── Strategy: the TOP of the hierarchy, attached to a campaign ─────────── */

// GET /api/ads-manager/strategies — every strategy available to build from:
// ones saved by the Strategy generator, and ones already attached to a campaign.
router.get('/strategies', requireAuth, async (req, res) => {
  try {
    const out = [];

    // Saved by the Strategy tab (legacy ad_records, type = 'strategy').
    try {
      const { data: records } = await supabaseAdmin.from('ad_records')
        .select('id, title, platform, objective, strategy, form_data, created_at')
        .eq('company_id', req.companyId).eq('type', 'strategy')
        .order('created_at', { ascending: false }).limit(50);
      for (const r of records || []) {
        if (!r.strategy || !Object.keys(r.strategy).length) continue;
        out.push({
          id: r.id, source: 'saved', title: r.title, platform: r.platform,
          objective: r.objective, strategy: r.strategy, created_at: r.created_at,
        });
      }
    } catch { /* legacy table may be empty */ }

    // Attached to an existing campaign — reusable for a new one.
    try {
      const { data: campaigns } = await supabaseAdmin.from('ad_campaigns')
        .select('id, name, platform, objective, strategy, created_at')
        .eq('company_id', req.companyId).order('created_at', { ascending: false }).limit(50);
      for (const c of campaigns || []) {
        if (!c.strategy || !Object.keys(c.strategy).length) continue;
        out.push({
          id: c.id, source: 'campaign', title: `${c.name} (current strategy)`,
          platform: c.platform, objective: c.objective, strategy: c.strategy, created_at: c.created_at,
        });
      }
    } catch { /* before migration 015 */ }

    res.json(out);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/ads-manager/campaigns/:id/strategy
// Generates the thinking that governs everything beneath the campaign, and
// stores it on the campaign so ad groups and copy can inherit it.
router.post('/campaigns/:id/strategy', requireAuth, async (req, res) => {
  try {
    const { data: campaign } = await scoped('ad_campaigns')(req.params.id, req.companyId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    const spec = getPlatform(campaign.platform);
    const ctx = await companyContext(req.companyId);

    const schema = {
      type: 'object',
      required: ['positioning', 'unique_mechanism', 'angles', 'funnel', 'kpis'],
      properties: {
        positioning: { type: 'string' },
        unique_mechanism: { type: 'string' },
        angles: { type: 'array', items: { type: 'string' } },
        audience_segments: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'who', 'message'],
            properties: { name: { type: 'string' }, who: { type: 'string' }, message: { type: 'string' } },
          },
        },
        funnel: {
          type: 'object',
          properties: {
            tof: { type: 'string' }, mof: { type: 'string' }, bof: { type: 'string' },
            budget_split: { type: 'string' },
          },
        },
        creative_direction: { type: 'string' },
        kpis: {
          type: 'object',
          properties: {
            primary: { type: 'string' }, target_cpa: { type: 'string' },
            break_even_roas: { type: 'string' }, scaling_trigger: { type: 'string' },
          },
        },
      },
    };

    const result = await runAIChat({
      companyId: req.companyId, userId: req.dbUser?.id,
      userRole: req.dbUser?.role || 'user', userEmail: req.dbUser?.email,
      action: 'ads_strategy', response_format: { type: 'json_object' }, temperature: 0.5,
      system: `You are a senior performance marketing strategist writing the strategy that will govern a ${spec?.label} campaign.
Everything below this campaign — its ${spec?.levels.ad_group.toLowerCase()}s and ${spec?.levels.ad.toLowerCase()}s — must follow from what you write.
Give each audience segment a distinct message so it can become its own ${spec?.levels.ad_group.toLowerCase()}.
Return ONLY JSON with these exact keys: ${JSON.stringify(schema)}`,
      messages: [{
        role: 'user',
        content: `${ctx}

Campaign: ${campaign.name}
Objective: ${campaign.objective || 'not set'}
Budget: ${campaign.budget || 'not set'} (${campaign.budget_type})
${req.body?.notes ? `Extra notes: ${req.body.notes}` : ''}`,
      }],
    });

    let strategy;
    try { strategy = JSON.parse(result.content); }
    catch { return res.status(502).json({ error: 'The AI returned something we could not read. Try again.' }); }

    const { data: saved, error } = await supabaseAdmin.from('ad_campaigns')
      .update({ strategy, updated_at: new Date().toISOString() })
      .eq('id', campaign.id).eq('company_id', req.companyId).select().single();
    if (error) throw error;

    await saveOutput(req.companyId, req.dbUser?.id, `Ads strategy — ${campaign.name}`, strategy, 'ads_strategy');
    res.json({ campaign: saved, strategy, usage: result.usage });
  } catch (err) {
    const status = err.code === 'CREDITS_EXHAUSTED' || err.code === 'MISSING_API_KEY' ? 402 : 500;
    res.status(status).json({ error: err.publicMessage || err.message, code: err.code });
  }
});

/* ─────────── Each level builds the one below it ─────────── */

// POST /api/ads-manager/campaigns/:id/ad-groups/generate
// Ad groups come FROM the campaign (and its strategy).
router.post('/campaigns/:id/ad-groups/generate', requireAuth, async (req, res) => {
  try {
    const { data: campaign } = await scoped('ad_campaigns')(req.params.id, req.companyId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    const spec = getPlatform(campaign.platform);
    const ctx = await companyContext(req.companyId);

    const targetingKeys = spec.targeting;
    const result = await runAIChat({
      companyId: req.companyId, userId: req.dbUser?.id,
      userRole: req.dbUser?.role || 'user', userEmail: req.dbUser?.email,
      action: 'ads_adgroups', response_format: { type: 'json_object' }, temperature: 0.6,
      system: `You are building the ${spec.levels.ad_group.toLowerCase()}s for an existing ${spec.label} campaign.
Each one must target a genuinely DIFFERENT audience so they do not compete with each other.
Only use these targeting keys: ${targetingKeys.join(', ')}.
Return ONLY JSON: {"ad_groups":[{"name":"","strategy_notes":"","optimization_goal":"","targeting":{}}]}`,
      messages: [{
        role: 'user',
        content: `${ctx}

CAMPAIGN: ${campaign.name}
Objective: ${campaign.objective || 'not set'}
STRATEGY GOVERNING IT: ${campaign.strategy && Object.keys(campaign.strategy).length ? JSON.stringify(campaign.strategy).slice(0, 2500) : 'none written yet — infer from the company context'}
Optimisation goals allowed: ${spec.optimizationGoals.map(o => o.key).join(', ')}
Create ${req.body?.count || 3} ${spec.levels.ad_group.toLowerCase()}s.`,
      }],
    });

    let parsed;
    try { parsed = JSON.parse(result.content); } catch { return res.status(502).json({ error: 'The AI returned something we could not read.' }); }
    const created = [];
    for (const g of (parsed.ad_groups || []).slice(0, 6)) {
      const { data } = await supabaseAdmin.from('ad_groups').insert({
        company_id: req.companyId, campaign_id: campaign.id,
        name: g.name || 'Audience', status: 'draft',
        targeting: g.targeting || {}, optimization_goal: g.optimization_goal || null,
        strategy_notes: g.strategy_notes || null,
      }).select().single();
      if (data) created.push({ ...data, ads: [] });
    }
    res.json({ ad_groups: created });
  } catch (err) {
    const status = err.code === 'CREDITS_EXHAUSTED' || err.code === 'MISSING_API_KEY' ? 402 : 500;
    res.status(status).json({ error: err.publicMessage || err.message, code: err.code });
  }
});

// POST /api/ads-manager/ad-groups/:id/ads/generate
// Ads come FROM the ad group (its audience) and the campaign above it.
router.post('/ad-groups/:id/ads/generate', requireAuth, async (req, res) => {
  try {
    const { data: group } = await scoped('ad_groups')(req.params.id, req.companyId);
    if (!group) return res.status(404).json({ error: 'Ad group not found.' });
    const { data: campaign } = await scoped('ad_campaigns')(group.campaign_id, req.companyId);
    const spec = getPlatform(campaign?.platform);
    if (!spec) return res.status(404).json({ error: 'This ad group has no campaign above it.' });
    const ctx = await companyContext(req.companyId);

    const result = await runAIChat({
      companyId: req.companyId, userId: req.dbUser?.id,
      userRole: req.dbUser?.role || 'user', userEmail: req.dbUser?.email,
      action: 'ads_ads', response_format: { type: 'json_object' }, temperature: 0.7,
      system: `You are creating ${spec.label} ${spec.levels.ad.toLowerCase()}s for one specific audience.
HARD LIMITS: ${spec.copyFields.map(f => `${f.key} max ${f.max}`).join('; ')}.
Formats allowed: ${spec.formats.map(f => f.key).join(', ')}. Calls to action allowed: ${spec.callToActions.join(', ')}.
Return ONLY JSON: {"ads":[{"name":"","format":"","call_to_action":"",${spec.copyFields.map(f => `"${f.key}":""`).join(',')}}]}`,
      messages: [{
        role: 'user',
        content: `${ctx}

CAMPAIGN: ${campaign.name} (objective ${campaign.objective || 'not set'})
STRATEGY: ${campaign.strategy && Object.keys(campaign.strategy).length ? JSON.stringify(campaign.strategy).slice(0, 1800) : 'none'}
THIS AD GROUP: ${group.name}
Its audience: ${JSON.stringify(group.targeting || {})}
${group.strategy_notes ? `Its role: ${group.strategy_notes}` : ''}
Create ${req.body?.count || 2} ads with different angles.`,
      }],
    });

    let parsed;
    try { parsed = JSON.parse(result.content); } catch { return res.status(502).json({ error: 'The AI returned something we could not read.' }); }
    const created = [];
    for (const a of (parsed.ads || []).slice(0, 5)) {
      const row = {
        company_id: req.companyId, ad_group_id: group.id,
        name: a.name || 'Ad', status: 'draft',
        format: spec.formats.some(f => f.key === a.format) ? a.format : spec.formats[0].key,
        call_to_action: spec.callToActions.includes(a.call_to_action) ? a.call_to_action : spec.callToActions[0],
        copy_data: a, copy_source: 'ai',
      };
      for (const f of spec.copyFields) {
        if (typeof a[f.key] === 'string' && ['headline', 'primary_text', 'description'].includes(f.key)) {
          row[f.key] = a[f.key].slice(0, f.max);
        }
      }
      const { data } = await supabaseAdmin.from('ads').insert(row).select().single();
      if (data) created.push(data);
    }
    res.json({ ads: created });
  } catch (err) {
    const status = err.code === 'CREDITS_EXHAUSTED' || err.code === 'MISSING_API_KEY' ? 402 : 500;
    res.status(status).json({ error: err.publicMessage || err.message, code: err.code });
  }
});

/* ─────────── Copy: the BOTTOM of the hierarchy, written for one ad ─────────── */

// POST /api/ads-manager/ads/:id/copy
// Inherits the campaign's strategy and the ad group's targeting, and respects
// the platform's real character limits, then writes the copy onto the ad.
router.post('/ads/:id/copy', requireAuth, async (req, res) => {
  try {
    const { data: ad } = await scoped('ads')(req.params.id, req.companyId);
    if (!ad) return res.status(404).json({ error: 'Ad not found.' });
    const { data: group } = await scoped('ad_groups')(ad.ad_group_id, req.companyId);
    const { data: campaign } = group ? await scoped('ad_campaigns')(group.campaign_id, req.companyId) : { data: null };
    if (!campaign) return res.status(404).json({ error: 'This ad has no campaign above it.' });

    const spec = getPlatform(campaign.platform);
    const ctx = await companyContext(req.companyId);
    const fields = spec.copyFields;

    const props = {};
    for (const f of fields) props[f.key] = { type: 'string' };
    const schema = {
      type: 'object',
      required: ['variants'],
      properties: {
        variants: {
          type: 'array',
          items: {
            type: 'object',
            required: fields.filter(f => f.required).map(f => f.key),
            properties: { ...props, angle: { type: 'string' } },
          },
        },
      },
    };

    const result = await runAIChat({
      companyId: req.companyId, userId: req.dbUser?.id,
      userRole: req.dbUser?.role || 'user', userEmail: req.dbUser?.email,
      action: 'ads_copy', response_format: { type: 'json_object' }, temperature: 0.7,
      system: `You are writing ${spec.label} ad copy for ONE specific ad, inside an existing plan.
Stay consistent with the campaign strategy and speak to THIS ad group's audience.
HARD LIMITS — never exceed them: ${fields.map(f => `${f.label} (${f.key}) max ${f.max} characters`).join('; ')}.
Write ${req.body?.count || 3} distinct variants with genuinely different angles.
Return ONLY JSON with these exact keys: ${JSON.stringify(schema)}`,
      messages: [{
        role: 'user',
        content: `${ctx}

CAMPAIGN (top of the hierarchy): ${campaign.name} — objective ${campaign.objective || 'not set'}
STRATEGY: ${campaign.strategy && Object.keys(campaign.strategy).length ? JSON.stringify(campaign.strategy).slice(0, 2500) : 'no strategy written yet — infer a sensible one from the company context'}

AD GROUP (who will see this): ${group?.name}
Targeting: ${JSON.stringify(group?.targeting || {})}
${group?.strategy_notes ? `Role in the strategy: ${group.strategy_notes}` : ''}

THIS AD: ${ad.name} — format ${ad.format || spec.formats[0].key}
Landing page: ${ad.destination_url || 'not set'}
${req.body?.notes ? `Extra notes: ${req.body.notes}` : ''}`,
      }],
    });

    let parsed;
    try { parsed = JSON.parse(result.content); }
    catch { return res.status(502).json({ error: 'The AI returned something we could not read. Try again.' }); }
    const variants = (parsed.variants || []).filter(Boolean);
    if (!variants.length) return res.status(502).json({ error: 'The AI did not return any copy. Try again.' });

    // Trim to the platform's limits so nothing can be rejected at publish time.
    for (const v of variants) {
      for (const f of fields) {
        if (typeof v[f.key] === 'string' && f.max) v[f.key] = v[f.key].slice(0, f.max);
      }
    }

    await saveOutput(req.companyId, req.dbUser?.id, `Ad copy — ${ad.name}`, variants, 'ads_copy');
    res.json({ variants, applied: false, usage: result.usage });
  } catch (err) {
    const status = err.code === 'CREDITS_EXHAUSTED' || err.code === 'MISSING_API_KEY' ? 402 : 500;
    res.status(status).json({ error: err.publicMessage || err.message, code: err.code });
  }
});

// POST /api/ads-manager/ads/:id/copy/apply — put a chosen variant on the ad.
router.post('/ads/:id/copy/apply', requireAuth, async (req, res) => {
  try {
    const variant = req.body?.variant;
    if (!variant) return res.status(400).json({ error: 'Choose a variant first.' });
    const { data: ad } = await scoped('ads')(req.params.id, req.companyId);
    if (!ad) return res.status(404).json({ error: 'Ad not found.' });

    const patch = { copy_data: variant, copy_source: 'ai', updated_at: new Date().toISOString() };
    for (const k of ['headline', 'primary_text', 'description']) {
      if (typeof variant[k] === 'string') patch[k] = variant[k];
    }
    // Editing a live ad means it no longer matches what is on the platform.
    if (ad.publish_state === 'published') patch.publish_state = 'out_of_sync';

    const { data, error } = await supabaseAdmin.from('ads')
      .update(patch).eq('id', ad.id).eq('company_id', req.companyId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ───────────────────────── Optimize (not just budget) ───────────────────────── */

// POST /api/ads-manager/optimize — full-funnel review, not only budget moves.
router.post('/optimize', requireAuth, async (req, res) => {
  try {
    const tree = req.body?.campaign_id ? await loadTree(req.body.campaign_id, req.companyId) : null;
    const ctx = await companyContext(req.companyId);
    const perf = req.body?.performance || null;

    const schema = {
      type: 'object',
      required: ['summary', 'recommendations'],
      properties: {
        summary: { type: 'string' },
        health_score: { type: 'number' },
        recommendations: {
          type: 'array',
          items: {
            type: 'object',
            required: ['category', 'title', 'why', 'how', 'impact', 'effort'],
            properties: {
              // Deliberately broad: the old version only ever moved budget.
              category: { type: 'string', enum: ['budget', 'targeting', 'creative', 'copy', 'bidding', 'structure', 'landing_page', 'measurement', 'schedule', 'audience_expansion'] },
              level: { type: 'string', enum: ['campaign', 'ad_group', 'ad', 'account'] },
              target: { type: 'string' },
              title: { type: 'string' },
              why: { type: 'string' },
              how: { type: 'string' },
              impact: { type: 'string', enum: ['high', 'medium', 'low'] },
              effort: { type: 'string', enum: ['low', 'medium', 'high'] },
              expected_effect: { type: 'string' },
            },
          },
        },
        tests_to_run: { type: 'array', items: { type: 'string' } },
        risks: { type: 'array', items: { type: 'string' } },
      },
    };

    const result = await runAIChat({
      companyId: req.companyId,
      userId: req.dbUser?.id,
      userRole: req.dbUser?.role || 'user',
      userEmail: req.dbUser?.email,
      action: 'ads_optimize',
      response_format: { type: 'json_object' },
      temperature: 0.4,
      system: `You are a senior performance marketer auditing an ad account.
Cover the WHOLE funnel, not just budget: targeting, creative, copy/messaging, bidding, account structure, landing page and conversion tracking, scheduling and audience expansion.
Give at most 8 recommendations, each concrete enough to act on today, ordered by expected impact. Never recommend something the data does not support; if data is missing, say what to measure first.
Return ONLY JSON with these exact keys: ${JSON.stringify(schema)}`,
      messages: [{
        role: 'user',
        content: `${ctx}

${tree ? `Campaign under review: ${JSON.stringify({
  platform: tree.campaign.platform,
  name: tree.campaign.name,
  objective: tree.campaign.objective,
  budget: tree.campaign.budget,
  budget_type: tree.campaign.budget_type,
  status: tree.campaign.status,
  ad_groups: tree.adGroups.map(g => ({
    name: g.name, targeting: g.targeting, optimization_goal: g.optimization_goal,
    ads: g.ads.map(a => ({ name: a.name, format: a.format, headline: a.headline, primary_text: a.primary_text, cta: a.call_to_action })),
  })),
}, null, 2)}` : 'No specific campaign selected — review the account setup generally.'}

${perf ? `Live performance data (last 30 days):\n${JSON.stringify(perf).slice(0, 4000)}` : 'No live performance data is connected yet — base the review on structure and best practice, and say clearly which recommendations need real data to confirm.'}`,
      }],
    });

    let parsed;
    try { parsed = JSON.parse(result.content); }
    catch { return res.status(502).json({ error: 'The AI returned something we could not read. Try again.' }); }

    await saveOutput(req.companyId, req.dbUser?.id, `Ads optimisation — ${tree?.campaign?.name || 'account'}`, parsed, 'ads_optimize');
    res.json({ ...parsed, usage: result.usage });
  } catch (err) {
    const status = err.code === 'CREDITS_EXHAUSTED' || err.code === 'MISSING_API_KEY' ? 402 : 500;
    res.status(status).json({ error: err.publicMessage || err.message, code: err.code });
  }
});

/* ───────────────────────── Hand leads to sales ───────────────────────── */

// GET/PATCH /api/ads-manager/settings — the automatic hand-over switch.
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const { data } = await supabaseAdmin.from('companies')
      .select('ads_auto_handover').eq('id', req.companyId).maybeSingle();
    res.json({ ads_auto_handover: !!data?.ads_auto_handover });
  } catch {
    // Column missing before migration 016 — treat as off.
    res.json({ ads_auto_handover: false });
  }
});

router.patch('/settings', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('companies')
      .update({ ads_auto_handover: !!req.body?.ads_auto_handover })
      .eq('id', req.companyId).select('ads_auto_handover').single();
    if (error) {
      if (/ads_auto_handover/i.test(error.message || '')) {
        return res.status(503).json({ error: 'Automatic hand-over is not enabled yet — run migration 016.' });
      }
      throw error;
    }
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * Hand one lead to sales using the company's routing rules. Shared by the manual
 * button and by automatic hand-over so both behave identically.
 */
export async function handOneLeadToSales({ companyId, leadId, ownerId = null, actorUserId = null, actorLabel = null, automatic = false }) {
  let owner = ownerId;
  if (!owner) {
    const next = await pickNextOwner(companyId);
    owner = next?.id || null;
  }
  const patch = { funnel_stage: 'sql', status: 'qualified' };
  if (owner) { patch.owner_id = owner; patch.owner_assigned_at = new Date().toISOString(); }
  await supabaseAdmin.from('leads').update(patch).eq('id', leadId).eq('company_id', companyId);

  await logLeadActivity({
    companyId, leadId,
    activityType: LEAD_ACTIVITY_TYPES.HANDOVER,
    summary: automatic
      ? (owner ? 'Automatically handed to the sales team on arrival from Ads' : 'Arrived from Ads — nobody online, queued for the SDR')
      : (owner ? 'Handed to the sales team from Ads' : 'Handed to sales from Ads — nobody online, left for the SDR'),
    details: { source: 'ads', automatic },
    actorUserId: automatic ? null : actorUserId,
    actorType: automatic ? 'system' : 'user',
    actorLabel: automatic ? 'Ads auto hand-over' : actorLabel,
  });
  return owner;
}

/** Whether this company wants ad leads handed over automatically. */
export async function autoHandoverEnabled(companyId) {
  try {
    const { data } = await supabaseAdmin.from('companies')
      .select('ads_auto_handover').eq('id', companyId).maybeSingle();
    return !!data?.ads_auto_handover;
  } catch { return false; }
}

// POST /api/ads-manager/leads/handover — single or bulk, into the normal
// owner-assignment + lead-history pipeline used everywhere else.
router.post('/leads/handover', requireAuth, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.lead_ids) ? req.body.lead_ids : [req.body?.lead_id].filter(Boolean);
    if (!ids.length) return res.status(400).json({ error: 'Select at least one lead.' });
    const ownerId = req.body?.owner_id || null;

    const handed = [];
    for (const id of ids) {
      const { data: lead } = await supabaseAdmin.from('leads').select('*')
        .eq('id', id).eq('company_id', req.companyId).maybeSingle();
      if (!lead) continue;

      await handOneLeadToSales({
        companyId: req.companyId,
        leadId: id,
        ownerId,
        actorUserId: req.dbUser?.id || null,
        actorLabel: req.dbUser?.full_name || req.dbUser?.email || null,
      });
      handed.push(id);
    }

    if (handed.length) {
      await createNotification({
        companyId: req.companyId, type: 'handover', icon: '🤝', priority: 'high',
        title: `${handed.length} ad lead(s) handed to sales`,
        body: 'Opened from the Ads section.', link: '/Sales',
      });
    }
    res.json({ handed: handed.length, lead_ids: handed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
