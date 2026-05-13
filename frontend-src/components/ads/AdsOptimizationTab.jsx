import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Zap, TrendingUp, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/apiClient';

export default function AdsOptimizationTab({ realAdData }) {
  const [platform, setPlatform] = useState('meta_ads');
  const [recommendations, setRecommendations] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const generateRecommendations = async () => {
    setIsGenerating(true);
    try {
      // Use the backend function which fetches real data + runs AI analysis
      const result = await api.post('/api/ai/chat', {
        platform,
        auto_apply: false,
      };

      if (!result.data?.success) {
        throw new Error(result.data?.error || 'Failed to generate recommendations');
      }

      const recs = result.data.recommendations || [];
      // Map to the display format expected by the UI
      const displayRecs = recs.map(r => ({
        campaign_name: r.campaign_name,
        current_budget: r.current_value,
        new_budget: r.recommended_value,
        reason: `${r.issue} — ${r.action} (${r.priority} priority, expected: ${r.expected_impact})`,
      })).filter(r => r.current_budget && r.new_budget);

      setRecommendations(displayRecs);
      toast.success(`Generated ${displayRecs.length} recommendations from real ${platform} data`);
    } catch (error) {
      toast.error('Failed: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const applyRecommendations = async () => {
    setIsApplying(true);
    try {
      // New optimizeAdCampaigns fetches its own data + applies changes via auto_apply
      const result = await api.post('/api/ai/chat', {
        platform,
        auto_apply: true,
      };

      if (result.data?.success) {
        const applied = result.data.changes_applied || 0;
        toast.success(`Applied ${applied} optimization${applied !== 1 ? 's' : ''} to ${platform}`);
        setRecommendations([]);
      } else {
        toast.error(result.data?.error || 'Failed to apply optimizations');
      }
    } catch (error) {
      toast.error('Failed to apply optimizations: ' + error.message);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">AI Optimization</h2>
        <p className="text-gray-400 mt-1">Get AI-powered budget reallocation suggestions based on performance data</p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-sm text-gray-400 block mb-2">Select Platform</label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-white/10">
              <SelectItem value="meta_ads">Meta (Facebook/Instagram)</SelectItem>
              <SelectItem value="tiktok_ads">TikTok</SelectItem>
              <SelectItem value="x_ads">X (Twitter)</SelectItem>
              <SelectItem value="linkedin_ads">LinkedIn</SelectItem>
              <SelectItem value="google_ads">Google Ads</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={generateRecommendations}
          disabled={isGenerating}
          className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2 mt-auto"
        >
          <Zap size={16} />
          {isGenerating ? 'Analyzing...' : 'Generate Recommendations'}
        </Button>
      </div>

      {recommendations.length > 0 && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-[#38b6ff]/10 to-[#cb6ce6]/10 border border-[#38b6ff]/20 rounded-lg p-4">
            <p className="text-white font-semibold flex items-center gap-2">
              <TrendingUp size={18} />
              {recommendations.length} Budget Reallocation{recommendations.length !== 1 ? 's' : ''} Recommended
            </p>
          </div>

          <div className="grid gap-4">
            {recommendations.map((rec, idx) => (
              <Card key={idx} className="bg-white/5 border-white/10 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold">{rec.campaign_name}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <div>
                        <span className="text-gray-400">Current Budget</span>
                        <p className="text-white font-mono">${rec.current_budget?.toFixed(2)}</p>
                      </div>
                      <div className="text-gray-500">→</div>
                      <div>
                        <span className="text-gray-400">Recommended Budget</span>
                        <p className="text-[#38b6ff] font-mono">${rec.new_budget?.toFixed(2)}</p>
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm mt-2">{rec.reason}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[#38b6ff]">
                      {((rec.new_budget / rec.current_budget - 1) * 100).toFixed(0)}%
                    </div>
                    <p className="text-gray-400 text-xs">change</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Button
            onClick={applyRecommendations}
            disabled={isApplying}
            className="w-full bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2 h-10"
          >
            <BarChart3 size={16} />
            {isApplying ? 'Applying...' : 'Apply Optimizations'}
          </Button>
        </div>
      )}

      {recommendations.length === 0 && !isGenerating && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-8 text-center">
          <p className="text-gray-400">Select a platform and click "Generate Recommendations" to fetch your real campaign data and get AI-powered optimization suggestions.</p>
          <p className="text-gray-500 text-xs mt-2">Make sure your ad account credentials are configured in Settings → API Keys.</p>
        </div>
      )}
    </div>
  );
}