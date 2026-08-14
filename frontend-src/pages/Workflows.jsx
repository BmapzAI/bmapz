import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Play, Pause, Trash2, Edit2, Copy, GitBranch, Users, Zap, MoreVertical, CheckCircle2, LayoutTemplate, UserPlus, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from 'sonner';
import WorkflowBuilderModal from '@/components/workflows/WorkflowBuilderModal';
import { WORKFLOW_TEMPLATE_LIST } from '@/components/workflows/workflowTemplates';
import QuickStartGuide from '@/components/ui/QuickStartGuide';
import { Company, Workflow, Lead } from '@/api/entities';
import { api } from '@/api/apiClient';

export default function Workflows() {
  const queryClient = useQueryClient();
  const { t, isPt } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [templateSeed, setTemplateSeed] = useState(null); // template to pre-load into a new builder
  const [showBuilder, setShowBuilder] = useState(false);
  const [enrollWorkflow, setEnrollWorkflow] = useState(null); // workflow being enrolled into
  const [enrollSelected, setEnrollSelected] = useState([]);   // selected lead ids
  const [enrollSearch, setEnrollSearch] = useState('');
  const [enrolling, setEnrolling] = useState(false);

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
    setTemplateSeed(null);
    setShowBuilder(true);
  };

  // Open the builder pre-loaded with a complete template (real nodes + connections).
  const openBuilderWithTemplate = (tmpl) => {
    setEditingWorkflow(null);
    setTemplateSeed(tmpl);
    setShowBuilder(true);
  };

  // Lead enrollment (only fetched when the enroll modal is open)
  const { data: leadsForEnroll = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['leadsForEnroll'],
    queryFn: () => Lead.list(),
    enabled: !!enrollWorkflow,
  });

  const openEnroll = (w) => {
    if (w.status !== 'active') {
      toast.error(isPt ? 'Ative o fluxo antes de inscrever leads.' : 'Activate the workflow before enrolling leads.');
      return;
    }
    setEnrollWorkflow(w);
    setEnrollSelected([]);
    setEnrollSearch('');
  };

  const toggleEnrollLead = (id) => {
    setEnrollSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const submitEnroll = async () => {
    if (!enrollSelected.length) return;
    setEnrolling(true);
    try {
      const res = await api.post(`/api/workflows/${enrollWorkflow.id}/enroll`, { lead_ids: enrollSelected });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success(isPt
        ? `${res.enrolled} lead(s) inscrito(s). Os passos agendados começarão a rodar automaticamente.`
        : `${res.enrolled} lead(s) enrolled. Scheduled steps will now run automatically.`);
      setEnrollWorkflow(null);
    } catch (e) {
      toast.error((isPt ? 'Falha ao inscrever: ' : 'Enroll failed: ') + e.message);
    } finally {
      setEnrolling(false);
    }
  };

  const enrollFiltered = leadsForEnroll.filter(l => {
    if (!enrollSearch) return true;
    const s = `${l.lead_name || ''} ${l.lead_company_name || ''} ${l.email || ''}`.toLowerCase();
    return s.includes(enrollSearch.toLowerCase());
  });

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
            <DropdownMenuItem onClick={() => openEnroll(w)} className="text-white hover:bg-white/10"><UserPlus size={14} className="mr-2" /> {isPt ? 'Inscrever leads' : 'Enroll leads'}</DropdownMenuItem>
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
        <div className="flex items-center gap-2">
          <CreateTaskButton section="workflow" />
          <Button onClick={() => openBuilder(null)} disabled={!company} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] hover:opacity-90 gap-2 disabled:opacity-50">
            <Plus size={18} /> {!company ? t('loading') : t('newWorkflow')}
          </Button>
        </div>
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
        <TabsList className="w-full justify-start overflow-x-auto bg-white/5 border border-white/10">
          <TabsTrigger value="active" className="shrink-0 data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">{t('activeCount')} ({active.length})</TabsTrigger>
          <TabsTrigger value="draft" className="shrink-0 data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">{t('draftsCount')} ({drafts.length})</TabsTrigger>
          <TabsTrigger value="inactive" className="shrink-0 data-[state=active]:bg-gray-500/20 data-[state=active]:text-gray-400">{t('inactiveCount')} ({inactive.length})</TabsTrigger>
          <TabsTrigger value="templates" className="shrink-0 data-[state=active]:bg-[#cb6ce6]/20 data-[state=active]:text-[#cb6ce6]">
            <LayoutTemplate size={14} className="mr-1" />{t('templatesCount')} ({WORKFLOW_TEMPLATE_LIST.length + workflowTemplates.length})
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
                {isPt
                  ? 'Escolha um modelo para abrir o construtor já montado com todos os passos — pronto para revisar, ajustar e ativar.'
                  : 'Pick a template to open the builder already assembled with every step — ready to review, tweak and activate.'}
              </div>
              {(
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {WORKFLOW_TEMPLATE_LIST.map(tmpl => (
                    <div key={tmpl.key} className="group p-5 rounded-2xl bg-[#cb6ce6]/5 border border-[#cb6ce6]/20 hover:border-[#cb6ce6]/40 transition-all flex flex-col">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="text-[10px] font-semibold text-[#cb6ce6]/60 uppercase tracking-wider">{tmpl.category}</span>
                          <p className="font-semibold text-white mt-0.5">{tmpl.name}</p>
                        </div>
                        <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full whitespace-nowrap">{tmpl.steps} {t('steps')}</span>
                      </div>
                      <p className="text-sm text-gray-400 mb-4 flex-1">{tmpl.description}</p>
                      <button
                        onClick={() => openBuilderWithTemplate(tmpl)}
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
          initialTemplate={templateSeed}
          onClose={() => { setShowBuilder(false); setEditingWorkflow(null); setTemplateSeed(null); queryClient.invalidateQueries({ queryKey: ['workflows'] }); }}
        />
      )}

      {/* Enroll leads modal */}
      <Dialog open={!!enrollWorkflow} onOpenChange={(o) => !o && setEnrollWorkflow(null)}>
        <DialogContent className="max-w-lg bg-[#111] border-white/10 text-white max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus size={18} className="text-[#38b6ff]" />
              {isPt ? 'Inscrever leads em' : 'Enroll leads into'} “{enrollWorkflow?.name}”
            </DialogTitle>
          </DialogHeader>
          <p className="text-gray-400 text-sm">
            {isPt
              ? 'Os leads selecionados entram no fluxo agora. Mensagens e esperas agendadas rodam automaticamente em segundo plano.'
              : 'Selected leads enter the workflow now. Scheduled messages and waits run automatically in the background.'}
          </p>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={enrollSearch} onChange={(e) => setEnrollSearch(e.target.value)}
              placeholder={isPt ? 'Buscar leads...' : 'Search leads...'}
              className="pl-10 bg-white/5 border-white/10 text-white" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[120px] max-h-[45vh]">
            {leadsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#38b6ff]" /></div>
            ) : enrollFiltered.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">{isPt ? 'Nenhum lead encontrado.' : 'No leads found.'}</p>
            ) : enrollFiltered.map(l => {
              const sel = enrollSelected.includes(l.id);
              return (
                <button key={l.id} onClick={() => toggleEnrollLead(l.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${sel ? 'bg-[#38b6ff]/15 border-[#38b6ff]/40' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${sel ? 'bg-[#38b6ff] border-[#38b6ff]' : 'border-white/30'}`}>
                    {sel && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">{l.lead_name || l.lead_company_name || 'Lead'}</p>
                    <p className="text-gray-500 text-xs truncate">{l.email || l.lead_company_name || '—'}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
            <span className="text-gray-400 text-sm">{enrollSelected.length} {isPt ? 'selecionado(s)' : 'selected'}</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEnrollWorkflow(null)} className="border-white/10 text-white hover:bg-white/5">
                {isPt ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button onClick={submitEnroll} disabled={!enrollSelected.length || enrolling}
                className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
                {enrolling ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                {isPt ? 'Inscrever' : 'Enroll'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
