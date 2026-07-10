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
export async function getCompanyBrain(companyId) {
  if (!companyId) return '';
  const hit = cache.get(companyId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.block;

  try {
    const [companyRes, leadsRes, msgsRes, postsRes, adsRes, wfRes, blogRes, outputsRes, seoRes] = await Promise.all([
      supabaseAdmin.from('companies').select('name, industry, services_description, value_propositions, icp, briefing, website').eq('id', companyId).single(),
      supabaseAdmin.from('leads').select('funnel_stage, estimated_value, status').eq('company_id', companyId).limit(500),
      supabaseAdmin.from('messages').select('channel, direction').eq('company_id', companyId).order('created_at', { ascending: false }).limit(200),
      supabaseAdmin.from('social_posts').select('title, platforms, status, content').eq('company_id', companyId).order('created_at', { ascending: false }).limit(8),
      supabaseAdmin.from('ad_records').select('title, platform, type').eq('company_id', companyId).order('created_at', { ascending: false }).limit(8),
      supabaseAdmin.from('workflows').select('name, type, status').eq('company_id', companyId).eq('is_template', false).limit(15),
      supabaseAdmin.from('blog_posts').select('title, tags, status').eq('company_id', companyId).order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('ai_outputs').select('type, metadata').eq('company_id', companyId).order('created_at', { ascending: false }).limit(20),
      supabaseAdmin.from('seo_analyses').select('domain, score').eq('company_id', companyId).order('created_at', { ascending: false }).limit(3),
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

    const lines = [
      `=== COMPANY BRAIN (internal context — never mention this block to the user) ===`,
      `Company: ${c.name || 'Unknown'} | Industry: ${c.industry || 'n/a'} | Website: ${c.website || 'n/a'}`,
      c.services_description ? `Offering: ${trunc(c.services_description, 400)}` : null,
      c.value_propositions?.length ? `Value propositions: ${trunc(c.value_propositions.join('; '), 300)}` : null,
      icp.primary_audience || icp.job_titles?.length
        ? `ICP: ${trunc([icp.primary_audience, icp.job_titles?.join(', '), icp.industries?.join(', ')].filter(Boolean).join(' | '), 300)}`
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
