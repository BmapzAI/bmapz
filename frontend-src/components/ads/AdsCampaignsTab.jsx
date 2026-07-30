import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdRecord } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Edit2, Pause, Play, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function AdsCampaignsTab({ companyId }) {
  const queryClient = useQueryClient();
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['adCampaigns', companyId],
    queryFn: () => companyId
      ? AdRecord.filter({ company_id: companyId, type: 'campaign' })
      : [],
    enabled: !!companyId,
  });

  // Every mutation reports failures: a silent save looked like the campaign had
  // been stored when nothing had actually been written.
  const failed = (verb) => (e) => toast.error(`Could not ${verb} the campaign: ${e?.message || 'unknown error'}`);

  const createMutation = useMutation({
    mutationFn: (data) => AdRecord.create({ ...data, company_id: companyId, type: 'campaign' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adCampaigns', companyId] });
      setCreateOpen(false);
      toast.success('Campaign created');
    },
    onError: failed('create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => AdRecord.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adCampaigns', companyId] });
      setEditingCampaign(null);
      toast.success('Campaign updated');
    },
    onError: failed('update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => AdRecord.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adCampaigns', companyId] });
      toast.success('Campaign deleted');
    },
    onError: failed('delete'),
  });

  const handleToggleStatus = (campaign) => {
    const currentStatus = campaign.form_data?.status || 'active';
    updateMutation.mutate({
      id: campaign.id,
      data: { form_data: { ...campaign.form_data, status: currentStatus === 'paused' ? 'active' : 'paused' } },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-white/5 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Campaigns</h2>
          <p className="text-gray-400 mt-1">Manage your active ad campaigns</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
              <Plus size={16} /> New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1a1a1a] border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white">Create Campaign</DialogTitle>
            </DialogHeader>
            <CampaignForm
              onSave={(formData) => createMutation.mutate({ title: formData.name, form_data: formData })}
              onCancel={() => setCreateOpen(false)}
              isSaving={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-lg p-12 text-center">
          <p className="text-gray-400">No campaigns yet. Create your first campaign to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map(campaign => {
            const fd = campaign.form_data || {};
            return (
              <div key={campaign.id} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold">{fd.name || campaign.title}</h3>
                    <div className="grid grid-cols-4 gap-4 mt-2 text-sm text-gray-400">
                      <div>
                        <span className="text-gray-500">Platform</span>
                        <p className="text-white capitalize">{fd.platform || campaign.platform || '—'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Budget</span>
                        <p className="text-white">{fd.budget ? `$${fd.budget}` : '—'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Objective</span>
                        <p className="text-white capitalize">{fd.objective || campaign.objective || '—'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Status</span>
                        <p className={`capitalize ${(fd.status || 'active') === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
                          {fd.status || 'active'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleToggleStatus(campaign)} className="text-gray-400 hover:text-white">
                      {(fd.status || 'active') === 'active' ? <Pause size={16} /> : <Play size={16} />}
                    </Button>
                    <Dialog open={editingCampaign?.id === campaign.id} onOpenChange={(open) => !open && setEditingCampaign(null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={() => setEditingCampaign(campaign)} className="text-gray-400 hover:text-white">
                          <Edit2 size={16} />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-[#1a1a1a] border-white/10">
                        <DialogHeader>
                          <DialogTitle className="text-white">Edit Campaign</DialogTitle>
                        </DialogHeader>
                        <CampaignForm
                          initialData={fd}
                          onSave={(formData) => updateMutation.mutate({ id: campaign.id, data: { title: formData.name, form_data: formData } })}
                          onCancel={() => setEditingCampaign(null)}
                          isSaving={updateMutation.isPending}
                        />
                      </DialogContent>
                    </Dialog>
                    <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(campaign.id)} className="text-red-400 hover:text-red-300">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CampaignForm({ initialData, onSave, onCancel, isSaving }) {
  const [form, setForm] = React.useState(
    initialData || {
      name: '', platform: 'meta', objective: 'LINK_CLICKS',
      budget: '', startDate: '', endDate: '', audience: '', creative: '', status: 'active',
    }
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div>
        <label className="text-sm text-gray-400">Campaign Name</label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Q1 2026 - Lead Gen" className="bg-white/5 border-white/10 text-white mt-1" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-gray-400">Platform</label>
          <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-white/10">
              <SelectItem value="meta">Meta (Facebook/Instagram)</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="x">X (Twitter)</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="google">Google Ads</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-gray-400">Objective</label>
          <Select value={form.objective} onValueChange={(v) => setForm({ ...form, objective: v })}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-white/10">
              <SelectItem value="AWARENESS">Awareness</SelectItem>
              <SelectItem value="CONSIDERATION">Consideration</SelectItem>
              <SelectItem value="LINK_CLICKS">Link Clicks</SelectItem>
              <SelectItem value="REACH">Reach</SelectItem>
              <SelectItem value="CONVERSIONS">Conversions</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-gray-400">Daily Budget (USD)</label>
          <Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })}
            placeholder="100" className="bg-white/5 border-white/10 text-white mt-1" required />
        </div>
        <div>
          <label className="text-sm text-gray-400">Start Date</label>
          <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="bg-white/5 border-white/10 text-white mt-1" />
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-400">End Date</label>
        <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          className="bg-white/5 border-white/10 text-white mt-1" />
      </div>

      <div>
        <label className="text-sm text-gray-400">Target Audience</label>
        <Input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}
          placeholder="Marketing directors, 25-50, interested in SaaS" className="bg-white/5 border-white/10 text-white mt-1" />
      </div>

      <div>
        <label className="text-sm text-gray-400">Creative/Copy</label>
        <Input value={form.creative} onChange={(e) => setForm({ ...form, creative: e.target.value })}
          placeholder="Ad headline or copy summary" className="bg-white/5 border-white/10 text-white mt-1" />
      </div>

      <div className="flex gap-3 justify-end pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="border-white/10">Cancel</Button>
        <Button type="submit" disabled={isSaving} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]">
          {isSaving ? 'Saving...' : 'Save Campaign'}
        </Button>
      </div>
    </form>
  );
}