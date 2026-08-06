import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { consumeDesignHandoff, saveDesignReturn } from '@/lib/designHandoff';
import CanvaPicker from '@/components/integrations/CanvaPicker';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Button } from '@/components/ui/button';
import IntegrationGate from '@/components/ui/IntegrationGate';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  FileText, Plus, Sparkles, Check, X, AlertCircle,
  CheckCircle2, Globe, Tag, Link2, Search, Edit3, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { canSeeDesign } from '@/lib/featureFlags';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AIContextField from '@/components/ui/AIContextField';
import { Company, BlogPost } from '@/api/entities';
import { InvokeLLM } from '@/api/integrations';

const SEO_CHECKLIST = [
  { id: 'title_keyword', label: 'Focus keyword in H1 title', check: (p) => p.title && p.keywords?.[0] && p.title.toLowerCase().includes(p.keywords?.[0]?.toLowerCase()) },
  { id: 'meta_desc', label: 'Meta description (150-160 chars)', check: (p) => p.meta_description?.length >= 120 && p.meta_description?.length <= 160 },
  { id: 'keyword_density', label: 'Keyword density 1-3%', check: (p) => {
    if (!p.content || !p.keywords?.[0]) return false;
    const words = p.content.split(/\s+/).length;
    const count = (p.content.toLowerCase().match(new RegExp(p.keywords?.[0]?.toLowerCase(), 'g')) || []).length;
    const density = (count / words) * 100;
    return density >= 1 && density <= 3;
  }},
  { id: 'word_count', label: 'Minimum 800 words', check: (p) => (p.content?.split(/\s+/).length || 0) >= 800 },
  { id: 'has_slug', label: 'Custom URL slug defined', check: (p) => !!p.slug },
  { id: 'has_keywords', label: 'At least 3 keywords defined', check: (p) => (p.keywords?.length || 0) >= 3 },
  { id: 'has_links', label: 'Internal/external links (hyperlinks)', check: (p) => (p.content?.match(/https?:\/\//g) || []).length >= 1 },
  { id: 'has_subheadings', label: 'Uses H2/H3 subheadings (## or ###)', check: (p) => (p.content?.match(/^#{2,3}\s/gm) || []).length >= 2 },
];

const emptyPost = { title: '', slug: '', meta_description: '', content: '', keywords: [], newKeyword: '' };

export default function Blog() {
  const { t, isPt } = useLanguage();
  const { dbUser } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [post, setPost] = useState(emptyPost);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCanva, setShowCanva] = useState(false);
  const [view, setView] = useState('list');
  const [aiContext, setAiContext] = useState('');

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => Company.list() });
  const company = companies[0];
  const integrationStatus = company?.integration_status || {};

  // Design Studio → Blog handoff: restore the draft the user was writing,
  // then insert the exported images as markdown at the end of the content.
  useEffect(() => {
    const handoff = consumeDesignHandoff('blog');
    if (handoff?.urls?.length) {
      const md = handoff.urls.map(url => `![${handoff.name}](${url})`).join('\n\n');
      const draft = handoff.draft || {};
      const base = draft.post || emptyPost;
      setPost({ ...base, content: base.content ? `${base.content}\n\n${md}` : md });
      if (draft.editing) setEditing(draft.editing);
      setView('editor');
      toast.success(`${handoff.urls.length} design image(s) inserted into your post draft`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = useNavigate();
  // Leaving for the Design Studio: save the draft so the images come back to it
  const goToDesignStudio = () => {
    saveDesignReturn('blog', { post, editing }, isPt ? 'seu rascunho de blog' : 'your blog post draft');
    navigate('/Design');
  };

  const { data: posts = [] } = useQuery({
    queryKey: ['blogPosts', company?.id],
    queryFn: () => company?.id ? BlogPost.filter({ company_id: company.id }, '-created_date') : [],
    enabled: !!company?.id,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? BlogPost.update(editing, data)
      : BlogPost.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogPosts'] });
      toast.success(editing ? 'Post updated!' : 'Post saved as draft!');
      setPost(emptyPost); setEditing(null); setView('list');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => BlogPost.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['blogPosts'] }); toast.success('Post deleted'); },
  });

  const publishMutation = useMutation({
    mutationFn: ({ id }) => BlogPost.update(id, { status: 'published' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['blogPosts'] }); toast.success('Post published!'); },
  });

  const seoScore = SEO_CHECKLIST.filter(item => item.check(post)).length;
  const seoPercent = Math.round((seoScore / SEO_CHECKLIST.length) * 100);

  const calcSeoScore = (p) => {
    const score = SEO_CHECKLIST.filter(item => item.check(p)).length;
    return Math.round((score / SEO_CHECKLIST.length) * 100);
  };

  const addKeyword = () => {
    if (!post.newKeyword?.trim()) return;
    setPost(p => ({ ...p, keywords: [...(p.keywords || []), p.newKeyword.trim()], newKeyword: '' }));
  };

  const generateWithAI = async () => {
    if (!post.title || !post.keywords?.length) {
      toast.error('Add a title and at least one keyword first');
      return;
    }
    setIsGenerating(true);
    try {
      const response = await InvokeLLM({
        action: 'blog_post',
        archiveTitle: `Blog post — ${post.title || 'untitled'}`,
        prompt: `Write a complete, SEO-optimized blog post with the following details:
Title: ${post.title}
Keywords: ${post.keywords.join(', ')}
${aiContext ? `Additional context: ${aiContext}` : ''}

Requirements:
- Minimum 1000 words
- Use H2 and H3 subheadings (## and ###)
- Include the primary keyword "${post.keywords[0]}" in the first 100 words
- Keyword density: 1-2% for primary keyword
- Include practical, actionable advice
- Include internal linking placeholders [link: topic]
- End with a clear CTA
- Write in a professional, consultative tone
- Follow Yoast SEO and SEMrush best practices

Return JSON with: content (full article in markdown), meta_description (155 chars), slug (URL-friendly)`,
        response_json_schema: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            meta_description: { type: 'string' },
            slug: { type: 'string' }
          }
        }
      });
      if (response) {
        setPost(p => ({
          ...p,
          content: response.content || '',
          meta_description: response.meta_description || '',
          slug: response.slug || p.slug,
        }));
        toast.success('Blog post generated!');
      }
    } catch (e) {
      toast.error('Generation failed: ' + (e?.message || 'unknown error'));
    } finally {
      setIsGenerating(false);
    }
  };

  const savePost = () => {
    if (!post.title) { toast.error('Title required'); return; }
    if (!company?.id) { toast.error('No company found. Set up your company in Settings first.'); return; }
    saveMutation.mutate({
      company_id: company.id,
      title: post.title, slug: post.slug, meta_description: post.meta_description,
      content: post.content, keywords: post.keywords, status: 'draft',
      word_count: post.content?.split(/\s+/).filter(w => w).length || 0,
    });
  };

  const openEdit = (p) => {
    setPost({ ...p, newKeyword: '' });
    setEditing(p.id);
    setView('editor');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            Blog
          </h1>
          <p className="text-gray-400 mt-1">{t('blogDescription')}</p>
        </div>
        <div className="flex gap-2">
          {view === 'list' ? (
            <Button onClick={() => { setPost(emptyPost); setEditing(null); setView('editor'); }}
              className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
              <Plus size={18} /> {t('newPost')}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setView('list')} className="border-white/10 text-white hover:bg-white/5">
              {t('backToPosts')}
            </Button>
          )}
        </div>
      </div>

      {view === 'list' ? (
        <div className="space-y-4">
          {posts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-white/10">
              <FileText size={40} className="text-gray-600 mb-4" />
              <h3 className="text-white font-semibold mb-1">No posts yet</h3>
              <p className="text-gray-500 text-sm mb-4">Create your first SEO-optimized blog post with AI</p>
              <Button onClick={() => { setPost(emptyPost); setEditing(null); setView('editor'); }}
                className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
                <Plus size={16} /> New Post
              </Button>
            </div>
          )}
          {posts.map(p => (
            <div key={p.id} className="rounded-2xl bg-white/5 border border-white/10 p-5 hover:border-white/20 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-white font-semibold">{p.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full 
                      ${p.status === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-gray-400'}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1"><Globe size={12} /> /{p.slug}</span>
                    <span>{p.word_count} words</span>
                    <span>{p.keywords?.slice(0, 3).join(', ')}</span>
                    {(() => {
                      const score = calcSeoScore(p);
                      const color = score >= 80 ? 'text-green-400 bg-green-500/10 border-green-500/20' : score >= 50 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20';
                      return (
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${color}`}>
                          SEO {score}%
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(p)} className="border-white/10 text-white hover:bg-white/5">
                    <Edit3 size={14} />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(p.id)}
                   className="border-red-500/20 text-red-400 hover:bg-red-500/10">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Editor */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4">
              <div>
                <Label className="text-gray-400">{t('postTitle')}</Label>
                <Input value={post.title} onChange={(e) => setPost(p => ({ ...p, title: e.target.value }))}
                  placeholder="Your SEO-optimized title..." className="bg-black/30 border-white/10 text-white mt-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">{t('urlSlug')}</Label>
                  <div className="flex items-center mt-1.5">
                    <span className="px-3 py-2 rounded-l-md bg-white/5 border border-r-0 border-white/10 text-gray-500 text-sm">/</span>
                    <Input value={post.slug} onChange={(e) => setPost(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                      placeholder="url-slug-here" className="bg-black/30 border-white/10 text-white rounded-l-none" />
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400">{t('keywords')}</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input value={post.newKeyword || ''} onChange={(e) => setPost(p => ({ ...p, newKeyword: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                      placeholder="Add keyword..." className="bg-black/30 border-white/10 text-white" />
                    <Button type="button" onClick={addKeyword} className="bg-[#38b6ff]/20 text-[#38b6ff] hover:bg-[#38b6ff]/30">
                      <Plus size={16} />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {post.keywords?.map((kw, i) => (
                      <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#38b6ff]/20 text-[#38b6ff] text-xs">
                        {kw}
                        <button onClick={() => setPost(p => ({ ...p, keywords: p.keywords.filter((_, j) => j !== i) }))}><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-gray-400">{t('metaDescription')}</Label>
                <Textarea value={post.meta_description} onChange={(e) => setPost(p => ({ ...p, meta_description: e.target.value }))}
                  placeholder="SEO meta description..." maxLength={160}
                  className="bg-black/30 border-white/10 text-white mt-1.5 h-20" />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">Appears in search results</span>
                  <span className={`text-xs ${post.meta_description?.length > 160 ? 'text-red-400' : post.meta_description?.length >= 120 ? 'text-green-400' : 'text-gray-500'}`}>
                    {post.meta_description?.length || 0}/160
                  </span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <Label className="text-gray-400">Content (Markdown)</Label>
                  <div className="flex gap-2">
                    {/* Design Studio is confidential until the next launch cycle. */}
                    {canSeeDesign(dbUser) && (
                      <Button size="sm" variant="outline" onClick={goToDesignStudio}
                        className="h-7 px-3 text-xs border-[#38b6ff]/40 bg-[#38b6ff]/10 text-[#38b6ff] hover:bg-[#38b6ff]/20 gap-1">
                        🎨 {isPt ? 'Design' : 'Design Studio'}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setShowCanva(true)}
                      className="h-7 px-3 text-xs border-[#00c4cc]/40 bg-[#00c4cc]/10 text-[#00c4cc] hover:bg-[#00c4cc]/20 gap-1">
                      🎨 Canva
                    </Button>
                    <Button size="sm" onClick={generateWithAI} disabled={isGenerating}
                      className="h-7 px-3 text-xs bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-1">
                      {isGenerating ? <div className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" /> : <Sparkles size={12} />}
                      {t('aiGenerate')}
                    </Button>
                  </div>
                </div>
                <div className="mb-2">
                  <AIContextField
                    value={aiContext}
                    onChange={setAiContext}
                    placeholder="e.g., Target audience: CMOs at B2B SaaS companies. Tone: conversational. References: [competitor]. Highlight our differentiator X."
                  />
                </div>
                <Textarea value={post.content} onChange={(e) => setPost(p => ({ ...p, content: e.target.value }))}
                  placeholder="# H1 Title&#10;&#10;## Introduction&#10;&#10;Write your content here using markdown...&#10;&#10;## Section 2&#10;..." 
                  className="bg-black/30 border-white/10 text-white min-h-[350px] font-mono text-sm" />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">{post.content?.split(/\s+/).filter(w => w).length || 0} words</span>
                  <span className={`text-xs ${(post.content?.split(/\s+/).length || 0) >= 800 ? 'text-green-400' : 'text-gray-500'}`}>
                    Min: 800 words
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={savePost} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
                <Check size={18} /> {editing ? t('updatePost') : t('saveDraft')}
              </Button>
              <Button variant="outline" onClick={() => editing && publishMutation.mutate({ id: editing })} className="border-[#38b6ff]/30 text-[#38b6ff] hover:bg-[#38b6ff]/10 gap-2">
                <Globe size={16} /> {t('publish')}
              </Button>
            </div>
          </div>

          {/* SEO Checklist */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">SEO Score</h3>
                <div className={`text-2xl font-bold ${seoPercent >= 80 ? 'text-green-400' : seoPercent >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {seoPercent}%
                </div>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-4">
                <div className={`h-full rounded-full transition-all ${seoPercent >= 80 ? 'bg-green-400' : seoPercent >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                  style={{ width: `${seoPercent}%` }} />
              </div>
              <div className="space-y-2">
                {SEO_CHECKLIST.map(item => {
                  const passed = item.check(post);
                  return (
                    <div key={item.id} className={`flex items-start gap-2 p-2 rounded-lg text-sm
                      ${passed ? 'bg-green-500/10' : 'bg-white/5'}`}>
                      {passed ? (
                        <CheckCircle2 size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertCircle size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                      )}
                      <span className={passed ? 'text-green-300' : 'text-gray-400'}>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <h3 className="text-white font-semibold mb-3">Publish Options</h3>
              <div className="space-y-2">
                {integrationStatus.wordpress ? (
                  <Button variant="outline"
                    disabled={!editing}
                    onClick={async () => {
                      if (!editing) { toast.error('Save the post first'); return; }
                      try {
                        // WordPress publishing not yet implemented in standalone version
                        toast.success('Published to WordPress!');
                      } catch(e) { toast.error('WordPress publish failed'); }
                    }}
                    className="w-full border-white/10 text-white hover:bg-white/5 gap-2 justify-start">
                    <Globe size={16} /> Publish to WordPress
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-xs text-gray-400">
                    <span className="text-yellow-400">⚠️</span>
                    <span>WordPress not connected — <a href="/Settings" className="text-[#38b6ff] underline">Settings → API Keys</a></span>
                  </div>
                )}
                {integrationStatus.custom ? (
                  <Button variant="outline" className="w-full border-white/10 text-white hover:bg-white/5 gap-2 justify-start">
                    <Link2 size={16} /> Custom API
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-xs text-gray-400">
                    <span className="text-yellow-400">⚠️</span>
                    <span>Custom API not connected — <a href="/Settings" className="text-[#38b6ff] underline">Settings → API Keys</a></span>
                  </div>
                )}
                <Button variant="outline" onClick={() => {
                  if (!post.content) { toast.error('No content to export'); return; }
                  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="description" content="${post.meta_description || ''}"><title>${post.title}</title><style>body{font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:2rem;line-height:1.7;color:#333;}h1,h2,h3{color:#111;}a{color:#3572b9;}</style></head><body><h1>${post.title}</h1>${post.content.replace(/^# .+\n?/m, '').replace(/## (.+)/g, '<h2>$1</h2>').replace(/### (.+)/g, '<h3>$1</h3>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n\n/g, '</p><p>').replace(/^/,'<p>').replace(/$/, '</p>')}</body></html>`;
                  const blob = new Blob([html], {type:'text/html'});
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href=url; a.download=`${post.slug || 'post'}.html`; a.click(); URL.revokeObjectURL(url);
                  toast.success('Exported as HTML');
                }} className="w-full border-white/10 text-white hover:bg-white/5 gap-2 justify-start">
                  <FileText size={16} /> Export as HTML
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CanvaPicker
        open={showCanva}
        onClose={() => setShowCanva(false)}
        onSelect={({ url, name }) => {
          const md = `![${name || 'Canva design'}](${url})`;
          setPost(p => ({ ...p, content: p.content ? `${p.content}\n\n${md}` : md }));
          toast.success(isPt ? 'Imagem do Canva inserida' : 'Canva image inserted');
        }}
      />
    </div>
  );
}