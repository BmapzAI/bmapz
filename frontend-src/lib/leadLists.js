/**
 * What a lead list contains.
 *
 * A static list is the ids it stores. A dynamic list is a rule, and its stored
 * `lead_ids` / `lead_count` are only as fresh as the last sync — so membership is
 * recomputed from the current leads rather than trusted.
 *
 * This lives in one place because it is now read from two screens (the Sales list
 * manager and workflow enrolment). Two copies of a membership rule drift, and the
 * symptom would be a workflow enrolling a different set than the list displays.
 */

/**
 * Read a sort field off a lead, translating the legacy Base44 date aliases.
 *
 * The sort UI still calls these fields `created_date` / `updated_date`, but the
 * columns are `created_at` / `updated_at`. Reading the alias returned undefined for
 * every lead, so every row compared equal and "sort by date added" — the DEFAULT
 * sort on both the Sales board and the list view — did nothing at all.
 */
export function leadSortValue(lead, field) {
  if (!lead || !field) return '';
  if (field === 'created_date') return lead.created_at || lead.created_date || '';
  if (field === 'updated_date') return lead.updated_at || lead.updated_date || '';
  return lead[field] ?? '';
}

/** Does one lead satisfy a dynamic list's rules? */
export function matchesListFilters(lead, filters) {
  const f = filters || {};
  if (f.funnel_stages?.length && !f.funnel_stages.includes(lead.funnel_stage)) return false;
  if (f.icp_score_min != null && lead.icp_score != null && lead.icp_score < f.icp_score_min) return false;
  if (f.sources?.length && lead.source_category != null && !f.sources.includes(lead.source_category)) return false;
  if (f.status?.length && !f.status.includes(lead.status)) return false;
  return true;
}

/** True when the list is a rule rather than a fixed set. */
export const isDynamicList = (list) =>
  list?.type === 'dynamic' && !!list?.filters && Object.keys(list.filters).length > 0;

/** The leads a list currently contains. */
export function resolveListLeads(list, leads = []) {
  if (!list) return [];
  if (isDynamicList(list)) return leads.filter(l => matchesListFilters(l, list.filters));
  const ids = list.lead_ids || [];
  return leads.filter(l => ids.includes(l.id));
}

/** How many leads a list currently contains, without waiting for a sync. */
export function resolveListCount(list, leads = []) {
  if (!list) return 0;
  if (isDynamicList(list)) return resolveListLeads(list, leads).length;
  return list.lead_count || (list.lead_ids || []).length || 0;
}
