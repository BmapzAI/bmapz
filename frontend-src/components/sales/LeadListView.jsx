import React, { useState, useMemo } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ChevronUp, ChevronDown, Settings2, Check, Trash2, 
  UserPlus, GitBranch, XCircle, Save, Eye, EyeOff,
  Crown, GripVertical, Search
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { Lead, Workflow } from '@/api/entities';

const ALL_COLUMNS = [
  { id: 'lead_company_name', label: 'Company', sortable: true, default: true },
  { id: 'lead_name', label: 'Contact', sortable: true, default: true },
  { id: 'role', label: 'Role', sortable: true, default: true },
  { id: 'funnel_stage', label: 'Stage', sortable: true, default: true },
  { id: 'icp_score', label: 'ICP Score', sortable: true, default: true },
  { id: 'estimated_value', label: 'Value', sortable: true, default: true },
  { id: 'status', label: 'Status', sortable: true, default: true },
  { id: 'email', label: 'Email', sortable: false, default: false },
  { id: 'phone', label: 'Phone', sortable: false, default: false },
  { id: 'source', label: 'Source', sortable: true, default: false },
  { id: 'source_category', label: 'Source Type', sortable: true, default: false },
  { id: 'is_decision_maker', label: 'Decision Maker', sortable: false, default: false },
  { id: 'created_date', label: 'Created', sortable: true, default: false },
  { id: 'updated_date', label: 'Updated', sortable: true, default: false },
];

const STAGE_COLORS = {
  prospect: '#9ca3af',
  awareness: '#38b6ff',
  lead_capture: '#3572b9',
  consideration: '#00e7ff',
  mql: '#a78bfa',
  sql: '#f59e0b',
  opportunity: '#cb6ce6',
  customer: '#22c55e',
  retention: '#10b981',
  advocacy: '#f59e0b',
};

export default function LeadListView({ leads, stages, onDisqualify, companyId }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [sortBy, setSortBy] = useState({ field: 'created_date', direction: 'desc' });
  const [visibleCols, setVisibleCols] = useState(ALL_COLUMNS.filter(c => c.default).map(c => c.id));
  const [colOrder, setColOrder] = useState(ALL_COLUMNS.filter(c => c.default).map(c => c.id));
  const [showSaveView, setShowSaveView] = useState(false);
  const [viewName, setViewName] = useState('');
  const [savedViews, setSavedViews] = useState(() => {
    try { return JSON.parse(localStorage.getItem('leadListViews') || '[]'); } catch { return []; }
  });
  const [activeView, setActiveView] = useState(null);
  const [showBulkWorkflow, setShowBulkWorkflow] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState('');
  const [showBulkList, setShowBulkList] = useState(false);
  const [selectedList, setSelectedList] = useState('');

  const { data: workflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: () => Workflow.list() });
  const { data: leadLists = [] } = useQuery({
    queryKey: ['leadLists', companyId],
    queryFn: () => companyId ? LeadList.filter({ company_id: companyId }) : [],
    enabled: !!companyId,
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, data }) => Lead.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });
  const updateListMutation = useMutation({
    mutationFn: ({ id, data }) => LeadList.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leadLists'] }),
  });

  const sortedLeads = useMemo(() => [...leads].sort((a, b) => {
    const aVal = a[sortBy.field] || '';
    const bVal = b[sortBy.field] || '';
    if (sortBy.direction === 'asc') return aVal > bVal ? 1 : -1;
    return aVal < bVal ? 1 : -1;
  }), [leads, sortBy]);

  const orderedCols = colOrder.filter(id => visibleCols.includes(id));

  const toggleSort = (field) => {
    if (sortBy.field === field) {
      setSortBy({ field, direction: sortBy.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSortBy({ field, direction: 'asc' });
    }
  };

  const toggleLead = (id) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedLeads.size === sortedLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(sortedLeads.map(l => l.id)));
    }
  };

  const toggleColumn = (colId) => {
    if (visibleCols.includes(colId)) {
      setVisibleCols(prev => prev.filter(c => c !== colId));
      setColOrder(prev => prev.filter(c => c !== colId));
    } else {
      setVisibleCols(prev => [...prev, colId]);
      setColOrder(prev => [...prev, colId]);
    }
  };

  const saveView = () => {
    if (!viewName.trim()) return;
    const view = { id: Date.now().toString(), name: viewName, cols: visibleCols, colOrder, sortBy };
    const updated = [...savedViews, view];
    setSavedViews(updated);
    localStorage.setItem('leadListViews', JSON.stringify(updated));
    setViewName('');
    setShowSaveView(false);
    toast.success('View saved!');
  };

  const loadView = (view) => {
    setVisibleCols(view.cols);
    setColOrder(view.colOrder);
    setSortBy(view.sortBy);
    setActiveView(view.id);
    toast.success(`Loaded view: ${view.name}`);
  };

  const deleteView = (id) => {
    const updated = savedViews.filter(v => v.id !== id);
    setSavedViews(updated);
    localStorage.setItem('leadListViews', JSON.stringify(updated));
    if (activeView === id) setActiveView(null);
  };

  const bulkAddToList = () => {
    if (!selectedList) return;
    const list = leadLists.find(l => l.id === selectedList);
    if (!list) return;
    const existingIds = list.lead_ids || [];
    const newIds = [...new Set([...existingIds, ...Array.from(selectedLeads)])];
    updateListMutation.mutate({ id: list.id, data: { lead_ids: newIds, lead_count: newIds.length } });
    toast.success(`Added ${selectedLeads.size} leads to "${list.name}"`);
    setShowBulkList(false);
    setSelectedLeads(new Set());
  };

  const bulkDisqualify = () => {
    if (selectedLeads.size === 0) return;
    selectedLeads.forEach(id => onDisqualify && onDisqualify(id));
    setSelectedLeads(new Set());
  };

  const renderCell = (lead, colId) => {
    switch (colId) {
      case 'lead_company_name': return (
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(createPageUrl(`LeadDetails?id=${lead.id}`))}>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#3572b9] to-[#38b6ff] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {lead.lead_company_name?.[0]?.toUpperCase() || 'L'}
          </div>
          <span className="text-white font-medium hover:text-[#38b6ff] transition-colors truncate max-w-[150px]">{lead.lead_company_name}</span>
        </div>
      );
      case 'lead_name': return (
        <div className="flex items-center gap-1">
          <span className="text-gray-300 truncate max-w-[130px]">{lead.lead_name || '—'}</span>
          {lead.is_decision_maker && <Crown size={12} className="text-yellow-400 flex-shrink-0" />}
        </div>
      );
      case 'funnel_stage': return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
          style={{ backgroundColor: `${STAGE_COLORS[lead.funnel_stage] || '#666'}20`, color: STAGE_COLORS[lead.funnel_stage] || '#999' }}>
          {stages.find(s => s.id === lead.funnel_stage)?.name || lead.funnel_stage || '—'}
        </span>
      );
      case 'icp_score': return lead.icp_score ? (
        <div className="flex items-center gap-2">
          <div className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${lead.icp_score}%`, backgroundColor: lead.icp_score >= 70 ? '#22c55e' : lead.icp_score >= 40 ? '#f59e0b' : '#ef4444' }} />
          </div>
          <span className={`text-xs font-medium ${lead.icp_score >= 70 ? 'text-green-400' : lead.icp_score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>{lead.icp_score}%</span>
        </div>
      ) : <span className="text-gray-600">—</span>;
      case 'estimated_value': return lead.estimated_value ? <span className="text-[#cb6ce6] font-medium">${lead.estimated_value.toLocaleString()}</span> : <span className="text-gray-600">—</span>;
      case 'status': return (
        <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${lead.status === 'active' ? 'text-green-400 bg-green-400/10' : lead.status === 'converted' ? 'text-blue-400 bg-blue-400/10' : lead.status === 'disqualified' ? 'text-red-400 bg-red-400/10' : 'text-gray-400 bg-white/10'}`}>
          {lead.status || 'active'}
        </span>
      );
      case 'is_decision_maker': return lead.is_decision_maker ? <span className="text-yellow-400 text-xs flex items-center gap-1"><Crown size={10} />Yes</span> : <span className="text-gray-600 text-xs">No</span>;
      case 'created_date': return <span className="text-gray-400 text-xs">{lead.created_date ? new Date(lead.created_date).toLocaleDateString() : '—'}</span>;
      case 'updated_date': return <span className="text-gray-400 text-xs">{lead.updated_date ? new Date(lead.updated_date).toLocaleDateString() : '—'}</span>;
      case 'email': return <span className="text-gray-400 text-xs truncate max-w-[180px]">{lead.email || '—'}</span>;
      case 'phone': return <span className="text-gray-400 text-xs">{lead.phone || '—'}</span>;
      case 'source': return <span className="text-gray-400 text-xs capitalize truncate max-w-[120px]">{lead.source || '—'}</span>;
      case 'source_category': return <span className="text-gray-400 text-xs capitalize">{lead.source_category || '—'}</span>;
      case 'role': return <span className="text-gray-300 text-sm truncate max-w-[120px]">{lead.role || '—'}</span>;
      default: return <span className="text-gray-600">—</span>;
    }
  };

  const SortIcon = ({ field }) => {
    if (sortBy.field !== field) return null;
    return sortBy.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Column selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="border-white/10 text-white hover:bg-white/5 gap-2">
              <Settings2 size={15} /> Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#1a1a1a] border-white/10 w-52">
            <DropdownMenuLabel className="text-gray-400">Visible Columns</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            {ALL_COLUMNS.map(col => (
              <DropdownMenuCheckboxItem key={col.id} checked={visibleCols.includes(col.id)}
                onCheckedChange={() => toggleColumn(col.id)} className="text-white hover:bg-white/10">
                {col.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Saved views */}
        {savedViews.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-white/10 text-white hover:bg-white/5 gap-2">
                <Eye size={15} /> Views ({savedViews.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#1a1a1a] border-white/10 w-56">
              {savedViews.map(view => (
                <div key={view.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded">
                  <button onClick={() => loadView(view)} className={`text-sm flex-1 text-left ${activeView === view.id ? 'text-[#38b6ff]' : 'text-white'}`}>
                    {view.name} {activeView === view.id && '✓'}
                  </button>
                  <button onClick={() => deleteView(view.id)} className="text-gray-500 hover:text-red-400 p-1">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button variant="outline" size="sm" onClick={() => setShowSaveView(true)}
          className="border-white/10 text-white hover:bg-white/5 gap-2">
          <Save size={15} /> Save View
        </Button>

        {/* Bulk actions (shown when leads selected) */}
        {selectedLeads.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[#38b6ff] text-sm font-medium">{selectedLeads.size} selected</span>
            <Button size="sm" variant="outline" onClick={() => setShowBulkList(true)}
              className="border-[#38b6ff]/30 text-[#38b6ff] hover:bg-[#38b6ff]/10 gap-1">
              <UserPlus size={14} /> Add to List
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowBulkWorkflow(true)}
              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 gap-1">
              <GitBranch size={14} /> Apply Workflow
            </Button>
            <Button size="sm" variant="outline" onClick={bulkDisqualify}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1">
              <XCircle size={14} /> Disqualify
            </Button>
            <button onClick={() => setSelectedLeads(new Set())} className="text-gray-400 hover:text-white p-1">
              <XCircle size={16} />
            </button>
          </div>
        )}
        {selectedLeads.size === 0 && (
          <span className="text-gray-500 text-sm ml-auto">{sortedLeads.length} leads</span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="w-10 px-3 py-3">
                  <div onClick={toggleAll} className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all
                    ${selectedLeads.size === sortedLeads.length && sortedLeads.length > 0 ? 'bg-[#38b6ff] border-[#38b6ff]' : 'border-white/30 hover:border-white/60'}`}>
                    {selectedLeads.size === sortedLeads.length && sortedLeads.length > 0 && <Check size={10} className="text-white" />}
                  </div>
                </th>
                {orderedCols.map(colId => {
                  const col = ALL_COLUMNS.find(c => c.id === colId);
                  return (
                    <th key={colId} className="px-3 py-3 text-left text-gray-400 font-medium whitespace-nowrap">
                      {col?.sortable ? (
                        <button onClick={() => toggleSort(colId)} className="flex items-center gap-1 hover:text-white transition-colors">
                          {col.label} <SortIcon field={colId} />
                        </button>
                      ) : col?.label}
                    </th>
                  );
                })}
                <th className="px-3 py-3 text-left text-gray-400 font-medium w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedLeads.map((lead, idx) => (
                <tr key={lead.id}
                  className={`border-b border-white/5 hover:bg-white/5 transition-colors
                    ${selectedLeads.has(lead.id) ? 'bg-[#38b6ff]/5' : idx % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                  <td className="px-3 py-2.5">
                    <div onClick={() => toggleLead(lead.id)} className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all
                      ${selectedLeads.has(lead.id) ? 'bg-[#38b6ff] border-[#38b6ff]' : 'border-white/30 hover:border-white/60'}`}>
                      {selectedLeads.has(lead.id) && <Check size={10} className="text-white" />}
                    </div>
                  </td>
                  {orderedCols.map(colId => (
                    <td key={colId} className="px-3 py-2.5">
                      {renderCell(lead, colId)}
                    </td>
                  ))}
                  <td className="px-3 py-2.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="p-1 rounded hover:bg-white/10 text-gray-400">
                        <Settings2 size={14} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-[#1a1a1a] border-white/10">
                        <DropdownMenuItem className="text-white hover:bg-white/10" onClick={() => navigate(createPageUrl(`LeadDetails?id=${lead.id}`))}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-400 hover:bg-red-500/10" onClick={() => onDisqualify && onDisqualify(lead.id)}>
                          Disqualify
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sortedLeads.length === 0 && (
          <div className="text-center py-12 text-gray-400">No leads match current filters</div>
        )}
      </div>

      {/* Save View Dialog */}
      <Dialog open={showSaveView} onOpenChange={setShowSaveView}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white">
          <DialogHeader><DialogTitle>Save Current View</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Input value={viewName} onChange={e => setViewName(e.target.value)} placeholder="View name (e.g. High ICP Prospects)"
              className="bg-black/30 border-white/10 text-white" onKeyDown={e => e.key === 'Enter' && saveView()} />
            <p className="text-gray-400 text-xs">Saves current columns, column order, and sort preferences.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowSaveView(false)} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
              <Button onClick={saveView} disabled={!viewName.trim()} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk add to list dialog */}
      <Dialog open={showBulkList} onOpenChange={setShowBulkList}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white">
          <DialogHeader><DialogTitle>Add {selectedLeads.size} Leads to List</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={selectedList} onValueChange={setSelectedList}>
              <SelectTrigger className="bg-black/30 border-white/10 text-white"><SelectValue placeholder="Select a list..." /></SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                {leadLists.map(l => <SelectItem key={l.id} value={l.id} className="text-white">{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowBulkList(false)} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
              <Button onClick={bulkAddToList} disabled={!selectedList} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]">Add to List</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk workflow dialog */}
      <Dialog open={showBulkWorkflow} onOpenChange={setShowBulkWorkflow}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white">
          <DialogHeader><DialogTitle>Apply Workflow to {selectedLeads.size} Leads</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={selectedWorkflow} onValueChange={setSelectedWorkflow}>
              <SelectTrigger className="bg-black/30 border-white/10 text-white"><SelectValue placeholder="Select workflow..." /></SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                {workflows.map(w => <SelectItem key={w.id} value={w.id} className="text-white">{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-gray-400 text-xs">This will enroll the selected leads in the chosen workflow.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowBulkWorkflow(false)} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
              <Button onClick={() => { toast.success(`Enrolled ${selectedLeads.size} leads in workflow`); setShowBulkWorkflow(false); setSelectedLeads(new Set()); }}
                disabled={!selectedWorkflow} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]">Apply</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
