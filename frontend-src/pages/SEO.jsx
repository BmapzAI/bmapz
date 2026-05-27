import { api } from '@/api/apiClient';
import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, Globe, CheckCircle2, AlertCircle, XCircle,
  TrendingUp, Sparkles, Clock, ExternalLink, ChevronDown, ChevronUp, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { Company, SEOAnalysis } from '@/api/entities';

const PLAIN_ENGLISH_LABELS = {
  title_tag: {
    label: 'Page Title (shown on Google)',
    plain: 'Your page needs a title between 50-60 characters that includes your main keyword. Think of it as the headline Google shows in search results.',
    fix: 'Go to your website\'s code or CMS and update the <title> tag on this page.'
  },
  meta_desc: {
    label: 'Search Result Description',
    plain: 'The short description (150-160 chars) people see under your page title on Google. It should summarize the page and include your keyword.',
    fix: 'Add or update the meta description in your CMS (WordPress, Webflow, etc.) under SEO settings.'
  },
  h1_present: {
    label: 'Main Heading with Keyword',
    plain: 'Every page needs one clear main heading (H1) that contains your most important keyword. It\'s the first big headline visitors see.',
    fix: 'Add an H1 heading at the top of your page content that includes your target keyword.'
  },
  subheadings: {
    label: 'Section Headings (H2/H3)',
    plain: 'Break your content into sections with clear headings. This helps readers scan your page AND helps Google understand your content structure.',
    fix: 'Add H2 headings before each major section of content on the page.'
  },
  keyword_density: {
    label: 'Keyword Usage (1-3%)',
    plain: 'Your target keyword should appear naturally throughout the page — not too little (ignored by Google) or too much (looks spammy).',
    fix: 'Review your content and ensure the main keyword appears naturally every 2-3 paragraphs.'
  },
  internal_links: {
    label: 'Links to Other Pages on Your Site',
    plain: 'Linking to related pages on your website helps Google discover all your content and keeps visitors on your site longer.',
    fix: 'Add 2-5 links within your content pointing to other relevant pages on your website.'
  },
  alt_text: {
    label: 'Image Descriptions (Alt Text)',
    plain: 'Every image needs a short text description. Google can\'t "see" images, so this text helps it understand what the image is about.',
    fix: 'For each image, add an alt attribute describing what\'s in the image and include keywords where natural.'
  },
  url_structure: {
    label: 'Clean Web Address',
    plain: 'Your page URL should be short, readable, and include your keyword. Example: /blog/seo-tips is better than /page?id=123.',
    fix: 'Update your page URL/slug in your CMS to be short and descriptive.'
  },
  page_speed: {
    label: 'Page Load Speed (under 3 sec)',
    plain: 'If your page takes more than 3 seconds to load, visitors leave and Google ranks you lower. Speed matters a lot.',
    fix: 'Use Google PageSpeed Insights (free tool) to find exactly what\'s slowing your page down. Common fixes: compress images, use a CDN.'
  },
  mobile_friendly: {
    label: 'Works Well on Mobile Phones',
    plain: 'Over 60% of searches happen on phones. If your site doesn\'t look good on mobile, Google penalizes your rankings.',
    fix: 'Test your site on your phone. If anything looks broken, contact your web developer to fix the responsive design.'
  },
  https: {
    label: 'Secure Website (HTTPS)',
    plain: 'Your website address should start with "https://" (with the padlock). Google marks non-secure sites as unsafe.',
    fix: 'Contact your hosting provider to install a free SSL certificate (most hosts offer this for free).'
  },
  sitemap: {
    label: 'Site Map for Google',
    plain: 'A sitemap is a file that lists all your pages so Google can find them easily. It\'s like giving Google a map of your website.',
    fix: 'Most CMS platforms (WordPress, Webflow) generate sitemaps automatically. Check if yours is at yoursite.com/sitemap.xml'
  },
  robots_txt: {
    label: 'Google Access Rules File',
    plain: 'A robots.txt file tells Google which pages it can and cannot index. A misconfigured one can accidentally block your entire site.',
    fix: 'Check yoursite.com/robots.txt and make sure it\'s not blocking important pages with "Disallow: /".'
  },
  structured_data: {
    label: 'Rich Result Tags (Schema)',
    plain: 'Special code that helps Google show rich results (star ratings, FAQs, prices) directly in search results. Increases click-through rates.',
    fix: 'Use Google\'s Structured Data Markup Helper to generate the code, then add it to your page.'
  },
  canonical: {
    label: 'Preferred Page URL Tag',
    plain: 'If the same content exists at multiple URLs, this tag tells Google which version is the "official" one to avoid duplicate content penalties.',
    fix: 'Add a canonical tag in your page\'s HTML head pointing to the preferred URL of the page.'
  },
  featured_snippet: {
    label: 'Ready for "Position 0" on Google',
    plain: 'Featured snippets are the answer boxes that appear at the very top of Google results. Structure your content to directly answer questions.',
    fix: 'Format key answers as short paragraphs (40-60 words) directly after the question they answer.'
  },
  faq_schema: {
    label: 'FAQ Section with Code Tags',
    plain: 'Adding FAQ sections with proper code lets Google show your Q&As directly in search results, taking up more space and getting more clicks.',
    fix: 'Add a FAQ section to your page and implement FAQ schema markup code. Tools like Rank Math (WordPress) do this automatically.'
  },
  question_keywords: {
    label: 'Question-Based Keywords',
    plain: 'People often ask questions to search engines and AI assistants (who, what, how, why). Your content should directly answer these questions.',
    fix: 'Research "People also ask" questions on Google for your topic and add pages or sections that answer each one directly.'
  },
  direct_answers: {
    label: 'Direct, Concise Answers',
    plain: 'AI assistants (ChatGPT, Gemini, Perplexity) and voice search need clear, direct answers. Don\'t bury the answer in paragraphs.',
    fix: 'After each section heading, include a 1-3 sentence direct answer before elaborating with more detail.'
  },
  voice_search: {
    label: 'Voice Search Friendly',
    plain: 'People speak differently than they type. Voice search uses conversational phrases like "What is the best way to..." instead of "best way".',
    fix: 'Include conversational phrases and natural language in your content, especially for FAQ sections.'
  },
  e_eeat: {
    label: 'Trust & Expertise Signals',
    plain: 'Google\'s E-E-A-T stands for Experience, Expertise, Authority, Trust. Your content needs to demonstrate real expertise, not just keywords.',
    fix: 'Add author bios, cite your sources, show real experience (case studies, data), and earn mentions from reputable sites.'
  },
  author_bio: {
    label: 'Author Bio & Credentials',
    plain: 'Who wrote this content? Google and AI systems trust content from identified experts more than anonymous pages.',
    fix: 'Add an author bio section with a photo, credentials, and links to their other work or social profiles.'
  },
  citations: {
    label: 'Statistics & Cited Sources',
    plain: 'Backing your claims with real data and linking to original sources builds credibility with both Google and AI citation systems.',
    fix: 'Add statistics with links to their original sources. Use phrases like "According to [Source], X% of...".'
  },
  comprehensive: {
    label: 'In-Depth Content Coverage',
    plain: 'Thin content (under 500 words) rarely ranks well. Comprehensive, helpful content that fully answers the topic ranks much higher.',
    fix: 'Expand your content to cover the topic fully. Aim for 1000+ words for competitive topics, ensuring every section adds value.'
  },
  entity_mentions: {
    label: 'Named Brands & Entities Mentioned',
    plain: 'Mentioning relevant brands, people, tools, and industry terms helps AI systems understand your page\'s context and recommend it as a source.',
    fix: 'Naturally include relevant industry names, tools, and entities that are genuinely related to your topic.'
  },
  ai_friendly: {
    label: 'Formatted for AI Summarization',
    plain: 'AI tools (ChatGPT, Perplexity, Gemini) summarize content to answer user questions. Well-structured content with clear headings is more likely to be cited.',
    fix: 'Use clear H2/H3 headings, short paragraphs, bullet points, and include a clear summary or TL;DR at the top of long articles.'
  },
};

const SEO_CATEGORIES = [
  { name: 'On-Page SEO', emoji: '📝', items: ['title_tag', 'meta_desc', 'h1_present', 'subheadings', 'keyword_density', 'internal_links', 'alt_text', 'url_structure'] },
  { name: 'Technical SEO', emoji: '⚙️', items: ['page_speed', 'mobile_friendly', 'https', 'sitemap', 'robots_txt', 'structured_data', 'canonical'] },
  { name: 'AEO – Answer Engine Optimization', emoji: '🤖', items: ['featured_snippet', 'faq_schema', 'question_keywords', 'direct_answers', 'voice_search'] },
  { name: 'GEO – Generative Engine Optimization', emoji: '✨', items: ['e_eeat', 'author_bio', 'citations', 'comprehensive', 'entity_mentions', 'ai_friendly'] },
];

export default function SEO() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [scanType, setScanType] = useState('page');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [expandedChecklist, setExpandedChecklist] = useState(null);
  const [expandedIssue, setExpandedIssue] = useState(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => Company.list(),
  });
  const company = companies[0];

  const { data: savedAnalyses = [] } = useQuery({
    queryKey: ['seoAnalyses', company?.id],
    queryFn: () => company?.id ? SEOAnalysis.filter({ company_id: company.id }, '-created_date', 5) : [],
    enabled: !!company?.id,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => SEOAnalysis.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['seoAnalyses'] }); },
  });

  const normalizeUrl = (raw) => {
    let u = raw.trim();
    if (!u) return '';
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      // Add www. if not present and no subdomain-like prefix
      if (!u.startsWith('www.') && !u.includes('.') === false) {
        u = 'https://' + u;
      } else {
        u = 'https://' + u;
      }
    }
    return u;
  };

  const analyzeUrl = async () => {
    if (!url.trim()) { toast.error('Enter a URL to analyze'); return; }
    const normalizedUrl = normalizeUrl(url);
    setUrl(normalizedUrl);
    setIsAnalyzing(true);
    try {
      // Fetch SEO analysis
      const res = await api.post('/api/ai/chat', { messages: [{ role: 'user', content: `Analyze SEO for URL: ${normalizedUrl}. Type: ${scanType}. Return a JSON with score, issues, and recommendations.` }], response_format: { type: 'json_object' } }).then(r => JSON.parse(r.content));
      const response = res;
      if (response.error) throw new Error(response.error);
      const analysisResult = { ...response, url: normalizedUrl, scanType, analyzed_at: new Date().toISOString() };

      // Try to fetch Google Search Console data if connected
      try {
        const searchConsoleRes = await api.get('/api/seo/search-console', { url: normalizedUrl });
        if (searchConsoleRes.data && !searchConsoleRes.data.error) {
          analysisResult.searchConsoleData = searchConsoleRes.data;
        }
      } catch (e) {
        // Silently fail if Google Search Console is not connected
        console.log('Search Console data unavailable');
      }

      setResults(analysisResult);
      if (company?.id) {
        saveMutation.mutate({ company_id: company.id, url: normalizedUrl, scan_type: scanType, ...analysisResult });
      }
      toast.success('Analysis complete!');
    } catch (e) {
      if (e.message?.includes('API') || e.message?.includes('key') || e.message?.includes('auth')) {
        setAiUnavailable(true);
      }
      toast.error('Analysis failed. Check the URL and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadSavedAnalysis = (analysis) => {
    setResults({ ...analysis, scanType: analysis.scan_type });
    setUrl(analysis.url);
  };

  const scoreColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };
  const scoreBg = (score) => {
    if (score >= 80) return 'bg-green-400';
    if (score >= 50) return 'bg-yellow-400';
    return 'bg-red-400';
  };
  const severityColor = { high: 'text-red-400 bg-red-400/10 border-red-400/20', medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', low: 'text-blue-400 bg-blue-400/10 border-blue-400/20' };
  const difficultyColor = { easy: 'text-green-400 bg-green-400/10', medium: 'text-yellow-400 bg-yellow-400/10', hard: 'text-red-400 bg-red-400/10' };
  const impactColor = { high: 'text-[#38b6ff]', medium: 'text-yellow-400', low: 'text-gray-400' };

  const failedItems = results ? SEO_CATEGORIES.flatMap(cat => cat.items.filter(id => results.checklist_results?.[id] === false)) : [];
  const passedItems = results ? SEO_CATEGORIES.flatMap(cat => cat.items.filter(id => results.checklist_results?.[id] === true)) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            SEO Analyzer
          </h1>
          <p className="text-gray-400 mt-1">Full SEO, AEO and GEO analysis • Simple explanations for every issue</p>
        </div>
      </div>



      {/* AI Unavailable Warning */}
      {aiUnavailable && (
        <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/30 p-4 flex items-start gap-3">
          <span className="text-yellow-400 text-lg">⚠️</span>
          <div>
            <p className="text-yellow-400 font-medium text-sm">AI Service Unavailable</p>
            <p className="text-gray-400 text-xs mt-1">
              The SEO analyzer requires an AI service to work. Please configure your OpenAI API key in{' '}
              <a href="/Settings" className="text-[#38b6ff] underline">Settings → API Keys</a>{' '}
              to enable analysis.
            </p>
          </div>
        </div>
      )}

      {/* URL Input */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-3">
          <Globe size={18} className="text-[#38b6ff]" />
          <span className="text-white font-medium">Enter URL to Analyze</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourwebsite.com/page"
            className="flex-1 min-w-[200px] bg-black/30 border-white/10 text-white"
            onKeyDown={(e) => e.key === 'Enter' && analyzeUrl()} />
          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/30">
            <button onClick={() => setScanType('page')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${scanType === 'page' ? 'bg-[#38b6ff]/20 text-[#38b6ff]' : 'text-gray-400'}`}>
              This page
            </button>
            <button onClick={() => setScanType('site')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${scanType === 'site' ? 'bg-[#38b6ff]/20 text-[#38b6ff]' : 'text-gray-400'}`}>
              Entire site
            </button>
          </div>
          <Button onClick={analyzeUrl} disabled={isAnalyzing || !url.trim()}
            className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
            {isAnalyzing ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Search size={16} />}
            {isAnalyzing ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>
      </div>

      {/* Recent Analyses - always visible below URL input, and below results when analysis shown */}
      {savedAnalyses.length > 0 && !results && (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Clock size={16} className="text-[#38b6ff]" /> Recent Analyses
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {savedAnalyses.map((a) => (
              <button key={a.id} onClick={() => loadSavedAnalysis(a)}
                className="flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-white/10 hover:border-[#38b6ff]/30 hover:bg-white/10 transition-all text-left group">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${scoreBg(a.overall_score || 0)} bg-opacity-20`}>
                  <span className={scoreColor(a.overall_score || 0)}>{a.overall_score || '?'}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs font-medium truncate">{a.url}</p>
                  <p className="text-gray-500 text-xs">{new Date(a.created_date).toLocaleDateString()}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Score Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Overall', score: results.overall_score, emoji: '🏆' },
              { label: 'SEO', score: results.seo_score, emoji: '📝' },
              { label: 'Technical', score: results.technical_score, emoji: '⚙️' },
              { label: 'AEO', score: results.aeo_score, emoji: '🤖' },
              { label: 'GEO', score: results.geo_score, emoji: '✨' },
            ].map(({ label, score, emoji }) => (
              <div key={label} className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
                <div className="text-xl mb-1">{emoji}</div>
                <div className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</div>
                <div className="text-gray-400 text-sm mt-1">{label}</div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-2">
                  <div className={`h-full rounded-full ${scoreBg(score)}`} style={{ width: `${score}%` }} />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {score >= 80 ? '✅ Great' : score >= 50 ? '⚠️ Needs work' : '❌ Critical'}
                </div>
              </div>
            ))}
          </div>

          {/* Page info */}
          {(results.page_title || results.primary_keyword_detected || results.searchConsoleData) && (
            <div className="space-y-4">
              <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 flex-wrap text-sm">
                {results.page_title && <div><span className="text-gray-400">Page: </span><span className="text-white">{results.page_title}</span></div>}
                {results.primary_keyword_detected && <div><span className="text-gray-400">Main keyword detected: </span><span className="text-[#38b6ff] font-medium">{results.primary_keyword_detected}</span></div>}
                {results.estimated_traffic_impact && <div><span className="text-gray-400">Traffic impact: </span><span className="text-green-400">{results.estimated_traffic_impact}</span></div>}
              </div>

              {/* Google Search Console Data */}
              {results.searchConsoleData && (
                <div className="rounded-2xl bg-gradient-to-r from-[#3572b9]/10 to-[#38b6ff]/10 border border-[#38b6ff]/20 p-5 space-y-3">
                  <h4 className="text-white font-semibold flex items-center gap-2">
                    <span>🔍</span> Google Search Console Data (Last 90 days)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-black/30 rounded-lg p-3">
                      <p className="text-gray-400 text-xs">Total Clicks</p>
                      <p className="text-white text-lg font-bold">{results.searchConsoleData.totalClicks || 0}</p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-3">
                      <p className="text-gray-400 text-xs">Impressions</p>
                      <p className="text-white text-lg font-bold">{results.searchConsoleData.totalImpressions || 0}</p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-3">
                      <p className="text-gray-400 text-xs">Avg. CTR</p>
                      <p className="text-white text-lg font-bold">{results.searchConsoleData.avgCTR || '0'}%</p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-3">
                      <p className="text-gray-400 text-xs">Avg. Position</p>
                      <p className="text-white text-lg font-bold">#{results.searchConsoleData.avgPosition || 0}</p>
                    </div>
                  </div>
                  {results.searchConsoleData.topQueries?.length > 0 && (
                    <div>
                      <p className="text-gray-300 text-xs font-medium mb-2">Top Search Queries:</p>
                      <div className="space-y-1">
                        {results.searchConsoleData.topQueries.slice(0, 5).map((q, i) => (
                          <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-black/20">
                            <span className="text-white">{q.query}</span>
                            <div className="flex gap-3 text-gray-400">
                              <span>{q.clicks} clicks</span>
                              <span>{q.ctr}% CTR</span>
                              <span className={`font-medium ${q.position <= 3 ? 'text-green-400' : q.position <= 10 ? 'text-yellow-400' : 'text-red-400'}`}>Pos: #{q.position}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {results.searchConsoleData.topPages?.length > 0 && (
                    <div>
                      <p className="text-gray-300 text-xs font-medium mb-2">Top Pages:</p>
                      <div className="space-y-1">
                        {results.searchConsoleData.topPages.slice(0, 5).map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-black/20">
                            <span className="text-white truncate">{p.page}</span>
                            <div className="flex gap-3 text-gray-400">
                              <span>{p.clicks} clicks</span>
                              <span className={`font-medium ${p.avgPosition <= 3 ? 'text-green-400' : p.avgPosition <= 10 ? 'text-yellow-400' : 'text-red-400'}`}>Avg Pos: #{p.avgPosition}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Issues - with plain English */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <AlertCircle size={18} className="text-red-400" />
                Issues Found ({results.top_issues?.length || 0})
              </h3>
              <div className="space-y-2">
                {(results.top_issues || []).map((issue, i) => (
                  <div key={i} className={`rounded-xl border overflow-hidden ${severityColor[issue.severity] || 'text-gray-400 bg-white/5 border-white/10'}`}>
                    <button
                      onClick={() => setExpandedIssue(expandedIssue === i ? null : i)}
                      className="w-full flex items-start gap-3 p-3 text-left"
                    >
                      <span className={`px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 mt-0.5
                        ${issue.severity === 'high' ? 'bg-red-500/30' : issue.severity === 'medium' ? 'bg-yellow-500/30' : 'bg-blue-500/30'}`}>
                        {issue.severity === 'high' ? '🔴 HIGH' : issue.severity === 'medium' ? '🟡 MED' : '🔵 LOW'}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{issue.issue}</p>
                        {issue.plain_english && <p className="text-xs opacity-70 mt-0.5 line-clamp-2">{issue.plain_english}</p>}
                      </div>
                      {expandedIssue === i ? <ChevronUp size={14} className="flex-shrink-0 mt-1" /> : <ChevronDown size={14} className="flex-shrink-0 mt-1" />}
                    </button>
                    {expandedIssue === i && (
                      <div className="px-3 pb-3 space-y-2">
                        {issue.plain_english && (
                          <div className="p-2 rounded-lg bg-black/20">
                            <p className="text-xs font-medium mb-1">💬 What this means in plain English:</p>
                            <p className="text-xs opacity-90">{issue.plain_english}</p>
                          </div>
                        )}
                        <div className="p-2 rounded-lg bg-black/20">
                          <p className="text-xs font-medium mb-1">🔧 How to fix it:</p>
                          <p className="text-xs opacity-90">{issue.recommendation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Wins */}
            <div className="space-y-4">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-green-400" />
                  What You're Doing Well ✅
                </h3>
                <div className="space-y-2">
                  {(results.strengths || []).map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircle2 size={14} className="text-green-400 mt-0.5 flex-shrink-0" /> {s}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-gradient-to-r from-[#3572b9]/10 to-[#38b6ff]/10 border border-[#38b6ff]/20 p-5">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp size={18} className="text-[#38b6ff]" />
                  Quick Wins 🚀 (Start Here)
                </h3>
                <div className="space-y-3">
                  {(results.quick_wins || []).map((w, i) => {
                    const isObj = typeof w === 'object';
                    return (
                      <div key={i} className="p-3 rounded-xl bg-black/20 border border-white/5">
                        <div className="flex items-start gap-2 mb-1">
                          <Sparkles size={14} className="text-[#38b6ff] mt-0.5 flex-shrink-0" />
                          <p className="text-white text-sm font-medium">{isObj ? w.action : w}</p>
                        </div>
                        {isObj && w.plain_english && <p className="text-gray-400 text-xs ml-5">{w.plain_english}</p>}
                        {isObj && (
                          <div className="flex gap-2 mt-2 ml-5">
                            {w.difficulty && <span className={`text-xs px-1.5 py-0.5 rounded-full ${difficultyColor[w.difficulty]}`}>{w.difficulty} to do</span>}
                            {w.expected_impact && <span className={`text-xs font-medium ${impactColor[w.expected_impact]}`}>{w.expected_impact} impact</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Checklist - plain English */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Full SEO Checklist</h3>
              <div className="flex gap-3 text-sm">
                <span className="text-green-400">✅ {passedItems.length} passed</span>
                <span className="text-red-400">❌ {failedItems.length} need attention</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {SEO_CATEGORIES.map(cat => (
                <div key={cat.name}>
                  <h4 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
                    {cat.emoji} {cat.name}
                  </h4>
                  <div className="space-y-1.5">
                    {cat.items.map(itemId => {
                      const passed = results.checklist_results?.[itemId];
                      const info = PLAIN_ENGLISH_LABELS[itemId];
                      const isExpanded = expandedChecklist === itemId;
                      return (
                        <div key={itemId} className={`rounded-xl overflow-hidden ${passed ? 'bg-green-500/10' : 'bg-red-500/5'}`}>
                          <button
                            onClick={() => setExpandedChecklist(isExpanded ? null : itemId)}
                            className="w-full flex items-start gap-2 p-2.5 text-left"
                          >
                            {passed ? (
                              <CheckCircle2 size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
                            ) : (
                              <XCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                            )}
                            <span className={`text-sm flex-1 ${passed ? 'text-green-300' : 'text-gray-300'}`}>
                              {info?.label || itemId}
                            </span>
                            {!passed && (isExpanded ? <ChevronUp size={12} className="text-gray-500 flex-shrink-0 mt-0.5" /> : <ChevronDown size={12} className="text-gray-500 flex-shrink-0 mt-0.5" />)}
                          </button>
                          {!passed && isExpanded && info && (
                            <div className="px-3 pb-3 space-y-2">
                              <div className="p-2 rounded-lg bg-black/20 text-xs">
                                <p className="text-gray-400 mb-1">💬 <span className="font-medium">What this means:</span></p>
                                <p className="text-gray-300">{info.plain}</p>
                              </div>
                              <div className="p-2 rounded-lg bg-black/20 text-xs">
                                <p className="text-gray-400 mb-1">🔧 <span className="font-medium">How to fix:</span></p>
                                <p className="text-gray-300">{info.fix}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Analyses - shown below results after analysis is complete */}
      {savedAnalyses.length > 0 && results && (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Clock size={16} className="text-[#38b6ff]" /> Recent Analyses
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {savedAnalyses.map((a) => (
              <button key={a.id} onClick={() => loadSavedAnalysis(a)}
                className="flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-white/10 hover:border-[#38b6ff]/30 hover:bg-white/10 transition-all text-left group">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${scoreBg(a.overall_score || 0)} bg-opacity-20`}>
                  <span className={scoreColor(a.overall_score || 0)}>{a.overall_score || '?'}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs font-medium truncate">{a.url}</p>
                  <p className="text-gray-500 text-xs">{new Date(a.created_date).toLocaleDateString()}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}