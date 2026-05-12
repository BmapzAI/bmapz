import React, { useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { BarChart3, RefreshCw, TrendingUp, TrendingDown, AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import PlatformSelector from './PlatformSelector';
import ConnectIntegrationModal from '@/components/integrations/ConnectIntegrationModal';

const PLATFORMS = [
  { key: 'meta_ads', type: 'meta_ads', name: 'Meta Ads', label: 'Meta Ads', color: '#1877F2', statusKey: 'meta_ads', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/2021_Facebook_icon.svg/512px-2021_Facebook_icon.svg.png', description: 'Facebook & Instagram campaigns — spend, CTR, ROAS, conversions' },
  { key: 'google_ads', type: 'google_ads', name: 'Google Ads', label: 'Google Ads', color: '#4285F4', statusKey: 'google_ads', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Google_Ads_logo.svg/512px-Google_Ads_logo.svg.png', description: 'Search, Display and YouTube campaign performance data' },
  { key: 'tiktok_ads', type: 'tiktok_ads', name: 'TikTok Ads', label: 'TikTok Ads', color: '#69C9D0', statusKey: 'tiktok_ads', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a9/TikTok_logo.svg/512px-TikTok_logo.svg.png', description: 'TikTok campaign metrics and creative performance' },
  { key: 'linkedin_ads', type: 'linkedin_ads', name: 'LinkedIn Ads', label: 'LinkedIn Ads', color: '#0077b5', statusKey: 'linkedin_ads', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/LinkedIn_logo_initials.png/480px-LinkedIn_logo_initials.png', description: 'B2B campaign manager insights and lead gen performance' },
  { key: 'twitter_ads', type: 'twitter_ads', name: 'X Ads', label: 'X Ads', color: '#000000', statusKey: 'twitter_ads', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/X_icon_2.svg/512px-X_icon_2.svg.png', description: 'X (Twitter) campaign performance and engagement metrics' },
];

function MetricCard({ label, value, sub }) {
  return (
    <div className="p-3 rounded-xl bg-black/30 border border-white/10 text-center">
      <p className="text-white font-bold text-lg">{value ?? '—'}</p>
      <p className="text-gray-400 text-xs">{label}</p>
      {sub && <p className="text-gray-600 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdsRealDataPanel({ company, onDataLoaded }) {
  const queryClient = useQueryClient();
  const [activePlatform, setActivePlatform] = useState(null);
  const [campaignData, setCampaignData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showConnectionModal, setShowConnectionModal] = useState(null);

  const integrationStatus = company?.integration_status || {};
  const connectedPlatforms = PLATFORMS.filter(p => integrationStatus[p.statusKey]);
  const hasAnyConnected = connectedPlatforms.length > 0;

  const handlePlatformError = (platformKey) => {
    const platform = PLATFORMS.find(p => p.key === platformKey);
    if (platform) {
      setShowConnectionModal(platform);
    }
  };

  const fetchData = async (platformKey) => {
    // Guard: if Meta is selected but token is missing, show OAuth prompt instead
    if (platformKey === 'meta_ads' && !company?.api_keys?.meta_access_token) {
      setActivePlatform(platformKey);
      setCampaignData(null);
      setError(null);
      return;
    }
    setActivePlatform(platformKey);
    setLoading(true);
    setError(null);
    setCampaignData(null);
    try {
      const res = await import('@/api/apiClient').then(m => m.api.get('/api/ads/campaigns', { platform: platformKey }));
      if (res.data.error) throw new Error(res.data.error);
      // Ensure data belongs to the requested platform
      setCampaignData({ ...res.data, platform: platformKey });
      onDataLoaded?.({ ...res.data, platform: platformKey });
      toast.success(`${PLATFORMS.find(p => p.key === platformKey)?.label} data loaded`);
    } catch (e) {
      setError(e.message);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Aggregate totals across campaigns
  const totals = campaignData?.campaigns?.reduce((acc, c) => ({
    spend: acc.spend + (parseFloat(c.spend) || 0),
    clicks: acc.clicks + (parseInt(c.clicks) || 0),
    impressions: acc.impressions + (parseInt(c.impressions) || 0),
    conversions: acc.conversions + (parseFloat(c.conversions) || 0),
  }), { spend: 0, clicks: 0, impressions: 0, conversions: 0 });

  if (!hasAnyConnected) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
        <div className="flex items-start gap-3">
          <BarChart3 size={20} className="text-[#38b6ff] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">Connect Your Ad Accounts</p>
            <p className="text-gray-400 text-xs mt-1">Link Meta Ads, Google Ads, TikTok Ads, LinkedIn Ads, or X Ads to get real campaign data that powers AI optimization recommendations.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {PLATFORMS.slice(0, 2).map(p => (
                <Button
                  key={p.key}
                  size="sm"
                  onClick={() => setShowConnectionModal(p)}
                  className={`gap-1.5 text-xs`}
                  style={{ backgroundColor: p.color, color: '#fff' }}
                >
                  <span className="font-bold text-xs">{p.label.charAt(0)}</span>
                  Connect {p.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
        {showConnectionModal && (
          <ConnectIntegrationModal
            integration={showConnectionModal}
            company={company}
            isConnected={integrationStatus[showConnectionModal.statusKey]}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['companies'] });
              setShowConnectionModal(null);
            }}
            onClose={() => setShowConnectionModal(null)}
          />
        )}
      </div>
      );
      }

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
      <div className="flex items-center justify-between">
         <h3 className="text-white font-semibold flex items-center gap-2">
           <BarChart3 size={18} className="text-[#38b6ff]" /> Live Ad Performance
           {campaignData && <span className="text-gray-500 text-xs font-normal">• last 30 days</span>}
         </h3>
         <div className="flex gap-2 flex-wrap items-center">
           <PlatformSelector
             selectedPlatform={activePlatform}
             onSelectPlatform={fetchData}
             connectedPlatforms={connectedPlatforms.map(p => p.key)}
             loading={loading}
           />
           {loading && <RefreshCw size={14} className="animate-spin text-[#38b6ff]" />}
         </div>
       </div>

      {error && activePlatform && (
        <div className="flex flex-col items-center gap-3 py-4">
          <p className="text-gray-400 text-sm">Your {PLATFORMS.find(p => p.key === activePlatform)?.label} connection needs to be refreshed.</p>
          <Button
            onClick={() => handlePlatformError(activePlatform)}
            className="text-white gap-2"
            style={{ backgroundColor: PLATFORMS.find(p => p.key === activePlatform)?.color }}
          >
            <RefreshCw size={14} />
            Reconnect {PLATFORMS.find(p => p.key === activePlatform)?.label}
          </Button>
        </div>
      )}

      {showConnectionModal && (
        <ConnectIntegrationModal
          integration={showConnectionModal}
          company={company}
          isConnected={integrationStatus[showConnectionModal.statusKey]}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['companies'] });
            setShowConnectionModal(null);
          }}
          onClose={() => setShowConnectionModal(null)}
        />
      )}

      {!campaignData && !loading && !error && !activePlatform ? (
        <p className="text-gray-500 text-xs text-center py-4">Select a platform above to load your real campaign data.</p>
      ) : null}

      {campaignData && totals && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Total Spend" value={`$${totals.spend.toFixed(2)}`} />
            <MetricCard label="Total Clicks" value={totals.clicks.toLocaleString()} />
            <MetricCard label="Impressions" value={totals.impressions >= 1000 ? `${(totals.impressions/1000).toFixed(1)}K` : totals.impressions} />
            <MetricCard label="Conversions" value={totals.conversions.toFixed(0)} sub={totals.spend > 0 ? `$${(totals.spend / Math.max(totals.conversions, 1)).toFixed(2)} CPA` : null} />
          </div>

          {/* Campaign table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-gray-400 pb-2 font-medium">Campaign</th>
                  <th className="text-right text-gray-400 pb-2 font-medium">Spend</th>
                  <th className="text-right text-gray-400 pb-2 font-medium">Clicks</th>
                  <th className="text-right text-gray-400 pb-2 font-medium">CTR</th>
                  <th className="text-right text-gray-400 pb-2 font-medium">CPC</th>
                  <th className="text-right text-gray-400 pb-2 font-medium">Conv.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {campaignData.campaigns.slice(0, 10).map((c, i) => {
                  const ctr = c.ctr ? (typeof c.ctr === 'string' ? c.ctr : `${(c.ctr * 100).toFixed(2)}%`) : '—';
                  const isGoodCtr = parseFloat(ctr) >= 1;
                  return (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="py-2 pr-3 text-white font-medium max-w-[200px] truncate">{c.campaign_name || `Campaign ${i+1}`}</td>
                      <td className="py-2 text-right text-gray-300">${parseFloat(c.spend || 0).toFixed(2)}</td>
                      <td className="py-2 text-right text-gray-300">{parseInt(c.clicks || 0).toLocaleString()}</td>
                      <td className={`py-2 text-right font-medium ${isGoodCtr ? 'text-green-400' : 'text-red-400'}`}>{ctr}</td>
                      <td className="py-2 text-right text-gray-300">${parseFloat(c.cpc || 0).toFixed(2)}</td>
                      <td className="py-2 text-right text-gray-300">{parseFloat(c.conversions || c.leads || 0).toFixed(0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-gray-600 text-xs">💡 Use this data as context when generating strategies — AI will optimize based on your real performance metrics.</p>
        </>
      )}
    </div>
  );
}