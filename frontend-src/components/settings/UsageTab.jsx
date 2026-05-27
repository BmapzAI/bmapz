import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Zap, TrendingUp, User as UserIcon, Cpu, Activity } from 'lucide-react';

function formatNumber(n) {
  return new Intl.NumberFormat('pt-BR').format(n || 0);
}

function StatCard({ icon: Icon, label, value, accent }) {
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

function BreakdownTable({ title, rows, valueLabel = 'Credits' }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-gray-400 text-sm font-medium mb-2">{title}</p>
        <p className="text-gray-600 text-xs">No usage yet.</p>
      </div>
    );
  }
  const total = rows.reduce((s, r) => s + r.credits, 0);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-gray-400 text-sm font-medium mb-3">{title}</p>
      <div className="space-y-2">
        {rows.slice(0, 8).map((r) => {
          const pct = total > 0 ? Math.round((r.credits / total) * 100) : 0;
          return (
            <div key={r.label} className="flex items-center gap-3">
              <span className="text-white text-xs flex-1 truncate">{r.label}</span>
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#3572b9] to-[#38b6ff]" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-gray-300 text-xs w-20 text-right">{formatNumber(r.credits)} <span className="text-gray-500">({pct}%)</span></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function UsageTab() {
  const { data: usage, isLoading, refetch } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: () => api.get('/api/ai/usage'),
  });

  if (isLoading) {
    return <div className="text-gray-400 text-sm">Loading usage…</div>;
  }
  if (!usage) {
    return <div className="text-gray-400 text-sm">No usage data available.</div>;
  }

  const pct = usage.percent_used || 0;
  const barColor = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#38b6ff';

  const byFeatureRows = Object.entries(usage.by_feature || {}).map(([k, v]) => ({ label: k, credits: v })).sort((a, b) => b.credits - a.credits);
  const byUserRows = Object.entries(usage.by_user || {}).map(([k, v]) => ({ label: k, credits: v })).sort((a, b) => b.credits - a.credits);
  const byModelRows = Object.entries(usage.by_model || {}).map(([k, v]) => ({ label: k, credits: v })).sort((a, b) => b.credits - a.credits);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Zap size={18} className="text-[#38b6ff]" /> AI Credit Usage
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Track how your team consumes AI credits across features, users, and models. Plan: <span className="text-white font-medium uppercase">{usage.plan_id}</span>
          </p>
        </div>
        <button onClick={() => refetch()} className="text-xs text-[#38b6ff] hover:underline">Refresh</button>
      </div>

      {/* Top-level stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard icon={Zap} label="Total Credits" value={formatNumber(usage.credits_total)} />
        <StatCard icon={TrendingUp} label="Used This Cycle" value={formatNumber(usage.credits_used)} accent="#f59e0b" />
        <StatCard icon={Activity} label="Remaining" value={formatNumber(usage.credits_remaining)} accent="#22c55e" />
        <StatCard icon={Cpu} label="Tokens (recent)" value={formatNumber((usage.recent_transactions || []).reduce((s, t) => s + (t.metadata?.tokens || 0), 0))} />
      </div>

      {/* Usage bar */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-300">Credits used</span>
          <span className="text-white font-medium">{pct}%</span>
        </div>
        <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: barColor }} />
        </div>
        {pct > 80 && (
          <p className="text-amber-400 text-xs mt-2">⚠ Approaching credit limit — consider upgrading your plan or buying a credit pack.</p>
        )}
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BreakdownTable title="By Feature" rows={byFeatureRows} />
        <BreakdownTable title="By Model" rows={byModelRows} />
        <BreakdownTable title="By User" rows={byUserRows} />
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-gray-400 text-sm font-medium mb-3">Recent Activity (last 50)</p>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {(usage.recent_transactions || []).slice(0, 50).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-xs gap-3 border-b border-white/5 pb-1.5">
                <div className="flex-1 truncate">
                  <span className="text-white">{tx.feature}</span>
                  <span className="text-gray-500 ml-2">· {tx.metadata?.model || '—'}</span>
                  {tx.metadata?.user_email && <span className="text-gray-500 ml-2">· {tx.metadata.user_email}</span>}
                </div>
                <span className="text-red-400 shrink-0">−{Math.abs(tx.credits_delta)}</span>
              </div>
            ))}
            {(!usage.recent_transactions || usage.recent_transactions.length === 0) && (
              <p className="text-gray-600 text-xs">No transactions yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
