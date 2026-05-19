import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, Plus, List, Trash2, Users, Edit, Zap, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { LeadList } from '@/api/entities';

const SOURCE_CATEGORIES = ['inbound', 'outbound', 'offline'];
const FUNNEL_STAGES = ['prospect', 'awareness', 'consideration', 'mql', 'sql', 'opportunity', 'customer', 'retention', 'advocacy'];

export default function LeadListManagerFull({ companyId, leads = [] }) {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingList, setEditingList] = useState(null);
  const [showManageLeads, setShowManageLeads] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', is_dynamic: false, filters: {} });
  const [manualSearch, setManualSearch] = useState('');

  const { data: leadLists = [] } = useQuery({
    queryKey: ['leadLists', companyId],
    queryFn: () => companyId ? LeadList.filter({ company_id: companyId }) : [],
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => LeadList.create({ ...data, company_id: companyId, lead_ids: [], lead_count: 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leadLists'] }); toast.success('List created'); setShowCreateDialog(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => LeadList.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leadLists'] }); toast.success('List updated'); setShowCreateDialog(false); setShowManageLeads(null); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => LeadList.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leadLists'] }); toast.success('List deleted'); },
  });

  const resetForm = () => { setFormData({ name: '', description: '', is_dynamic: false, filters: {} }); setEditingList(null); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) { toast.error('Name required'); return; }
    if (editingList) {
      updateMutation.mutate({ id: editingList.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (list) => {
    setEditingList(list);
    setFormData({ name: list.name, description: list.description || '', is_dynamic: list.is_dynamic || false, filters: list.filters || {} });
    setShowCreateDialog(true);
  };

  // Manual add/remove lead from list
  const toggleLeadInList = (list, leadId) => {
    const ids = list.lead_ids || [];
    const hasLead = ids.includes(leadId);
    const newIds = hasLead ? ids.filter(id => id !== leadId) : [...ids, leadId];
    updateMutation.mutate({ id: list.id, data: { lead_ids: newIds, lead_count: newIds.length } });
    toast.success(hasLead ? 'Lead removed from list' : 'Lead added to list');
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const syncDynamicLists = async () => {
    setIsSyncing(true);
    try {
      const res = await Promise.resolve({ success: true });
      queryClient.invalidateQueries({ queryKey: ['leadLists'] });
      toast.success(`Synced ${res.data?.synced ?? 0} dynamic list(s)`);
    } catch (e) {
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  // Compute live lead counts for dynamic lists from current leads data (no DB lag)
  const getLiveCount = (list) => {
    if (!list.is_dynamic || !list.filters || Object.keys(list.filters).length === 0) {
      return list.lead_count || 0;
    }
    const f = list.filters;
    return leads.filter(lead => {
      if (f.funnel_stages?.length && !f.funnel_stages.includes(lead.funnel_stage)) return false;
      if (f.icp_score_min != null && lead.icp_score != null && lead.icp_score < f.icp_score_min) return false;
      if (f.sources?.length && lead.source_category != null && !f.sources.includes(lead.source_category)) return false;
      if (f.status?.length && !f.status.includes(lead.status)) return false;
      return true;
    }).length;
  };

  const getListLeads = (list) => leads.filter(l => (list.lead_ids || []).includes(l.id));
  const getUnlistedLeads = (list) => leads.filter(l => !(list.lead_ids || []).includes(l.id));

  const filteredUnlistedLeads = (list) => getUnlistedLeads(list).filter(l =>
    !manualSearch || l.lead_company_name?.toLowerCase().includes(manualSearch.toLowerCase()) || l.lead_name?.toLowerCase().includes(manualSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Lead Lists</h3>
        <div className="flex items-center gap-2">
          <Button onClick={syncDynamicLists} disabled={isSyncing} variant="ghost" size="sm"
            className="text-[#cb6ce6] hover:bg-[#cb6ce6]/10 gap-1.5 text-xs" title="Re-sync all dynamic lists">
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} /> Sync
          </Button>
          <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2" size="sm">
            <Plus size={16} /> New List
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {leadLists.map(list => (
          <div key={list.id} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <List size={16} className="text-[#38b6ff]" />
                  <h4 className="text-white font-medium">{list.name}</h4>
                  {list.is_dynamic && <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#cb6ce6]/20 text-[#cb6ce6] flex items-center gap-1"><Zap size={10} />Dynamic</span>}
                </div>
                {list.description && <p className="text-sm text-gray-400 mb-2">{list.description}</p>}
                <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                  <span className="flex items-center gap-1"><Users size={12} />{getLiveCount(list)} leads</span>
                  {list.is_dynamic && list.filters && Object.keys(list.filters).length > 0 && (
                    <span className="text-[#cb6ce6]">Auto-filters: {Object.keys(list.filters).join(', ')}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setShowManageLeads(list)} className="text-[#38b6ff] hover:bg-[#38b6ff]/10 h-8 w-8" title="Manage Leads">
                  <UserPlus size={14} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleEdit(list)} className="text-gray-400 hover:text-white h-8 w-8">
                  <Edit size={14} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(list.id)} className="text-gray-400 hover:text-red-400 h-8 w-8">
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {leadLists.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <List size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No lists yet. Create one to organize your leads.</p>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); resetForm(); } }}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingList ? 'Edit List' : 'Create New List'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-gray-400">List Name</Label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., High Priority Leads" className="mt-1.5 bg-black/30 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-400">Description</Label>
              <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="What's this list for?" className="mt-1.5 bg-black/30 border-white/10 text-white" />
            </div>

            {/* Dynamic list toggle */}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setFormData({ ...formData, is_dynamic: !formData.is_dynamic })}
                className={`w-9 h-5 rounded-full transition-all relative ${formData.is_dynamic ? 'bg-[#38b6ff]' : 'bg-white/20'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${formData.is_dynamic ? 'left-4' : 'left-0.5'}`} />
              </button>
              <div>
                <p className="text-white text-sm font-medium">Dynamic List</p>
                <p className="text-gray-500 text-xs">Auto-adds leads based on rules</p>
              </div>
            </div>

            {/* Dynamic filters */}
            {formData.is_dynamic && (
              <div className="space-y-3 p-4 rounded-xl bg-[#cb6ce6]/5 border border-[#cb6ce6]/20">
                <p className="text-[#cb6ce6] text-xs font-medium flex items-center gap-1"><Zap size={12} />Auto-Filter Rules</p>
                <div>
                  <Label className="text-gray-400 text-xs">Funnel Stages (any of)</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {FUNNEL_STAGES.map(stage => (
                      <button key={stage} type="button"
                        onClick={() => {
                          const stages = formData.filters.funnel_stages || [];
                          const updated = stages.includes(stage) ? stages.filter(s => s !== stage) : [...stages, stage];
                          setFormData({ ...formData, filters: { ...formData.filters, funnel_stages: updated } });
                        }}
                        className={`text-xs px-2 py-1 rounded-lg border transition-all capitalize
                          ${(formData.filters.funnel_stages || []).includes(stage) ? 'border-[#38b6ff] bg-[#38b6ff]/10 text-[#38b6ff]' : 'border-white/10 text-gray-400'}`}>
                        {stage}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">Min ICP Score</Label>
                  <Input type="number" min="0" max="100" placeholder="e.g., 70"
                    value={formData.filters.icp_score_min || ''}
                    onChange={e => setFormData({ ...formData, filters: { ...formData.filters, icp_score_min: parseInt(e.target.value) || undefined } })}
                    className="mt-1 bg-black/30 border-white/10 text-white h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">Source Category (any of)</Label>
                  <div className="flex gap-2 mt-1">
                    {SOURCE_CATEGORIES.map(cat => (
                      <button key={cat} type="button"
                        onClick={() => {
                          const cats = formData.filters.sources || [];
                          const updated = cats.includes(cat) ? cats.filter(c => c !== cat) : [...cats, cat];
                          setFormData({ ...formData, filters: { ...formData.filters, sources: updated } });
                        }}
                        className={`text-xs px-2 py-1 rounded-lg border transition-all capitalize
                          ${(formData.filters.sources || []).includes(cat) ? 'border-[#38b6ff] bg-[#38b6ff]/10 text-[#38b6ff]' : 'border-white/10 text-gray-400'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]">
                {editingList ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Leads Dialog */}
      <Dialog open={!!showManageLeads} onOpenChange={open => { if (!open) { setShowManageLeads(null); setManualSearch(''); } }}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Manage Leads — {showManageLeads?.name}</DialogTitle></DialogHeader>
          {showManageLeads && (
            <div className="flex-1 overflow-hidden space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 h-[60vh]">
                {/* In List */}
                <div className="rounded-xl bg-white/5 border border-white/10 flex flex-col">
                  <div className="p-3 border-b border-white/10">
                    <p className="text-white font-medium text-sm">In List ({getListLeads(showManageLeads).length})</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {getListLeads(showManageLeads).map(lead => (
                      <div key={lead.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5">
                        <div>
                          <p className="text-white text-xs font-medium">{lead.lead_company_name}</p>
                          <p className="text-gray-500 text-xs">{lead.lead_name}</p>
                        </div>
                        <button onClick={() => toggleLeadInList(showManageLeads, lead.id)} className="text-red-400 hover:bg-red-500/10 p-1 rounded">
                          <UserMinus size={13} />
                        </button>
                      </div>
                    ))}
                    {getListLeads(showManageLeads).length === 0 && <p className="text-gray-600 text-xs text-center py-4">No leads in this list</p>}
                  </div>
                </div>
                {/* Available */}
                <div className="rounded-xl bg-white/5 border border-white/10 flex flex-col">
                  <div className="p-3 border-b border-white/10 space-y-2">
                    <p className="text-white font-medium text-sm">Available Leads</p>
                    <Input value={manualSearch} onChange={e => setManualSearch(e.target.value)} placeholder="Search..."
                      className="bg-black/30 border-white/10 text-white h-7 text-xs" />
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredUnlistedLeads(showManageLeads).map(lead => (
                      <div key={lead.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5">
                        <div>
                          <p className="text-white text-xs font-medium">{lead.lead_company_name}</p>
                          <p className="text-gray-500 text-xs">{lead.lead_name}</p>
                        </div>
                        <button onClick={() => toggleLeadInList(showManageLeads, lead.id)} className="text-green-400 hover:bg-green-500/10 p-1 rounded">
                          <UserPlus size={13} />
                        </button>
                      </div>
                    ))}
                    {filteredUnlistedLeads(showManageLeads).length === 0 && <p className="text-gray-600 text-xs text-center py-4">No available leads</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}