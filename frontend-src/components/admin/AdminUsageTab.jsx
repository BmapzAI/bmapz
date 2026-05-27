import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { TrendingUp, Building2, User as UserIcon, Cpu, Activity, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

function formatNumber(n) {
  return new Intl.NumberFormat('pt-BR').format(n || 0);
}

function Card({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1.5">
        <Icon size={14} />
        <span>{label}</span>
      </div>
      <p className="text-white font-bold text-2xl" style={{ color: accent }}>{value}</p>
    </div>
  );
}

function Breakdown({ title, rows, valueKey = 'credits', labelKey, maxRows = 10, onSelect }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-gray-400 text-sm font-medium mb-2">{title}</p>
        <p className="text-gray-600 text-xs">No data.</p>
      </div>
    );
  }
  const total = rows.reduce((s, r) => s + (r[valueKey] || 0), 0);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-gray-400 text-sm font-medium mb-3">{title}</p>
      <div className="space-y-2">
        {rows.slice(0, maxRows).map((r, i) => {
          const v = r[valueKey] || 0;
          const pct = total > 0 ? Math.round((v / total) * 100) : 0;
          const label = labelKey ? r[labelKey] : (r.company_name || r.user_email || r.model || r.feature);
          const clickable = !!onSelect;
          return (
            <div key={r.company_id || r.user_email || r.model || r.feature || i}
              onClick={() => clickable && onSelect(r)}
              className={`flex items-center gap-3 ${clickable ? 'cursor-pointer hover:bg-white/5 rounded -m-1 p-1' : ''}`}>
              <span className="text-white text-xs flex-1 truncate">{label}</span>
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#3572b9] to-[#38b6ff]" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-gray-300 text-xs w-24 text-right">{formatNumber(v)} <span className="text-gray-500">({pct}%)</span></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminUsageTab() {
  const [days, setDays] = useState(30);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['admin-usage-stats', days],
    queryFn: () => api.get('/api/admin/usage-stats', { days }),
  });

  const { data: companyDetail } = useQuery({
    queryKey: ['admin-usage-company', selectedCompany?.company_id, days],
    queryFn: () => api.get(`/api/admin/usage-stats/company/${selectedCompany.company_id}`, { days }),
    enabled: !!selectedCompany,
  });

  if (isLoading) return <div className="text-gray-400">Loading usage…</div>;
  if (!stats) return <div className="text-gray-400">No data available.</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2"><TrendingUp size={18} /> System-Wide AI Usage</h3>
          <p className="text-gray-500 text-xs">Aggregated credit consumption across all companies and users.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="bg-black/30 border border-white/10 text-white rounded-md px-3 py-1.5 text-sm">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
          </select>
          <Button onClick={() => refetch()} variant="outline" className="border-white/10 gap-1.5 text-white">
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card icon={Activity} label="Total Credits Consumed" value={formatNumber(stats.total_credits_consumed)} />
        <Card icon={Cpu} label="Total Tokens" value={formatNumber(stats.total_tokens)} />
        <Card icon={TrendingUp} label="AI Transactions" value={formatNumber(stats.total_transactions)} />
        <Card icon={Building2} label="Active Companies" value={formatNumber(stats.by_company?.length || 0)} accent="#22c55e" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Breakdown title="By Company (click for detail)" rows={stats.by_company || []} onSelect={setSelectedCompany} />
        <Breakdown title="By Model" rows={stats.by_model || []} />
        <Breakdown title="By User" rows={stats.by_user || []} />
        <Breakdown title="By Feature" rows={stats.by_feature || []} />
      </div>

      {/* Company detail drawer */}
      {selectedCompany && companyDetail && (
        <div className="rounded-2xl border border-[#38b6ff]/30 bg-[#38b6ff]/5 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white font-bold">{selectedCompany.company_name}</p>
              <p className="text-gray-400 text-xs">
                {formatNumber(companyDetail.total_credits_consumed)} credits · {formatNumber(companyDetail.total_tokens)} tokens · {formatNumber(companyDetail.total_transactions)} transactions
              </p>
            </div>
            <button onClick={() => setSelectedCompany(null)} className="text-gray-400 hover:text-white">Close ×</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Breakdown title="By User" rows={companyDetail.by_user || []} />
            <Breakdown title="By Model" rows={companyDetail.by_model || []} />
            <Breakdown title="By Feature" rows={companyDetail.by_feature || []} />
          </div>
        </div>
      )}
    </div>
  );
}
