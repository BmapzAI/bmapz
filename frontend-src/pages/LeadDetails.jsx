import { api } from '@/api/apiClient';
import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import IntegrationGate from '@/components/ui/IntegrationGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, Edit3, Check, X, Mail, Phone, Globe, Linkedin, 
  Crown, MessageSquare, GitBranch, Activity, Building2, 
  User, Tag, DollarSign, TrendingUp, Clock, ChevronRight,
  Instagram, Facebook, Save, Sparkles, Loader2, Zap, Play
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { Activity, Company, Lead, Message, Workflow, WorkflowRun } from '@/api/entities';


const FUNNEL_STAGES = [
  { id: 'prospect', name: 'Prospect', color: '#9ca3af' },
  { id: 'awareness', name: 'Awareness', color: '#38b6ff' },
  { id: 'consideration', name: 'Consideration (Lead)', color: '#00e7ff' },
  { id: 'mql', name: 'MQL', color: '#a78bfa' },
  { id: 'sql', name: 'SQL', color: '#f59e0b' },
  { id: 'opportunity', name: 'Opportunity', color: '#cb6ce6' },
  { id: 'customer', name: 'Customer', color: '#22c55e' },
  { id: 'retention', name: 'Retention', color: '#10b981' },
  { id: 'advocacy', name: 'Advocacy', color: '#fbbf24' },
];

function EditableField({ label, value, onSave, type = 'text', multiline = false, options = null }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || '');

  const handleSave = () => { onSave(val); setEditing(false); };
  const handleKeyDown = (e) => { if (e.key === 'Enter' && !multiline) handleSave(); if (e.key === 'Escape') { setVal(value || ''); setEditing(false); } };

  if (editing) {
    return (
      <div className="space-y-1">
        <label className="text-gray-400 text-xs">{label}</label>
        <div className="flex gap-2">
          {options ? (
            <Select value={val} onValueChange={v => { setVal(v); onSave(v); setEditing(false); }}>
              <SelectTrigger className="bg-black/30 border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                {options.map(o => <SelectItem key={o.value} value={o.value} className="text-white">{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : multiline ? (
            <Textarea value={val} onChange={e => setVal(e.target.value)} className="flex-1 bg-black/30 border-white/10 text-white min-h-[80px]" autoFocus />
          ) : (
            <Input type={type} value={val} onChange={e => setVal(e.target.value)} onKeyDown={handleKeyDown}
              className="flex-1 bg-black/30 border-white/10 text-white" autoFocus />
          )}
          {!options && (
            <>
              <button onClick={handleSave} className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30"><Check size={14} /></button>
              <button onClick={() => { setVal(value || ''); setEditing(false); }} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10"><X size={14} /></button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group space-y-1">
      <label className="text-gray-400 text-xs">{label}</label>
      <div className="flex items-center justify-between gap-2">
        <p className="text-white text-sm">{value || <span className="text-gray-600 italic">Not set</span>}</p>
        <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-gray-400 hover:text-white hover:bg-white/10">
          <Edit3 size={12} />
        </button>
      </div>
    </div>
  );
}

export default function LeadDetails() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const leadId = urlParams.get('id');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [isEnrolling, setIsEnrolling] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => Lead.filter({ id: leadId }),
    select: data => data[0],
    enabled: !!leadId,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['leadMessages', leadId],
    queryFn: () => leadId ? Message.filter({ lead_id: leadId }, '-created_date') : [],
    enabled: !!leadId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['leadActivities', leadId],
    queryFn: () => leadId ? Activity.filter({ lead_id: leadId }, '-created_date') : [],
    enabled: !!leadId,
  });

  const { data: workflowRuns = [] } = useQuery({
    queryKey: ['leadWorkflowRuns', leadId],
    queryFn: () => leadId ? WorkflowRun.filter({ lead_id: leadId }) : [],
    enabled: !!leadId,
  });

  const { data: funnels = [] } = useQuery({ queryKey: ['funnels'], queryFn: () => Funnel.list() });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => Company.list() });
  const integrationStatus = companies[0]?.integration_status || {};

  const updateMutation = useMutation({
    mutationFn: (data) => Lead.update(leadId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lead', leadId] }); queryClient.invalidateQueries({ queryKey: ['leads'] }); toast.success('Lead updated'); },
  });

  const updateField = (field) => (value) => updateMutation.mutate({ [field]: value });

  const { data: availableWorkflows = [] } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => Workflow.list(),
  });

  const analyzeDigitalPresence = async () => {
    setIsAnalyzing(true);
    try {
      await api.post('/api/leads/' + leadId + '/score');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      toast.success('Digital presence analyzed!');
    } catch (e) {
      toast.error('Analysis failed: ' + (e?.response?.data?.error || e.message));
    } finally {
      setIsAnalyzing(false); }
  };

  const scoreICP = async () => {
    setIsScoring(true);
    try {
      const res = await api.post('/api/leads/' + leadId + '/score');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      toast.success(`ICP Score: ${res.data.score}/100`);
    } catch (e) {
      toast.error('Scoring failed: ' + (e?.response?.data?.error || e.message));
    } finally {
      setIsScoring(false); }
  };

  const enrollInWorkflow = async (workflowId) => {
    setIsEnrolling(true);
    try {
      await api.post('/api/workflows/' + workflowId + '/run', { lead_id: leadId });
      queryClient.invalidateQueries({ queryKey: ['leadWorkflowRuns', leadId] });
      toast.success('Lead enrolled in workflow!');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Enrollment failed');
    } finally {
      setIsEnrolling(false); }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 rounded-full border-2 border-[#38b6ff] border-t-transparent animate-spin" />
    </div>
  );

  if (!lead) return (
    <div className="text-center py-20">
      <p className="text-white text-lg mb-4">Lead not found</p>
      <Button onClick={() => navigate(createPageUrl('Sales'))} variant="outline" className="border-white/10 text-white">
        <ArrowLeft size={16} className="mr-2" /> Back to Sales
      </Button>
    </div>
  );

  const stage = FUNNEL_STAGES.find(s => s.id === lead.funnel_stage);
  const allInteractions = [
    ...messages.map(m => ({ ...m, _type: 'message', _date: m.created_date })),
    ...activities.map(a => ({ ...a, _type: 'activity', _date: a.created_date })),
    ...workflowRuns.map(r => ({ ...r, _type: 'workflow', _date: r.created_date })),
  ].sort((a, b) => new Date(b._date) - new Date(a._date));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(createPageUrl('Sales'))} className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-4 flex-1 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3572b9] to-[#38b6ff] flex items-center justify-center text-white font-bold text-xl">
            {lead.lead_company_name?.[0]?.toUpperCase() || 'L'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{lead.lead_company_name}</h1>
            <div className="flex items-center gap-3 mt-1">
              {lead.lead_name && <p className="text-gray-400 flex items-center gap-1"><User size={14} />{lead.lead_name}{lead.is_decision_maker && <Crown size={12} className="text-yellow-400 ml-1" />}</p>}
              {stage && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${stage.color}20`, color: stage.color }}>
                  {stage.name}
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${lead.status === 'active' ? 'text-green-400 bg-green-400/10' : 'text-gray-400 bg-white/10'}`}>{lead.status}</span>
            </div>
          </div>
          {lead.icp_score && (
            <div className="ml-auto text-center">
              <div className={`text-3xl font-bold ${lead.icp_score >= 70 ? 'text-green-400' : lead.icp_score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>{lead.icp_score}</div>
              <div className="text-gray-500 text-xs">ICP Score</div>
            </div>
          )}
          {lead.estimated_value && (
            <div className="text-center">
              <div className="text-2xl font-bold text-[#cb6ce6]">${lead.estimated_value.toLocaleString()}</div>
              <div className="text-gray-500 text-xs">Est. Value</div>
            </div>
          )}
          <div className="ml-auto flex gap-2 flex-wrap">
            <Button size="sm" onClick={scoreICP} disabled={isScoring}
              className="bg-[#38b6ff]/20 text-[#38b6ff] hover:bg-[#38b6ff]/30 gap-1.5 text-xs">
              {isScoring ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Score ICP
            </Button>
            <Button size="sm" onClick={analyzeDigitalPresence} disabled={isAnalyzing}
              className="bg-[#cb6ce6]/20 text-[#cb6ce6] hover:bg-[#cb6ce6]/30 gap-1.5 text-xs">
              {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Analyze Digital
            </Button>
            {availableWorkflows.filter(w => w.status === 'active').length > 0 && (
              <Select onValueChange={enrollInWorkflow} disabled={isEnrolling}>
                <SelectTrigger className="h-8 text-xs bg-green-500/20 border-green-500/30 text-green-400 hover:bg-green-500/30 w-auto px-3">
                  {isEnrolling ? <Loader2 size={12} className="animate-spin mr-1" /> : <Play size={12} className="mr-1" />}
                  Enroll in Workflow
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  {availableWorkflows.filter(w => w.status === 'active').map(w => (
                    <SelectItem key={w.id} value={w.id} className="text-white">{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="details">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="details" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <Building2 size={15} className="mr-2" /> Details
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <Activity size={15} className="mr-2" /> History ({allInteractions.length})
          </TabsTrigger>
          <TabsTrigger value="messages" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <MessageSquare size={15} className="mr-2" /> Messages ({messages.length})
          </TabsTrigger>
          <TabsTrigger value="workflows" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <GitBranch size={15} className="mr-2" /> Workflows ({workflowRuns.length})
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contact Info */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2"><User size={16} className="text-[#38b6ff]" />Contact Information</h3>
              <EditableField label="Contact Name" value={lead.lead_name} onSave={updateField('lead_name')} />
              <EditableField label="Role / Title" value={lead.role} onSave={updateField('role')} />
              <EditableField label="Email" value={lead.email} onSave={updateField('email')} type="email" />
              <EditableField label="Phone / WhatsApp" value={lead.phone} onSave={updateField('phone')} />
              <EditableField label="LinkedIn Profile" value={lead.linkedin_profile} onSave={updateField('linkedin_profile')} />
              <div className="flex items-center gap-3 pt-2">
                <label className="text-gray-400 text-xs">Decision Maker</label>
                <button onClick={() => updateMutation.mutate({ is_decision_maker: !lead.is_decision_maker })}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${lead.is_decision_maker ? 'bg-yellow-400/20 text-yellow-400' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}>
                  <Crown size={12} className="inline mr-1" />{lead.is_decision_maker ? 'Yes' : 'No'}
                </button>
              </div>
            </div>

            {/* Company Info */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2"><Building2 size={16} className="text-[#38b6ff]" />Company Information</h3>
              <EditableField label="Company Name" value={lead.lead_company_name} onSave={updateField('lead_company_name')} />
              <EditableField label="Website" value={lead.company_website} onSave={updateField('company_website')} />
              <EditableField label="LinkedIn" value={lead.company_linkedin} onSave={updateField('company_linkedin')} />
              <EditableField label="Instagram" value={lead.company_instagram} onSave={updateField('company_instagram')} />
              <EditableField label="Facebook" value={lead.company_facebook} onSave={updateField('company_facebook')} />
              <EditableField label="TikTok" value={lead.company_tiktok} onSave={updateField('company_tiktok')} />
            </div>

            {/* Pipeline Info */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2"><TrendingUp size={16} className="text-[#38b6ff]" />Pipeline</h3>
              <div className="space-y-1">
                <label className="text-gray-400 text-xs">Funnel Stage</label>
                <Select value={lead.funnel_stage || 'prospect'} onValueChange={updateField('funnel_stage')}>
                  <SelectTrigger className="bg-black/30 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {FUNNEL_STAGES.map(s => <SelectItem key={s.id} value={s.id} className="text-white">{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <EditableField label="Estimated Value ($)" value={lead.estimated_value?.toString()} onSave={v => updateField('estimated_value')(parseFloat(v) || 0)} type="number" />
              <EditableField label="ICP Score (0-100)" value={lead.icp_score?.toString()} onSave={v => updateField('icp_score')(parseFloat(v) || 0)} type="number" />
              <div className="space-y-1">
                <label className="text-gray-400 text-xs">Status</label>
                <Select value={lead.status || 'active'} onValueChange={updateField('status')}>
                  <SelectTrigger className="bg-black/30 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {['active', 'qualified', 'disqualified', 'converted', 'lost'].map(s => <SelectItem key={s} value={s} className="text-white capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes & Source */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2"><Tag size={16} className="text-[#38b6ff]" />Notes & Source</h3>
              <EditableField label="Notes" value={lead.notes} onSave={updateField('notes')} multiline />
              <EditableField label="Source" value={lead.source} onSave={updateField('source')} />
              <EditableField label="Source Category" value={lead.source_category} onSave={updateField('source_category')}
                options={[{value:'inbound',label:'Inbound'},{value:'outbound',label:'Outbound'},{value:'offline',label:'Offline'}]} />
            </div>
          </div>

          {/* Digital Presence Analysis */}
          {lead.digital_presence_analysis && (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Globe size={16} className="text-[#38b6ff]" />Digital Presence Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {lead.digital_presence_analysis.strengths?.length > 0 && (
                  <div>
                    <p className="text-green-400 text-xs font-medium mb-2">Strengths</p>
                    <ul className="space-y-1">{lead.digital_presence_analysis.strengths.map((s, i) => <li key={i} className="text-gray-300 text-sm">✅ {s}</li>)}</ul>
                  </div>
                )}
                {lead.digital_presence_analysis.gaps?.length > 0 && (
                  <div>
                    <p className="text-red-400 text-xs font-medium mb-2">Gaps</p>
                    <ul className="space-y-1">{lead.digital_presence_analysis.gaps.map((g, i) => <li key={i} className="text-gray-300 text-sm">❌ {g}</li>)}</ul>
                  </div>
                )}
                {lead.digital_presence_analysis.opportunities?.length > 0 && (
                  <div>
                    <p className="text-[#38b6ff] text-xs font-medium mb-2">Opportunities</p>
                    <ul className="space-y-1">{lead.digital_presence_analysis.opportunities.map((o, i) => <li key={i} className="text-gray-300 text-sm">💡 {o}</li>)}</ul>
                  </div>
                )}
              </div>
              {lead.digital_presence_analysis.summary && (
                <p className="text-gray-400 text-sm mt-4 p-3 rounded-xl bg-black/20">{lead.digital_presence_analysis.summary}</p>
              )}
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <h3 className="text-white font-semibold mb-4">Interaction Timeline</h3>
            {allInteractions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No interactions yet</p>
            ) : (
              <div className="space-y-3">
                {allInteractions.map((item, i) => (
                  <div key={i} className="flex gap-4 p-3 rounded-xl bg-black/20 border border-white/5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${item._type === 'message' ? 'bg-[#38b6ff]/20' : item._type === 'workflow' ? 'bg-[#cb6ce6]/20' : 'bg-white/10'}`}>
                      {item._type === 'message' ? <MessageSquare size={14} className="text-[#38b6ff]" /> :
                       item._type === 'workflow' ? <GitBranch size={14} className="text-[#cb6ce6]" /> :
                       <Activity size={14} className="text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-white text-sm font-medium">
                          {item._type === 'message' ? `${item.channel} ${item.direction}` :
                           item._type === 'workflow' ? `Workflow run (${item.status})` :
                           item.title || item.type}
                        </p>
                        <span className="text-gray-500 text-xs flex-shrink-0">
                          {new Date(item._date).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mt-0.5 line-clamp-2">
                        {item._type === 'message' ? item.content :
                         item._type === 'activity' ? item.description :
                         `${item.steps_completed || 0}/${item.steps_total || 0} steps`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-3">
            <div className="flex gap-2 mb-4 flex-wrap">
              {[
                { ch: 'email', intKey: 'email' },
                { ch: 'whatsapp', intKey: 'whatsapp' },
                { ch: 'linkedin', intKey: 'linkedin' },
              ].map(({ ch, intKey }) => {
                const connected = integrationStatus[intKey] === true;
                return (
                  <span key={ch} title={!connected ? `${ch} not connected — add API key in Settings → API Keys` : ''}>
                    <Button size="sm" variant="outline"
                      disabled={!connected}
                      className={`gap-1.5 text-xs capitalize transition-all ${connected ? 'border-white/10 text-white hover:bg-white/5' : 'border-white/5 text-gray-600 cursor-not-allowed opacity-50'}`}
                      onClick={async () => {
                        if (!connected) return;
                        try {
                          await api.post('/api/ai/chat', { messages: [{ role: 'user', content: 'Generate outreach message for lead ' + leadId + ' via ' + ch }] });
                          queryClient.invalidateQueries({ queryKey: ['leadMessages', leadId] });
                          toast.success(`${ch} message draft created!`);
                        } catch(e) { toast.error('Failed to generate message'); }
                      }}>
                      <Sparkles size={12} /> Generate {ch}
                    </Button>
                  </span>
                );
              })}
            </div>
            {!integrationStatus.whatsapp && !integrationStatus.email && !integrationStatus.linkedin && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 mb-2">
                <Loader2 size={15} className="text-yellow-400 flex-shrink-0 mt-0.5 hidden" />
                <span className="text-yellow-400 text-lg flex-shrink-0">⚠️</span>
                <p className="text-gray-300 text-xs">No messaging integrations connected. Go to <a href="/Settings" className="text-[#38b6ff] underline">Settings → API Keys</a> to connect WhatsApp, Email, or LinkedIn.</p>
              </div>
            )}
            {messages.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No messages yet — generate one above!</p>
            ) : messages.map(msg => (
              <div key={msg.id} className={`p-4 rounded-xl border ${msg.direction === 'inbound' ? 'bg-[#38b6ff]/5 border-[#38b6ff]/20 ml-8' : 'bg-white/5 border-white/10 mr-8'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300 capitalize">{msg.channel}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${msg.direction === 'inbound' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>{msg.direction}</span>
                    <span className="text-xs text-gray-500 capitalize">{msg.status}</span>
                  </div>
                  <span className="text-gray-500 text-xs">{msg.created_date ? new Date(msg.created_date).toLocaleString() : ''}</span>
                </div>
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.status === 'draft' && (() => {
                  const chKey = msg.channel === 'email' ? 'email' : msg.channel === 'whatsapp' ? 'whatsapp' : 'linkedin';
                  const connected = integrationStatus[chKey] === true;
                  return (
                    <span title={!connected ? `${msg.channel} not connected. Add key in Settings → API Keys.` : ''}>
                      <Button size="sm"
                        disabled={!connected}
                        className={`mt-2 gap-1.5 text-xs ${connected ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-white/5 text-gray-600 cursor-not-allowed opacity-50'}`}
                        onClick={async () => {
                          if (!connected) return;
                          try {
                            await api.post('/api/email/send', { to: msg.to, subject: msg.subject, html: msg.body });
                            queryClient.invalidateQueries({ queryKey: ['leadMessages', leadId] });
                            toast.success('Message sent!');
                          } catch(e) { toast.error('Failed to send'); }
                        }}>
                        {connected ? 'Send' : '🔒 Send (not connected)'}
                      </Button>
                    </span>
                  );
                })()}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-3">
            {workflowRuns.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No workflow runs yet</p>
            ) : workflowRuns.map(run => (
              <div key={run.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize
                    ${run.status === 'completed' ? 'bg-green-500/20 text-green-400' : run.status === 'running' ? 'bg-blue-500/20 text-blue-400' : run.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {run.status}
                  </span>
                  <span className="text-gray-500 text-xs">{new Date(run.created_date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>Steps: {run.steps_completed || 0}/{run.steps_total || 0}</span>
                  {run.duration_minutes && <span>Duration: {run.duration_minutes.toFixed(1)} min</span>}
                  {run.optimization_score && <span>Score: {run.optimization_score}/100</span>}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}