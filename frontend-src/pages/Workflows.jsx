import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Play, Pause, Trash2, Edit2, Copy, GitBranch, Users, Zap, MoreVertical, CheckCircle2, LayoutTemplate } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';
import WorkflowBuilderModal from '@/components/workflows/WorkflowBuilderModal';
import QuickStartGuide from '@/components/ui/QuickStartGuide';
import { Company, Workflow } from '@/api/entities';

const getStarterTemplates = (t) => [
  { id: 'st1', name: t('wfT1Name'), description: t('wfT1Desc'), steps: 5, category: 'Outreach' },
  { id: 'st2', name: t('wfT2Name'), description: t('wfT2Desc'), steps: 4, category: 'Social Selling' },
  { id: 'st3', name: t('wfT3Name'), description: t('wfT3Desc'), steps: 3, category: 'WhatsApp' },
  { id: 'st4', name: t('wfT4Name'), description: t('wfT4Desc'), steps: 3, category: 'Automation' },
  { id: 'st5', name: t('wfT5Name'), description: t('wfT5Desc'), steps: 3, category: 'Retention' },
  { id: 'st6', name: t('wfT6Name'), description: t('wfT6Desc'), steps: 2, category: 'Onboarding' },
];

export default function Workflows() {
  const queryClient = useQueryClient();
  const { t, isPt } = useLanguage();
  const STARTER_WORKFLOW_TEMPLATES = getStarterTemplates(t);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => Company.list() });
  const company = companies[0];

  // Company-specific workflows (custom, non-template)
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows', company?.id],
    queryFn: () => company?.id
      ? Workflow.filter({ company_id: company.id, is_template: false })
      : [],
    enabled: !!company?.id,
  });

  // App-wide templates (accessible to all users — stored with company_id: "global")
  const { data: workflowTemplates = [] } = useQuery({
    queryKey: ['workflowTemplates'],
    queryFn: () => Workflow.filter({ is_template: true }),
  });

  // When user clicks "Use as Template", copy with correct company_id
  const applyTemplate = async (w) => {
    if (!company?.id) { toast.error('Company not loaded'); return; }
    const { id, created_date, updated_date, created_by, ...rest } = w;
    await Workflow.create({ ...rest, company_id: company.id, name: w.name, is_template: false, status: 'draft' });
    queryClient.invalidateQueries({ queryKey: ['workflows'] });
    toast.success(t('workflowCreatedFromTemplate'));
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => Workflow.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => Workflow.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workflows'] }); toast.success(t('deleted')); },
  });

  const handleDuplicate = async (w) => {
    const { id, created_date, updated_date, created_by, ...rest } = w;
    await Workflow.create({ ...rest, name: `${w.name} (${isPt ? 'Cópia' : 'Copy'})`, status: 'draft' });
    queryClient.invalidateQueries({ queryKey: ['workflows'] });
    toast.success(t('duplicated'));
  };

  const openBuilder = (workflow = null) => {
    setEditingWorkflow(workflow);
    setShowBuilder(true);
  };

  const filter = (list) => list.filter(w => !searchQuery || w.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const active = filter(workflows.filter(w => w.status === 'active'));
  const drafts = filter(workflows.filter(w => w.status === 'draft'));
  const inactive = filter(workflows.filter(w => w.status === 'paused' || w.status === 'archived'));

  const WorkflowCard = ({ workflow: w }) => (
    <div className="group p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-[#38b6ff]/30 transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${w.status === 'active' ? 'bg-green-500/20' : 'bg-[#38b6ff]/20'}`}>
            <GitBranch size={20} className={w.status === 'active' ? 'text-green-400' : 'text-[#38b6ff]'} />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm leading-tight">{w.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5 capitalize">{w.type?.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white h-7 w-7">
              <MoreVertical size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#1a1a1a] border-white/10">
            <DropdownMenuItem onClick={() => openBuilder(w)} className="text-white hover:bg-white/10"><Edit2 size={14} className="mr-2" /> {t('edit')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDuplicate(w)} className="text-white hover:bg-white/10"><Copy size={14} className="mr-2" /> {t('duplicate')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => deleteMutation.mutate(w.id)} className="text-red-400 hover:bg-red-500/10"><Trash2 size={14} className="mr-2" /> {t('delete')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {w.description && <p className="text-gray-400 text-xs mb-3 line-clamp-2">{w.description}</p>}

      <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
        <div className="flex items-center gap-1"><Zap size={12} className="text-[#38b6ff]" />{w.steps?.length || w.nodes?.filter(n => n.type !== 'trigger')?.length || 0} {t('steps')}</div>
        <div className="flex items-center gap-1"><Users size={12} className="text-[#cb6ce6]" />{w.leads_enrolled || 0} {t('enrolled')}</div>
        {w.status === 'active' && <div className="flex items-center gap-1 text-green-400"><CheckCircle2 size={12} />{t('active')}</div>}
      </div>

      <div className="flex gap-2">
        <Button onClick={() => updateMutation.mutate({ id: w.id, data: { status: w.status === 'active' ? 'paused' : 'active' } })}
          size="sm" className={`flex-1 gap-1.5 text-xs ${w.status === 'active' ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400' : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'}`}>
          {w.status === 'active' ? <><Pause size={12} /> {t('pause')}</> : <><Play size={12} /> {t('activate')}</>}
        </Button>
        <Button onClick={() => openBuilder(w)} size="sm" variant="outline" className="border-white/10 text-white hover:bg-white/5">
          <Edit2 size={14} />
        </Button>
      </div>
    </div>
  );

  const EmptyState = ({ label }) => (
    <div className="text-center py-16">
      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
        <GitBranch size={24} className="text-gray-500" />
      </div>
      <p className="text-gray-400 font-medium mb-1">{isPt ? `Nenhum fluxo ${label}` : `No ${label} workflows`}</p>
      <p className="text-gray-600 text-sm">{t('createOneToStart')}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            {t('workflows')}
          </h1>
          <p className="text-gray-400 mt-1">{t('buildAutomateOptimize')}</p>
        </div>
        <Button onClick={() => openBuilder(null)} disabled={!company} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] hover:opacity-90 gap-2 disabled:opacity-50">
          <Plus size={18} /> {!company ? t('loading') : t('newWorkflow')}
        </Button>
      </div>

      <QuickStartGuide
        id="workflows"
        title={isPt ? 'Início Rápido: Fluxos' : 'Workflows Quick Start'}
        steps={[t('wfQs1'), t('wfQs2'), t('wfQs3'), t('wfQs4')]}
      />

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input placeholder={t('searchWorkflows')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
      </div>

      <Tabs defaultValue="active">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="active" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">{t('activeCount')} ({active.length})</TabsTrigger>
          <TabsTrigger value="draft" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">{t('draftsCount')} ({drafts.length})</TabsTrigger>
          <TabsTrigger value="inactive" className="data-[state=active]:bg-gray-500/20 data-[state=active]:text-gray-400">{t('inactiveCount')} ({inactive.length})</TabsTrigger>
          <TabsTrigger value="templates" className="data-[state=active]:bg-[#cb6ce6]/20 data-[state=active]:text-[#cb6ce6]">
            <LayoutTemplate size={14} className="mr-1" />{t('templatesCount')} ({workflowTemplates.length})
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 rounded-full border-2 border-[#38b6ff] border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            <TabsContent value="active">
              {active.length === 0 ? <EmptyState label="active" /> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{active.map(w => <WorkflowCard key={w.id} workflow={w} />)}</div>
              )}
            </TabsContent>
            <TabsContent value="draft">
              {drafts.length === 0 ? <EmptyState label="draft" /> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{drafts.map(w => <WorkflowCard key={w.id} workflow={w} />)}</div>
              )}
            </TabsContent>
            <TabsContent value="inactive">
              {inactive.length === 0 ? <EmptyState label="inactive" /> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{inactive.map(w => <WorkflowCard key={w.id} workflow={w} />)}</div>
              )}
            </TabsContent>
            <TabsContent value="templates">
              <div className="mb-4 p-3 rounded-xl bg-[#cb6ce6]/10 border border-[#cb6ce6]/20 text-xs text-[#cb6ce6]">
                {t('appWideTemplates')}
              </div>
              {(
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {STARTER_WORKFLOW_TEMPLATES.map(tmpl => (
                    <div key={tmpl.id} className="group p-5 rounded-2xl bg-[#cb6ce6]/5 border border-[#cb6ce6]/20 hover:border-[#cb6ce6]/40 transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="text-[10px] font-semibold text-[#cb6ce6]/60 uppercase tracking-wider">{tmpl.category}</span>
                          <p className="font-semibold text-white mt-0.5">{tmpl.name}</p>
                        </div>
                        <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{tmpl.steps} {t('steps')}</span>
                      </div>
                      <p className="text-sm text-gray-400 mb-4">{tmpl.description}</p>
                      <button
                        onClick={async () => { await Workflow.create({ name: tmpl.name, description: tmpl.description, status: 'draft', steps: [], company_id: company?.id }); queryClient.invalidateQueries({ queryKey: ['workflows'] }); toast.success(t('workflowCreated')); }}
                        className="w-full py-2 rounded-lg bg-[#cb6ce6]/15 text-[#cb6ce6] text-sm font-medium hover:bg-[#cb6ce6]/25 transition-colors"
                      >
                        {t('useTemplate')}
                      </button>
                    </div>
                  ))}
                  {workflowTemplates.map(w => (
                    <div key={w.id} className="group p-5 rounded-2xl bg-[#cb6ce6]/5 border border-[#cb6ce6]/20 hover:border-[#cb6ce6]/40 transition-all">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-11 h-11 rounded-xl bg-[#cb6ce6]/20 flex items-center justify-center">
                          <LayoutTemplate size={20} className="text-[#cb6ce6]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-sm">{w.name}</h3>
                          <p className="text-xs text-gray-500 capitalize">{w.type?.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      {w.description && <p className="text-gray-400 text-xs mb-3 line-clamp-2">{w.description}</p>}
                      <Button onClick={() => applyTemplate(w)} size="sm"
                        className="w-full bg-[#cb6ce6]/20 hover:bg-[#cb6ce6]/30 text-[#cb6ce6] border border-[#cb6ce6]/30 gap-1.5 text-xs">
                        <Copy size={12} /> {t('useAsTemplate')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {showBuilder && (
        <WorkflowBuilderModal
          workflow={editingWorkflow}
          company={company}
          onClose={() => { setShowBuilder(false); setEditingWorkflow(null); queryClient.invalidateQueries({ queryKey: ['workflows'] }); }}
        />
      )}
    </div>
  );
}