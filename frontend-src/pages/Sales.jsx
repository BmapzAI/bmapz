import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { useThemeClasses } from '@/components/ui/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, Search, LayoutGrid, List, Filter, 
  ChevronRight, ChevronLeft, Check, X, ChevronDown,
  Building2, User, Mail, Phone, Linkedin, Globe
} from 'lucide-react';
import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import LeadKanban from '@/components/sales/LeadKanban.jsx';
import LeadQualification from '@/components/sales/LeadQualification.jsx';
import AddLeadForm from '@/components/sales/AddLeadForm.jsx';
import DisqualifyDialog from '@/components/sales/DisqualifyDialog.jsx';
import KanbanFilters from '@/components/sales/KanbanFilters.jsx';
import LeadListManagerFull from '@/components/sales/LeadListManagerFull.jsx';
import LeadListView from '@/components/sales/LeadListView.jsx';
import QuickStartGuide from '@/components/ui/QuickStartGuide';
import { Company, Lead, LeadList, Funnel } from '@/api/entities';

const FUNNEL_STAGES_ORDERED = [
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

export default function Sales() {
  const { t } = useLanguage();
  const tc = useThemeClasses();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [showAddLead, setShowAddLead] = useState(false);
  const [showDisqualify, setShowDisqualify] = useState(false);
  const [leadToDisqualify, setLeadToDisqualify] = useState(null);
  const [filters, setFilters] = useState({
    icpScoreMin: 0,
    icpScoreMax: 100,
    minValue: 0,
    maxValue: null,
    decisionMakerOnly: false,
    source: 'all',
    listId: 'all',
  });
  const [sortBy, setSortBy] = useState({ field: 'created_date', direction: 'desc' });
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [showListManager, setShowListManager] = useState(false);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => Lead.list(),
  });

  const { data: funnels = [] } = useQuery({
    queryKey: ['funnels'],
    queryFn: () => Funnel.list(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => Company.list(),
  });

  const company = companies[0];
  const { data: leadLists = [] } = useQuery({
    queryKey: ['leadLists', company?.id],
    queryFn: () => company?.id ? LeadList.filter({ company_id: company.id }) : [],
    enabled: !!company?.id,
  });

  const stages = FUNNEL_STAGES_ORDERED;

  // Initialize visible columns
  React.useEffect(() => {
    if (stages.length && visibleColumns.length === 0) {
      setVisibleColumns(stages.map(s => s.id));
    }
  }, [stages]);

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchQuery || 
      lead.lead_company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.lead_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = stageFilter === 'all' || lead.funnel_stage === stageFilter;
    const matchesICP = (lead.icp_score || 0) >= filters.icpScoreMin && (lead.icp_score || 100) <= filters.icpScoreMax;
    const matchesValue = (lead.estimated_value || 0) >= filters.minValue;
    const matchesDecisionMaker = !filters.decisionMakerOnly || lead.is_decision_maker;
    const matchesSource = filters.source === 'all' || lead.source === filters.source;
    const matchesList = filters.listId === 'all' || (() => {
      const list = leadLists.find(l => l.id === filters.listId);
      return list && (list.lead_ids || []).includes(lead.id);
    })();
    return matchesSearch && matchesStage && matchesICP && matchesValue && matchesDecisionMaker && matchesSource && matchesList;
  }).sort((a, b) => {
    const aVal = a[sortBy.field] || '';
    const bVal = b[sortBy.field] || '';
    if (sortBy.direction === 'asc') {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, data }) => Lead.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead updated');
    },
  });

  const handleStageChange = (leadId, newStage) => {
    updateLeadMutation.mutate({ id: leadId, data: { funnel_stage: newStage } });
  };

  const handleDisqualify = (leadId) => {
    const lead = leads.find(l => l.id === leadId);
    setLeadToDisqualify(lead);
    setShowDisqualify(true);
  };

  const confirmDisqualify = (reason, notes) => {
    if (leadToDisqualify) {
      updateLeadMutation.mutate({ 
        id: leadToDisqualify.id, 
        data: { 
          status: 'disqualified',
          disqualification_reason: reason,
          disqualification_notes: notes,
        } 
      });
    }
    setShowDisqualify(false);
    setLeadToDisqualify(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold tracking-tight ${tc.text}`}
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            {t('leadManagement')}
          </h1>
          <p className={`mt-1 ${tc.textMuted}`}>{t('manageLeads')}</p>
        </div>
        
<div className="flex gap-2">
          <Button 
            onClick={() => setShowListManager(true)}
            variant="outline"
            className={`gap-2 ${tc.outlineBtn}`}
          >
            <List size={18} />
            {t('lists')}
          </Button>
          <Button 
            onClick={() => setShowAddLead(true)}
            className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] hover:opacity-90 
              transition-all duration-300 shadow-lg shadow-[#38b6ff]/20 gap-2"
          >
            <Plus size={18} />
            {t('addNewLead')}
          </Button>
        </div>
      </div>

      <QuickStartGuide
        id="sales_leads"
        title="Lead Management"
        steps={[
          "Add leads manually with the '+ Add New Lead' button, or import them in bulk from the Sales menu.",
          "Use Kanban view to drag leads between funnel stages, or switch to List view for a spreadsheet-style overview.",
          "Click any lead card to open its full profile — add notes, send messages, run AI analysis, and enroll in workflows.",
          "Use the Filters panel to narrow down leads by ICP score, value, source, or list membership.",
        ]}
      />

      {/* Controls */}
      <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl border ${tc.controlBar}`}>
        {/* View Toggle */}
        <div className={`flex items-center gap-1 p-1 rounded-xl ${tc.viewToggle}`}>
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200
              ${viewMode === 'kanban' ? tc.viewToggleActive : tc.viewToggleInactive}`}
          >
            <LayoutGrid size={18} />
            <span className="text-sm font-medium hidden sm:inline">{t('kanbanView')}</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200
              ${viewMode === 'list' ? tc.viewToggleActive : tc.viewToggleInactive}`}
          >
            <List size={18} />
            <span className="text-sm font-medium hidden sm:inline">{t('listView')}</span>
          </button>
          <button
            onClick={() => setViewMode('qualification')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200
              ${viewMode === 'qualification' ? tc.viewToggleActive : tc.viewToggleInactive}`}
          >
            <ChevronRight size={18} />
            <span className="text-sm font-medium hidden sm:inline">{t('qualificationView')}</span>
          </button>
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder={t('searchLeads')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`pl-10 ${tc.input} focus:border-[#38b6ff]/50`}
          />
        </div>

        {/* Stage Filter */}
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className={`w-[180px] ${tc.select}`}>
                  <Filter size={16} className={`mr-2 ${tc.textMuted}`} />
                  <SelectValue placeholder={t('filterByStage')} />
                </SelectTrigger>
                <SelectContent className={tc.selectContent}>
                  <SelectItem value="all" className={tc.selectItem}>{t('allStages')}</SelectItem>
                  {stages.map(stage => (
                    <SelectItem key={stage.id} value={stage.id} className={tc.selectItem}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* List filter */}
              {leadLists.length > 0 && (
                <Select value={filters.listId} onValueChange={v => setFilters({ ...filters, listId: v })}>
                  <SelectTrigger className={`w-[160px] ${tc.select}`}>
                    <SelectValue placeholder="All Lists" />
                  </SelectTrigger>
                  <SelectContent className={tc.selectContent}>
                    <SelectItem value="all" className={tc.selectItem}>All Lists</SelectItem>
                    {leadLists.map(list => (
                      <SelectItem key={list.id} value={list.id} className={tc.selectItem}>{list.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Advanced Filters */}
              {viewMode === 'kanban' && (
                <KanbanFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  visibleColumns={visibleColumns}
                  onColumnsChange={setVisibleColumns}
                  stages={stages}
                />
              )}
            </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 rounded-full border-2 border-[#38b6ff] border-t-transparent animate-spin" />
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#3572b9]/20 to-[#cb6ce6]/20 
            flex items-center justify-center mb-4">
            <Building2 size={40} className="text-[#38b6ff]" />
          </div>
          <h3 className={`text-xl font-semibold mb-2 ${tc.text}`}>{t('noLeadsFound')}</h3>
          <p className={`mb-6 ${tc.textMuted}`}>{t('addYourFirst')}</p>
          <Button 
            onClick={() => setShowAddLead(true)}
            className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2"
          >
            <Plus size={18} />
            {t('addNewLead')}
          </Button>
        </div>
      ) : viewMode === 'kanban' ? (
            <LeadKanban 
              leads={filteredLeads} 
              stages={visibleColumns.length > 0 ? stages.filter(s => visibleColumns.includes(s.id)) : stages}
              onStageChange={handleStageChange}
              onDisqualify={handleDisqualify}
            />
          ) : viewMode === 'list' ? (
            <LeadListView
              leads={filteredLeads}
              stages={stages}
              onDisqualify={handleDisqualify}
              companyId={company?.id}
            />
          ) : (
        <LeadQualification 
          leads={filteredLeads}
          stages={stages}
          onAdvance={handleStageChange}
          onDisqualify={handleDisqualify}
        />
      )}

      {/* Add Lead Dialog */}
      <Dialog open={showAddLead} onOpenChange={setShowAddLead}>
        <DialogContent className={`max-w-2xl ${tc.dialogBg}`}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t('addNewLead')}</DialogTitle>
          </DialogHeader>
          <AddLeadForm onClose={() => setShowAddLead(false)} stages={stages} />
                </DialogContent>
              </Dialog>

              {/* Disqualify Dialog */}
              <DisqualifyDialog
                open={showDisqualify}
                onOpenChange={setShowDisqualify}
                onConfirm={confirmDisqualify}
                leadName={leadToDisqualify?.lead_company_name || ''}
              />

              {/* Lead List Manager Dialog */}
               <Dialog open={showListManager} onOpenChange={setShowListManager}>
                <DialogContent className={`max-w-2xl max-h-[90vh] overflow-y-auto ${tc.dialogBg}`}>
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Lead Lists</DialogTitle>
                  </DialogHeader>
                  <LeadListManagerFull companyId={company?.id} leads={leads} />
                </DialogContent>
              </Dialog>
            </div>
          );
          }