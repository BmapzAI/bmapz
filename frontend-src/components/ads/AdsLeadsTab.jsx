import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, RotateCw, Users, UserCheck, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/api/apiClient';
import { Lead, AdsManager } from '@/api/entities';

/**
 * Where a handed-over lead should land. Mirrors the funnel stages used by the
 * Sales board and the SDR, so a lead arriving from Ads sits in the same pipeline
 * as everything else. Only MQL and beyond mark a lead as qualified.
 */
const FUNNEL_STAGES = [
  { key: 'awareness',     label: 'Awareness',     hint: 'just discovered you' },
  { key: 'consideration', label: 'Consideration', hint: 'weighing options' },
  { key: 'mql',           label: 'MQL',           hint: 'marketing qualified' },
  { key: 'sql',           label: 'SQL',           hint: 'sales qualified' },
  { key: 'opportunity',   label: 'Opportunity',   hint: 'active deal' },
];

export default function AdsLeadsTab() {
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['adsSettings'],
    queryFn: () => AdsManager.getSettings(),
    retry: false,
  });
  const autoHandover = !!settings?.ads_auto_handover;

  // Manual hand-over: which leads, and which stage they should enter.
  const [selected, setSelected] = useState([]);
  const [stage, setStage] = useState('sql');

  const handover = useMutation({
    mutationFn: () => AdsManager.handoverLeads({ lead_ids: selected, stage }),
    onSuccess: (r) => {
      toast.success(`${r.handed} lead(s) handed to sales as "${stage}"`);
      setSelected([]);
      syncLeads();
    },
    onError: (e) => toast.error(`Could not hand the leads over: ${e.message}`),
  });

  const saveSettings = useMutation({
    mutationFn: (on) => AdsManager.saveSettings({ ads_auto_handover: on }),
    onSuccess: (_d, on) => {
      queryClient.invalidateQueries({ queryKey: ['adsSettings'] });
      toast.success(on
        ? 'New ad leads will be handed to the sales team automatically'
        : 'Automatic hand-over turned off');
    },
    onError: (e) => toast.error(`Could not change the setting: ${e.message}`),
  });

  useEffect(() => {
    const stored = localStorage.getItem('adLeadsLastSync');
    if (stored) setLastSync(new Date(stored));
  }, []);

  const syncLeads = async () => {
    setIsLoading(true);
    try {
      const result = await api.get('/api/ads/platform-leads');

      if (result?.success) {
        toast.success(`Synced ${result.total_added} new leads from ad campaigns`);
        setLastSync(new Date());
        localStorage.setItem('adLeadsLastSync', new Date().toISOString());

        // Fetch updated leads from all ad platforms
        const [meta, tiktok, linkedin] = await Promise.all([
          Lead.filter({ source: 'meta_ads' }),
          Lead.filter({ source: 'tiktok_ads' }),
          Lead.filter({ source: 'linkedin_ads' }),
        ]);
        const adLeads = [...(meta || []), ...(tiktok || []), ...(linkedin || [])];
        setLeads(adLeads);
      } else {
        toast.error(result?.message || 'Failed to sync leads');
      }
    } catch (error) {
      console.error('Error syncing leads:', error);
      toast.error('Failed to sync leads');
    } finally {
      setIsLoading(false);
    }
  };

  const exportLeads = () => {
    if (leads.length === 0) {
      toast.error('No leads to export');
      return;
    }

    const csv = [
      ['Name', 'Email', 'Phone', 'Company', 'Source', 'Status', 'Synced Date'].join(','),
      ...leads.map(l =>
        [
          l.lead_name || '',
          l.email || '',
          l.phone || '',
          l.lead_company_name || '',
          l.source || '',
          l.status || '',
          // The column is created_at; created_date is a Base44 alias that does not
          // exist here, so this rendered "Invalid Date".
          new Date(l.created_at || l.created_date).toLocaleDateString(),
        ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ad-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Leads exported');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Ad Leads</h2>
        <p className="text-gray-400 mt-1">Automatically sync leads from your ad campaigns</p>
      </div>

      {/* Automatic hand-over. Uses the same routing rules as everywhere else:
          the online sales member chosen by your routing method, or the SDR queue
          when nobody is online. */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-white font-medium text-sm flex items-center gap-2">
            <UserCheck size={16} className="text-[#38b6ff]" />
            Hand new ad leads to the sales team automatically
          </p>
          <p className="text-gray-400 text-xs mt-1 max-w-xl">
            {autoHandover
              ? 'On — each lead that arrives is assigned straight away using your lead routing method. If nobody is online it waits in the SDR queue.'
              : 'Off — leads arrive unassigned and you hand them over yourself.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoHandover}
          aria-label="Hand new ad leads to the sales team automatically"
          disabled={saveSettings.isPending}
          onClick={() => saveSettings.mutate(!autoHandover)}
          className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full text-sm border transition-colors flex-shrink-0 disabled:opacity-60 ${
            autoHandover
              ? 'text-green-400 bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
              : 'text-gray-400 bg-white/5 border-white/10 hover:bg-white/10'}`}
        >
          <span className={`relative w-8 h-4 rounded-full transition-colors ${autoHandover ? 'bg-green-500/70' : 'bg-white/20'}`}>
            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${autoHandover ? 'left-4' : 'left-0.5'}`} />
          </span>
          {saveSettings.isPending ? 'Saving…' : autoHandover ? 'On' : 'Off'}
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-semibold flex items-center gap-2">
              <Users size={18} />
              {leads.length} Leads Synced
            </p>
            {lastSync && (
              <p className="text-gray-400 text-sm mt-1">
                Last sync: {lastSync.toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={syncLeads}
              disabled={isLoading}
              variant="outline"
              className="border-white/10 gap-2"
            >
              <RotateCw size={16} className={isLoading ? 'animate-spin' : ''} />
              {isLoading ? 'Syncing...' : 'Sync Now'}
            </Button>
            <Button
              onClick={exportLeads}
              disabled={leads.length === 0}
              variant="outline"
              className="border-white/10 gap-2"
            >
              <Download size={16} />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Manual hand-over: pick leads, choose the stage they enter, send them. */}
      {leads.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-gray-400 text-xs block mb-1">Stage the lead enters</label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="h-9 w-56 bg-black/30 border-white/10 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                {FUNNEL_STAGES.map(s => (
                  <SelectItem key={s.key} value={s.key}>{s.label} — {s.hint}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => handover.mutate()}
            disabled={!selected.length || handover.isPending}
            className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2 h-9"
          >
            {handover.isPending ? <Loader2 size={15} className="animate-spin" /> : <UserCheck size={15} />}
            Hand {selected.length || ''} to sales
          </Button>
          <p className="text-gray-500 text-xs flex-1 min-w-[200px]">
            Assigned using your lead routing method. Only stages from MQL onward mark the lead as qualified.
          </p>
        </div>
      )}

      {leads.length > 0 ? (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-2 w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all leads"
                      checked={selected.length > 0 && selected.length === leads.length}
                      onChange={(e) => setSelected(e.target.checked ? leads.map(l => l.id) : [])}
                      className="w-4 h-4 accent-[#38b6ff]"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Email</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Company</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Source</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Synced</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${lead.lead_name || lead.email || 'lead'}`}
                        checked={selected.includes(lead.id)}
                        onChange={(e) => setSelected(s => e.target.checked ? [...s, lead.id] : s.filter(x => x !== lead.id))}
                        className="w-4 h-4 accent-[#38b6ff]"
                      />
                    </td>
                    <td className="py-3 px-4 text-white">{lead.lead_name || '—'}</td>
                    <td className="py-3 px-4 text-white">{lead.email || '—'}</td>
                    <td className="py-3 px-4 text-gray-400">{lead.lead_company_name || '—'}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full capitalize">
                        {lead.source?.replace('_', ' ') || 'direct'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                        lead.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {lead.status || 'active'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs">
                      {new Date(lead.created_at || lead.created_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-lg p-12 text-center">
          <p className="text-gray-400 mb-4">No leads synced yet</p>
          <Button
            onClick={syncLeads}
            className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]"
          >
            Sync Ad Leads
          </Button>
        </div>
      )}
    </div>
  );
}