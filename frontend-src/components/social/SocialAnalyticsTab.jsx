import React, { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Heart, Eye, Share2, TrendingUp, BarChart3, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/api/apiClient';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: '📸' },
  { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { value: 'tiktok', label: 'TikTok', icon: '🎵' },
  { value: 'twitter', label: 'X (Twitter)', icon: '𝕏' },
  { value: 'youtube', label: 'YouTube', icon: '▶️' },
  { value: 'facebook', label: 'Facebook', icon: '📘' },
];

export default function SocialAnalyticsTab({ company, posts, publishedPosts, selectedPlatforms, setSelectedPlatforms }) {
  const { data: channelStats, isLoading: isLoadingStats, refetch } = useQuery({
    queryKey: ['channelStats', company?.id, 'social'],
    queryFn: async () => {
      return await api.get('/api/social/analytics', { platform: 'all', days: 30 });
    },
    enabled: !!company?.id,
  });

  const igStats = channelStats?.instagram;

  // Filtered post counts
  const filtered = selectedPlatforms.length > 0
    ? posts.filter(p => (p.platforms || []).some(pl => selectedPlatforms.includes(pl)))
    : posts;
  const filteredPublished = filtered.filter(p => p.status === 'published' && p.external_post_id);
  const filteredScheduled = filtered.filter(p => p.status === 'scheduled');
  const filteredDraft = filtered.filter(p => p.status === 'draft');

  // Aggregate from stored performance data
  const withPerf = filteredPublished.filter(p => p.performance);
  const totalLikes = withPerf.reduce((s, p) => s + (p.performance?.likes || 0), 0);
  const totalReach = withPerf.reduce((s, p) => s + (p.performance?.reach || 0), 0);
  const avgEngagement = withPerf.filter(p => p.performance?.engagement_rate).length > 0
    ? (withPerf.reduce((s, p) => s + (p.performance?.engagement_rate || 0), 0) / withPerf.filter(p => p.performance?.engagement_rate).length).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
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
        <Button size="sm" variant="outline" onClick={() => refetch()} className="ml-auto border-white/10 text-gray-400 hover:text-white gap-1">
          <RefreshCw size={13} className={isLoadingStats ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {/* Post counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Posts', value: filtered.length, icon: '📝' },
          { label: 'Scheduled', value: filteredScheduled.length, icon: '📅' },
          { label: 'Published', value: filteredPublished.length, icon: '✅' },
          { label: 'Drafts', value: filteredDraft.length, icon: '📄' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
            <p className="text-2xl mb-1">{stat.icon}</p>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-gray-400 text-sm">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Real Instagram stats from API */}
      {igStats?.connected && (
        <div className="rounded-2xl bg-gradient-to-r from-[#E1306C]/10 to-[#cb6ce6]/10 border border-[#E1306C]/20 p-5">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">📸 Instagram — Real-Time Account Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Followers', value: (igStats.followers || 0).toLocaleString(), icon: <Users size={16} />, color: 'text-[#E1306C]' },
              { label: 'Total Posts', value: igStats.total_posts || 0, icon: <BarChart3 size={16} />, color: 'text-purple-400' },
              { label: 'Likes (30d)', value: (igStats.total_likes || 0).toLocaleString(), icon: <Heart size={16} />, color: 'text-red-400' },
              { label: 'Comments (30d)', value: (igStats.total_comments || 0).toLocaleString(), icon: <TrendingUp size={16} />, color: 'text-[#38b6ff]' },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl bg-black/30 border border-white/10 p-3 text-center">
                <div className={`flex justify-center mb-1 ${stat.color}`}>{stat.icon}</div>
                <p className="text-xl font-bold text-white">{stat.value}</p>
                <p className="text-gray-400 text-xs mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
          {igStats.username && <p className="text-gray-500 text-xs mt-2">{igStats.username}</p>}
        </div>
      )}
      {igStats && !igStats.connected && (
        <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
          Instagram not connected. Add meta_access_token and instagram_account_id in <a href="/Settings" className="underline">Settings → API Keys</a>.
        </div>
      )}

      {/* Aggregated performance from stored post data */}
      {withPerf.length > 0 && (
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

      {/* Per-post performance table */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-[#38b6ff]" /> Performance by Post
        </h3>
        {filteredPublished.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 size={48} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No externally published posts found.</p>
            <p className="text-gray-500 text-xs mt-1">Use "Publish Now" on draft posts to publish them and track metrics.</p>
          </div>
        ) : (
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
            {filteredPublished.filter(p => !p.performance).length > 0 && (
              <p className="text-gray-600 text-xs text-center pt-2">
                {filteredPublished.filter(p => !p.performance).length} post(s) have no metrics yet — use the Refresh button in the Posts tab to sync.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}