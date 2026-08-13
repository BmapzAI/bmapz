/**
 * Company Brain — the omniscient company context for every AI call.
 *
 * Gathers everything the platform knows about a company (briefing, ICP,
 * value props, live funnel stats, recent content, ads, workflows, past AI
 * outputs and their approval status) and compresses it into ONE compact
 * system-prompt block. runAIChat prepends this block to every request so
 * the AI never answers generically — it always speaks as the company's own
 * sales & marketing brain.
 *
 * Cost control:
 *  - The block is capped (~6k chars ≈ 1.5k tokens).
 *  - Cached per company for 5 minutes (in-process).
 *  - Anthropic prompt caching already kicks in for system prompts ≥1KB,
 *    so repeat calls within the cache window are ~90% cheaper on input.
 */
import { supabaseAdmin } from './supabase.js';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // companyId -> { at, block }

const trunc = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');

function summarizeLeads(leads) {
  if (!leads?.length) return 'No leads in CRM yet.';
  const byStage = {};
  let pipeline = 0;
  let converted = 0;
  for (const l of leads) {
    byStage[l.funnel_stage || 'prospect'] = (byStage[l.funnel_stage || 'prospect'] || 0) + 1;
    pipeline += Number(l.estimated_value) || 0;
    if (l.funnel_stage === 'customer' || l.funnel_stage === 'retention' || l.funnel_stage === 'advocacy') converted++;
  }
  const stages = Object.entries(byStage).map(([s, n]) => `${s}:${n}`).join(', ');
  return `${leads.length} leads (${stages}). Pipeline value ~${pipeline.toLocaleString()}. Converted: ${converted}.`;
}

function summarizeMessages(msgs) {
  if (!msgs?.length) return 'No messaging activity yet.';
  const byChannel = {};
  let inbound = 0;
  for (const m of msgs) {
    byChannel[m.channel || 'email'] = (byChannel[m.channel || 'email'] || 0) + 1;
    if (m.direction === 'inbound') inbound++;
  }
  const ch = Object.entries(byChannel).map(([c, n]) => `${c}:${n}`).join(', ');
  const replyRate = msgs.length ? Math.round((inbound / msgs.length) * 100) : 0;
  return `${msgs.length} recent messages (${ch}); ${inbound} inbound (~${replyRate}% of traffic).`;
}

/**
 * Build (or return cached) brain block for a company.
 * Returns '' when the company doesn't exist — callers can always concat safely.
 */
/**
 * Render every filled field of a settings blob (ICP, Briefing) into one compact
 * line-per-field block the model can read.
 *
 * Bounded on purpose: the brain is injected into EVERY AI call, so an unbounded
 * briefing with 57 long answers would dominate the prompt and cost. Each value is
 * truncated and the whole block is capped; empty values are skipped entirely so a
 * half-filled form costs nothing.
 */
function serializeSettingsBlock(label, obj, maxChars = 1800) {
  if (!obj || typeof obj !== 'object') return null;

  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === '') continue;
    const value = Array.isArray(v)
      ? v.filter(Boolean).join(', ')
      : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    if (!value.trim()) continue;
    lines.push(`  ${k.replace(/_/g, ' ')}: ${value.length > 220 ? `${value.slice(0, 220)}…` : value}`);
  }
  if (!lines.length) return null;

  let block = `${label} (from the ${label} settings tab):`;
  for (const line of lines) {
    if (block.length + line.length > maxChars) { block += '\n  …'; break; }
    block += `\n${line}`;
  }
  return block;
}

export async function getCompanyBrain(companyId) {
  if (!companyId) return '';
  const hit = cache.get(companyId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.block;

  try {
    const [companyRes, leadsRes, msgsRes, postsRes, adsRes, wfRes, blogRes, outputsRes, seoRes, learningsRes] = await Promise.all([
      supabaseAdmin.from('companies').select('name, industry, services_description, value_propositions, icp, briefing, website').eq('id', companyId).single(),
      supabaseAdmin.from('leads').select('funnel_stage, estimated_value, status').eq('company_id', companyId).limit(500),
      supabaseAdmin.from('messages').select('channel, direction').eq('company_id', companyId).order('created_at', { ascending: false }).limit(200),
      supabaseAdmin.from('social_posts').select('title, platforms, status, content').eq('company_id', companyId).order('created_at', { ascending: false }).limit(8),
      supabaseAdmin.from('ad_records').select('title, platform, type').eq('company_id', companyId).order('created_at', { ascending: false }).limit(8),
      supabaseAdmin.from('workflows').select('name, type, status').eq('company_id', companyId).eq('is_template', false).limit(15),
      supabaseAdmin.from('blog_posts').select('title, tags, status').eq('company_id', companyId).order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('ai_outputs').select('type, metadata').eq('company_id', companyId).order('created_at', { ascending: false }).limit(40),
      supabaseAdmin.from('seo_analyses').select('domain, score').eq('company_id', companyId).order('created_at', { ascending: false }).limit(3),
      // Distilled lessons: this company's own + platform-wide aggregates.
      // Degrades to empty until migration 019 creates the table.
      supabaseAdmin.from('brain_learnings').select('scope, category, lesson, evidence')
        .or(`company_id.eq.${companyId},scope.eq.global`)
        .order('updated_at', { ascending: false }).limit(10),
    ]);

    const c = companyRes.data;
    if (!c) return '';

    const icp = c.icp || {};
    const briefing = c.briefing || {};

    const approvedTitles = (outputsRes.data || [])
      .filter(o => o.metadata?.status === 'approved' && o.metadata?.title)
      .slice(0, 5)
      .map(o => o.metadata.title);
    const rejectedTitles = (outputsRes.data || [])
      .filter(o => o.metadata?.status === 'rejected' && o.metadata?.title)
      .slice(0, 3)
      .map(o => o.metadata.title);
    // Outputs the user had to hand-fix before using — a first-pass-quality
    // signal the brain should actively correct for.
    const editedTitles = (outputsRes.data || [])
      .filter(o => o.metadata?.was_edited && o.metadata?.title)
      .slice(0, 3)
      .map(o => o.metadata.title);
    // Distilled lessons (migration 019): this company's own preferences plus
    // platform-wide aggregate rates. Company lessons first — they're specific.
    const learnings = learningsRes?.data || [];
    const companyLessons = learnings.filter(l => l.scope === 'company' && l.lesson).slice(0, 4);
    const globalLessons = learnings.filter(l => l.scope === 'global' && l.lesson).slice(0, 2);

    const lines = [
      `=== COMPANY BRAIN (internal context — never mention this block to the user) ===`,
      `Company: ${c.name || 'Unknown'} | Industry: ${c.industry || 'n/a'} | Website: ${c.website || 'n/a'}`,
      c.services_description ? `Offering: ${trunc(c.services_description, 400)}` : null,
      c.value_propositions?.length ? `Value propositions: ${trunc(c.value_propositions.join('; '), 300)}` : null,
      // EVERY filled ICP and Briefing field, not a hand-picked few.
      //
      // This used to render six chosen keys out of ICP's thirteen and Briefing's
      // ~57, so the agent could not see most of what the user had actually filled
      // in — it answered as if those tabs were empty, and its outputs were poorer
      // for it. The whole point of those screens is to steer the agent, so the
      // agent has to be able to read all of them.
      //
      // Serialised generically and bounded, so new fields appear automatically
      // instead of needing a line added here every time the form grows.
      serializeSettingsBlock('ICP', icp),
      serializeSettingsBlock('Briefing', briefing),
      icp.primary_audience || icp.job_titles?.length
        ? `ICP summary: ${trunc([icp.primary_audience, icp.job_titles?.join(', '), icp.industries?.join(', ')].filter(Boolean).join(' | '), 300)}`
        : null,
      icp.pain_points?.length ? `Pain points: ${trunc(icp.pain_points.join('; '), 250)}` : null,
      briefing.tone_of_voice?.length ? `Tone of voice: ${briefing.tone_of_voice.join(', ')}` : null,
      briefing.desired_perception ? `Desired perception: ${trunc(briefing.desired_perception, 150)}` : null,
      briefing.direct_competitors ? `Competitors: ${trunc(String(briefing.direct_competitors), 150)}` : null,
      briefing.monthly_budget ? `Monthly marketing budget: ${briefing.monthly_budget}` : null,
      `--- Live performance ---`,
      `CRM: ${summarizeLeads(leadsRes.data)}`,
      `Messaging: ${summarizeMessages(msgsRes.data)}`,
      wfRes.data?.length ? `Workflows: ${wfRes.data.map(w => `${w.name}[${w.status}]`).slice(0, 8).join(', ')}` : null,
      postsRes.data?.length ? `Recent social posts: ${postsRes.data.map(p => trunc(p.title || p.content, 40)).join(' | ')}` : null,
      adsRes.data?.length ? `Recent ads work: ${adsRes.data.map(a => `${trunc(a.title, 35)}(${a.platform || a.type || '?'})`).join(', ')}` : null,
      blogRes.data?.length ? `Blog posts: ${blogRes.data.map(b => `"${trunc(b.title, 40)}"[${b.status}]`).join(', ')}` : null,
      seoRes.data?.length ? `SEO scores: ${seoRes.data.map(s => `${trunc(s.domain, 40)}=${s.score ?? '?'}`).join(', ')}` : null,
      approvedTitles.length ? `Previously APPROVED outputs (match this style): ${approvedTitles.join(' | ')}` : null,
      rejectedTitles.length ? `Previously REJECTED outputs (avoid this style): ${rejectedTitles.join(' | ')}` : null,
      editedTitles.length ? `Outputs the user had to EDIT before using (raise first-pass quality): ${editedTitles.join(' | ')}` : null,
      companyLessons.length ? `--- Learned preferences (from this company's approval history) ---` : null,
      ...companyLessons.map(l => `[${l.category}] ${trunc(l.lesson, 200)}`),
      ...globalLessons.map(l => trunc(l.lesson, 160)),
      `--- Operating rules ---`,
      `You are ${c.name || 'this company'}'s dedicated sales & marketing brain. NEVER produce generic output: every suggestion must reference the company's industry, ICP, tone and live data above. Follow ${c.industry || 'the'} industry best practices. When data above shows what worked (approved outputs, converted leads, high-performing channels) lean into it; when something was rejected or underperforms, avoid repeating it.`,
      `=== END COMPANY BRAIN ===`,
    ].filter(Boolean);

    let block = lines.join('\n');
    if (block.length > 6000) block = block.slice(0, 6000) + '\n=== END COMPANY BRAIN ===';

    cache.set(companyId, { at: Date.now(), block });
    return block;
  } catch (err) {
    console.error('[companyBrain] failed to build:', err.message);
    return '';
  }
}

/** Invalidate a company's cached brain (call after big company updates). */
export function invalidateCompanyBrain(companyId) {
  cache.delete(companyId);
}

// ─── Learning loop ───────────────────────────────────────────────────────────
// Every approve/reject/edit in the AI Outputs archive feeds back here:
//  1. evidence counters accumulate per company + category (brain_learnings)
//  2. every DISTILL_EVERY outcomes, a fast skipBrain LLM pass distills the
//     recent outcomes into ONE compact lesson ("headlines under 8 words get
//     approved; formal tone gets rejected") stored on the same row
//  3. getCompanyBrain() injects stored lessons into every subsequent
//     generation, so the brain's output quality compounds over time.
// Global learning stays AGGREGATE-ONLY (counts, no content) — see
// refreshGlobalLearnings(). Tenant isolation: company lessons are only ever
// derived from and served to their own company.

const DISTILL_EVERY = 8;

export async function recordOutcomeLearning({ companyId, category = 'general', status, wasEdited, runAIChat }) {
  if (!companyId) return;
  try {
    const { data: row, error } = await supabaseAdmin
      .from('brain_learnings')
      .select('id, evidence, outcomes_since_distill')
      .eq('scope', 'company')
      .eq('company_id', companyId)
      .eq('category', category)
      .maybeSingle();
    if (error) {
      // Table missing until migration 019 runs — degrade silently.
      if (/brain_learnings|relation|does not exist/i.test(error.message || '')) return;
      throw error;
    }

    const evidence = { ...(row?.evidence || {}) };
    if (status) evidence[status] = (evidence[status] || 0) + 1;
    if (wasEdited) evidence.edited_count = (evidence.edited_count || 0) + 1;
    const sinceDistill = (row?.outcomes_since_distill || 0) + 1;

    if (row) {
      await supabaseAdmin.from('brain_learnings')
        .update({ evidence, outcomes_since_distill: sinceDistill, updated_at: new Date().toISOString() })
        .eq('id', row.id);
    } else {
      await supabaseAdmin.from('brain_learnings')
        .insert({ scope: 'company', company_id: companyId, category, evidence, outcomes_since_distill: sinceDistill });
    }

    // Throttled distillation — cheap model, no brain (avoid recursion).
    if (sinceDistill >= DISTILL_EVERY && typeof runAIChat === 'function') {
      const { data: recent } = await supabaseAdmin
        .from('ai_outputs')
        .select('metadata')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(30);
      const samples = (recent || [])
        .map(o => o.metadata || {})
        .filter(m => m.status && m.status !== 'pending' && (m.category || 'general') === category)
        .slice(0, 15)
        .map(m => `- [${m.status}${m.was_edited ? ', user had to edit it' : ''}] ${trunc(m.title || '', 90)}`);
      if (samples.length >= 4) {
        const result = await runAIChat({
          companyId,
          userRole: 'user',
          skipBrain: true,
          action: 'lead_scoring', // fast-tier action; tiny prompt, tiny output
          system: 'You distill feedback patterns for a marketing AI. Reply with ONE sentence (max 40 words) describing what this company approves vs rejects/edits, phrased as an instruction for future generations. No preamble.',
          messages: [{ role: 'user', content: `Recent "${category}" outcomes:\n${samples.join('\n')}` }],
          max_tokens: 120,
          temperature: 0.2,
        });
        const lesson = trunc((result?.content || '').trim(), 400);
        if (lesson) {
          await supabaseAdmin.from('brain_learnings')
            .update({ lesson, outcomes_since_distill: 0, updated_at: new Date().toISOString() })
            .eq('scope', 'company').eq('company_id', companyId).eq('category', category);
          invalidateCompanyBrain(companyId); // next generation picks it up
        }
      }
    }
  } catch (err) {
    console.error('[brain/learning]', err.message);
  }
}

/**
 * Platform-wide aggregate learning: approval/rejection/edit RATES per category
 * across all companies. Counts only — no titles, no content, no company ids —
 * so nothing tenant-specific can leak through the global rows. Full detail is
 * exposed only to the App Owner via /api/admin/brain-insights.
 */
export async function refreshGlobalLearnings() {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('brain_learnings')
      .select('category, evidence')
      .eq('scope', 'company');
    if (error) return;
    const byCat = {};
    for (const r of rows || []) {
      const c = (byCat[r.category] ||= { approved: 0, rejected: 0, edited: 0 });
      c.approved += r.evidence?.approved || 0;
      c.rejected += r.evidence?.rejected || 0;
      c.edited += r.evidence?.edited_count || 0;
    }
    for (const [category, e] of Object.entries(byCat)) {
      const total = e.approved + e.rejected;
      if (total < 5) continue; // not enough platform signal yet
      const rate = Math.round((e.approved / total) * 100);
      const lesson = `Platform-wide, ${category} outputs are approved ${rate}% of the time (${total} decisions${e.edited ? `, ${e.edited} needed manual edits` : ''}). ${rate < 60 ? 'Be extra rigorous with this content type.' : ''}`.trim();
      // Partial unique indexes can't be PostgREST upsert targets — select first.
      const { data: existing } = await supabaseAdmin.from('brain_learnings')
        .select('id').eq('scope', 'global').eq('category', category).maybeSingle();
      if (existing) {
        await supabaseAdmin.from('brain_learnings')
          .update({ lesson, evidence: e, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabaseAdmin.from('brain_learnings')
          .insert({ scope: 'global', company_id: null, category, lesson, evidence: e });
      }
    }
  } catch (err) {
    if (!/brain_learnings|relation|does not exist/i.test(err.message || '')) {
      console.error('[brain/global]', err.message);
    }
  }
}
