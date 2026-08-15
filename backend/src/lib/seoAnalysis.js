/**
 * Running an SEO analysis, and storing it so it can be read back.
 *
 * This used to live entirely in the browser (`pages/SEO.jsx` built the prompt,
 * called /api/ai/chat, then POSTed the result). That had two consequences:
 *
 *  1. The AI agent could not run one. Asked for an SEO analysis in chat it
 *     answered that it had no external tools, because the capability genuinely
 *     only existed in the SEO screen's click handler.
 *  2. Nothing was ever saved. The insert spread the model's JSON straight into
 *     the table, and none of those keys were columns, so PostgREST rejected
 *     every row. `seo_analyses` sat at exactly 0 rows.
 *
 * So the analysis lives here, server-side, and both the SEO screen and the chat
 * action call the same function.
 */
import { supabaseAdmin } from './supabase.js';

/** Keys promoted to real columns; everything else is kept in `results`. */
const PROMOTED = ['overall_score', 'url', 'scan_type', 'analyzed_at'];

/**
 * The report contract.
 *
 * Kept verbatim from the SEO screen so stored analyses and freshly-run ones
 * render identically — the screen reads these exact keys.
 */
export function buildSeoPrompt(url, scanType) {
  return `You are an expert SEO auditor. Analyze the SEO of this URL: ${url} (scan type: ${scanType === 'site' ? 'entire site' : 'single page'}).

Based on your knowledge of the URL and best practices, return a JSON object with EXACTLY this structure (no extra keys at the top level):
{
  "overall_score": <0-100 integer>,
  "seo_score": <0-100>,
  "technical_score": <0-100>,
  "aeo_score": <0-100>,
  "geo_score": <0-100>,
  "page_title": "<detected or inferred page title>",
  "primary_keyword_detected": "<main keyword>",
  "estimated_traffic_impact": "<e.g. +15-20% with fixes>",
  "top_issues": [
    { "issue": "<issue title>", "severity": "high|medium|low", "plain_english": "<simple explanation>", "recommendation": "<specific fix step>" }
  ],
  "strengths": ["<strength 1>", "<strength 2>"],
  "quick_wins": [
    { "action": "<action>", "plain_english": "<why it matters>", "difficulty": "easy|medium|hard", "expected_impact": "high|medium|low" }
  ],
  "checklist_results": {
    "title_tag": true|false,
    "meta_desc": true|false,
    "h1_present": true|false,
    "subheadings": true|false,
    "keyword_density": true|false,
    "internal_links": true|false,
    "alt_text": true|false,
    "url_structure": true|false,
    "page_speed": true|false,
    "mobile_friendly": true|false,
    "https": true|false,
    "sitemap": true|false,
    "robots_txt": true|false,
    "structured_data": true|false,
    "canonical": true|false,
    "featured_snippet": true|false,
    "faq_schema": true|false,
    "question_keywords": true|false,
    "direct_answers": true|false,
    "voice_search": true|false,
    "e_eeat": true|false,
    "author_bio": true|false,
    "citations": true|false,
    "comprehensive": true|false,
    "entity_mentions": true|false,
    "ai_friendly": true|false
  }
}
Be realistic and specific based on what you know about the URL. If it's an HTTPS URL, set https: true. If it's a well-known site, use your knowledge about their SEO. Provide at least 3 top_issues and 3 quick_wins.`;
}

/** Accepts "acme.com", "www.acme.com/x" or a full URL and returns a real URL. */
export function normalizeUrl(raw) {
  const u = String(raw || '').trim();
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

/** Endings that look like a domain but are a filename or a library. */
const NOT_A_TLD = new Set([
  'js', 'jsx', 'ts', 'tsx', 'json', 'html', 'htm', 'css', 'md', 'txt', 'csv',
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'pdf', 'zip', 'xml', 'yml', 'yaml',
]);

/**
 * Find the site someone is talking about.
 *
 * Bare domains matter as much as full URLs: a task called "SEO of the
 * ai.bmapz.com page" never writes the scheme, and requiring "https://" meant that
 * task could not be recognised as being about a website at all.
 */
export function extractUrl(text) {
  const raw = String(text || '');

  const schemed = raw.match(/https?:\/\/[^\s"'<>)\]]+/);
  if (schemed) return schemed[0].replace(/[.,;:]+$/, '');

  // The path is part of the address: "bmapz.com/pricing" asked about the pricing
  // page, and capturing only the host silently analysed the homepage instead.
  //
  // Every candidate is checked rather than just the first, so a filename earlier
  // in the sentence does not hide a real domain later in it.
  const all = raw.matchAll(/\b((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})(\/[^\s"'<>)\]]*)?/gi);
  for (const m of all) {
    const host = m[1];
    if (NOT_A_TLD.has(host.split('.').pop().toLowerCase())) continue;
    const path = (m[2] || '').replace(/[.,;:]+$/, '');
    return `https://${host}${path}`;
  }
  return null;
}

/** Whatever the model returned, shaped into the columns the table actually has. */
export function toRow({ companyId, url, scanType, analysis }) {
  const results = { ...(analysis || {}) };
  for (const k of PROMOTED) delete results[k];

  const score = Number(analysis?.overall_score);

  // The legacy issues / recommendations / top_keywords columns are jsonb[], not
  // text[], and nothing reads them — the full report is in `results`. Writing them
  // would only reintroduce the type mismatch this function exists to prevent.
  return {
    company_id: companyId,
    url,
    domain: domainOf(url),
    scan_type: scanType === 'site' ? 'site' : 'page',
    overall_score: Number.isFinite(score) ? Math.round(score) : null,
    // `score` predates overall_score — keep both in step for anything still on it.
    score: Number.isFinite(score) ? Math.round(score) : null,
    ai_summary: analysis?.estimated_traffic_impact || null,
    analyzed_at: new Date().toISOString(),
    results,
  };
}

/**
 * Store an analysis that already exists — no model call, no credits.
 *
 * Used when a task or a chat message already produced the report and it just
 * needs to land in the SEO section.
 */
export async function storeAnalysis({ companyId, url, scanType = 'page', analysis }) {
  const target = normalizeUrl(url);
  if (!target || !domainOf(target)) throw new Error(`"${url}" is not a valid URL.`);

  const { data, error } = await supabaseAdmin
    .from('seo_analyses')
    .insert(toRow({ companyId, url: target, scanType, analysis }))
    .select()
    .single();
  if (error) throw new Error(`Could not save the SEO analysis: ${error.message}`);
  return data;
}

/**
 * Pull an SEO report out of arbitrary text.
 *
 * Task results and chat replies arrive as prose, or as JSON inside a fenced
 * block, or as raw JSON. Returns { analysis, url } — either may be null.
 */
export function parseAnalysis(text) {
  const raw = String(text || '');
  let analysis = null;

  // Prefer a fenced block, then the widest brace span.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1), raw];
  for (const c of candidates) {
    if (!c || !c.trim().startsWith('{')) continue;
    try {
      const parsed = JSON.parse(c);
      // Only treat it as a report if it actually looks like one, so a random
      // JSON blob is not filed as an SEO analysis.
      if (parsed && typeof parsed === 'object'
        && (parsed.overall_score !== undefined || parsed.checklist_results || parsed.top_issues)) {
        analysis = parsed;
        break;
      }
    } catch { /* try the next shape */ }
  }

  const url = analysis?.url || extractUrl(raw);

  return { analysis, url };
}

/**
 * Run an analysis and store it. Returns the saved row.
 *
 * Throws on failure rather than returning a half-result: a caller that reports
 * "analysis complete" over a rejected insert is the exact bug this replaces.
 */
export async function runSeoAnalysis({ companyId, userId, userRole, url, scanType = 'page' }) {
  const target = normalizeUrl(url);
  if (!target) throw new Error('A URL is required to run an SEO analysis.');
  if (!domainOf(target)) throw new Error(`"${url}" is not a valid URL.`);

  // Imported at call time, not at module load: routes/ai.js imports aiActions.js,
  // which imports this file, so a static import would close the cycle.
  const { runAIChat } = await import('../routes/ai.js');

  const result = await runAIChat({
    companyId,
    userId: userId || null,
    userRole: userRole || 'user',
    messages: [{ role: 'user', content: buildSeoPrompt(target, scanType) }],
    response_format: { type: 'json_object' },
    // Routes the model tier AND files it in the AI Outputs archive
    // (ARCHIVE_CATEGORY_BY_ACTION in routes/ai.js).
    action: 'seo_plan',
    archiveTitle: `SEO analysis — ${target}`,
  });

  let analysis;
  try {
    analysis = JSON.parse(result?.content ?? '');
  } catch {
    throw new Error('The SEO analysis came back in an unreadable format.');
  }
  if (analysis?.error) throw new Error(String(analysis.error));

  // supabase-js resolves with {data:null,error} instead of throwing — an ignored
  // error here is precisely how this table stayed empty.
  return storeAnalysis({ companyId, url: target, scanType, analysis });
}

export default { buildSeoPrompt, normalizeUrl, toRow, runSeoAnalysis, storeAnalysis, parseAnalysis };
