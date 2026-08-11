import React, { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2, Eye, TrendingUp, RefreshCw, BarChart3, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { InvokeLLM } from '@/api/integrations';
import { api } from '@/api/apiClient';
import { SocialPost } from '@/api/entities';
import { usePersistentDraft } from '@/lib/usePersistentDraft';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', color: '#E1306C', icon: '📸' },
  { value: 'linkedin', label: 'LinkedIn', color: '#0077b5', icon: '💼' },
  { value: 'tiktok', label: 'TikTok', color: '#000000', icon: '🎵' },
  { value: 'twitter', label: 'X (Twitter)', color: '#1DA1F2', icon: '𝕏' },
  { value: 'youtube', label: 'YouTube', color: '#FF0000', icon: '▶️' },
  { value: 'facebook', label: 'Facebook', color: '#1877F2', icon: '📘' },
];

export default function SocialPerformanceTab({ company, selectedPlatforms, setSelectedPlatforms, posts = [] }) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  // Kept in place until re-run — see usePersistentDraft.
  const [boostInsights, setBoostInsights] = usePersistentDraft('social:boostInsights', null);

  const integrationStatus = company?.integration_status || {};

  const [refreshingId, setRefreshingId] = useState(null);
  const [boostingId, setBoostingId] = useState(null);

  // Only posts that are truly published externally (have external_post_id)
  const filteredPosts = posts.filter(p =>
    p.status === 'published' && p.external_post_id &&
    (selectedPlatforms.length === 0 || (p.platforms || []).some(pl => selectedPlatforms.includes(pl)))
  );

  const handleRefreshMetrics = async (post) => {
    const platform = (post.platforms || [])[0];
    if (!platform || !post.external_post_id) return;
    setRefreshingId(post.id);
    try {
      const res = await api.get('/api/social/analytics', {
        post_id: post.external_post_id,
        platform,
        company_id: company?.id,
      });
      if (res?.success) {
        await SocialPost.update(post.id, { performance: res.metrics });
        toast.success('Metrics synced!');
        // Trigger parent re-fetch via window event
        window.dispatchEvent(new Event('refetchSocialPosts'));
      } else {
        toast.error(res?.error || 'Metrics fetch failed');
      }
    } catch { toast.error('Failed to refresh metrics'); }
    finally { setRefreshingId(null); }
  };

  const handleBoost = async (post) => {
    const platform = (post.platforms || [])[0];
    if (platform !== 'facebook' && platform !== 'instagram') { toast.error('Boost only for Facebook/Instagram'); return; }
    // This used to POST /api/social/posts/boost, which no backend route
    // defines — the call always 404'd and the user just saw "Boost failed"
    // with no reason. Boosting a published post creates a real Meta ad, which
    // needs the Marketing API permissions the app has not been granted yet, so
    // say that plainly instead of failing opaquely.
    toast.info(
      'Boosting a post creates a real Meta ad, which needs Meta Marketing API access. That approval is not in place yet — build the campaign in the Ads section instead.',
      { duration: 8000 },
    );
    void post;
  };

  const postsWithPerformance = filteredPosts.filter(p => p.performance);

  const totalLikes = postsWithPerformance.reduce((s, p) => s + (p.performance?.likes || 0), 0);
  const totalReach = postsWithPerformance.reduce((s, p) => s + (p.performance?.reach || 0), 0);
  const totalComments = postsWithPerformance.reduce((s, p) => s + (p.performance?.comments || 0), 0);
  const avgEngagement = postsWithPerformance.filter(p => p.performance?.engagement_rate).length > 0
    ? (postsWithPerformance.reduce((s, p) => s + (p.performance?.engagement_rate || 0), 0) / postsWithPerformance.filter(p => p.performance?.engagement_rate).length).toFixed(1)
    : 0;

  const analyzeBoost = async () => {
    if (filteredPosts.length === 0) { toast.error('No published posts to analyze'); return; }
    setIsOptimizing(true);
    try {
      const response = await InvokeLLM({
        action: 'social_performance',
        archiveTitle: 'Social boosting recommendations',
        prompt: `You are a social media expert. Analyze these published posts and give boosting recommendations.

Company: ${company?.name || 'Unknown'}
Platforms analyzed: ${selectedPlatforms.length > 0 ? selectedPlatforms.join(', ') : 'all'}

Published posts:
${JSON.stringify(filteredPosts.map(p => ({ title: p.title, platforms: p.platforms, performance: p.performance, published_at: p.published_at })), null, 2)}

Provide:
1. Which posts to boost (paid promotion) and why
2. Best performing content patterns
3. Content improvement suggestions
4. Optimal repost timing

Return JSON with: boost_recommendations (array of {post_title, reason, expected_lift, action}), patterns (string), next_steps (array of strings)`,
        response_json_schema: {
          type: 'object',
          properties: {
            boost_recommendations: { type: 'array', items: { type: 'object', properties: { post_title: { type: 'string' }, reason: { type: 'string' }, expected_lift: { type: 'string' }, action: { type: 'string' } } } },
            patterns: { type: 'string' },
            next_steps: { type: 'array', items: { type: 'string' } }
          }
        }
      });
      setBoostInsights(response);
      toast.success('Boost analysis complete!');
    } catch { toast.error('Analysis failed'); }
    finally { setIsOptimizing(false); }
  };

  return (
    <div className="space-y-6">
      {/* Platform Selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-gray-400 text-sm">Platforms:</span>
        {PLATFORMS.map(p => (
          <button key={p.value}
            onClick={() => setSelectedPlatforms(prev => prev.includes(p.value) ? prev.filter(x => x !== p.value) : [...prev, p.value])}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all ${selectedPlatforms.includes(p.value) ? 'border-[#38b6ff]/50 bg-[#38b6ff]/10 text-white' : 'border-white/10 text-gray-500'}`}>
            {p.icon} {p.label}
          </button>
        ))}
        {selectedPlatforms.length > 0 && (
          <button onClick={() => setSelectedPlatforms([])} className="text-xs text-gray-500 hover:text-white underline">All</button>
        )}
        <Button onClick={analyzeBoost} disabled={isOptimizing} size="sm"
          className="ml-auto bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2">
          {isOptimizing ? <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Zap size={14} />}
          Analyze & Boost
        </Button>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Likes', value: totalLikes.toLocaleString(), icon: <Heart size={18} />, color: 'text-red-400' },
          { label: 'Total Reach', value: totalReach.toLocaleString(), icon: <Eye size={18} />, color: 'text-purple-400' },
          { label: 'Total Comments', value: totalComments.toLocaleString(), icon: <MessageCircle size={18} />, color: 'text-blue-400' },
          { label: 'Avg. Engagement', value: `${avgEngagement}%`, icon: <TrendingUp size={18} />, color: 'text-[#38b6ff]' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
            <div className={`flex justify-center mb-1 ${stat.color}`}>{stat.icon}</div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-gray-400 text-sm">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Boost Insights */}
      {boostInsights && (
        <div className="rounded-2xl bg-gradient-to-r from-[#cb6ce6]/10 to-[#38b6ff]/10 border border-[#38b6ff]/20 p-5 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><Zap size={16} className="text-[#38b6ff]" />Boost Recommendations</h3>
          {boostInsights.patterns && (
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <p className="text-green-400 text-xs font-medium mb-1">Top Performing Pattern</p>
              <p className="text-white text-sm">{boostInsights.patterns}</p>
            </div>
          )}
          {boostInsights.boost_recommendations?.length > 0 && (
            <div className="space-y-2">
              {boostInsights.boost_recommendations.map((rec, i) => (
                <div key={i} className="p-3 rounded-xl bg-black/30 border border-white/10">
                  <p className="text-white text-sm font-medium">{rec.post_title}</p>
                  <p className="text-gray-400 text-xs mt-1">{rec.reason}</p>
                  {rec.expected_lift && <p className="text-[#38b6ff] text-xs mt-1">📈 {rec.expected_lift}</p>}
                  {rec.action && <p className="text-[#cb6ce6] text-xs mt-1">→ {rec.action}</p>}
                </div>
              ))}
            </div>
          )}
          {boostInsights.next_steps?.length > 0 && (
            <div>
              <p className="text-gray-400 text-xs font-medium mb-2">Next Steps:</p>
              <ul className="space-y-1">
                {boostInsights.next_steps.map((step, i) => (
                  <li key={i} className="text-gray-300 text-sm flex items-start gap-2"><span className="text-[#38b6ff]">•</span>{step}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Per-post Performance */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-[#38b6ff]" /> Post Performance Details
        </h3>
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 size={48} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No published posts found for the selected platforms.</p>
            {!integrationStatus.meta && !integrationStatus.linkedin && (
              <p className="text-gray-500 text-xs mt-2">
                Connect your social accounts in <a href="/Integrations" className="text-[#38b6ff] underline">Integrations</a> to auto-sync performance data.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPosts.sort((a, b) => (b.performance?.engagement_rate || 0) - (a.performance?.engagement_rate || 0)).map(post => (
              <div key={post.id} className="p-4 rounded-xl bg-black/30 border border-white/10 hover:border-white/20 transition-all">
                <div className="flex items-start gap-4">
                  <div className="flex gap-1">{(post.platforms || []).map(p => <span key={p} className="text-lg">{PLATFORMS.find(pl => pl.value === p)?.icon}</span>)}</div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{post.title}</p>
                    <p className="text-gray-500 text-xs">{post.published_at ? new Date(post.published_at).toLocaleDateString() : 'Published'}</p>
                    {post.performance ? (
                      <div className="flex gap-4 text-xs mt-2 flex-wrap">
                        <span className="flex items-center gap-1 text-gray-400"><Heart size={11} className="text-red-400" />{post.performance.likes || 0} likes</span>
                        <span className="flex items-center gap-1 text-gray-400"><MessageCircle size={11} className="text-blue-400" />{post.performance.comments || 0} comments</span>
                        <span className="flex items-center gap-1 text-gray-400"><Share2 size={11} className="text-green-400" />{post.performance.shares || 0} shares</span>
                        <span className="flex items-center gap-1 text-gray-400"><Eye size={11} className="text-purple-400" />{post.performance.reach || 0} reach</span>
                        {post.performance.engagement_rate != null && (
                          <span className={`font-semibold flex items-center gap-1 ${post.performance.engagement_rate >= 3 ? 'text-green-400' : post.performance.engagement_rate >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                            <TrendingUp size={11} />{post.performance.engagement_rate}%
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-600 text-xs italic mt-1">No metrics yet — click Refresh to sync from platform</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => handleRefreshMetrics(post)} disabled={refreshingId === post.id}
                      className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-all" title="Refresh metrics from platform">
                      <RefreshCw size={12} className={refreshingId === post.id ? 'animate-spin' : ''} />
                    </button>
                    {((post.platforms || [])[0] === 'facebook' || (post.platforms || [])[0] === 'instagram') && (
                      <button onClick={() => handleBoost(post)} disabled={boostingId === post.id}
                        className="px-2 py-1 rounded-lg border border-[#cb6ce6]/40 bg-[#cb6ce6]/10 hover:bg-[#cb6ce6]/20 text-[#cb6ce6] text-xs flex items-center gap-1 transition-all disabled:opacity-50" title="Boost via Meta Ads">
                        {boostingId === post.id ? <div className="w-3 h-3 rounded-full border-2 border-[#cb6ce6] border-t-transparent animate-spin" /> : <Zap size={11} />}
                        Boost
                      </button>
                    )}
                  </div>
                </div>
                {post.performance?.engagement_rate !== undefined && post.performance.engagement_rate < 2 && (
                  <div className="mt-3 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-yellow-400 text-xs flex items-center gap-1"><Zap size={11} /> Low engagement ({post.performance.engagement_rate}%) — Boost this post or repost at peak hours (Tue–Thu, 9–11am)</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}