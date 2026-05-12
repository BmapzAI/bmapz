import React, { useState, useEffect, useMemo } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, ListChecks, Plus, TrendingUp, Users, BookOpen, Send, Image } from 'lucide-react';
import { toast } from 'sonner';

import AdsSavedRecords from '@/components/ads/AdsSavedRecords';
import AdsGuideModal from '@/components/ads/AdsGuideModal';
import AdsStrategyForm from '@/components/ads/AdsStrategyForm';
import AdsStrategyOutput from '@/components/ads/AdsStrategyOutput';
import AdsCopyForm from '@/components/ads/AdsCopyForm';
import AdsCopyOutput from '@/components/ads/AdsCopyOutput';
import AdsRealDataPanel from '@/components/ads/AdsRealDataPanel';
import AdsCreativesTab from '@/components/ads/AdsCreativesTab';
import AdsPublishModal from '@/components/ads/AdsPublishModal';
import AdsCampaignsTab from '@/components/ads/AdsCampaignsTab';
import AdsOptimizationTab from '@/components/ads/AdsOptimizationTab';
import AdsLeadsTab from '@/components/ads/AdsLeadsTab';
import QuickStartGuide from '@/components/ui/QuickStartGuide';
import { Company, AdRecord } from '@/api/entities';
import { InvokeLLM } from '@/api/integrations';

export default function Ads() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('campaigns');
  const [isGenerating, setIsGenerating] = useState(false);
  const [strategy, setStrategy] = useState(null);
  const [copies, setCopies] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [guidePlatform, setGuidePlatform] = useState(null);
  const [showSaved, setShowSaved] = useState(false);
  const [realAdData, setRealAdData] = useState(null);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishTarget, setPublishTarget] = useState(null); // { title, platform, isUpdate }
  const NEVER_SHOW_KEY = 'bmapz_never_show_budget_warning';

  const handlePublish = (title, platform, isUpdate = false) => {
    const neverShow = localStorage.getItem(NEVER_SHOW_KEY) === 'true';
    if (neverShow || isUpdate) {
      // Skip warning for updates or if user opted out
      toast.success(isUpdate ? `Ad "${title}" updated!` : `Ad "${title}" published to ${platform}!`);
      return;
    }
    setPublishTarget({ title, platform, isUpdate });
    setShowPublishModal(true);
  };

  const [strategyForm, setStrategyForm] = useState({
    objective: '', platform: '', budget: '', product: '', audience: '', differentiator: '',
  });
  const [copyForm, setCopyForm] = useState({
    platform: '', funnel_stage: 'all', angle: 'curiosity', product: '', audience: '',
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => Company.list(),
  });
  const company = useMemo(() => companies[0], [companies[0]?.id]);

  useEffect(() => {
    if (!company) return;
    const icp = company.icp || {};
    const briefing = company.briefing || {};
    setStrategyForm(prev => ({
      ...prev,
      product: prev.product || company.services_description || '',
      audience: prev.audience || icp.primary_audience || (icp.job_titles?.join(', ') || ''),
      differentiator: prev.differentiator || (company.value_propositions?.join(', ') || ''),
      budget: prev.budget || briefing.monthly_budget || '',
    }));
    setCopyForm(prev => ({
      ...prev,
      product: prev.product || company.services_description || '',
      audience: prev.audience || icp.primary_audience || '',
    }));
  }, [company]);

  const { data: adRecords = [] } = useQuery({
    queryKey: ['adRecords'],
    queryFn: () => AdRecord.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => AdRecord.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adRecords'] }); toast.success('Saved!'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => AdRecord.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['adRecords'] }); toast.success('Deleted'); },
  });

  const buildStrategyPrompt = () => {
    const icp = company?.icp || {};
    const briefing = company?.briefing || {};
    return `You are a senior performance marketing strategist. Create a complete ad campaign strategy using ALL the following company context:

Company: ${company?.name || 'Not specified'}
Industry: ${company?.industry || 'Not specified'}
Product/Service: ${strategyForm.product}
Value Propositions: ${company?.value_propositions?.join(', ') || 'Not specified'}
Primary Objective: ${strategyForm.objective}
Platform: ${strategyForm.platform || 'Multi-platform'}
Monthly Budget: ${strategyForm.budget || briefing.monthly_budget || 'Not specified'}
Target Audience: ${strategyForm.audience || icp.primary_audience || 'B2B decision makers'}
ICP - Job Titles: ${icp.job_titles?.join(', ') || 'Not specified'}
ICP - Industries: ${icp.industries?.join(', ') || 'Not specified'}
ICP - Pain Points: ${icp.pain_points?.join(', ') || 'Not specified'}
Main Differentiator: ${strategyForm.differentiator || company?.value_propositions?.[0] || 'Not specified'}
Tone of Voice: ${briefing.tone_of_voice?.join(', ') || 'Professional'}
Competitors: ${briefing.direct_competitors || 'Not specified'}
Desired Perception: ${briefing.desired_perception || 'Not specified'}
${strategyForm.extra_context ? `Extra Context: ${strategyForm.extra_context}` : ''}
${realAdData ? `\nReal Ad Account Performance (last 30 days from ${realAdData.platform}):\nTotal Spend: $${realAdData.campaigns?.reduce((a,c)=>a+parseFloat(c.spend||0),0).toFixed(2)}\nTotal Clicks: ${realAdData.campaigns?.reduce((a,c)=>a+parseInt(c.clicks||0),0).toLocaleString()}\nTop Campaigns:\n${realAdData.campaigns?.slice(0,5).map(c=>`- ${c.campaign_name}: Spend $${c.spend}, CTR ${c.ctr}, CPC $${c.cpc}, Conversions ${c.conversions||c.leads||0}`).join('\n')}\n\nUSE THIS REAL DATA to identify what is and isn't working, optimize budget allocation, and provide specific data-driven recommendations.` : ''}

Framework:
1. Business Context Analysis
2. Strategic Foundation (unique mechanism, positioning, creative angles)
3. Funnel Architecture (TOF/MOF/BOF with objectives, formats, KPIs per stage)
4. Creative Strategy (hook angles, emotional/rational appeals, visual direction)
5. Performance Metrics (KPIs, target CPA, break-even ROAS, scaling triggers)
6. Optimization Loop (weekly routine, what to test, when to scale/pause)

Return structured JSON with all these sections.`;
  };

  const buildCopyPrompt = () => {
    const icp = company?.icp || {};
    const briefing = company?.briefing || {};
    const strategyContext = strategy
      ? `\nCampaign Strategy Context:\n- Angles: ${strategy.strategic_foundation?.angles?.join(', ')}\n- Hooks: ${strategy.creative_strategy?.hooks?.join(', ')}\n- Unique Mechanism: ${strategy.strategic_foundation?.unique_mechanism}`
      : '';
    const funnelContext = (briefing.tof_objective || briefing.mof_objective || briefing.bof_objective)
      ? `\nFunnel Objectives:\n- TOF: ${briefing.tof_objective || 'N/A'}\n- MOF: ${briefing.mof_objective || 'N/A'}\n- BOF: ${briefing.bof_objective || 'N/A'}`
      : '';
    return `Create high-converting ad copies for ${copyForm.platform || 'Meta'}.

Company: ${company?.name || 'Not specified'}
Product: ${copyForm.product}
Target Audience: ${copyForm.audience || icp.primary_audience}
ICP Pain Points: ${icp.pain_points?.join(', ') || 'Not specified'}
Tone of Voice: ${briefing.tone_of_voice?.join(', ') || 'Professional'}
Primary Angle: ${copyForm.angle}
Value Propositions: ${company?.value_propositions?.join(', ') || 'Not specified'}
${copyForm.extra_context ? `Extra Context from user: ${copyForm.extra_context}` : ''}
${strategyContext}${funnelContext}
${realAdData ? `\nReal Ad Account Performance (last 30 days from ${realAdData.platform}):\nTotal Spend: $${realAdData.campaigns?.reduce((a,c)=>a+parseFloat(c.spend||0),0).toFixed(2)}\nTop Campaigns:\n${realAdData.campaigns?.slice(0,5).map(c=>`- ${c.campaign_name}: Spend $${c.spend}, CTR ${c.ctr}, CPC $${c.cpc}`).join('\n')}\n\nUSE THIS DATA to write copy angles that address what's underperforming and amplify what's working.` : ''}

Create:
- 2 TOF ads (awareness) — aligned with TOF objective above
- 2 MOF ads (consideration/retargeting) — aligned with MOF objective above
- 2 BOF ads (conversion/offer) — aligned with BOF objective above

Each ad must follow: Hook (0-3s pattern interrupt) → Bridge → Problem Amplification → Solution → Proof → Offer → CTA.

Return JSON with "ads" array, each object has: stage, angle, hook, body, cta, platform_notes`;
  };

  const generateStrategy = async () => {
    if (!strategyForm.objective) { toast.error('Select a campaign objective'); return; }
    setIsGenerating(true);
    try {
      const response = await InvokeLLM({
        prompt: buildStrategyPrompt(),
        response_json_schema: {
          type: 'object',
          properties: {
            business_analysis: { type: 'string' },
            strategic_foundation: { type: 'object', properties: { unique_mechanism: { type: 'string' }, positioning: { type: 'string' }, angles: { type: 'array', items: { type: 'string' } } } },
            funnel_architecture: { type: 'object', properties: { tof: { type: 'string' }, mof: { type: 'string' }, bof: { type: 'string' }, budget_split: { type: 'string' } } },
            creative_strategy: { type: 'object', properties: { hooks: { type: 'array', items: { type: 'string' } }, emotional_appeals: { type: 'array', items: { type: 'string' } }, visual_direction: { type: 'string' } } },
            kpis: { type: 'object', properties: { primary: { type: 'string' }, secondary: { type: 'string' }, target_cpa: { type: 'string' }, break_even_roas: { type: 'string' }, scaling_trigger: { type: 'string' } } },
            optimization: { type: 'string' }
          }
        }
      });
      setStrategy(response);
      toast.success('Strategy generated!');
    } catch (e) { toast.error('Generation failed'); }
    finally { setIsGenerating(false); }
  };

  const generateCopies = async () => {
    setIsGenerating(true);
    try {
      const response = await InvokeLLM({
        prompt: buildCopyPrompt(),
        response_json_schema: {
          type: 'object',
          properties: {
            ads: { type: 'array', items: { type: 'object', properties: { stage: { type: 'string' }, angle: { type: 'string' }, hook: { type: 'string' }, body: { type: 'string' }, cta: { type: 'string' }, platform_notes: { type: 'string' } } } }
          }
        }
      });
      setCopies(response?.ads || []);
      toast.success('Ad copies generated!');
    } catch (e) { toast.error('Generation failed'); }
    finally { setIsGenerating(false); }
  };

  const saveStrategy = () => {
    if (!strategy || !company) return;
    const title = `${strategyForm.platform || 'Multi-platform'} — ${strategyForm.objective} — ${new Date().toLocaleDateString()}`;
    saveMutation.mutate({ company_id: company.id, type: 'strategy', title, platform: strategyForm.platform, objective: strategyForm.objective, strategy_data: strategy, form_data: strategyForm });
  };

  const saveCopies = () => {
    if (!copies || !company) return;
    const title = `${copyForm.platform || 'Multi-platform'} Copies — ${copyForm.angle} — ${new Date().toLocaleDateString()}`;
    saveMutation.mutate({ company_id: company.id, type: 'copy', title, platform: copyForm.platform, copies_data: copies, form_data: copyForm });
  };

  const loadRecord = (record) => {
    if (record.type === 'strategy') {
      setStrategy(record.strategy_data);
      if (record.form_data) setStrategyForm(record.form_data);
      setActiveTab('strategy');
    } else {
      setCopies(record.copies_data);
      if (record.form_data) setCopyForm(record.form_data);
      setActiveTab('copy');
    }
    setShowSaved(false);
    toast.success('Loaded!');
  };

  const openGuide = (platform) => {
    setGuidePlatform(platform || strategyForm.platform || copyForm.platform);
    setShowGuide(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>Ads</h1>
          <p className="text-gray-400 mt-1">AI-powered ad strategy and copy creation • Pre-filled from your Settings</p>
        </div>
        <Button variant="outline" onClick={() => setShowSaved(!showSaved)}
          className="border-white/10 text-white hover:bg-white/5 gap-2">
          <BookOpen size={16} /> Saved ({adRecords.length})
        </Button>
      </div>

      <QuickStartGuide
        id="ads"
        title="Ads Quick Start"
        steps={[
          "Fill in your campaign objective and platform in the Strategy tab, then click 'Generate Strategy' to get a full AI-powered campaign plan.",
          "Switch to the Copy tab to generate ad copy for each funnel stage (TOF, MOF, BOF) aligned to your strategy.",
          "Use the Creatives tab to generate design briefs and test A/B variations for your ad visuals.",
          "Connect your Meta or Google Ads account in Settings → API Keys to import real performance data and get data-driven recommendations.",
        ]}
      />

      {showSaved && (
        <AdsSavedRecords
          adRecords={adRecords}
          onLoad={loadRecord}
          onDelete={(id) => deleteMutation.mutate(id)}
          isDeleting={deleteMutation.isPending}
        />
      )}

      {showGuide && guidePlatform && (
        <AdsGuideModal platform={guidePlatform} onClose={() => setShowGuide(false)} />
      )}

      <AdsRealDataPanel company={company} onDataLoaded={setRealAdData} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="campaigns" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <ListChecks size={16} className="mr-2" /> Campaigns
          </TabsTrigger>
          <TabsTrigger value="create" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <Plus size={16} className="mr-2" /> Create Ad
          </TabsTrigger>
          <TabsTrigger value="performance" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <TrendingUp size={16} className="mr-2" /> Performance
          </TabsTrigger>
          <TabsTrigger value="optimize" className="data-[state=active]:bg-[#cb6ce6]/20 data-[state=active]:text-[#cb6ce6]">
            <Zap size={16} className="mr-2" /> Optimize
          </TabsTrigger>
          <TabsTrigger value="leads" className="data-[state=active]:bg-[#cb6ce6]/20 data-[state=active]:text-[#cb6ce6]">
            <Users size={16} className="mr-2" /> Leads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-6">
          <AdsCampaignsTab companyId={company?.id} />
        </TabsContent>

        <TabsContent value="create" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <AdsStrategyForm
              form={strategyForm} setForm={setStrategyForm} company={company}
              isGenerating={isGenerating} onGenerate={generateStrategy}
              onSave={saveStrategy} isSaving={saveMutation.isPending}
              onOpenGuide={openGuide} hasStrategy={!!strategy}
            />
            <div className="lg:col-span-2">
              <AdsStrategyOutput strategy={strategy} setStrategy={setStrategy} company={company} />
              {strategy && (
                <div className="mt-4 flex gap-3">
                  <Button onClick={() => handlePublish(`${strategyForm.platform || 'Multi-platform'} Strategy`, strategyForm.platform || 'ads')}
                    className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
                    <Send size={16} /> Publish Campaign Strategy
                  </Button>
                  <Button onClick={() => handlePublish(`${strategyForm.platform || 'Multi-platform'} Strategy`, strategyForm.platform || 'ads', true)}
                    variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-2">
                    <Send size={16} /> Update Existing Campaign
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <AdsCopyForm
              form={copyForm} setForm={setCopyForm} company={company} strategy={strategy}
              isGenerating={isGenerating} onGenerate={generateCopies}
              onSave={saveCopies} isSaving={saveMutation.isPending}
              onOpenGuide={openGuide} hasCopies={!!copies}
            />
            <div className="lg:col-span-2">
              <AdsCopyOutput copies={copies} setCopies={setCopies} company={company} strategy={strategy} />
              {copies && copies.length > 0 && (
                <div className="mt-4 flex gap-3">
                  <Button onClick={() => handlePublish(`${copyForm.platform || 'Multi-platform'} Ad Copies`, copyForm.platform || 'ads')}
                    className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
                    <Send size={16} /> Publish Ad Copies
                  </Button>
                  <Button onClick={() => handlePublish(`${copyForm.platform || 'Multi-platform'} Ad Copies`, copyForm.platform || 'ads', true)}
                    variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-2">
                    <Send size={16} /> Update Existing Ad
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="optimize" className="space-y-6">
          <AdsOptimizationTab realAdData={realAdData} />
        </TabsContent>

        <TabsContent value="leads" className="space-y-6">
          <AdsLeadsTab />
        </TabsContent>
      </Tabs>

      {showPublishModal && publishTarget && (
        <AdsPublishModal
          isOpen={showPublishModal}
          onClose={() => { setShowPublishModal(false); setPublishTarget(null); }}
          onConfirm={() => toast.success(`${publishTarget.isUpdate ? 'Updated' : 'Published'}: "${publishTarget.title}"`)}
          platform={publishTarget.platform}
          adTitle={publishTarget.title}
          isUpdate={publishTarget.isUpdate}
          campaignData={{ 
            ...strategyForm, 
            ...copyForm, 
            objective: strategyForm.objective || 'LINK_CLICKS',
            strategy: strategy,
            copies: copies
          }}
        />
      )}
    </div>
  );
}