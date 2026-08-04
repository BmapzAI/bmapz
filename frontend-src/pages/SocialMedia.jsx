import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { consumeDesignHandoff, saveDesignReturn, normalizeBrief } from '@/lib/designHandoff';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar, Plus, Clock, Sparkles, Edit3, Trash2, Check, X,
  ChevronLeft, ChevronRight, TrendingUp, BarChart3, Zap,
  RefreshCw, Eye, Heart, Share2, MessageCircle, Upload, FileImage, Wand2,
  FileText, CalendarClock, CheckCircle2, PencilLine
} from 'lucide-react';
import SocialCalendar from '@/components/social/SocialCalendar';
import SocialPerformanceTab from '@/components/social/SocialPerformanceTab';

import QuickStartGuide from '@/components/ui/QuickStartGuide';
import AIContextField from '@/components/ui/AIContextField';
import GoogleDriveImagePicker from '@/components/integrations/GoogleDriveImagePicker';
import CanvaPicker from '@/components/integrations/CanvaPicker';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { canSeeDesign } from '@/lib/featureFlags';
import { Company, SocialPost } from '@/api/entities';
import { InvokeLLM, GenerateImage, UploadFile } from '@/api/integrations';
import PlatformIcon from '@/components/ui/PlatformIcon';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', color: '#E1306C', icon: <PlatformIcon platform="instagram" /> },
  { value: 'linkedin', label: 'LinkedIn', color: '#0A66C2', icon: <PlatformIcon platform="linkedin" /> },
  { value: 'tiktok', label: 'TikTok', color: '#FF0050', icon: <PlatformIcon platform="tiktok" /> },
  { value: 'twitter', label: 'X (Twitter)', color: '#FFFFFF', icon: <PlatformIcon platform="twitter" /> },
  { value: 'youtube', label: 'YouTube', color: '#FF0000', icon: <PlatformIcon platform="youtube" /> },
  { value: 'facebook', label: 'Facebook', color: '#1877F2', icon: <PlatformIcon platform="facebook" /> },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

const HEATMAP_DATA = Array.from({ length: 7 }, (_, day) =>
  Array.from({ length: 24 }, (_, hour) => ({
    day, hour,
    score: Math.random() * 100,
    best: (day >= 1 && day <= 5) && (hour >= 8 && hour <= 11 || hour >= 13 && hour <= 17),
  }))
);

export default function SocialMedia() {
  const queryClient = useQueryClient();
  const { t, isPt } = useLanguage();
  const { dbUser } = useAuth();
  const [activeTab, setActiveTab] = useState('planning');
  const [selectedPlatforms, setSelectedPlatforms] = useState(['instagram', 'linkedin']);
  const [editingPost, setEditingPost] = useState(null);
  const [newPost, setNewPost] = useState({ title: '', content: '', platforms: [], type: 'text', scheduled_for: '' });
  const EMPTY_POST = { title: '', content: '', platforms: [], type: 'text', scheduled_for: '' };
  const openNewPost = (defaults = {}) => {
    setEditingPost({ ...EMPTY_POST, ...defaults, _isNew: true });
    setNewPost({ ...EMPTY_POST, ...defaults });
    setUploadedMedia(mediaFromUrls(defaults.media_urls));
  };
  // Rebuild the media strip from a saved post's media_urls. Without this, opening
  // a saved post showed an empty media strip (images looked lost) and saving then
  // wrote that empty list back over the real images.
  const mediaFromUrls = (urls) => (Array.isArray(urls) ? urls : []).map((url, i) => ({
    url,
    name: `media-${i + 1}`,
    type: /\.(mp4|mov|webm|avi)(\?|$)/i.test(url) ? 'video/mp4' : 'image/png',
  }));
  // Single entry point for editing an existing post, so every call site keeps the
  // images, the schedule and the editor in sync.
  const openExistingPost = (post, { goToContent = false } = {}) => {
    setEditingPost(post);
    setNewPost({ ...post, type: post.type || post.content_type || 'text' });
    setUploadedMedia(mediaFromUrls(post.media_urls));
    if (goToContent) {
      setActiveTab('content');
      // Scroll the editor into view — opening a post from a list further down
      // the page otherwise left the user staring at the list, as if nothing
      // had loaded.
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }
  };
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState([]);
  const [designBrief, setDesignBrief] = useState(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [isGeneratingAIImage, setIsGeneratingAIImage] = useState(false);
  const [aiImagePrompt, setAiImagePrompt] = useState('');
  const [showAiImageInput, setShowAiImageInput] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [optimizationInsights, setOptimizationInsights] = useState(null);
  const [generatedContent, setGeneratedContent] = useState(null);
  const [showGoogleDrivePicker, setShowGoogleDrivePicker] = useState(false);
  const [showCanva, setShowCanva] = useState(false);
  const navigate = useNavigate();

  // Design Studio → Social handoff: restore the draft the user was writing
  // before they left for Design, then attach the exported images to it.
  useEffect(() => {
    const handoff = consumeDesignHandoff('social');
    if (handoff?.urls?.length) {
      const media = handoff.urls.map((url, i) => ({ url, name: `${handoff.name}-${i + 1}.png`, type: 'image/png' }));
      const draft = handoff.draft || {};
      const restoredPost = { ...EMPTY_POST, ...(draft.newPost || {}), type: 'image' };
      setUploadedMedia([...(draft.uploadedMedia || []), ...media]);
      setEditingPost({ ...restoredPost, _isNew: true });
      setNewPost(restoredPost);
      toast.success(isPt
        ? `${media.length} imagem(ns) adicionada(s) ao seu rascunho de post`
        : `${media.length} image(s) added to your post draft`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving for the Design Studio: save the in-progress post so it survives
  // the round-trip and the exported images come back to THIS draft. Optionally
  // carry the AI design brief so Design can generate from it in one click.
  const goToDesignStudio = (brief) => {
    saveDesignReturn('social', { newPost, uploadedMedia }, isPt ? 'seu rascunho de post' : 'your post draft',
      brief ? normalizeBrief(brief, 'social') : null);
    navigate('/Design');
  };

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => Company.list(),
  });
  const company = companies[0];
  const integrationStatus = company?.integration_status || {};

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['socialPosts', company?.id],
    queryFn: () => company?.id ? SocialPost.filter({ company_id: company.id }, '-created_date') : [],
    enabled: !!company?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data) => SocialPost.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['socialPosts'] });
      toast.success(isPt ? 'Post salvo!' : 'Post saved!');
      setEditingPost(null);
      setNewPost({ ...EMPTY_POST });
      setUploadedMedia([]);
    },
    // Without this a failed save did nothing visible — the post silently vanished.
    onError: (e) => toast.error((isPt ? 'Falha ao salvar o post: ' : 'Could not save the post: ') + (e?.message || 'unknown error')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => SocialPost.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['socialPosts'] });
      toast.success(isPt ? 'Post atualizado!' : 'Post updated!');
      setEditingPost(null);
      setUploadedMedia([]);
    },
    onError: (e) => toast.error((isPt ? 'Falha ao atualizar o post: ' : 'Could not update the post: ') + (e?.message || 'unknown error')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => SocialPost.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['socialPosts'] }); toast.success(isPt ? 'Post excluído' : 'Post deleted'); },
  });

  const buildCompanyContext = () => {
    const icp = company?.icp || {};
    const briefing = company?.briefing || {};
    return `Company: ${company?.name || 'Not set'}
Industry: ${company?.industry || 'Not set'}
Services: ${company?.services_description || 'Not set'}
Tone of voice: ${briefing.tone_of_voice?.join(', ') || 'Professional'}
Value propositions: ${company?.value_propositions?.join(', ') || 'Not set'}
ICP - Job titles: ${icp.job_titles?.join(', ') || 'Not set'}
ICP - Industries: ${icp.industries?.join(', ') || 'Not set'}`;
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const response = await InvokeLLM({
        prompt: `You are a social media expert. Create high-performing social media posts using this company context:

${buildCompanyContext()}

User request: "${aiPrompt}"
${newPost.ai_context ? `\nAdditional context provided by user: ${newPost.ai_context}` : ''}

Create optimized versions for LinkedIn and Instagram. 
For LinkedIn: professional tone, thought leadership, more text.
For Instagram: visual-focused, engaging, with hashtags.

Return JSON with: title, linkedin_content, instagram_content, content_type (text/carousel/video), 
suggested_hashtags array, best_posting_time (e.g. "Tuesday 10am"), 
performance_prediction (object with: expected_reach, engagement_rate_estimate, best_for)`,
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            linkedin_content: { type: 'string' },
            instagram_content: { type: 'string' },
            content_type: { type: 'string' },
            suggested_hashtags: { type: 'array', items: { type: 'string' } },
            best_posting_time: { type: 'string' },
            performance_prediction: {
              type: 'object',
              properties: {
                expected_reach: { type: 'string' },
                engagement_rate_estimate: { type: 'string' },
                best_for: { type: 'string' }
              }
            }
          }
        }
      });
      if (response) {
        setGeneratedContent(response);
        const aiPost = {
          title: response.title || 'AI Generated Post',
          content: response.linkedin_content || response.instagram_content || '',
          platform_contents: { linkedin: response.linkedin_content, instagram: response.instagram_content },
          platforms: ['linkedin', 'instagram'],
          type: response.content_type || 'text',
          hashtags: response.suggested_hashtags || [],
          scheduled_for: '',
          _isNew: true,
        };
        setNewPost(aiPost);
        setEditingPost(aiPost);
        setAiPrompt('');
        toast.success(isPt ? 'Conteúdo gerado com IA!' : 'Content generated with AI!');
      }
    } catch (e) {
      toast.error('Generation failed: ' + (e?.message || 'unknown error'));
    } finally {
      setIsGenerating(false);
    }
  };

  const analyzeAndOptimize = async () => {
    const publishedPosts = posts.filter(p => p.status === 'published' && p.performance);
    const scheduledPosts = posts.filter(p => p.status === 'scheduled');

    if (publishedPosts.length === 0 && scheduledPosts.length === 0) {
      toast.error('No published or scheduled posts to analyze');
      return;
    }

    setIsOptimizing(true);
    try {
      const response = await InvokeLLM({
        prompt: `You are a social media analytics expert. Analyze performance data and optimize the schedule.

Company context:
${buildCompanyContext()}

Published posts performance:
${JSON.stringify(publishedPosts.map(p => ({ title: p.title, platform: p.platforms, performance: p.performance, scheduled_for: p.scheduled_for })), null, 2)}

Scheduled posts for next week:
${JSON.stringify(scheduledPosts.map(p => ({ title: p.title, platforms: p.platforms, scheduled_for: p.scheduled_for })), null, 2)}

Based on the performance data:
1. Identify which post types/times performed best
2. For each scheduled post, suggest the optimal posting time and any content improvements
3. Provide actionable recommendations to increase engagement

Return JSON with:
- insights: array of {observation: string, impact: string}
- optimizations: array of {post_title: string, current_time: string, suggested_time: string, reason: string, content_tip: string}
- top_performing_pattern: string
- next_week_strategy: string`,
        response_json_schema: {
          type: 'object',
          properties: {
            insights: { type: 'array', items: { type: 'object', properties: { observation: { type: 'string' }, impact: { type: 'string' } } } },
            optimizations: { type: 'array', items: { type: 'object', properties: { post_title: { type: 'string' }, current_time: { type: 'string' }, suggested_time: { type: 'string' }, reason: { type: 'string' }, content_tip: { type: 'string' } } } },
            top_performing_pattern: { type: 'string' },
            next_week_strategy: { type: 'string' }
          }
        }
      });
      setOptimizationInsights(response);
      toast.success(isPt ? 'Análise de otimização com IA concluída!' : 'AI optimization analysis complete!');
    } catch (e) {
      toast.error('Optimization failed: ' + (e?.message || 'unknown error'));
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleMediaUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setIsUploadingMedia(true);
    try {
      const results = await Promise.all(files.map(f => UploadFile({ file: f })));
      const newMedia = results.map((r, i) => ({ url: r.url || r.file_url, name: files[i].name, type: files[i].type }));
      setUploadedMedia(prev => [...prev, ...newMedia]);
      toast.success(`${files.length} file(s) uploaded`);
    } catch { toast.error('Upload failed'); }
    finally { setIsUploadingMedia(false); }
  };

  const generateAIImage = async () => {
    if (!aiImagePrompt.trim()) return;
    setIsGeneratingAIImage(true);
    try {
      const result = await GenerateImage({
        prompt: `Social media post image. ${aiImagePrompt}. High quality, visually engaging, suitable for ${(newPost.platforms || []).join(', ') || 'social media'}.`,
      });
      if (result?.url) {
        setUploadedMedia(prev => [...prev, { url: result.url, name: 'AI Generated', type: 'image/png' }]);
        setAiImagePrompt('');
        setShowAiImageInput(false);
        toast.success('AI image generated and added!');
      }
    } catch { toast.error('Image generation failed'); }
    finally { setIsGeneratingAIImage(false); }
  };

  const generateDesignBrief = async () => {
    setIsGeneratingBrief(true);
    const platforms = (newPost.platforms || []).join(', ') || 'general social media';
    const contentType = newPost.type || 'text';
    try {
      const response = await InvokeLLM({
        prompt: `You are a creative director. Generate a concise design brief for a ${contentType} post for ${platforms}.
Post title: "${newPost.title || 'Untitled'}"
Post content: "${newPost.content || ''}"
Company: ${company?.name || ''}, Industry: ${company?.industry || ''}

Return JSON with: visual_concept, color_palette (array of hex codes), typography_suggestion, image_style, dimensions (object with platform-specific sizes), mood, do_list (array), dont_list (array).`,
        response_json_schema: {
          type: 'object',
          properties: {
            visual_concept: { type: 'string' },
            color_palette: { type: 'array', items: { type: 'string' } },
            typography_suggestion: { type: 'string' },
            image_style: { type: 'string' },
            dimensions: { type: 'object' },
            mood: { type: 'string' },
            do_list: { type: 'array', items: { type: 'string' } },
            dont_list: { type: 'array', items: { type: 'string' } },
          }
        }
      });
      setDesignBrief(response);
      toast.success('Design brief generated!');
    } catch { toast.error('Failed to generate brief'); }
    finally { setIsGeneratingBrief(false); }
  };

  const PLATFORM_FORMATS = {
    instagram: { image: '1:1 (1080×1080)', story: '9:16 (1080×1920)', carousel: '1:1 or 4:5', video: 'MP4, max 60s' },
    linkedin: { image: '1.91:1 (1200×628)', article: '1:1 (1200×1200)', video: 'MP4, max 10min' },
    tiktok: { video: '9:16 (1080×1920), MP4, max 10min' },
    twitter: { image: '16:9 (1200×675)', video: 'MP4, max 2min 20s' },
    youtube: { thumbnail: '16:9 (1280×720)', shorts: '9:16 (1080×1920)' },
    facebook: { image: '1.91:1 (1200×630)', story: '9:16 (1080×1920)', video: 'MP4, max 240min' },
  };

  // social_posts.content_type is CHECK-constrained to these four values, so an
  // AI-suggested free-text type must be normalized or the whole save is rejected.
  const CONTENT_TYPES = ['text', 'carousel', 'video', 'image'];
  const safeContentType = (...candidates) => {
    for (const c of candidates) {
      const v = String(c || '').toLowerCase().trim();
      if (CONTENT_TYPES.includes(v)) return v;
    }
    return 'text';
  };

  // The media strip is the single source of truth while the editor is open; it is
  // seeded from the post's saved media_urls, so this never wipes existing images.
  const currentMediaUrls = () => {
    const fromStrip = uploadedMedia.map(m => m.url).filter(Boolean);
    if (fromStrip.length) return fromStrip;
    return Array.isArray(newPost.media_urls) ? newPost.media_urls : [];
  };

  // One save path for both new and existing posts.
  const handleSavePost = () => {
    if (!newPost.title?.trim()) { toast.error(isPt ? 'Adicione um título' : 'Add a title'); return; }
    if (!company?.id) { toast.error(isPt ? 'Empresa não encontrada' : 'No company found'); return; }
    const media_urls = currentMediaUrls();
    const isNew = !!editingPost?._isNew || !editingPost?.id;
    // scheduled_for is a TIMESTAMPTZ: an empty string from the date input makes
    // Postgres reject the whole row, which is why saves silently did nothing.
    const scheduled_for = newPost.scheduled_for?.trim() ? newPost.scheduled_for : null;

    if (isNew) {
      createMutation.mutate({
        ...newPost,
        company_id: company.id,
        scheduled_for,
        status: scheduled_for ? 'scheduled' : 'draft',
        content_type: safeContentType(newPost.type, newPost.content_type),
        ai_generated: !!generatedContent,
        media_urls,
      });
    } else {
      updateMutation.mutate({
        id: editingPost.id,
        data: {
          ...newPost,
          scheduled_for,
          // Keep a published post published; otherwise reflect the schedule field.
          status: newPost.status === 'published'
            ? 'published'
            : (scheduled_for ? 'scheduled' : 'draft'),
          content_type: safeContentType(newPost.type, newPost.content_type),
          media_urls,
        },
      });
    }
    setGeneratedContent(null);
    setDesignBrief(null);
  };
  const savePost = handleSavePost;

  const heatColor = (score, best) => {
    if (best && score > 60) return 'bg-[#38b6ff] opacity-90';
    if (score > 70) return 'bg-[#38b6ff] opacity-60';
    if (score > 40) return 'bg-[#38b6ff] opacity-30';
    return 'bg-white/5';
  };

  const scheduledPosts = posts.filter(p => p.status === 'scheduled');
  const publishedPosts = posts.filter(p => p.status === 'published');
  const draftPosts = posts.filter(p => p.status === 'draft');

  const PostCard = ({ post }) => {
    const canPublish = (post.platforms || []).some(p =>
      (p === 'instagram' || p === 'facebook') ? integrationStatus.meta :
      p === 'linkedin' ? integrationStatus.linkedin :
      false
    );
    const handleDoubleClick = () => {
      if (post.status !== 'published') openExistingPost(post, { goToContent: true });
    };
    return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 hover:border-white/20 transition-all group cursor-pointer"
      onDoubleClick={handleDoubleClick}
      title={post.status !== 'published' ? 'Double-click to edit' : ''}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex gap-1 flex-wrap">
          {(post.platforms || []).map(p => (
            <span key={p} className="text-lg">{PLATFORMS.find(pl => pl.value === p)?.icon}</span>
          ))}
          {post.ai_generated && <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#cb6ce6]/20 text-[#cb6ce6] flex items-center gap-0.5"><Sparkles size={10} />AI</span>}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full
          ${post.status === 'published' ? 'bg-green-500/20 text-green-400' :
            post.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
            'bg-white/10 text-gray-400'}`}>
          {post.status}
        </span>
      </div>
      <h4 className="text-white font-medium text-sm mb-2">{post.title}</h4>
      <p className="text-gray-400 text-xs line-clamp-3">{post.content}</p>
      {post.performance && (
        <div className="flex gap-3 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Heart size={10} className="text-red-400" />{post.performance.likes || 0}</span>
          <span className="flex items-center gap-1"><MessageCircle size={10} className="text-blue-400" />{post.performance.comments || 0}</span>
          <span className="flex items-center gap-1"><Share2 size={10} className="text-green-400" />{post.performance.shares || 0}</span>
          {post.performance.engagement_rate && <span className="flex items-center gap-1"><TrendingUp size={10} className="text-[#38b6ff]" />{post.performance.engagement_rate}%</span>}
        </div>
      )}
      {post.scheduled_for && (
        <p className="text-gray-500 text-xs mt-2 flex items-center gap-1">
          <Clock size={10} /> {new Date(post.scheduled_for).toLocaleString()}
        </p>
      )}
      <div className="flex gap-2 mt-3">
        <Button size="sm" variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/5 text-xs"
          onClick={() => openExistingPost(post)}>
          {t('edit')}
        </Button>
        <Button size="sm" variant="outline" className="border-red-500/20 text-red-400 hover:bg-red-500/10"
          onClick={() => deleteMutation.mutate(post.id)}>
          <Trash2 size={14} />
        </Button>
      </div>
      {!canPublish && post.status === 'draft' && (
        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
          <span className="text-yellow-400">•</span>
          Connect accounts in <a href="/Settings" className="text-[#38b6ff] underline ml-1">Settings</a> to publish
        </p>
      )}
    </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            {t('socialMediaTitle')}
          </h1>
          <p className="text-gray-400 mt-1">{t('socialMediaSubtitle')}</p>
        </div>
        <Button onClick={analyzeAndOptimize} disabled={isOptimizing}
          className="bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2">
          {isOptimizing ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Zap size={16} />}
          {t('aiOptimize')}
        </Button>

        {/* Meta/LinkedIn connection status hints */}
        {!integrationStatus.meta && !integrationStatus.linkedin && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-xs text-gray-400">
            <span className="text-yellow-400">•</span>
            <span>Connect social accounts in <a href="/Settings" className="text-[#38b6ff] underline">Settings → API Keys</a> to auto-publish</span>
          </div>
        )}
      </div>

      <QuickStartGuide
        id="social_media"
        title={isPt ? 'Início Rápido: Redes Sociais' : 'Social Media Quick Start'}
        steps={[t('smQs1'), t('smQs2'), t('smQs3'), t('smQs4')]}
      />

      {/* AI Optimization Insights */}
      {optimizationInsights && (
        <div className="rounded-2xl bg-gradient-to-r from-[#cb6ce6]/10 to-[#38b6ff]/10 border border-[#38b6ff]/20 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2"><Zap size={18} className="text-[#38b6ff]" />AI Optimization Results</h3>
            <button onClick={() => setOptimizationInsights(null)} className="text-gray-400 hover:text-white"><X size={16} /></button>
          </div>
          {optimizationInsights.top_performing_pattern && (
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <p className="text-green-400 text-xs font-medium mb-1">Top Performing Pattern</p>
              <p className="text-white text-sm">{optimizationInsights.top_performing_pattern}</p>
            </div>
          )}
          {optimizationInsights.insights?.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {optimizationInsights.insights.map((insight, i) => (
                <div key={i} className="p-3 rounded-xl bg-black/30 border border-white/10">
                  <p className="text-white text-sm font-medium">{insight.observation}</p>
                  <p className="text-[#38b6ff] text-xs mt-1">{insight.impact}</p>
                </div>
              ))}
            </div>
          )}
          {optimizationInsights.optimizations?.length > 0 && (
            <div>
              <p className="text-gray-400 text-sm font-medium mb-2">Schedule Optimizations:</p>
              <div className="space-y-2">
                {optimizationInsights.optimizations.map((opt, i) => (
                  <div key={i} className="p-3 rounded-xl bg-black/30 border border-white/10 flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{opt.post_title}</p>
                      <p className="text-gray-400 text-xs">Move from <span className="text-red-400">{opt.current_time}</span> → <span className="text-green-400">{opt.suggested_time}</span></p>
                      <p className="text-gray-500 text-xs mt-1">{opt.reason}</p>
                      {opt.content_tip && <p className="text-[#38b6ff] text-xs mt-1 italic">= {opt.content_tip}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {optimizationInsights.next_week_strategy && (
            <div className="p-3 rounded-xl bg-[#38b6ff]/10 border border-[#38b6ff]/20">
              <p className="text-[#38b6ff] text-xs font-medium mb-1">Next Week Strategy</p>
              <p className="text-white text-sm">{optimizationInsights.next_week_strategy}</p>
            </div>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="planning" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <Calendar size={16} className="mr-2" /> {t('planning')}
          </TabsTrigger>
          <TabsTrigger value="content" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <Edit3 size={16} className="mr-2" /> {t('contentTab')}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <BarChart3 size={16} className="mr-2" /> {t('analytics')}
          </TabsTrigger>
          <TabsTrigger value="posts" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <TrendingUp size={16} className="mr-2" /> {t('posts')}
          </TabsTrigger>
          <TabsTrigger value="performance" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <BarChart3 size={16} className="mr-2" /> {t('performance')}
          </TabsTrigger>
        </TabsList>

        {/* Planning Tab */}
        <TabsContent value="planning" className="space-y-6">
          {/* Interactive Calendar */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-[#38b6ff]" /> {isPt ? 'Calendário de Conteúdo' : 'Content Calendar'}
            </h3>
            <SocialCalendar
              posts={posts}
              onDayClick={(day) => {
                openNewPost({ scheduled_for: day.toISOString().slice(0, 16) });
              }}
              onPostClick={(post) => openExistingPost(post)}
              onPostDoubleClick={(post) => {
                if (post.status !== 'published') openExistingPost(post, { goToContent: true });
              }}
            />
          </div>

          {/* Scheduled Posts */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">{isPt ? 'Posts Agendados' : 'Scheduled Posts'} ({scheduledPosts.length})</h3>
              <Button onClick={() => openNewPost()} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2" size="sm">
                <Plus size={16} /> {t('schedulePost')}
              </Button>
            </div>
            <div className="space-y-3">
              {scheduledPosts.map(post => (
                <div key={post.id}
                  className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:border-[#38b6ff]/30 transition-all"
                  onDoubleClick={() => openExistingPost(post, { goToContent: true })}
                  title="Double-click to edit"
                >
                  <div className="flex gap-1">{(post.platforms || []).map(p => <span key={p} className="text-lg">{PLATFORMS.find(pl => pl.value === p)?.icon}</span>)}</div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{post.title}</p>
                    <p className="text-gray-500 text-xs">{post.scheduled_for ? new Date(post.scheduled_for).toLocaleString() : 'Not scheduled'}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">Scheduled</span>
                  <span className="text-gray-600 text-[10px]">dbl-click</span>
                </div>
              ))}
              {scheduledPosts.length === 0 && <p className="text-gray-500 text-sm text-center py-4">{t('noPostsScheduled')}</p>}
            </div>
          </div>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-6">
          {/* AI Generation */}
          <div className="rounded-2xl bg-gradient-to-r from-[#3572b9]/10 to-[#cb6ce6]/10 border border-[#38b6ff]/20 p-6">
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <Sparkles size={18} className="text-[#38b6ff]" /> {t('generateWithAI')}
              {company && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 flex items-center gap-1 ml-2"><Check size={10} />Using {company.name} data</span>}
            </h3>
            <p className="text-gray-400 text-sm mb-3">Describe what you want to post  AI creates platform-optimized versions using your company briefing and ICP</p>
            <div className="flex gap-3">
              <Input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., Why ICP matters for B2B sales, post for marketing directors..."
                className="flex-1 bg-black/30 border-white/10 text-white"
                onKeyDown={(e) => e.key === 'Enter' && generateWithAI()} />
              <Button onClick={generateWithAI} disabled={isGenerating || !aiPrompt.trim()}
                className="bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2">
                {isGenerating ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Sparkles size={16} />}
                Generate
              </Button>
            </div>
            <AIContextField
              value={newPost.ai_context || ''}
              onChange={(val) => setNewPost(p => ({ ...p, ai_context: val }))}
              placeholder="e.g., We are launching a new course on Aug 15. Target: CMOs. Reference: Alex Hormozi style."
            />
          </div>

          {/* New/Edit Post Form */}
          {editingPost && (
            <div className="rounded-2xl bg-white/5 border border-[#38b6ff]/30 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold">{editingPost._isNew ? 'New Post' : 'Edit Post'}</h3>
                <button onClick={() => { setEditingPost(null); setGeneratedContent(null); }} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>

              {/* Performance prediction from AI */}
              {generatedContent?.performance_prediction && (
                <div className="p-3 rounded-xl bg-[#38b6ff]/10 border border-[#38b6ff]/20 flex gap-4 text-xs">
                  <div><span className="text-gray-400">Expected reach: </span><span className="text-white">{generatedContent.performance_prediction.expected_reach}</span></div>
                  <div><span className="text-gray-400">Est. engagement: </span><span className="text-white">{generatedContent.performance_prediction.engagement_rate_estimate}</span></div>
                  <div><span className="text-gray-400">Best for: </span><span className="text-[#38b6ff]">{generatedContent.performance_prediction.best_for}</span></div>
                  {generatedContent.best_posting_time && <div><span className="text-gray-400">Best time: </span><span className="text-green-400">{generatedContent.best_posting_time}</span></div>}
                </div>
              )}

              <Input value={newPost.title} onChange={(e) => setNewPost(p => ({ ...p, title: e.target.value }))}
                placeholder="Post title..." className="bg-black/30 border-white/10 text-white" />

              <div>
                <p className="text-gray-400 text-sm mb-2">Platforms:</p>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(p => (
                    <button key={p.value}
                      onClick={() => setNewPost(prev => ({
                        ...prev,
                        platforms: prev.platforms?.includes(p.value)
                          ? prev.platforms.filter(x => x !== p.value)
                          : [...(prev.platforms || []), p.value]
                      }))}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all
                        ${(newPost.platforms || []).includes(p.value) ? 'border-[#38b6ff]/50 text-white bg-[#38b6ff]/10' : 'border-white/10 text-gray-400'}`}>
                      {p.icon} {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Per-platform content if AI generated */}
              {generatedContent && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {generatedContent.linkedin_content && (
                    <div>
                      <p className="text-[#0077b5] text-xs font-medium mb-1">= LinkedIn Version</p>
                      <Textarea value={generatedContent.linkedin_content}
                        onChange={e => setGeneratedContent(p => ({ ...p, linkedin_content: e.target.value }))}
                        className="min-h-[120px] bg-black/30 border-white/10 text-white text-xs" />
                    </div>
                  )}
                  {generatedContent.instagram_content && (
                    <div>
                      <p className="text-[#E1306C] text-xs font-medium mb-1">= Instagram Version</p>
                      <Textarea value={generatedContent.instagram_content}
                        onChange={e => setGeneratedContent(p => ({ ...p, instagram_content: e.target.value }))}
                        className="min-h-[120px] bg-black/30 border-white/10 text-white text-xs" />
                    </div>
                  )}
                </div>
              )}

              <Textarea value={newPost.content} onChange={(e) => setNewPost(p => ({ ...p, content: e.target.value }))}
                placeholder="Main post content..." className="min-h-[120px] bg-black/30 border-white/10 text-white" />

              {/* Media Upload */}
              <div>
                <p className="text-gray-400 text-sm mb-2 flex items-center gap-2"><FileImage size={14} /> Media Upload (optional):</p>
                {(newPost.platforms || []).length > 0 && (
                  <div className="mb-2 p-2 rounded-lg bg-black/20 border border-white/5 text-xs text-gray-400 space-y-0.5">
                    {(newPost.platforms || []).map(p => {
                      const formats = PLATFORM_FORMATS[p];
                      if (!formats) return null;
                      return <div key={p}><span className="font-medium" style={{color: PLATFORMS.find(pl=>pl.value===p)?.color}}>{PLATFORMS.find(pl=>pl.value===p)?.label}:</span> {Object.entries(formats).map(([k,v])=>`${k}: ${v}`).join(' → ')}</div>;
                    })}
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer text-sm text-gray-300 transition-all ${isUploadingMedia ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload size={14} />
                    {isUploadingMedia ? 'Uploading...' : 'Add Media'}
                    <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} disabled={isUploadingMedia} />
                  </label>
                  {/* Design Studio (and anything naming it) is confidential
                      until the next launch cycle — App Owner only. */}
                  {canSeeDesign(dbUser) && (
                    <>
                      <button
                        onClick={generateDesignBrief}
                        disabled={isGeneratingBrief}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#cb6ce6]/40 bg-[#cb6ce6]/10 hover:bg-[#cb6ce6]/20 text-[#cb6ce6] text-sm transition-all disabled:opacity-50"
                      >
                        {isGeneratingBrief ? <div className="w-3 h-3 rounded-full border-2 border-[#cb6ce6] border-t-transparent animate-spin" /> : <Wand2 size={14} />}
                        AI Design Brief
                      </button>
                      <button
                        onClick={goToDesignStudio}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#38b6ff]/40 bg-[#38b6ff]/10 hover:bg-[#38b6ff]/20 text-[#38b6ff] text-sm transition-all"
                      >
                        <Sparkles size={14} />
                        {isPt ? 'Design' : 'Design Studio'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setShowGoogleDrivePicker(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm transition-all"
                  >
                    <FileImage size={14} />
                    Google Drive
                  </button>
                  <button
                    onClick={() => setShowCanva(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#00c4cc]/40 bg-[#00c4cc]/10 hover:bg-[#00c4cc]/20 text-[#00c4cc] text-sm transition-all"
                  >
                    🎨 Canva
                  </button>
                </div>
                {showAiImageInput && (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={aiImagePrompt}
                      onChange={e => setAiImagePrompt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && generateAIImage()}
                      placeholder="Describe the image you want to generate..."
                      className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder:text-gray-600 text-sm focus:outline-none focus:border-[#38b6ff]/50"
                    />
                    <button
                      onClick={generateAIImage}
                      disabled={isGeneratingAIImage || !aiImagePrompt.trim()}
                      className="px-4 py-2 rounded-lg bg-[#38b6ff] text-black text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isGeneratingAIImage ? <div className="w-3 h-3 rounded-full border-2 border-black border-t-transparent animate-spin" /> : <Sparkles size={13} />}
                      {isGeneratingAIImage ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                )}
                {uploadedMedia.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {uploadedMedia.map((m, i) => (
                      <div key={i} className="relative group">
                        {m.type.startsWith('image/') ? (
                          <img src={m.url} alt={m.name} className="w-16 h-16 rounded-lg object-cover border border-white/10" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs text-gray-400"></div>
                        )}
                        <button onClick={() => setUploadedMedia(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100">•</button>
                      </div>
                    ))}
                  </div>
                )}
                {designBrief && (
                  <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-[#cb6ce6]/10 to-[#38b6ff]/10 border border-[#cb6ce6]/20 space-y-2">
                    <p className="text-[#cb6ce6] text-xs font-semibold flex items-center gap-1"><Wand2 size={12} /> AI Design Brief</p>
                    {designBrief.visual_concept && <p className="text-white text-xs"><span className="text-gray-400">Concept: </span>{designBrief.visual_concept}</p>}
                    {designBrief.mood && <p className="text-white text-xs"><span className="text-gray-400">Mood: </span>{designBrief.mood}</p>}
                    {designBrief.image_style && <p className="text-white text-xs"><span className="text-gray-400">Style: </span>{designBrief.image_style}</p>}
                    {designBrief.color_palette?.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs">Colors:</span>
                        {designBrief.color_palette.map((c, i) => <div key={i} className="w-5 h-5 rounded-full border border-white/20" style={{backgroundColor: c}} title={c} />)}
                      </div>
                    )}
                    <button onClick={() => goToDesignStudio(designBrief)}
                      className="w-full mt-1 py-1.5 rounded-lg text-xs bg-[#38b6ff]/15 border border-[#38b6ff]/40 text-[#38b6ff] hover:bg-[#38b6ff]/25 transition-all">
                      🎨 {isPt ? 'Criar imagem no Design com este brief' : 'Create image in Design from this brief'}
                    </button>
                    {designBrief.do_list?.length > 0 && <div className="text-xs text-green-400"> {designBrief.do_list.slice(0,2).join(' → ')}</div>}
                    {designBrief.dont_list?.length > 0 && <div className="text-xs text-red-400">L {designBrief.dont_list.slice(0,2).join(' → ')}</div>}
                  </div>
                )}
              </div>

              <div>
                <p className="text-gray-400 text-sm mb-2">Schedule date & time (optional):</p>
                <Input type="datetime-local" value={newPost.scheduled_for}
                  onChange={(e) => setNewPost(p => ({ ...p, scheduled_for: e.target.value }))}
                  className="bg-black/30 border-white/10 text-white w-fit" />
              </div>

              <div className="flex gap-3">
                <Button onClick={handleSavePost} disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
                  {(createMutation.isPending || updateMutation.isPending)
                    ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    : <Check size={16} />}
                  {editingPost._isNew ? (isPt ? 'Salvar Post' : 'Save Post') : t('updatePost')}
                </Button>
                <Button variant="outline" onClick={() => { setEditingPost(null); setGeneratedContent(null); setUploadedMedia([]); }}
                  className="border-white/10 text-white hover:bg-white/5">{t('cancel')}</Button>
              </div>
            </div>
          )}

          {/* Posts Grid */}
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">{isPt ? 'Todos os Posts' : 'All Posts'} ({posts.length})</h3>
            <Button onClick={() => openNewPost()} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2" size="sm">
              <Plus size={16} /> {t('newPostBtn')}
            </Button>
          </div>
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl bg-white/5 border border-white/10">
              <Calendar size={48} className="text-gray-600 mb-4" />
              <p className="text-white font-semibold">{t('noPostsYet')}</p>
              <p className="text-gray-400 text-sm mt-1">{isPt ? 'Gere com IA ou crie manualmente' : 'Generate with AI or create manually'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {posts.map(post => <PostCard key={post.id} post={post} />)}
            </div>
          )}
        </TabsContent>

        {/* Posts Tab  Published history + Boosting suggestions */}
        <TabsContent value="posts" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-white font-semibold">{t('postedPosts')} ({publishedPosts.length})</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-2">
                {PLATFORMS.map(p => (
                  <button key={p.value}
                    onClick={() => setSelectedPlatforms(prev => prev.includes(p.value) ? prev.filter(x => x !== p.value) : [...prev, p.value])}
                    className={`text-lg transition-all rounded-lg px-2 py-1 border ${selectedPlatforms.includes(p.value) ? 'border-[#38b6ff]/50 bg-[#38b6ff]/10' : 'border-white/10 opacity-40'}`}
                    title={p.label}>
                    {p.icon}
                  </button>
                ))}
              </div>
              <Button onClick={analyzeAndOptimize} disabled={isOptimizing}
                className="bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2" size="sm">
                {isOptimizing ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Zap size={14} />}
                Get Boosting Suggestions
              </Button>
            </div>
          </div>
          {publishedPosts.filter(post => selectedPlatforms.length === 0 || (post.platforms || []).some(p => selectedPlatforms.includes(p))).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl bg-white/5 border border-white/10 text-center">
              <TrendingUp size={48} className="text-gray-600 mb-4" />
              <p className="text-white font-semibold">No published posts yet</p>
              <p className="text-gray-400 text-sm mt-1">Posts you publish will appear here with performance data and boosting suggestions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {publishedPosts.filter(post => selectedPlatforms.length === 0 || (post.platforms || []).some(p => selectedPlatforms.includes(p))).map(post => (
                <div key={post.id} className="rounded-2xl bg-white/5 border border-white/10 p-5 hover:border-white/20 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex gap-1">{(post.platforms || []).map(p => <span key={p} className="text-lg">{PLATFORMS.find(pl => pl.value === p)?.icon}</span>)}</div>
                        <h4 className="text-white font-semibold">{post.title}</h4>
                        {post.ai_generated && <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#cb6ce6]/20 text-[#cb6ce6]"><Sparkles size={10} className="inline" /> AI</span>}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Published</span>
                      </div>
                      <p className="text-gray-400 text-sm line-clamp-2 mb-3">{post.content}</p>
                      {post.performance ? (
                        <div className="flex gap-4 text-xs">
                          <span className="flex items-center gap-1 text-gray-400"><Heart size={12} className="text-red-400" />{post.performance.likes || 0} likes</span>
                          <span className="flex items-center gap-1 text-gray-400"><MessageCircle size={12} className="text-blue-400" />{post.performance.comments || 0} comments</span>
                          <span className="flex items-center gap-1 text-gray-400"><Share2 size={12} className="text-green-400" />{post.performance.shares || 0} shares</span>
                          <span className="flex items-center gap-1 text-gray-400"><Eye size={12} className="text-purple-400" />{post.performance.reach || 0} reach</span>
                          {post.performance.engagement_rate && <span className="flex items-center gap-1 text-[#38b6ff]"><TrendingUp size={12} />{post.performance.engagement_rate}% engagement</span>}
                        </div>
                      ) : (
                        <p className="text-gray-600 text-xs italic">No performance data yet  connect your social accounts in Integrations to sync metrics</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-col items-end">
                      {post.published_at && <p className="text-gray-500 text-xs">{new Date(post.published_at).toLocaleDateString()}</p>}
                      <Button size="sm" variant="outline" onClick={() => openExistingPost(post, { goToContent: true })}
                        className="border-white/10 text-white hover:bg-white/5 text-xs gap-1">
                        <Edit3 size={12} /> Repost
                      </Button>
                    </div>
                  </div>
                  {post.performance?.engagement_rate !== undefined && post.performance.engagement_rate < 2 && (
                    <div className="mt-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-yellow-400 text-xs font-medium flex items-center gap-1.5">
                        <Zap size={12} /> Boosting Suggestion
                      </p>
                      <p className="text-gray-300 text-xs mt-1">
                        This post has low engagement ({post.performance.engagement_rate}%). Consider boosting it as a paid promotion, repurposing the content in a new format (Reel/Carousel), or reposting with a stronger hook at a peak time (TueThu, 911am).
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {optimizationInsights && (
            <div className="rounded-2xl bg-gradient-to-r from-[#cb6ce6]/10 to-[#38b6ff]/10 border border-[#38b6ff]/20 p-5 space-y-3">
              <h3 className="text-white font-semibold flex items-center gap-2"><Zap size={16} className="text-[#38b6ff]" />AI Boosting Insights</h3>
              {optimizationInsights.next_week_strategy && <p className="text-gray-300 text-sm">{optimizationInsights.next_week_strategy}</p>}
              {optimizationInsights.insights?.slice(0, 3).map((ins, i) => (
                <div key={i} className="p-3 rounded-xl bg-black/30 border border-white/10">
                  <p className="text-white text-sm font-medium">{ins.observation}</p>
                  <p className="text-[#38b6ff] text-xs mt-1">{ins.impact}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Performance Tab  Real channel stats */}
        <TabsContent value="performance" className="space-y-6">
          <SocialPerformanceTab company={company} selectedPlatforms={selectedPlatforms} setSelectedPlatforms={setSelectedPlatforms} posts={posts} />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Platform Filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-gray-400 text-sm">Filter by platform:</span>
            {PLATFORMS.map(p => (
              <button key={p.value}
                onClick={() => setSelectedPlatforms(prev => prev.includes(p.value) ? prev.filter(x => x !== p.value) : [...prev, p.value])}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all ${selectedPlatforms.includes(p.value) ? 'border-[#38b6ff]/50 bg-[#38b6ff]/10 text-white' : 'border-white/10 text-gray-500'}`}>
                {p.icon} {p.label}
              </button>
            ))}
            {selectedPlatforms.length > 0 && (
              <button onClick={() => setSelectedPlatforms([])} className="text-xs text-gray-500 hover:text-white underline">Clear</button>
            )}
          </div>

          {/* Stats */}
          {(() => {
            const filtered = selectedPlatforms.length > 0
              ? posts.filter(p => (p.platforms || []).some(pl => selectedPlatforms.includes(pl)))
              : posts;
            const filteredPublished = filtered.filter(p => p.status === 'published');
            const filteredScheduled = filtered.filter(p => p.status === 'scheduled');
            const filteredDraft = filtered.filter(p => p.status === 'draft');
            const totalLikes = filteredPublished.reduce((s, p) => s + (p.performance?.likes || 0), 0);
            const totalReach = filteredPublished.reduce((s, p) => s + (p.performance?.reach || 0), 0);
            const avgEngagement = filteredPublished.filter(p => p.performance?.engagement_rate).length > 0
              ? (filteredPublished.reduce((s, p) => s + (p.performance?.engagement_rate || 0), 0) / filteredPublished.filter(p => p.performance?.engagement_rate).length).toFixed(1)
              : 0;
            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: isPt ? 'Total de Posts' : 'Total Posts', value: filtered.length, Icon: FileText, tone: 'text-[#38b6ff]' },
                    { label: isPt ? 'Agendados' : 'Scheduled', value: filteredScheduled.length, Icon: CalendarClock, tone: 'text-[#cb6ce6]' },
                    { label: isPt ? 'Publicados' : 'Published', value: filteredPublished.length, Icon: CheckCircle2, tone: 'text-green-400' },
                    { label: 'Drafts', value: filteredDraft.length, Icon: PencilLine, tone: 'text-yellow-400' },
                  ].map(stat => (
                    <div key={stat.label} className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
                      <stat.Icon size={22} className={`mx-auto mb-1.5 ${stat.tone}`} />
                      <p className="text-2xl font-bold text-white">{stat.value}</p>
                      <p className="text-gray-400 text-sm">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Drafts & Scheduled — where saved-but-not-live posts live; click to open/edit */}
                {(() => {
                  const pending = filtered
                    .filter(p => p.status === 'draft' || p.status === 'scheduled')
                    .sort((a, b) => new Date(b.scheduled_for || b.created_date || 0) - new Date(a.scheduled_for || a.created_date || 0));
                  return (
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
                      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <Edit3 size={18} className="text-[#38b6ff]" /> {isPt ? 'Rascunhos & Agendados' : 'Drafts & Scheduled'}
                        <span className="text-gray-500 text-sm font-normal">({pending.length})</span>
                      </h3>
                      {pending.length === 0 ? (
                        <div className="text-center py-10">
                          <FileImage size={40} className="text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-400 text-sm">{isPt ? 'Nenhum rascunho ou post agendado.' : 'No drafts or scheduled posts.'}</p>
                          <Button size="sm" onClick={() => { openNewPost(); setActiveTab('content'); }} className="mt-3 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1.5">
                            <Plus size={14} /> {isPt ? 'Criar post' : 'Create a post'}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {pending.map(post => (
                            <div key={post.id}
                              className="flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-white/10 hover:border-[#38b6ff]/40 transition-all group cursor-pointer"
                              onClick={() => openExistingPost(post, { goToContent: true })}>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${post.status === 'scheduled' ? 'text-[#38b6ff] bg-[#38b6ff]/10 border-[#38b6ff]/20' : 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'}`}>
                                {post.status === 'scheduled' ? (isPt ? 'Agendado' : 'Scheduled') : (isPt ? 'Rascunho' : 'Draft')}
                              </span>
                              <div className="flex gap-1 flex-shrink-0">{(post.platforms || []).map(p => <span key={p} className="text-base">{PLATFORMS.find(pl => pl.value === p)?.icon}</span>)}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-medium truncate">{post.title || (post.content ? post.content.slice(0, 60) : (isPt ? '(sem título)' : '(untitled)'))}</p>
                                <p className="text-gray-500 text-xs truncate">
                                  {post.scheduled_for ? `${isPt ? 'Para' : 'For'} ${new Date(post.scheduled_for).toLocaleString()}` : (post.content ? post.content.slice(0, 80) : '')}
                                </p>
                              </div>
                              {(post.media_urls?.length > 0) && <span className="text-gray-500 text-xs flex-shrink-0">🖼️ {post.media_urls.length}</span>}
                              <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(post.id); }}
                                className="text-gray-600 hover:text-red-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {filteredPublished.filter(p => p.performance).length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Total Likes', value: totalLikes.toLocaleString(), icon: <Heart size={18} />, color: 'text-red-400' },
                      { label: 'Total Reach', value: totalReach.toLocaleString(), icon: <Eye size={18} />, color: 'text-purple-400' },
                      { label: 'Avg. Engagement', value: `${avgEngagement}%`, icon: <TrendingUp size={18} />, color: 'text-[#38b6ff]' },
                    ].map(stat => (
                      <div key={stat.label} className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
                        <div className={`flex justify-center mb-1 ${stat.color}`}>{stat.icon}</div>
                        <p className="text-2xl font-bold text-white">{stat.value}</p>
                        <p className="text-gray-400 text-sm">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 size={18} className="text-[#38b6ff]" /> Performance by Post
                  </h3>
                  {filteredPublished.filter(p => p.performance).length > 0 ? (
                    <div className="space-y-3">
                      {filteredPublished.filter(p => p.performance).sort((a, b) => (b.performance?.engagement_rate || 0) - (a.performance?.engagement_rate || 0)).map(post => (
                        <div key={post.id} className="flex items-center gap-4 p-3 rounded-xl bg-black/30 border border-white/10">
                          <div className="flex gap-1">{(post.platforms || []).map(p => <span key={p} className="text-base">{PLATFORMS.find(pl => pl.value === p)?.icon}</span>)}</div>
                          <div className="flex-1">
                            <p className="text-white text-sm font-medium">{post.title}</p>
                            {post.published_at && <p className="text-gray-500 text-xs">{new Date(post.published_at).toLocaleDateString()}</p>}
                          </div>
                          <div className="flex gap-4 text-xs">
                            <span className="text-gray-400 flex items-center gap-1"><Heart size={12} className="text-red-400" />{post.performance?.likes || 0}</span>
                            <span className="text-gray-400 flex items-center gap-1"><Eye size={12} className="text-blue-400" />{post.performance?.reach || 0}</span>
                            <span className="text-gray-400 flex items-center gap-1"><Share2 size={12} className="text-green-400" />{post.performance?.shares || 0}</span>
                            <span className={`font-medium ${(post.performance?.engagement_rate || 0) >= 3 ? 'text-green-400' : (post.performance?.engagement_rate || 0) >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>{post.performance?.engagement_rate || 0}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <BarChart3 size={48} className="text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">No performance data yet.</p>
                      <p className="text-gray-500 text-xs mt-2">Connect your social media accounts in Integrations to auto-sync performance data.</p>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* Google Drive Image Picker */}
      <GoogleDriveImagePicker
        open={showGoogleDrivePicker}
        onClose={() => setShowGoogleDrivePicker(false)}
        onSelect={(image) => {
          setUploadedMedia(prev => [...prev, { url: image.url, name: image.name, type: 'image/jpeg' }]);
          setShowGoogleDrivePicker(false);
        }}
      />
      <CanvaPicker
        open={showCanva}
        onClose={() => setShowCanva(false)}
        onSelect={({ url, name }) => setUploadedMedia(prev => [...prev, { url, name: name || 'Canva design', type: 'image/png' }])}
      />
    </div>
  );
}