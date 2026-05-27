import React, { useState, useEffect } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, Building2, Target, CreditCard, Globe, Save, Plus, X, FileText, ArrowRight, Zap, ScanLine, KeyRound, Sparkles } from 'lucide-react';
// KeyRound used in TabsTrigger
import { toast } from 'sonner';
import ApiKeysTab from '@/components/settings/ApiKeysTab';
import UsageTab from '@/components/settings/UsageTab';
import { Company } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';

function TagInput({ label, values = [], onChange, placeholder }) {
  const [input, setInput] = useState('');
  const add = () => {
    if (!input.trim()) return;
    onChange([...values, input.trim()]);
    setInput('');
  };
  return (
    <div>
      <Label className="text-gray-400">{label}</Label>
      <div className="flex gap-2 mt-1.5">
        <Input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          className="bg-black/30 border-white/10 text-white" placeholder={placeholder} />
        <Button type="button" onClick={add} className="bg-[#38b6ff]/20 text-[#38b6ff] hover:bg-[#38b6ff]/30"><Plus size={18} /></Button>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {values.map((item, i) => (
          <span key={i} className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#38b6ff]/20 text-[#38b6ff] text-sm">
            {item}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="ml-1 hover:text-red-400"><X size={14} /></button>
          </span>
        ))}
      </div>
    </div>
  );
}

function CheckboxGroup({ label, options, values = [], onChange, multi = true }) {
  const toggle = (val) => {
    if (multi) {
      onChange(values.includes(val) ? values.filter(v => v !== val) : [...values, val]);
    } else {
      onChange(val);
    }
  };
  return (
    <div>
      <Label className="text-gray-400 block mb-2">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const active = multi ? values.includes(opt) : values === opt;
          return (
            <button key={opt} onClick={() => toggle(opt)}
              className={`px-3 py-1.5 rounded-lg border text-sm transition-all
                ${active ? 'border-[#38b6ff]/50 text-[#38b6ff] bg-[#38b6ff]/10' : 'border-white/10 text-gray-400 hover:border-white/30'}`}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const isDark = true; // dark mode only
  const queryClient = useQueryClient();
  const { dbUser } = useAuth();
  const [user, setUser] = useState(null);
  const [agentName, setAgentName] = useState('');

  useEffect(() => {
    // user loaded from useAuth()
  }, []);

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => Company.list() });
  const company = companies[0];

  const [companyForm, setCompanyForm] = useState({ name: '', website: '', industry: '', services_description: '', value_propositions: [], years_in_business: '', business_model: '', average_ticket: '', repurchase_cycle: '', marketing_structure: '', sales_structure: '', geographic_market: '' });
  const [icpForm, setIcpForm] = useState({ industries: [], company_sizes: [], locations: [], job_titles: [], pain_points: [], budget_range: '', decision_criteria: [], primary_audience: '', secondary_audience: '', decision_maker_profile: [], main_desires: '', common_objections: '', awareness_level: '' });
  const [briefingForm, setBriefingForm] = useState({ current_marketing: false, marketing_channels: [], main_challenge: [], funnel_structure: [], historical_data: [], primary_objectives: [], revenue_target: '', lead_target: '', expected_roi: '', positioning_today: '', desired_perception: '', competitive_advantages: '', do_not_communicate: '', tone_of_voice: [], direct_competitors: '', market_references: '', what_sold: '', transformation: '', recurrence: false, upsell: false, technical_differentiator: '', primary_platform: [], content_formats: [], content_frequency: '', content_focus: [], content_types: [], hook_type: [], monthly_budget: '', campaign_structure: '', key_kpis: [], main_bottlenecks: '', retention_strategy: false, discover_brand: '', research: '', compare: '', purchase_decision: '', repurchase: '', aov_drivers: '', important_dates: '', strategic_events: '', sales_peaks: '', low_demand: '', brand_perception: [], mandatory_visuals: '', avoid_visuals: '', video_style: '', believe_sentence: '', exists_sentence: '', unlike_sentence: '', not_for: '', not_priority: '', attract: '', avoid_client: '', success_metrics: '', timeframe: '', ideal_6_months: '' });


  useEffect(() => {
    if (company) {
      setCompanyForm(prev => ({
        ...prev,
        name: company.name || '', website: company.website || '', industry: company.industry || '',
        services_description: company.services_description || '', value_propositions: company.value_propositions || [],
        ...(company.company_details || {})
      }));
      setIcpForm(company.icp || icpForm);
      setBriefingForm(prev => ({ ...prev, ...(company.briefing || {}) }));
      setAgentName(company.personal_agent_name || '');
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: (data) => company ? Company.update(company.id, data) : Company.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['companies'] }); toast.success(language === 'pt-BR' ? 'Configura��es salvas' : 'Settings saved'); },
  });

  const bf = briefingForm;
  const setBf = (field, val) => setBriefingForm(prev => ({ ...prev, [field]: val }));
  const toggleBf = (field) => setBriefingForm(prev => ({ ...prev, [field]: !prev[field] }));



  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>{t('settingsTitle')}</h1>
        <p className="mt-1 text-gray-400">{t('generalSettings')}</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1 p-1 bg-white/5 border border-white/10">
          <TabsTrigger value="general" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]"><SettingsIcon size={14} className="mr-1.5" />General</TabsTrigger>
          <TabsTrigger value="company" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]"><Building2 size={14} className="mr-1.5" />Company</TabsTrigger>
          <TabsTrigger value="briefing" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]"><FileText size={14} className="mr-1.5" />Briefing</TabsTrigger>
          <TabsTrigger value="icp" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]"><Target size={14} className="mr-1.5" />ICP Settings</TabsTrigger>
          <TabsTrigger value="api-keys" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]"><KeyRound size={14} className="mr-1.5" />API Keys</TabsTrigger>
          <TabsTrigger value="ai-settings" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]"><Sparkles size={14} className="mr-1.5" />AI Settings</TabsTrigger>
          <TabsTrigger value="usage" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]"><Zap size={14} className="mr-1.5" />Usage</TabsTrigger>
          <TabsTrigger value="subscription" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]"><CreditCard size={14} className="mr-1.5" />Subscription</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white">
              {language === 'pt-BR' ? 'Prefer�ncias' : 'Preferences'}
            </h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#38b6ff]/20 flex items-center justify-center"><Globe size={20} className="text-[#38b6ff]" /></div>
                <div>
                  <p className="font-medium text-white">{t('language')}</p>
                  <p className="text-sm text-gray-400">
                    {language === 'pt-BR' ? 'Escolha seu idioma preferido' : 'Choose your preferred language'}
                  </p>
                </div>
              </div>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-[180px] bg-black/30 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  <SelectItem value="en" className="text-white">English (US)</SelectItem>
                  <SelectItem value="pt-BR" className="text-white">Portugu�s (BR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        {/* Company */}
        <TabsContent value="company" className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white">
              {language === 'pt-BR' ? 'Informa��es da Empresa' : 'Company Information'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label className="text-gray-400">Company Name</Label><Input value={companyForm.name} onChange={(e) => setCompanyForm(p => ({ ...p, name: e.target.value }))} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="Your company name" /></div>
              <div><Label className="text-gray-400">Website</Label><Input value={companyForm.website} onChange={(e) => setCompanyForm(p => ({ ...p, website: e.target.value }))} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="https://yourcompany.com" /></div>
              <div><Label className="text-gray-400">Industry / Niche</Label><Input value={companyForm.industry} onChange={(e) => setCompanyForm(p => ({ ...p, industry: e.target.value }))} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="e.g., Marketing, Technology" /></div>
              <div><Label className="text-gray-400">Years in Business</Label><Input value={companyForm.years_in_business || ''} onChange={(e) => setCompanyForm(p => ({ ...p, years_in_business: e.target.value }))} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="e.g., 5 years" /></div>
              <div>
                <Label className="text-gray-400">Business Model</Label>
                <Select value={companyForm.business_model || ''} onValueChange={(v) => setCompanyForm(p => ({ ...p, business_model: v }))}>
                  <SelectTrigger className="mt-1.5 bg-black/30 border-white/10 text-white"><SelectValue placeholder="Select model" /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {['B2B', 'B2C', 'Hybrid B2B/B2C', 'B2B2C', 'Marketplace'].map(m => <SelectItem key={m} value={m} className="text-white">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-gray-400">Average Ticket Size</Label><Input value={companyForm.average_ticket || ''} onChange={(e) => setCompanyForm(p => ({ ...p, average_ticket: e.target.value }))} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="e.g., $5,000" /></div>
              <div><Label className="text-gray-400">Average Repurchase Cycle</Label><Input value={companyForm.repurchase_cycle || ''} onChange={(e) => setCompanyForm(p => ({ ...p, repurchase_cycle: e.target.value }))} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="e.g., 6 months" /></div>
              <div>
                <Label className="text-gray-400">Geographic Market</Label>
                <Select value={companyForm.geographic_market || ''} onValueChange={(v) => setCompanyForm(p => ({ ...p, geographic_market: v }))}>
                  <SelectTrigger className="mt-1.5 bg-black/30 border-white/10 text-white"><SelectValue placeholder="Select market" /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {['Local', 'National', 'International', 'Global'].map(m => <SelectItem key={m} value={m} className="text-white">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-400">Marketing Structure</Label>
                <Select value={companyForm.marketing_structure || ''} onValueChange={(v) => setCompanyForm(p => ({ ...p, marketing_structure: v }))}>
                  <SelectTrigger className="mt-1.5 bg-black/30 border-white/10 text-white"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {['In-house', 'Agency', 'Freelancer', 'Hybrid'].map(m => <SelectItem key={m} value={m} className="text-white">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-400">Sales Structure</Label>
                <Select value={companyForm.sales_structure || ''} onValueChange={(v) => setCompanyForm(p => ({ ...p, sales_structure: v }))}>
                  <SelectTrigger className="mt-1.5 bg-black/30 border-white/10 text-white"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {['In-house', 'Agency', 'Freelancer', 'Hybrid'].map(m => <SelectItem key={m} value={m} className="text-white">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label className="text-gray-400">Main Product(s) or Service(s)</Label><Textarea value={companyForm.services_description} onChange={(e) => setCompanyForm(p => ({ ...p, services_description: e.target.value }))} className="bg-black/30 border-white/10 text-white mt-1.5 min-h-[80px]" placeholder="Describe your products and services..." /></div>
            </div>
            <TagInput label="Value Propositions" values={companyForm.value_propositions} onChange={(v) => setCompanyForm(p => ({ ...p, value_propositions: v }))} placeholder="Add a value proposition" />
            <Button onClick={() => updateMutation.mutate({ name: companyForm.name, website: companyForm.website, industry: companyForm.industry, services_description: companyForm.services_description, value_propositions: companyForm.value_propositions, years_in_business: companyForm.years_in_business, business_model: companyForm.business_model, average_ticket: companyForm.average_ticket, repurchase_cycle: companyForm.repurchase_cycle, marketing_structure: companyForm.marketing_structure, sales_structure: companyForm.sales_structure, geographic_market: companyForm.geographic_market })} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2"><Save size={18} />{language === 'pt-BR' ? 'Salvar Perfil da Empresa' : 'Save Company Profile'}</Button>
          </div>
        </TabsContent>

        {/* Briefing */}
        <TabsContent value="briefing" className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-8">
            <div>
              <h2 className="text-lg font-semibold mb-1 text-white">
                {language === 'pt-BR' ? 'Briefing Estrat�gico' : 'Strategic Briefing'}
              </h2>
              <p className="text-gray-400 text-sm">
                {language === 'pt-BR'
                  ? 'Este briefing � usado como contexto para melhorar os outputs de IA e automa��o de tarefas. As perguntas n�o s�o obrigat�rias, mas melhoram significativamente a qualidade da IA.'
                  : 'This briefing is used as context to improve AI outputs and task automation. Questions are not mandatory but improve AI quality significantly.'}
              </p>
            </div>

            {/* Current Scenario */}
            <div className="space-y-4 border-t border-white/5 pt-6">
              <h3 className="text-[#38b6ff] font-semibold">{language === 'pt-BR' ? 'Cen�rio Atual' : 'Current Scenario'}</h3>
              <div>
                <Label className="text-gray-400">Is the company currently investing in marketing campaigns?</Label>
                <div className="flex gap-4 mt-2">
                  {['Yes', 'No'].map(opt => (
                    <button key={opt} onClick={() => setBf('current_marketing', opt === 'Yes')}
                      className={`px-4 py-2 rounded-lg border text-sm transition-all ${(bf.current_marketing ? 'Yes' : 'No') === opt ? 'border-[#38b6ff]/50 text-[#38b6ff] bg-[#38b6ff]/10' : 'border-white/10 text-gray-400'}`}>{opt}</button>
                  ))}
                </div>
              </div>
              {bf.current_marketing && <CheckboxGroup label="If yes, which channels?" options={['Instagram / Meta Ads', 'LinkedIn Ads', 'Google Ads', 'TikTok Ads', 'YouTube Ads', 'Email Marketing', 'Other']} values={bf.marketing_channels} onChange={(v) => setBf('marketing_channels', v)} />}
              <CheckboxGroup label="Main current challenge:" options={['Low conversion', 'Poor quality leads', 'Lack of predictability', 'Low authority', 'Low brand awareness', 'Scaling issues', 'Other']} values={bf.main_challenge} onChange={(v) => setBf('main_challenge', v)} />
              <CheckboxGroup label="Is there a structured funnel?" options={['Top of funnel', 'Middle of funnel', 'Bottom of funnel', 'Not structured']} values={bf.funnel_structure} onChange={(v) => setBf('funnel_structure', v)} />
              <CheckboxGroup label="Is the historical data organized?" options={['CRM', 'Pixel tracking', 'GA4', 'Spreadsheets', 'None']} values={bf.historical_data} onChange={(v) => setBf('historical_data', v)} />
            </div>

            {/* Primary Objectives */}
            <div className="space-y-4 border-t border-white/5 pt-6">
              <h3 className="text-[#38b6ff] font-semibold">{language === 'pt-BR' ? 'Objetivos Prim�rios' : 'Primary Objectives'}</h3>
              <CheckboxGroup label="Select priorities:" options={['Lead generation', 'Direct sales', 'Authority building', 'Premium positioning', 'Scaling', 'Revenue predictability', 'Product launch', 'Repositioning']} values={bf.primary_objectives} onChange={(v) => setBf('primary_objectives', v)} />
              <div className="space-y-3">
                <Label className="text-gray-400 block">Funnel Stage Objectives</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-[#38b6ff]/10 border border-[#38b6ff]/20">
                    <p className="text-[#38b6ff] text-xs font-semibold mb-1.5">{'<'} Top of Funnel (TOF)</p>
                    <p className="text-gray-500 text-xs mb-2">Awareness & discovery</p>
                    <Textarea value={bf.tof_objective || ''} onChange={(e) => setBf('tof_objective', e.target.value)} className="bg-black/30 border-white/10 text-white text-xs min-h-[60px]" placeholder="e.g., Reach 50K new people/mo, grow LinkedIn followers by 20%" />
                  </div>
                  <div className="p-3 rounded-xl bg-[#cb6ce6]/10 border border-[#cb6ce6]/20">
                    <p className="text-[#cb6ce6] text-xs font-semibold mb-1.5">= Middle of Funnel (MOF)</p>
                    <p className="text-gray-500 text-xs mb-2">Consideration & nurturing</p>
                    <Textarea value={bf.mof_objective || ''} onChange={(e) => setBf('mof_objective', e.target.value)} className="bg-black/30 border-white/10 text-white text-xs min-h-[60px]" placeholder="e.g., Generate 200 MQLs/mo, 40% email open rate" />
                  </div>
                  <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                    <p className="text-green-400 text-xs font-semibold mb-1.5">= Bottom of Funnel (BOF)</p>
                    <p className="text-gray-500 text-xs mb-2">Conversion & closing</p>
                    <Textarea value={bf.bof_objective || ''} onChange={(e) => setBf('bof_objective', e.target.value)} className="bg-black/30 border-white/10 text-white text-xs min-h-[60px]" placeholder="e.g., 30 SQLs/mo, close 15 deals at $5K avg" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label className="text-gray-400">Revenue Target</Label><Input value={bf.revenue_target || ''} onChange={(e) => setBf('revenue_target', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="e.g., $500K" /></div>
                <div><Label className="text-gray-400">Lead Target</Label><Input value={bf.lead_target || ''} onChange={(e) => setBf('lead_target', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="e.g., 500 leads/month" /></div>
                <div><Label className="text-gray-400">Expected ROI</Label><Input value={bf.expected_roi || ''} onChange={(e) => setBf('expected_roi', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="e.g., 300%" /></div>
              </div>
            </div>

            {/* Positioning */}
            <div className="space-y-4 border-t border-white/5 pt-6">
              <h3 className="text-[#38b6ff] font-semibold">{language === 'pt-BR' ? 'Posicionamento & Diferencia��o' : 'Positioning & Differentiation'}</h3>
              <div><Label className="text-gray-400">How does the company position itself today?</Label><Textarea value={bf.positioning_today || ''} onChange={(e) => setBf('positioning_today', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5 min-h-[80px]" /></div>
              <div><Label className="text-gray-400">How does it want to be perceived?</Label><Textarea value={bf.desired_perception || ''} onChange={(e) => setBf('desired_perception', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5 min-h-[80px]" /></div>
              <div><Label className="text-gray-400">Main competitive advantages</Label><Textarea value={bf.competitive_advantages || ''} onChange={(e) => setBf('competitive_advantages', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" /></div>
              <div><Label className="text-gray-400">What should NOT be communicated?</Label><Textarea value={bf.do_not_communicate || ''} onChange={(e) => setBf('do_not_communicate', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" /></div>
              <CheckboxGroup label="Desired tone of voice:" options={['Technical', 'Informal', 'Premium', 'Provocative', 'Institutional', 'Consultative', 'Strong authority', 'Educational']} values={bf.tone_of_voice} onChange={(v) => setBf('tone_of_voice', v)} />
              <div><Label className="text-gray-400">Direct Competitors</Label><Input value={bf.direct_competitors || ''} onChange={(e) => setBf('direct_competitors', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="e.g., HubSpot, Salesforce" /></div>
              <div><Label className="text-gray-400">Market References (brands you admire)</Label><Input value={bf.market_references || ''} onChange={(e) => setBf('market_references', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" /></div>
            </div>

            {/* Product/Service */}
            <div className="space-y-4 border-t border-white/5 pt-6">
              <h3 className="text-[#38b6ff] font-semibold">{language === 'pt-BR' ? 'Produto / Servi�o' : 'Product / Service'}</h3>
              <div><Label className="text-gray-400">What is truly being sold?</Label><Textarea value={bf.what_sold || ''} onChange={(e) => setBf('what_sold', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" /></div>
              <div><Label className="text-gray-400">What transformation does it generate?</Label><Textarea value={bf.transformation || ''} onChange={(e) => setBf('transformation', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" /></div>
              <div><Label className="text-gray-400">Technical differentiator (that few competitors can explain)</Label><Textarea value={bf.technical_differentiator || ''} onChange={(e) => setBf('technical_differentiator', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" /></div>
              <div className="flex gap-8">
                <div className="flex items-center gap-3"><span className="text-gray-400 text-sm">Recurrence / Subscription?</span><Switch checked={bf.recurrence || false} onCheckedChange={() => toggleBf('recurrence')} /></div>
                <div className="flex items-center gap-3"><span className="text-gray-400 text-sm">Upsell or strategic bundling?</span><Switch checked={bf.upsell || false} onCheckedChange={() => toggleBf('upsell')} /></div>
              </div>
            </div>

            {/* Content Strategy */}
            <div className="space-y-4 border-t border-white/5 pt-6">
              <h3 className="text-[#38b6ff] font-semibold">{language === 'pt-BR' ? 'Estrat�gia de Conte�do' : 'Content Strategy'}</h3>
              <CheckboxGroup label="Primary platform(s):" options={['Instagram', 'LinkedIn', 'TikTok', 'YouTube', 'Facebook', 'X (Twitter)', 'Multi-channel']} values={bf.primary_platform} onChange={(v) => setBf('primary_platform', v)} />
              <CheckboxGroup label="Priority formats:" options={['Reels / Short-form video', 'Carousel', 'Text + image', 'Stories', 'Long-form video', 'Podcast', 'Blog']} values={bf.content_formats} onChange={(v) => setBf('content_formats', v)} />
              <div><Label className="text-gray-400">Ideal posting frequency (weekly/monthly)</Label><Input value={bf.content_frequency || ''} onChange={(e) => setBf('content_frequency', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="e.g., 5x per week" /></div>
              <CheckboxGroup label="Main strategic focus:" options={['Acquisition', 'Authority', 'Education', 'Conversion', 'Branding', 'Sales']} values={bf.content_focus} onChange={(v) => setBf('content_focus', v)} />
              <CheckboxGroup label="Content hook type (video):" options={['Curiosity', 'Humor', 'Belief-breaking', 'Challenge', 'Direct pain point']} values={bf.hook_type} onChange={(v) => setBf('hook_type', v)} />
            </div>

            {/* Performance */}
            <div className="space-y-4 border-t border-white/5 pt-6">
              <h3 className="text-[#38b6ff] font-semibold">{language === 'pt-BR' ? 'Estrat�gia de Performance (M�dia Paga)' : 'Performance Strategy (Paid Media)'}</h3>
              <div><Label className="text-gray-400">Average Monthly Budget</Label><Input value={bf.monthly_budget || ''} onChange={(e) => setBf('monthly_budget', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="e.g., $10,000" /></div>
              <div><Label className="text-gray-400">Current Campaign Structure</Label><Textarea value={bf.campaign_structure || ''} onChange={(e) => setBf('campaign_structure', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="Describe platforms, objectives, formats..." /></div>
              <CheckboxGroup label="Most important KPIs:" options={['CPA', 'ROAS', 'LTV', 'CAC', 'CPL', 'Conversion rate', 'Leads', 'MQLs', 'SQLs', 'New followers', 'Engagement rate', 'CTR', 'Revenue']} values={bf.key_kpis} onChange={(v) => setBf('key_kpis', v)} />
              <div className="flex items-center gap-3"><span className="text-gray-400 text-sm">Is there a retention strategy?</span><Switch checked={bf.retention_strategy || false} onCheckedChange={() => toggleBf('retention_strategy')} /></div>
            </div>

            {/* Core Message */}
            <div className="space-y-4 border-t border-white/5 pt-6">
              <h3 className="text-[#38b6ff] font-semibold">{language === 'pt-BR' ? 'Mensagem Central' : 'Core Message'}</h3>
              <div><Label className="text-gray-400">"We believe that ___________________."</Label><Textarea value={bf.believe_sentence || ''} onChange={(e) => setBf('believe_sentence', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" /></div>
              <div><Label className="text-gray-400">"Our company exists to ___________________."</Label><Textarea value={bf.exists_sentence || ''} onChange={(e) => setBf('exists_sentence', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" /></div>
              <div><Label className="text-gray-400">"Unlike companies that ______, we ______."</Label><Textarea value={bf.unlike_sentence || ''} onChange={(e) => setBf('unlike_sentence', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" /></div>
            </div>

            {/* Success Metrics */}
            <div className="space-y-4 border-t border-white/5 pt-6">
              <h3 className="text-[#38b6ff] font-semibold">{language === 'pt-BR' ? 'M�tricas de Sucesso' : 'Success Metrics'}</h3>
              <div><Label className="text-gray-400">How will we know this is working?</Label><Textarea value={bf.success_metrics || ''} onChange={(e) => setBf('success_metrics', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" /></div>
              <div><Label className="text-gray-400">Expected time frame for results</Label><Input value={bf.timeframe || ''} onChange={(e) => setBf('timeframe', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="e.g., 90 days, 6 months" /></div>
              <div><Label className="text-gray-400">Ideal scenario in 6 months</Label><Textarea value={bf.ideal_6_months || ''} onChange={(e) => setBf('ideal_6_months', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1.5" /></div>
            </div>

            <Button onClick={() => updateMutation.mutate({ briefing: briefingForm })} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2"><Save size={18} />{language === 'pt-BR' ? 'Salvar Briefing' : 'Save Briefing'}</Button>
          </div>
        </TabsContent>

        {/* ICP Settings */}
        <TabsContent value="icp" className="space-y-6">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white">{t('icpSettings')}</h2>
              <p className="text-gray-400 text-sm">
                {language === 'pt-BR' ? 'Defina seu Perfil de Cliente Ideal para ajudar o agente de IA a qualificar e priorizar leads.' : 'Define your Ideal Customer Profile to help the AI agent qualify and prioritize leads.'}
              </p>
            </div>
            <div><Label className="text-gray-400">Primary Audience Description</Label><Textarea value={icpForm.primary_audience || ''} onChange={(e) => setIcpForm(p => ({ ...p, primary_audience: e.target.value }))} className="bg-black/30 border-white/10 text-white mt-1.5 min-h-[80px]" placeholder="Describe your primary target audience..." /></div>
            <div><Label className="text-gray-400">Secondary Audience Description</Label><Textarea value={icpForm.secondary_audience || ''} onChange={(e) => setIcpForm(p => ({ ...p, secondary_audience: e.target.value }))} className="bg-black/30 border-white/10 text-white mt-1.5 min-h-[80px]" placeholder="Describe your secondary target audience..." /></div>
            <CheckboxGroup label="Decision-maker profile:" options={['Founder', 'Director', 'CMO', 'CTO', 'VP Marketing', 'Buyer', 'End consumer', 'Manager']} values={icpForm.decision_maker_profile || []} onChange={(v) => setIcpForm(p => ({ ...p, decision_maker_profile: v }))} />
            {[
              { field: 'industries', label: 'Target Industries', placeholder: 'e.g., Technology, Healthcare' },
              { field: 'company_sizes', label: 'Company Sizes', placeholder: 'e.g., 10-50 employees' },
              { field: 'locations', label: 'Target Locations', placeholder: 'e.g., United States, Brazil' },
              { field: 'job_titles', label: 'Target Job Titles', placeholder: 'e.g., Marketing Director, CEO' },
              { field: 'pain_points', label: 'Common Pain Points', placeholder: 'e.g., Low conversion rates' },
              { field: 'decision_criteria', label: 'Decision Criteria', placeholder: 'e.g., Budget approval' },
            ].map(({ field, label, placeholder }) => (
              <TagInput key={field} label={label} values={icpForm[field] || []} onChange={(v) => setIcpForm(p => ({ ...p, [field]: v }))} placeholder={placeholder} />
            ))}
            <div><Label className="text-gray-400">Main Desires</Label><Textarea value={icpForm.main_desires || ''} onChange={(e) => setIcpForm(p => ({ ...p, main_desires: e.target.value }))} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="What does your ideal customer want to achieve?" /></div>
            <div><Label className="text-gray-400">Common Objections</Label><Textarea value={icpForm.common_objections || ''} onChange={(e) => setIcpForm(p => ({ ...p, common_objections: e.target.value }))} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="What are the most common objections?" /></div>
            <CheckboxGroup label="Customer awareness level:" options={['Unaware', 'Problem-aware', 'Solution-aware', 'Comparing suppliers', 'Ready to buy']} values={icpForm.awareness_level ? [icpForm.awareness_level] : []} onChange={(v) => setIcpForm(p => ({ ...p, awareness_level: v[v.length - 1] }))} />
            <div><Label className="text-gray-400">Who is this NOT for?</Label><Textarea value={icpForm.not_for || ''} onChange={(e) => setIcpForm(p => ({ ...p, not_for: e.target.value }))} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="Who should we NOT target?" /></div>
            <div><Label className="text-gray-400">Budget Range</Label><Input value={icpForm.budget_range} onChange={(e) => setIcpForm(p => ({ ...p, budget_range: e.target.value }))} className="bg-black/30 border-white/10 text-white mt-1.5" placeholder="e.g., $10,000 - $50,000" /></div>
            <Button onClick={() => updateMutation.mutate({ icp: icpForm })} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2"><Save size={18} />{language === 'pt-BR' ? 'Salvar Configura��es de ICP' : 'Save ICP Settings'}</Button>
          </div>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api-keys" className="space-y-6">
          <ApiKeysTab
            company={company}
            user={dbUser}
            onSave={(data) => updateMutation.mutateAsync(data)}
          />
        </TabsContent>

        {/* Usage */}
        <TabsContent value="usage" className="space-y-6">
          <UsageTab />
        </TabsContent>


        {/* AI Settings  image provider, model, personal agent name */}
        <TabsContent value="ai-settings" className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles size={20} className="text-[#38b6ff]" /> AI Configuration
              </h2>
              <p className="text-sm text-gray-400 mt-1">Configure AI image generation and your personal AI agent name.</p>
            </div>

            {/* Personal Agent Name */}
            <div className="space-y-3 pb-6 border-b border-white/10">
              <div>
                <p className="font-medium text-white">Personal AI Agent Name</p>
                <p className="text-sm text-gray-400">This name appears in the sidebar and AI chat. Your team will see this label.</p>
              </div>
              <div className="flex gap-3 items-center">
                <Input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') updateMutation.mutate({ personal_agent_name: agentName });
                  }}
                  placeholder="e.g. Sales AI, Marketing Bot, Bmapz AI..."
                  className="bg-black/30 border-white/10 text-white max-w-sm"
                />
                <Button
                  onClick={() => updateMutation.mutate({ personal_agent_name: agentName })}
                  disabled={updateMutation.isPending}
                  className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2"
                >
                  <Save size={16} />Save
                </Button>
              </div>
              <p className="text-xs text-gray-500">Leave blank to use the default "Bmapz AI".</p>
            </div>

            {/* AI Image Provider */}
            <div className="space-y-3">
              <div>
                <p className="font-medium text-white">Image Generation Provider</p>
                <p className="text-sm text-gray-400">Choose which AI generates images in the platform (ads creatives, social posts, etc.)</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { value: 'openai', label: 'OpenAI DALL-E', models: ['dall-e-3', 'dall-e-2'], icon: '>' },
                  { value: 'stability', label: 'Stable Diffusion', models: ['stable-diffusion-xl-1024-v1-0'], icon: '<' },
                ].map((provider) => {
                  const isSelected = (company?.ai_image_provider || 'openai') === provider.value;
                  return (
                    <button
                      key={provider.value}
                      onClick={() => updateMutation.mutate({ ai_image_provider: provider.value, ai_image_model: provider.models[0] })}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-[#38b6ff] bg-[#38b6ff]/10 text-[#38b6ff]'
                          : 'border-white/10 bg-white/5 text-white hover:border-white/20'
                      }`}
                    >
                      <div className="text-2xl mb-2">{provider.icon}</div>
                      <p className="font-medium text-sm">{provider.label}</p>
                      {isSelected && (
                        <p className="text-xs mt-1 opacity-70">{company?.ai_image_model || provider.models[0]}</p>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Model selector */}
              {(company?.ai_image_provider === 'openai' || !company?.ai_image_provider) && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-gray-400">DALL-E Model:</p>
                  <Select
                    value={company?.ai_image_model || 'dall-e-3'}
                    onValueChange={(v) => updateMutation.mutate({ ai_image_model: v })}
                  >
                    <SelectTrigger className="w-[200px] bg-black/30 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-white/10">
                      <SelectItem value="dall-e-3" className="text-white">DALL-E 3 (Best quality)</SelectItem>
                      <SelectItem value="dall-e-2" className="text-white">DALL-E 2 (Faster)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {company?.ai_image_provider === 'stability' && (
                <p className="text-xs text-gray-500 mt-2">
                  Stable Diffusion requires a Stability AI API key set in your environment variables (STABILITY_API_KEY).
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Subscription */}
        <TabsContent value="subscription" className="space-y-6">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white">{t('subscriptionPlan')}</h2>
              <p className="text-gray-400 text-sm">
                {language === 'pt-BR' ? 'Gerencie sua assinatura, cr�ditos e add-ons' : 'Manage your subscription, credits and add-ons'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#38b6ff]/10 border border-[#38b6ff]/20 flex items-center gap-3">
                <Zap size={20} className="text-[#38b6ff]" />
                <div>
                  <p className="text-gray-400 text-xs">AI Credits</p>
                  <p className="text-white font-bold">{language === 'pt-BR' ? 'Ver no Billing' : 'See in Billing'}</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#cb6ce6]/10 border border-[#cb6ce6]/20 flex items-center gap-3">
                <ScanLine size={20} className="text-[#cb6ce6]" />
                <div>
                  <p className="text-gray-400 text-xs">Scan Tokens</p>
                  <p className="text-white font-bold">{language === 'pt-BR' ? 'Ver no Billing' : 'See in Billing'}</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center gap-3">
                <CreditCard size={20} className="text-[#f59e0b]" />
                <div>
                  <p className="text-gray-400 text-xs">{language === 'pt-BR' ? 'Plano Atual' : 'Current Plan'}</p>
                  <p className="text-white font-bold">{language === 'pt-BR' ? 'Ver no Billing' : 'See in Billing'}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => navigate('/Billing')} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
                <CreditCard size={18} />{language === 'pt-BR' ? 'Gerenciar Assinatura' : 'Manage Subscription'} <ArrowRight size={16} />
              </Button>
              <Button onClick={() => navigate('/Pricing')} variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-2">
                {language === 'pt-BR' ? 'Ver Planos' : 'View Plans'} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
