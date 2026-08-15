import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { GitBranch, AlertTriangle, PieChart as PieIcon } from 'lucide-react';

/**
 * Where leads are in a workflow, why runs fail, and how they end.
 *
 * Everything is derived from the runs already loaded by the Insights page — no
 * extra fetch, and the numbers cannot disagree with the tables beside them.
 */

const OUTCOME_COLORS = {
  completed: '#22c55e',
  active: '#38b6ff',
  queued: '#8b8b8b',
  failed: '#ef4444',
  canceled: '#f59e0b',
  cancelled: '#f59e0b',
};

const FAILURE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#a855f7', '#64748b'];

/**
 * Group a raw error string into a reason someone can act on.
 *
 * Raw messages are unique per run (ids, addresses, provider text), so charting
 * them directly gives one slice per failure and tells you nothing.
 */
export function classifyFailure(error) {
  const e = String(error || '').toLowerCase();
  if (!e) return 'Unknown';
  if (e.includes('loop') || e.includes('exceeded')) return 'Step limit / loop';
  if (e.includes('deleted') || e.includes('archived')) return 'Workflow removed';
  if (e.includes('email') || e.includes('smtp') || e.includes('send')) return 'Message delivery';
  if (e.includes('credit') || e.includes('quota') || e.includes('limit')) return 'Credits / quota';
  if (e.includes('timeout') || e.includes('timed out')) return 'Timeout';
  if (e.includes('permission') || e.includes('auth') || e.includes('token')) return 'Auth / permission';
  if (e.includes('not found') || e.includes('missing')) return 'Missing data';
  return 'Other';
}

const EmptyNote = ({ children }) => (
  <p className="text-gray-500 text-sm text-center py-10">{children}</p>
);

export default function WorkflowRunBreakdown({ runs = [], workflows = [] }) {
  const { stepData, failureData, outcomeData, failedCount } = useMemo(() => {
    // Which step each lead is sitting on. Only runs still in flight — a finished
    // run is not "at" a step, and counting them would bury the live ones.
    const live = runs.filter(r => r.status === 'active' || r.status === 'queued');
    const byStep = new Map();
    for (const r of live) {
      const key = r.current_node_id || `Step ${(r.current_step_index ?? r.steps_completed ?? 0) + 1}`;
      byStep.set(key, (byStep.get(key) || 0) + 1);
    }
    const stepData = [...byStep.entries()]
      .map(([step, leads]) => ({ step: String(step).slice(0, 22), leads }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 12);

    const failed = runs.filter(r => r.status === 'failed');
    const byReason = new Map();
    for (const r of failed) {
      const reason = classifyFailure(r.error);
      byReason.set(reason, (byReason.get(reason) || 0) + 1);
    }
    const failureData = [...byReason.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const byOutcome = new Map();
    for (const r of runs) {
      const s = r.status || 'unknown';
      byOutcome.set(s, (byOutcome.get(s) || 0) + 1);
    }
    const outcomeData = [...byOutcome.entries()].map(([name, value]) => ({ name, value }));

    return { stepData, failureData, outcomeData, failedCount: failed.length };
  }, [runs]);

  const tooltipStyle = {
    background: '#1a1a1a',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    color: '#fff',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="bg-white/5 border-white/10 lg:col-span-3 xl:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <GitBranch size={15} className="text-[#38b6ff]" /> Where leads are now
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stepData.length === 0 ? (
            <EmptyNote>No leads currently in a workflow.</EmptyNote>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stepData} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" stroke="#8b8b8b" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="step" stroke="#8b8b8b" fontSize={11} width={110} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="leads" fill="#38b6ff" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <AlertTriangle size={15} className="text-red-400" /> Why runs failed
          </CardTitle>
        </CardHeader>
        <CardContent>
          {failureData.length === 0 ? (
            <EmptyNote>No failed runs in this period.</EmptyNote>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={failureData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {failureData.map((entry, i) => (
                      <Cell key={entry.name} fill={FAILURE_COLORS[i % FAILURE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {failureData.map((f, i) => (
                  <div key={f.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: FAILURE_COLORS[i % FAILURE_COLORS.length] }} />
                    <span className="text-gray-300 flex-1 truncate">{f.name}</span>
                    <span className="text-gray-500">{f.value}</span>
                    <span className="text-gray-600">
                      {failedCount ? `${Math.round((f.value / failedCount) * 100)}%` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <PieIcon size={15} className="text-green-400" /> Outcomes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {outcomeData.length === 0 ? (
            <EmptyNote>No runs in this period.</EmptyNote>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={outcomeData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {outcomeData.map(entry => (
                      <Cell key={entry.name} fill={OUTCOME_COLORS[entry.name] || '#64748b'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {outcomeData.map(o => (
                  <div key={o.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: OUTCOME_COLORS[o.name] || '#64748b' }} />
                    <span className="text-gray-300 flex-1 capitalize">{o.name}</span>
                    <span className="text-gray-500">{o.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
