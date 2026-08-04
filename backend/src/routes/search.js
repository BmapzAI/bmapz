/**
 * Global search — one box that finds anything in the app.
 *
 * Searches real records (leads, conversations, messages, posts, blog posts, ad
 * campaigns/ads, workflows, saved AI outputs, templates, team mates) AND the
 * app's own screens and settings, so a user who does not yet know where
 * something lives can simply type what they want.
 *
 * Everything is company-scoped. Sections the user may not see (Design Studio is
 * App-Owner-only) are filtered out so search can never leak them.
 */
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * Static destinations: screens, settings and common actions. Keywords let people
 * find a screen by what they want to DO, not only by its name.
 */
const DESTINATIONS = [
  { title: 'Home', path: '/', keywords: 'dashboard overview start' },
  { title: 'Sales pipeline', path: '/Sales', keywords: 'leads kanban pipeline funnel deals opportunities' },
  { title: 'Inbox', path: '/Inbox', keywords: 'messages email whatsapp conversations replies' },
  { title: 'SDR agent', path: '/SDR', keywords: 'chatbot ai agent qualify prospects outcomes greeting' },
  { title: 'Workflows', path: '/Workflows', keywords: 'automation sequences triggers nurture builder templates' },
  { title: 'Ads', path: '/Ads', keywords: 'campaigns ad groups advertising meta google tiktok linkedin budget copy optimize' },
  { title: 'Social Media', path: '/SocialMedia', keywords: 'posts instagram facebook schedule calendar drafts' },
  { title: 'Blog', path: '/Blog', keywords: 'articles content seo writing posts' },
  { title: 'SEO', path: '/SEO', keywords: 'search rankings keywords audit' },
  { title: 'Brand Scan', path: '/BrandScan', keywords: 'brand audit analysis presence' },
  { title: 'AI Chat', path: '/AIChat', keywords: 'assistant company brain ask ai chat' },
  { title: 'AI Automations', path: '/AIAutomations', keywords: 'scheduled jobs cron recurring automation' },
  { title: 'AI Outputs', path: '/AIOutputs', keywords: 'generated saved results history outputs' },
  { title: 'Text Templates', path: '/TextTemplates', keywords: 'snippets templates canned responses' },
  { title: 'Dashboards', path: '/Dashboards', keywords: 'charts reports metrics analytics' },
  { title: 'Insights', path: '/WorkflowAnalytics', keywords: 'performance analytics workflow stats' },
  { title: 'Notifications', path: '/Notifications', keywords: 'alerts updates bell' },
  { title: 'Integrations', path: '/Integrations', keywords: 'connect meta google linkedin whatsapp canva api keys oauth' },
  { title: 'Help', path: '/Help', keywords: 'support guides how to assistance faq' },
  { title: 'Profile', path: '/Profile', keywords: 'my account name picture password' },
  { title: 'Settings', path: '/Settings', keywords: 'preferences configuration language company' },
  { title: 'Settings — Company', path: '/Settings', keywords: 'company name industry website services description' },
  { title: 'Settings — API keys', path: '/Settings', keywords: 'openai anthropic api key credentials model' },
  { title: 'Settings — Sales Team', path: '/Settings', keywords: 'sales team members availability online standby offline lead routing queue' },
  { title: 'Settings — AI', path: '/Settings', keywords: 'model image provider agent name ai settings' },
  { title: 'Billing', path: '/Billing', keywords: 'plan subscription invoices credits payment upgrade' },
  { title: 'Pricing', path: '/Pricing', keywords: 'plans price cost tiers' },
];

// Only an App Owner may even know this exists (see frontend lib/featureFlags.js).
const OWNER_ONLY_DESTINATIONS = [
  { title: 'Design Studio', path: '/Design', keywords: 'design images carousel canvas brand templates' },
];

const esc = (s) => String(s).replace(/[%_,()]/g, ' ').trim();
const take = (rows, n) => (rows || []).slice(0, n);

router.get('/', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ query: q, groups: [] });

  const like = `%${esc(q)}%`;
  const lower = q.toLowerCase();
  const companyId = req.companyId;
  const groups = [];

  // Screens and settings — matched on title or on what the user wants to do.
  const destinations = req.dbUser?.role === 'owner'
    ? [...DESTINATIONS, ...OWNER_ONLY_DESTINATIONS]
    : DESTINATIONS;
  const pageHits = destinations
    .filter(d => d.title.toLowerCase().includes(lower) || d.keywords.includes(lower))
    .slice(0, 6)
    .map(d => ({ id: d.path + d.title, title: d.title, subtitle: 'Go to screen', path: d.path }));
  if (pageHits.length) groups.push({ key: 'pages', label: 'Screens & settings', items: pageHits });

  // Each lookup is independent: one failing table must not break the whole search.
  const safe = async (fn) => { try { return await fn(); } catch { return []; } };

  const [leads, posts, blogs, campaigns, ads, workflows, outputs, convos, messages, people] = await Promise.all([
    safe(async () => {
      const { data } = await supabaseAdmin.from('leads')
        .select('id, lead_name, lead_company_name, email, funnel_stage')
        .eq('company_id', companyId)
        .or(`lead_name.ilike.${like},lead_company_name.ilike.${like},email.ilike.${like}`)
        .limit(6);
      return take(data, 6).map(l => ({
        id: l.id,
        title: l.lead_name || l.lead_company_name || l.email || 'Lead',
        subtitle: [l.lead_company_name, l.email, l.funnel_stage].filter(Boolean).join(' · '),
        path: `/LeadDetails?id=${l.id}`,
      }));
    }),
    safe(async () => {
      const { data } = await supabaseAdmin.from('social_posts')
        .select('id, title, content, status')
        .eq('company_id', companyId).or(`title.ilike.${like},content.ilike.${like}`).limit(5);
      return take(data, 5).map(p => ({
        id: p.id, title: p.title || 'Untitled post',
        subtitle: `Social post · ${p.status}`, path: '/SocialMedia',
      }));
    }),
    safe(async () => {
      const { data } = await supabaseAdmin.from('blog_posts')
        .select('id, title, status').eq('company_id', companyId).ilike('title', like).limit(4);
      return take(data, 4).map(b => ({ id: b.id, title: b.title, subtitle: `Blog · ${b.status}`, path: '/Blog' }));
    }),
    safe(async () => {
      const { data } = await supabaseAdmin.from('ad_campaigns')
        .select('id, name, platform, status').eq('company_id', companyId).ilike('name', like).limit(5);
      return take(data, 5).map(c => ({
        id: c.id, title: c.name, subtitle: `Campaign · ${c.platform} · ${c.status}`, path: '/Ads',
      }));
    }),
    safe(async () => {
      const { data } = await supabaseAdmin.from('ads')
        .select('id, name, headline, primary_text').eq('company_id', companyId)
        .or(`name.ilike.${like},headline.ilike.${like},primary_text.ilike.${like}`).limit(5);
      return take(data, 5).map(a => ({
        id: a.id, title: a.name, subtitle: a.headline || a.primary_text || 'Ad copy', path: '/Ads',
      }));
    }),
    safe(async () => {
      const { data } = await supabaseAdmin.from('workflows')
        .select('id, name, status').eq('company_id', companyId).ilike('name', like).limit(4);
      return take(data, 4).map(w => ({ id: w.id, title: w.name, subtitle: `Workflow · ${w.status}`, path: '/Workflows' }));
    }),
    safe(async () => {
      const { data } = await supabaseAdmin.from('ai_outputs')
        .select('id, title, type, content').eq('company_id', companyId)
        .or(`title.ilike.${like},content.ilike.${like}`).limit(5);
      return take(data, 5).map(o => ({
        id: o.id, title: o.title || 'AI output', subtitle: `Saved work · ${o.type || 'ai'}`, path: '/AIOutputs',
      }));
    }),
    safe(async () => {
      const { data } = await supabaseAdmin.from('sdr_conversations')
        .select('id, contact_name, contact_handle, status').eq('company_id', companyId)
        .or(`contact_name.ilike.${like},contact_handle.ilike.${like}`).limit(4);
      return take(data, 4).map(c => ({
        id: c.id, title: c.contact_name || c.contact_handle || 'Conversation',
        subtitle: `SDR chat · ${c.status}`, path: '/SDR',
      }));
    }),
    safe(async () => {
      const { data } = await supabaseAdmin.from('messages')
        .select('id, content, channel, direction').eq('company_id', companyId)
        .ilike('content', like).order('sent_at', { ascending: false }).limit(5);
      return take(data, 5).map(m => ({
        id: m.id, title: String(m.content || '').slice(0, 70),
        subtitle: `Message · ${m.channel} · ${m.direction}`, path: '/Inbox',
      }));
    }),
    safe(async () => {
      const { data } = await supabaseAdmin.from('users')
        .select('id, full_name, email, role').eq('company_id', companyId)
        .or(`full_name.ilike.${like},email.ilike.${like}`).limit(4);
      return take(data, 4).map(u => ({
        id: u.id, title: u.full_name || u.email, subtitle: `Team · ${u.role}`, path: '/Settings',
      }));
    }),
  ]);

  const push = (key, label, items) => { if (items.length) groups.push({ key, label, items }); };
  push('leads', 'Leads', leads);
  push('conversations', 'Conversations', convos);
  push('messages', 'Messages', messages);
  push('ads', 'Campaigns & ads', [...campaigns, ...ads]);
  push('social', 'Social posts', posts);
  push('blog', 'Blog posts', blogs);
  push('workflows', 'Workflows', workflows);
  push('outputs', 'Saved work', outputs);
  push('people', 'People', people);

  res.json({ query: q, groups, total: groups.reduce((n, g) => n + g.items.length, 0) });
});

export default router;
