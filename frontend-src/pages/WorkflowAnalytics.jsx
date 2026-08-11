import { api } from '@/api/apiClient';
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, Activity, Clock, CheckCircle2, XCircle, Zap, AlertCircle, Calendar, Share2, MessageSquare, Mail, Linkedin, BarChart3, ExternalLink, Instagram, Users, FileText, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Company, Workflow, WorkflowRun } from '@/api/entities';
import { InvokeLLM } from '@/api/integrations';
import { usePersistentDraft } from '@/lib/usePersistentDraft';

const COLORS = ['#38b6ff', '#cb6ce6', '#22c55e', '#ef4444', '#f59e0b'];

// Channel definitions with social metadata support
const ALL_CHANNELS = [
  { key: 'email',     label: 'Email',     Icon: Mail,        isSocial: false },
  { key: 'linkedin',  label: 'LinkedIn',  Icon: Linkedin,    isSocial: true  },
  { key: 'whatsapp',  label: 'WhatsApp',  Icon: MessageSquare, isSocial: false },
  { key: 'instagram', label: 'Instagram', Icon: Instagram,   isSocial: true  },
];

const pct = (curr, prev) => prev > 0 ? (((curr - prev) / prev) * 100).toFixed(1) : null;

export default function WorkflowAnalytics() {
  const [activeTab, setActiveTab] = useState('workflows');
  const [selectedWorkflow, setSelectedWorkflow] = useState('all');
  const [dateRange, setDateRange] = useState('30');
  const [channelDateRange, setChannelDateRange] = useState('30');
  const [selectedChannels, setSelectedChannels] = useState(['email', 'linkedin', 'whatsapp', 'instagram']);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // Kept in place until re-run, so leaving the page does not discard the
  // analysis (or force paying for another one).
  const [aiInsights, setAiInsights] = usePersistentDraft('workflowAnalytics:insights', null);
  const [channelStats, setChannelStats] = useState(null);
  const [channelStatsLoading, setChannelStatsLoading] = useState(false);

  const toggleChannel = (key) => {
    setSelectedChannels(prev =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter(k => k !== key) : prev) : [...prev, key]
    );
  };

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => Company.list() });
  const company = companies[0];

  // Fetch live channel stats whenever tab or date range changes
  useEffect(() => {
    if (activeTab !== 'marketing') return;
    setChannelStatsLoading(true);
    api.get('/api/social/analytics', { days: channelDateRange })
      .then(res => setChannelStats(res))
      .catch(() => setChannelStats(null))
      .finally(() => setChannelStatsLoading(false));
  }, [activeTab, channelDateRange, company?.id]);

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => Workflow.list(),
  });

  const { data: workflowRuns = [] } = useQuery({
    queryKey: ['workflowRuns', company?.id, selectedWorkflow, dateRange],
    queryFn: async () => {
      if (!company?.id) return [];
      const query = { company_id: company.id };
      if (selectedWorkflow !== 'all') query.workflow_id = selectedWorkflow;
      return WorkflowRun.filter(query);
    },
    enabled: !!company?.id,
  });

  const metrics = useMemo(() => {
    const total = workflowRuns.length;
    const completed = workflowRuns.filter(r => r.status === 'completed').length;
    const failed = workflowRuns.filter(r => r.status === 'failed').length;
    const running = workflowRuns.filter(r => r.status === 'running').length;
    const avgDuration = workflowRuns.filter(r => r.duration_minutes).reduce((sum, r) => sum + r.duration_minutes, 0) / (workflowRuns.filter(r => r.duration_minutes).length || 1);
    const successRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
    const avgOptScore = workflowRuns.filter(r => r.optimization_score).reduce((sum, r) => sum + r.optimization_score, 0) / (workflowRuns.filter(r => r.optimization_score).length || 1);
    return { total, completed, failed, running, avgDuration, successRate, avgOptScore };
  }, [workflowRuns]);

  const chartData = useMemo(() => {
    const statusData = [
      { name: 'Completed', value: metrics.completed, color: '#22c55e' },
      { name: 'Failed', value: metrics.failed, color: '#ef4444' },
      { name: 'Running', value: metrics.running, color: '#38b6ff' },
    ].filter(d => d.value > 0);

    const workflowPerformance = workflows.map(w => {
      const runs = workflowRuns.filter(r => r.workflow_id === w.id);
      const completed = runs.filter(r => r.status === 'completed').length;
      const failed = runs.filter(r => r.status === 'failed').length;
      return { name: w.name, completed, failed, successRate: runs.length > 0 ? ((completed / runs.length) * 100).toFixed(1) : 0 };
    });

    const dailyRuns = workflowRuns.reduce((acc, run) => {
      const date = new Date(run.created_date).toLocaleDateString();
      if (!acc[date]) acc[date] = { date, completed: 0, failed: 0 };
      if (run.status === 'completed') acc[date].completed++;
      if (run.status === 'failed') acc[date].failed++;
      return acc;
    }, {});

    return { statusData, workflowPerformance, dailyRuns: Object.values(dailyRuns) };
  }, [workflowRuns, workflows, metrics]);

  const bottlenecks = useMemo(() => {
    const stepCounts = {};
    workflowRuns.forEach(run => {
      (run.bottleneck_steps || []).forEach(step => { stepCounts[step] = (stepCounts[step] || 0) + 1; });
    });
    return Object.entries(stepCounts).map(([step, count]) => ({ step, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [workflowRuns]);

  const analyzeWithAI = async () => {
    setIsAnalyzing(true);
    try {
      const analysisData = {
        total_runs: workflowRuns.length,
        success_rate: metrics.successRate,
        avg_duration: metrics.avgDuration,
        bottlenecks: bottlenecks.map(b => b.step),
        failed_runs: workflowRuns.filter(r => r.status === 'failed').length,
        avg_optimization_score: metrics.avgOptScore,
        channel_stats: channelStats?.channelStats || {},
        instagram: channelStats?.instagram || {},
      };
      const response = await InvokeLLM({
        action: 'workflow_optimize',
        archiveTitle: 'Workflow performance analysis',
        prompt: `As a workflow and marketing automation optimization expert, analyze this performance data:
        
${JSON.stringify(analysisData, null, 2)}

Provide:
1. Key bottlenecks for sales workflows and marketing automations
2. Specific optimization recommendations
3. Which marketing channel is performing best and why
4. Priority actions (high/medium/low)
5. Cross-channel insights (e.g., which leads from LinkedIn convert better via email or WhatsApp follow-up)

Return structured JSON.`,
        response_json_schema: {
          type: "object",
          properties: {
            insights: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, severity: { type: "string" } } } },
            recommendations: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, priority: { type: "string" }, expected_improvement: { type: "string" } } } },
            overall_health_score: { type: "number" }
          }
        }
      });
      setAiInsights(response);
      toast.success('AI analysis complete!');
    } catch (e) {
      toast.error('Failed to analyze');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>Analytics & Performance</h1>
          <p className="text-gray-400">Workflow runs performance + Channel & message analytics</p>
        </div>
        <Button onClick={analyzeWithAI} disabled={isAnalyzing} className="bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2">
          {isAnalyzing ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Zap size={16} />}
          AI Analysis
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="workflows" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <Activity size={16} className="mr-2" /> Workflow Analytics
          </TabsTrigger>
          <TabsTrigger value="marketing" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <Share2 size={16} className="mr-2" /> Channel Performance
          </TabsTrigger>
        </TabsList>

        {/* Workflow Runs Tab */}
        <TabsContent value="workflows" className="space-y-6">
          <div className="flex gap-4">
            <Select value={selectedWorkflow} onValueChange={setSelectedWorkflow}>
              <SelectTrigger className="w-64 bg-[#1a1a1a] border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                <SelectItem value="all" className="text-white">All Workflows</SelectItem>
                {workflows.map(w => <SelectItem key={w.id} value={w.id} className="text-white">{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-48 bg-[#1a1a1a] border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                <SelectItem value="7" className="text-white">Last 7 days</SelectItem>
                <SelectItem value="30" className="text-white">Last 30 days</SelectItem>
                <SelectItem value="90" className="text-white">Last 90 days</SelectItem>
                <SelectItem value="365" className="text-white">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Total Runs', value: metrics.total, sub: 'Workflow executions', Icon: Activity, color: '#38b6ff' },
              { title: 'Success Rate', value: `${metrics.successRate}%`, sub: 'Completed workflows', Icon: CheckCircle2, color: '#22c55e' },
              { title: 'Avg Duration', value: `${metrics.avgDuration.toFixed(1)}m`, sub: 'Average completion time', Icon: Clock, color: '#cb6ce6' },
              { title: 'Health Score', value: aiInsights ? aiInsights.overall_health_score : metrics.avgOptScore.toFixed(0), sub: 'Optimization score', Icon: aiInsights ? TrendingUp : AlertCircle, color: aiInsights ? '#22c55e' : '#888' },
            ].map(({ title, value, sub, Icon, color }) => (
              <Card key={title} className="bg-[#1a1a1a] border-white/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
                  <Icon className="w-4 h-4" style={{ color }} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{value}</div>
                  <p className="text-xs text-gray-400 mt-1">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-[#1a1a1a] border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Status Distribution</CardTitle>
                <p className="text-xs text-gray-500 mt-1">Breakdown of workflow runs by their current execution status</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={chartData.statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                      label={({ name, percent, x, y }) => (
                        <text x={x} y={y} fill="#ccc" textAnchor="middle" dominantBaseline="central" fontSize={11}>
                          {`${name} ${(percent*100).toFixed(0)}%`}
                        </text>
                      )}
                      labelLine={{ stroke: '#555' }}>
                      {chartData.statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(value, name) => {
                        const entry = chartData.statusData.find(d => d.name === name);
                        const color = entry?.color ?? '#ccc';
                        return [<span style={{ color }}>{value} runs</span>, <span style={{ color }}>{name}</span>];
                      }}
                    />
                    <Legend formatter={(value) => {
                      const entry = chartData.statusData.find(d => d.name === value);
                      return <span style={{ color: entry?.color ?? '#ccc', fontSize: 12 }}>{value}</span>;
                    }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="bg-[#1a1a1a] border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Daily Execution Trends</CardTitle>
                <p className="text-xs text-gray-500 mt-1">Completed vs. failed workflow runs per day over the selected period</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData.dailyRuns}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="date" stroke="#888" tick={{ fill: '#999' }} />
                    <YAxis stroke="#888" tick={{ fill: '#999' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}
                      formatter={(value, name) => {
                        const colors = { completed: '#22c55e', failed: '#ef4444' };
                        const color = colors[name] ?? '#ccc';
                        return [<span style={{ color }}>{value}</span>, <span style={{ color }}>{name}</span>];
                      }}
                    />
                    <Legend formatter={(value) => {
                      const colors = { completed: '#22c55e', failed: '#ef4444' };
                      return <span style={{ color: colors[value] ?? '#ccc', fontSize: 12 }}>{value}</span>;
                    }} />
                    <Line type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {bottlenecks.length > 0 && (
            <Card className="bg-[#1a1a1a] border-white/10">
              <CardHeader><CardTitle className="text-white flex items-center gap-2"><AlertCircle size={20} className="text-yellow-500" />Bottlenecks</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {bottlenecks.map((b, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-white">{b.step}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">{b.count} occurrences</span>
                        <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-500" style={{ width: `${Math.min((b.count / workflowRuns.length) * 100, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Channel Performance Tab */}
        <TabsContent value="marketing" className="space-y-6">

          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Time period */}
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-gray-400" />
              <Select value={channelDateRange} onValueChange={setChannelDateRange}>
                <SelectTrigger className="w-44 bg-[#1a1a1a] border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  <SelectItem value="7" className="text-white">Last 7 days</SelectItem>
                  <SelectItem value="30" className="text-white">Last 30 days</SelectItem>
                  <SelectItem value="90" className="text-white">Last 90 days</SelectItem>
                  <SelectItem value="365" className="text-white">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Channel toggles */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={14} className="text-gray-400" />
              {ALL_CHANNELS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => toggleChannel(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                    ${selectedChannels.includes(key)
                      ? 'bg-[#38b6ff]/20 border-[#38b6ff]/50 text-[#38b6ff]'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'}`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Channel cards */}
          {channelStatsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-[#38b6ff] border-t-transparent animate-spin" />
              <span className="text-gray-400 ml-3">Loading live data…</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ALL_CHANNELS.filter(ch => selectedChannels.includes(ch.key)).map(({ key, label, Icon, isSocial }) => {
                // Build data object from live sources
                let outreach = null;
                let socialData = null;
                let isLive = false;

                if (key === 'instagram') {
                  const ig = channelStats?.instagram;
                  if (ig?.connected) {
                    isLive = true;
                    socialData = {
                      username: ig.username,
                      followers: ig.followers,
                      posts: ig.posts_in_period,
                      total_posts: ig.total_posts,
                      total_likes: ig.total_likes,
                      total_comments: ig.total_comments,
                    };
                  }
                } else if (channelStats?.channelStats?.[key]) {
                  isLive = true;
                  outreach = channelStats.channelStats[key];
                }

                return (
                  <div key={key} className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                          <Icon size={20} className="text-[#38b6ff]" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">{label}</p>
                          {socialData?.username && <p className="text-gray-500 text-xs">{socialData.username}</p>}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isLive ? 'bg-green-500/15 text-green-400' : 'bg-gray-500/15 text-gray-400'}`}>
                        {isLive ? '● Live' : 'Not connected'}
                      </span>
                    </div>

                    {/* Instagram social stats */}
                    {key === 'instagram' && socialData && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-white/5 p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Users size={13} className="text-gray-400" />
                            <span className="text-gray-400 text-xs">Followers</span>
                          </div>
                          <p className="text-white font-bold text-xl">{socialData.followers?.toLocaleString()}</p>
                        </div>
                        <div className="rounded-xl bg-white/5 p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <FileText size={13} className="text-gray-400" />
                            <span className="text-gray-400 text-xs">Posts (period)</span>
                          </div>
                          <p className="text-white font-bold text-xl">{socialData.posts}</p>
                          <p className="text-gray-500 text-xs">{socialData.total_posts} total</p>
                        </div>
                        {(socialData.total_likes > 0 || socialData.total_comments > 0) && (
                          <>
                            <div className="rounded-xl bg-white/5 p-3">
                              <p className="text-gray-400 text-xs mb-1">Likes (period)</p>
                              <p className="text-white font-bold text-xl">{socialData.total_likes?.toLocaleString()}</p>
                            </div>
                            <div className="rounded-xl bg-white/5 p-3">
                              <p className="text-gray-400 text-xs mb-1">Comments (period)</p>
                              <p className="text-white font-bold text-xl">{socialData.total_comments?.toLocaleString()}</p>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Instagram not connected */}
                    {key === 'instagram' && !socialData && (
                      <p className="text-gray-500 text-xs text-center py-3">Connect your Instagram integration to see live follower & engagement data.</p>
                    )}

                    {/* Outreach stats for email / whatsapp / linkedin */}
                    {key !== 'instagram' && outreach && outreach.sent > 0 && (
                      <>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: 'Sent', value: outreach.sent },
                            { label: 'Delivered', value: outreach.delivered },
                            { label: 'Opened', value: outreach.opened },
                            { label: 'Replied', value: outreach.replied },
                          ].map(stat => (
                            <div key={stat.label} className="text-center">
                              <p className="text-white font-bold text-base">{stat.value?.toLocaleString()}</p>
                              <p className="text-gray-500 text-xs">{stat.label}</p>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          {[
                            { label: 'Delivery Rate', value: outreach.delivery_rate, target: 95, color: '#38b6ff' },
                            { label: 'Open / Read Rate', value: outreach.open_rate, target: 60, color: '#cb6ce6' },
                            { label: 'Reply Rate', value: outreach.reply_rate, target: 10, color: '#22c55e' },
                          ].map(metric => (
                            <div key={metric.label}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">{metric.label}</span>
                                <span className="text-white font-medium">{metric.value}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(metric.value / metric.target * 100, 100)}%`, backgroundColor: metric.color }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {key !== 'instagram' && outreach && outreach.sent === 0 && (
                      <p className="text-gray-500 text-xs text-center py-3">No outbound messages recorded for this channel in the selected period.</p>
                    )}

                    {key !== 'instagram' && !outreach && (
                      <p className="text-gray-500 text-xs text-center py-3">Connect your {label} integration to track outreach performance.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* AI Insights */}
      {aiInsights && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-[#cb6ce6]/10 to-[#38b6ff]/10 border-[#38b6ff]/20">
            <CardHeader><CardTitle className="text-white flex items-center gap-2"><AlertCircle size={20} className="text-[#38b6ff]" />Key Insights</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {aiInsights.insights?.map((insight, i) => (
                <div key={i} className="p-3 rounded-lg bg-black/30 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${insight.severity === 'high' ? 'bg-red-500/20 text-red-400' : insight.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>{insight.severity}</span>
                    <h4 className="text-white font-medium text-sm">{insight.title}</h4>
                  </div>
                  <p className="text-gray-400 text-sm">{insight.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="bg-[#1a1a1a] border-white/10">
            <CardHeader><CardTitle className="text-white flex items-center gap-2"><Zap size={20} className="text-[#cb6ce6]" />Recommendations</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {aiInsights.recommendations?.map((rec, i) => {
                // Map recommendation keywords to internal pages
                const pageMap = [
                  { keywords: ['workflow', 'sequence', 'automation'], path: '/Workflows', label: 'Go to Workflows' },
                  { keywords: ['lead', 'prospect', 'contact', 'sales', 'pipeline'], path: '/Sales', label: 'Go to Sales' },
                  { keywords: ['message', 'template', 'email', 'whatsapp', 'linkedin'], path: '/TextTemplates', label: 'Go to Templates' },
                  { keywords: ['social', 'content', 'post', 'instagram'], path: '/SocialMedia', label: 'Go to Social Media' },
                  { keywords: ['ad', 'campaign', 'meta', 'google', 'paid'], path: '/Ads', label: 'Go to Ads' },
                  { keywords: ['blog', 'seo', 'article', 'keyword'], path: '/Blog', label: 'Go to Blog' },
                  { keywords: ['integration', 'connect', 'api', 'crm'], path: '/Integrations', label: 'Go to Integrations' },
                  { keywords: ['setting', 'briefing', 'icp', 'profile'], path: '/Settings', label: 'Go to Settings' },
                ];
                const text = `${rec.title} ${rec.description}`.toLowerCase();
                const matched = pageMap.find(p => p.keywords.some(kw => text.includes(kw)));
                return (
                  <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-white font-medium text-sm">{rec.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${rec.priority === 'high' ? 'bg-red-500/20 text-red-400' : rec.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>{rec.priority}</span>
                    </div>
                    <p className="text-gray-400 text-sm mb-2">{rec.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-green-400 text-xs"><TrendingUp size={12} />{rec.expected_improvement}</div>
                      {matched && (
                        <Link to={matched.path}>
                          <button className="flex items-center gap-1 text-[#38b6ff] text-xs hover:underline">
                            <ExternalLink size={11} /> {matched.label}
                          </button>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}