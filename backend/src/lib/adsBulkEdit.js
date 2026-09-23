/**
 * Bulk editing across campaigns, ad groups and ads.
 *
 * Modelled on what makes Google Ads Editor fast: you rarely want "set every budget
 * to 50". You want "raise these twelve budgets by 10%", "pause everything in this
 * campaign", or "swap Summer for Winter in every headline". So three operations —
 * set, adjust and replace — rather than a single overwrite.
 *
 * Platform-aware, because the platforms genuinely differ: Google has no ad-group
 * budget, so writing one there would store a value the publisher must then ignore.
 * Such a row is REPORTED as skipped with the reason rather than silently dropped —
 * a bulk edit that quietly does less than it claimed is how people lose an
 * afternoon.
 */
import { supabaseAdmin } from './supabase.js';
import { AD_PLATFORMS } from './adPlatforms.js';

export const LEVELS = {
  campaign: { table: 'ad_campaigns', parentKey: null, parentTable: null },
  ad_group: { table: 'ad_groups', parentKey: 'campaign_id', parentTable: 'ad_campaigns' },
  ad: { table: 'ads', parentKey: 'ad_group_id', parentTable: 'ad_groups' },
};

/** What a bulk edit may touch, per level. Deliberately narrower than the single-row PATCH. */
const EDITABLE = {
  campaign: new Set(['name', 'status', 'budget', 'budget_type', 'bid_strategy',
    'objective', 'starts_at', 'ends_at']),
  ad_group: new Set(['name', 'status', 'budget', 'budget_type', 'bid_amount',
    'optimization_goal', 'starts_at', 'ends_at', 'campaign_id']),
  ad: new Set(['name', 'status', 'headline', 'primary_text', 'description',
    'call_to_action', 'destination_url', 'display_url', 'ad_group_id']),
};

/** Fields carrying money or a bid, and therefore adjustable proportionally. */
const NUMERIC_FIELDS = new Set(['budget', 'bid_amount']);

/** Fields holding prose, and therefore find-and-replaceable. */
const TEXT_FIELDS = new Set(['name', 'headline', 'primary_text', 'description',
  'destination_url', 'display_url', 'call_to_action']);

const STATUSES = new Set(['draft', 'active', 'paused', 'archived', 'removed']);

/** Escape a user string so find-and-replace cannot smuggle in a regex. */
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Is this field meaningful for this row's platform?
 * Returns null when fine, or a human reason when it is not.
 */
export function platformObjection(level, field, platform) {
  const spec = AD_PLATFORMS[String(platform || '').toLowerCase()];
  if (!spec) return null; // unknown or multi-platform: do not invent a restriction

  const isBudget = field === 'budget' || field === 'budget_type';
  if (!isBudget) return null;

  const groupLabel = spec.levels?.ad_group || 'ad group';
  if (level === 'ad_group' && !spec.budgetLevels?.includes('ad_group')) {
    return `${spec.short || platform} sets budget on the campaign, not the ${groupLabel}`;
  }
  if (level === 'campaign' && !spec.budgetLevels?.includes('campaign')) {
    return `${spec.short || platform} sets budget on the ${groupLabel}, not the campaign`;
  }
  return null;
}

/** Apply one edit to one row: either a new value, or a reason it was skipped. */
export function applyEdit(row, edit) {
  const { field, op } = edit;
  const current = row[field];

  if (op === 'set') {
    if (field === 'status') {
      if (!STATUSES.has(edit.value)) return { skip: `"${edit.value}" is not a valid status` };
      return { value: edit.value };
    }
    if (NUMERIC_FIELDS.has(field)) {
      const n = Number(edit.value);
      if (!Number.isFinite(n) || n < 0) return { skip: 'budget and bid must be a positive number' };
      return { value: Math.round(n * 100) / 100 };
    }
    return { value: edit.value === '' ? null : edit.value };
  }

  if (op === 'adjust') {
    if (!NUMERIC_FIELDS.has(field)) return { skip: `${field} cannot be adjusted by an amount` };
    // null/'' must NOT be treated as zero. Number(null) is 0, so without this an
    // empty budget would "adjust" from nothing and be written as 0 — silently
    // zeroing rows the user only meant to raise by a percentage.
    if (current === null || current === undefined || current === '') {
      return { skip: `no current ${field} to adjust` };
    }
    const base = Number(current);
    if (!Number.isFinite(base)) return { skip: `no current ${field} to adjust` };
    const delta = Number(edit.value);
    if (!Number.isFinite(delta)) return { skip: 'adjustment must be a number' };

    const next = edit.mode === 'percent' ? base * (1 + delta / 100) : base + delta;
    // Never drive spend negative: a -200% adjustment means zero, not a refund.
    return { value: Math.max(0, Math.round(next * 100) / 100) };
  }

  if (op === 'replace') {
    if (!TEXT_FIELDS.has(field)) return { skip: `${field} is not a text field` };
    if (typeof current !== 'string' || !current) return { skip: `no ${field} to search` };
    if (!edit.find) return { skip: 'nothing to find' };
    const re = new RegExp(escapeRe(edit.find), edit.matchCase ? 'g' : 'gi');
    if (!re.test(current)) return { skip: `"${edit.find}" not found` };
    return { value: current.replace(re, String(edit.replace ?? '')) };
  }

  return { skip: `unknown operation "${op}"` };
}

/**
 * Run a bulk edit.
 *
 * Every row is read company-scoped FIRST, so an id belonging to another tenant is
 * simply absent and reported as not found — it can never be written to. Each row
 * gets its own outcome, including the ones that changed nothing and why.
 */
export async function runBulkEdit({ companyId, level, ids, edits }) {
  const cfg = LEVELS[level];
  if (!cfg) throw new Error(`Unknown level "${level}".`);

  const uniqueIds = [...new Set((ids || []).filter(Boolean))].slice(0, 500);
  if (!uniqueIds.length) throw new Error('Nothing selected.');

  const cleanEdits = (edits || []).filter(e => e && EDITABLE[level].has(e.field));
  if (!cleanEdits.length) throw new Error('No editable field in this request.');

  const { data: rows, error } = await supabaseAdmin
    .from(cfg.table).select('*')
    .in('id', uniqueIds).eq('company_id', companyId);
  if (error) throw new Error(error.message);

  const found = new Map((rows || []).map(r => [r.id, r]));

  // Re-parenting is a real Ads Editor move, but the destination must be ours.
  const reparent = cleanEdits.find(e => cfg.parentKey && e.field === cfg.parentKey && e.op === 'set');
  if (reparent) {
    const { data: parent } = await supabaseAdmin
      .from(cfg.parentTable).select('id')
      .eq('id', reparent.value).eq('company_id', companyId).maybeSingle();
    if (!parent) throw new Error('That destination does not exist in this company.');
  }

  // Ads and ad groups do not carry `platform` themselves; it lives on the campaign,
  // so it is resolved once per batch rather than per row.
  const platformById = await resolvePlatforms(level, rows || [], companyId);

  const results = [];
  for (const id of uniqueIds) {
    const row = found.get(id);
    if (!row) { results.push({ id, ok: false, reason: 'Not found in this company.' }); continue; }

    const platform = row.platform || platformById.get(id) || null;
    const patch = {};
    const skipped = [];

    for (const edit of cleanEdits) {
      const objection = platformObjection(level, edit.field, platform);
      if (objection) { skipped.push(`${edit.field}: ${objection}`); continue; }

      const outcome = applyEdit(row, edit);
      if (outcome.skip) { skipped.push(`${edit.field}: ${outcome.skip}`); continue; }
      if (outcome.value === row[edit.field]) continue;   // no-op, not worth a write
      patch[edit.field] = outcome.value;
    }

    if (!Object.keys(patch).length) {
      results.push({ id, ok: false, reason: skipped.join('; ') || 'Nothing to change.' });
      continue;
    }

    // A published entity that changes locally no longer matches what the platform
    // holds — the same rule the single-ad copy editor already applies.
    if (row.publish_state === 'published') patch.publish_state = 'out_of_sync';
    patch.updated_at = new Date().toISOString();

    const { error: upErr } = await supabaseAdmin
      .from(cfg.table).update(patch).eq('id', id).eq('company_id', companyId);

    results.push(upErr
      ? { id, ok: false, reason: upErr.message }
      : { id, ok: true, changed: Object.keys(patch).filter(k => k !== 'updated_at'), skipped });
  }

  return {
    updated: results.filter(r => r.ok).length,
    unchanged: results.filter(r => !r.ok).length,
    results,
  };
}

/** Map each row id to the platform of the campaign it ultimately belongs to. */
async function resolvePlatforms(level, rows, companyId) {
  const out = new Map();
  if (level === 'campaign' || !rows.length) return out;

  if (level === 'ad_group') {
    const campaignIds = [...new Set(rows.map(r => r.campaign_id).filter(Boolean))];
    if (!campaignIds.length) return out;
    const { data } = await supabaseAdmin
      .from('ad_campaigns').select('id, platform')
      .in('id', campaignIds).eq('company_id', companyId);
    const byCampaign = new Map((data || []).map(c => [c.id, c.platform]));
    for (const r of rows) out.set(r.id, byCampaign.get(r.campaign_id));
    return out;
  }

  // ads -> ad_groups -> ad_campaigns
  const groupIds = [...new Set(rows.map(r => r.ad_group_id).filter(Boolean))];
  if (!groupIds.length) return out;
  const { data: groups } = await supabaseAdmin
    .from('ad_groups').select('id, campaign_id')
    .in('id', groupIds).eq('company_id', companyId);
  const campaignIds = [...new Set((groups || []).map(g => g.campaign_id).filter(Boolean))];
  if (!campaignIds.length) return out;
  const { data: campaigns } = await supabaseAdmin
    .from('ad_campaigns').select('id, platform')
    .in('id', campaignIds).eq('company_id', companyId);

  const platformByCampaign = new Map((campaigns || []).map(c => [c.id, c.platform]));
  const campaignByGroup = new Map((groups || []).map(g => [g.id, g.campaign_id]));
  for (const r of rows) out.set(r.id, platformByCampaign.get(campaignByGroup.get(r.ad_group_id)));
  return out;
}

export default { runBulkEdit, LEVELS };
