import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, RotateCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/apiClient';

export default function AdsLeadsTab() {
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('adLeadsLastSync');
    if (stored) setLastSync(new Date(stored));
  }, []);

  const syncLeads = async () => {
    setIsLoading(true);
    try {
      const result = await api.get('/api/ads/platform-leads');

      if (result.data?.success) {
        toast.success(`Synced ${result.data.total_added} new leads from ad campaigns`);
        setLastSync(new Date());
        localStorage.setItem('adLeadsLastSync', new Date().toISOString());

        // Fetch updated leads
        const adLeads = await Lead.filter({ source: 'meta_ads' }).concat(
          await Lead.filter({ source: 'tiktok_ads' }).concat(
            await Lead.filter({ source: 'linkedin_ads' })
          )
        );
        setLeads(adLeads);
      } else {
        toast.error(result.data?.message || 'Failed to sync leads');
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
          new Date(l.created_date).toLocaleDateString(),
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

      {leads.length > 0 ? (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
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
                      {new Date(lead.created_date).toLocaleDateString()}
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