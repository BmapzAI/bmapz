import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import {
  BarChart3, TrendingUp, Users, MessageSquare, Target,
  Calendar, Download, RefreshCw, Plus, Star, Edit3, Trash2, Check, X, GripVertical,
  ChevronDown, ChevronUp, Sparkles, Settings2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';
import StatsCard from '@/components/dashboard/StatsCard';
import { toast } from 'sonner';
import { Company, Lead, Message, Activity, DashboardConfig } from '@/api/entities';
import { InvokeLLM } from '@/api/integrations';

const WIDGET_TYPES = [
  { id: 'bar_chart', name: 'Bar Chart', icon: BarChart3, color: '#38b6ff' },
  { id: 'pie_chart', name: 'Pie Chart', icon: Target, color: '#cb6ce6' },
  { id: 'area_chart', name: 'Area Chart', icon: TrendingUp, color: '#22c55e' },
  { id: 'stat_card', name: 'Stat Card', icon: Target, color: '#f59e0b' },
];

const DATA_CATALOG = [
  {
    category: 'Leads & CRM',
    items: [
      { id: 'leads_total', label: 'Total Leads Count', entity: 'leads', field: 'count' },
      { id: 'leads_by_stage', label: 'Leads by Funnel Stage', entity: 'leads', field: 'funnel_stage' },
      { id: 'leads_by_status', label: 'Leads by Status', entity: 'leads', field: 'status' },
      { id: 'leads_converted', label: 'Converted Leads', entity: 'leads', field: 'converted' },
      { id: 'leads_icp_score', label: 'ICP Score Distribution', entity: 'leads', field: 'icp_score' },
      { id: 'leads_pipeline_value', label: 'Pipeline Value', entity: 'leads', field: 'estimated_value' },
    ]
  },
  {
    category: 'Messaging',
    items: [
      { id: 'messages_sent', label: 'Messages Sent', entity: 'messages', field: 'outbound' },
      { id: 'messages_by_channel', label: 'Messages by Channel', entity: 'messages', field: 'channel' },
      { id: 'messages_status', label: 'Message Status Breakdown', entity: 'messages', field: 'status' },
      { id: 'messages_response_rate', label: 'Response Rate', entity: 'messages', field: 'response_rate' },
    ]
  },
  {
    category: 'Workflows',
    items: [
      { id: 'workflows_total', label: 'Total Workflows', entity: 'workflows', field: 'count' },
      { id: 'workflows_active', label: 'Active Workflows', entity: 'workflows', field: 'active' },
      { id: 'workflows_enrolled', label: 'Leads Enrolled in Workflows', entity: 'workflows', field: 'leads_enrolled' },
    ]
  },
  {
    category: 'Social Media',
    items: [
      { id: 'social_posts', label: 'Total Social Posts', entity: 'social_posts', field: 'count' },
      { id: 'social_published', label: 'Published Posts', entity: 'social_posts', field: 'published' },
      { id: 'social_engagement', label: 'Post Engagement Rate', entity: 'social_posts', field: 'engagement_rate' },
    ]
  },
  {
    category: 'Activities',
    items: [
      { id: 'activities_total', label: 'Total Activities', entity: 'activities', field: 'count' },
      { id: 'activities_by_type', label: 'Activities by Type', entity: 'activities', field: 'type' },
    ]
  },
  {
    category: 'Custom Metrics (AI)',
    items: [
      { id: 'custom_metric', label: 'Custom AI Metric', entity: 'custom', field: 'ai_prompt', isCustom: true },
    ]
  },
];

const DATA_SOURCES = ['leads', 'messages', 'funnel', 'activities', 'workflows', 'social_posts', 'custom'];

const SIZE_OPTIONS = [
  { value: 'small', label: 'Small (1 col)', cols: 1 },
  { value: 'medium', label: 'Medium (2 col)', cols: 2 },
  { value: 'large', label: 'Large (3 col)', cols: 3 },
];

const DEFAULT_WIDGET_LEGEND = { show: ['chart', 'tooltip'], position: 'bottom' };

const DEFAULT_WIDGETS = [
  { id: 'w1', type: 'area_chart', title: 'Weekly Activity', dataSource: 'leads', size: 'large', width: 3, height: 2, legend: DEFAULT_WIDGET_LEGEND },
  { id: 'w2', type: 'pie_chart', title: 'Channel Distribution', dataSource: 'messages', size: 'small', width: 1, height: 2, legend: DEFAULT_WIDGET_LEGEND },
  { id: 'w3', type: 'bar_chart', title: 'Funnel Performance', dataSource: 'funnel', size: 'medium', width: 2, height: 2, legend: DEFAULT_WIDGET_LEGEND },
  { id: 'w4', type: 'stat_card', title: 'Response Rates', dataSource: 'messages', size: 'medium', width: 2, height: 1, legend: DEFAULT_WIDGET_LEGEND },
];

// ─── Built-in dashboard templates ────────────────────────────────────────────
const DASHBOARD_TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank Dashboard',
    description: 'Start from scratch with no widgets',
    emoji: '⬜',
    widgets: [],
  },
  {
    id: 'sales',
    name: 'Sales Metrics',
    description: 'Pipeline, funnel stages, lead sources & deal values',
    emoji: '📊',
    widgets: [
      { id: 'ts1', type: 'area_chart',  title: 'Weekly Lead Acquisition',    dataSource: 'leads',    size: 'large',  width: 3, height: 2, legend: DEFAULT_WIDGET_LEGEND },
      { id: 'ts2', type: 'bar_chart',   title: 'Funnel Stage Breakdown',     dataSource: 'funnel',   size: 'medium', width: 2, height: 2, legend: DEFAULT_WIDGET_LEGEND },
      { id: 'ts3', type: 'pie_chart',   title: 'Lead Source Distribution',   dataSource: 'leads',    size: 'small',  width: 1, height: 2, legend: DEFAULT_WIDGET_LEGEND },
      { id: 'ts4', type: 'stat_card',   title: 'Sales KPIs',                 dataSource: 'messages', size: 'medium', width: 2, height: 1, legend: DEFAULT_WIDGET_LEGEND },
      { id: 'ts5', type: 'bar_chart',   title: 'Outbound Messages by Channel', dataSource: 'messages', size: 'medium', width: 2, height: 2, legend: DEFAULT_WIDGET_LEGEND },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing Conversion',
    description: 'Conversion rates, messaging performance & engagement',
    emoji: '📈',
    widgets: [
      { id: 'tm1', type: 'stat_card',   title: 'Conversion Metrics',         dataSource: 'messages', size: 'large',  width: 3, height: 1, legend: DEFAULT_WIDGET_LEGEND },
      { id: 'tm2', type: 'area_chart',  title: 'Message Volume Over Time',   dataSource: 'messages', size: 'large',  width: 3, height: 2, legend: DEFAULT_WIDGET_LEGEND },
      { id: 'tm3', type: 'pie_chart',   title: 'Channel Mix',                dataSource: 'messages', size: 'small',  width: 1, height: 2, legend: DEFAULT_WIDGET_LEGEND },
      { id: 'tm4', type: 'bar_chart',   title: 'Leads by Status',            dataSource: 'leads',    size: 'medium', width: 2, height: 2, legend: DEFAULT_WIDGET_LEGEND },
      { id: 'tm5', type: 'area_chart',  title: 'Workflow Enrollments',       dataSource: 'workflows', size: 'medium', width: 2, height: 2, legend: DEFAULT_WIDGET_LEGEND },
    ],
  },
];

export default function Dashboards() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState('30d');
  const [isEditing, setIsEditing] = useState(false);
  const [showNewDashboard, setShowNewDashboard] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [activeDashboardId, setActiveDashboardId] = useState(null);
  const [resizingWidget, setResizingWidget] = useState(null);
  const [legendSettingsWidgetId, setLegendSettingsWidgetId] = useState(null);
  const [localWidgets, setLocalWidgets] = useState(null); // optimistic local copy, always used as source of truth for rendering
  const [newWidget, setNewWidget] = useState({ type: 'bar_chart', title: '', dataSource: 'leads', size: 'medium', width: 2, height: 2, legend: DEFAULT_WIDGET_LEGEND });
  const [selectedDataItems, setSelectedDataItems] = useState([]);
  const [expandedDataCategory, setExpandedDataCategory] = useState('Leads & CRM');
  const [customMetricPrompt, setCustomMetricPrompt] = useState('');
  const [isGeneratingMetric, setIsGeneratingMetric] = useState(false);
  const [generatedMetricDesc, setGeneratedMetricDesc] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('sales');

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => Company.list() });
  const company = companies[0];

  const { data: leads = [] } = useQuery({ queryKey: ['leads'], queryFn: () => Lead.list() });
  const { data: messages = [] } = useQuery({ queryKey: ['messages'], queryFn: () => Message.list() });

  const { data: dashboards = [], isLoading } = useQuery({
    queryKey: ['dashboards', company?.id],
    queryFn: () => company?.id ? DashboardConfig.filter({ company_id: company.id }) : [],
    enabled: !!company?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data) => DashboardConfig.create(data),
    onSuccess: (newDash) => { queryClient.invalidateQueries({ queryKey: ['dashboards'] }); setActiveDashboardId(newDash.id); setShowNewDashboard(false); setNewDashboardName(''); toast.success('Dashboard created!'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => DashboardConfig.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dashboards'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => DashboardConfig.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dashboards'] }); setActiveDashboardId(null); toast.success('Dashboard deleted'); },
  });

  const activeDashboard = dashboards.find(d => d.id === activeDashboardId) || dashboards.find(d => d.is_default) || dashboards[0];

  // localWidgets is always the source of truth for rendering (optimistic).
  // Sync it when activeDashboard changes (i.e. on load or tab switch).
  useEffect(() => {
    if (activeDashboard?.widgets) {
      setLocalWidgets(activeDashboard.widgets);
    }
  }, [activeDashboard?.id]);

  const currentWidgets = localWidgets ?? activeDashboard?.widgets ?? DEFAULT_WIDGETS;

  const saveWidgets = (widgets) => {
    setLocalWidgets(widgets); // instant optimistic update
    if (activeDashboard) {
      updateMutation.mutate({ id: activeDashboard.id, data: { widgets } });
    }
  };

  const createDashboard = (overrideName, overrideTemplate) => {
    const name = overrideName || newDashboardName;
    if (!name.trim() || !company?.id) return;
    const tmplId = overrideTemplate || selectedTemplate;
    const tmpl = DASHBOARD_TEMPLATES.find(t => t.id === tmplId);
    const widgets = tmpl ? tmpl.widgets : DEFAULT_WIDGETS;
    createMutation.mutate({
      company_id: company.id,
      name,
      is_default: dashboards.length === 0,
      widgets,
    });
  };

  const setAsMain = (dashboard) => {
    dashboards.forEach(d => {
      if (d.id !== dashboard.id && d.is_default) updateMutation.mutate({ id: d.id, data: { is_default: false } });
    });
    updateMutation.mutate({ id: dashboard.id, data: { is_default: true } });
    toast.success(`"${dashboard.name}" is now the main dashboard`);
  };

  const generateCustomMetric = async () => {
    if (!customMetricPrompt.trim()) return;
    setIsGeneratingMetric(true);
    try {
      // Lead.list() returns an array directly
      const resp = await InvokeLLM({
        prompt: `You are a data analyst. The user wants to display a custom metric on their dashboard.
User request: "${customMetricPrompt}"

Available data:
- ${leads.length} leads (fields: status, funnel_stage, icp_score, estimated_value, source)
- ${messages.length} messages (fields: channel, direction, status)
- Activities, Workflows, Social Posts data

Describe in 1-2 sentences what this metric would show and how it would be calculated from the available data.`,
      });
      setGeneratedMetricDesc(resp || '');
    } catch {
      setGeneratedMetricDesc('Custom metric based on your description. Will be calculated from available app data.');
    } finally {
      setIsGeneratingMetric(false);
    }
  };

  const addWidget = () => {
    if (!newWidget.title) return;
    const widget = {
      id: `w_${Date.now()}`,
      ...newWidget,
      selectedDataItems: selectedDataItems.length > 0 ? selectedDataItems : undefined,
      customMetricPrompt: customMetricPrompt || undefined,
      customMetricDesc: generatedMetricDesc || undefined,
    };
    const updated = [...currentWidgets, widget];
    if (activeDashboard) saveWidgets(updated);
    setShowAddWidget(false);
    setNewWidget({ type: 'bar_chart', title: '', dataSource: 'leads', size: 'medium', width: 2, height: 2 });
    setSelectedDataItems([]);
    setCustomMetricPrompt('');
    setGeneratedMetricDesc('');
  };

  const removeWidget = (id) => {
    const updated = currentWidgets.filter(w => w.id !== id);
    if (activeDashboard) saveWidgets(updated);
  };

  const updateWidgetSize = (id, size) => {
    const sizeMap = { small: 1, medium: 2, large: 3 };
    const updated = currentWidgets.map(w => w.id === id ? { ...w, size, width: sizeMap[size] } : w);
    if (activeDashboard) saveWidgets(updated);
  };

  const updateWidgetLegend = (id, legendPatch) => {
    const updated = currentWidgets.map(w => w.id === id ? { ...w, legend: { ...(w.legend || DEFAULT_WIDGET_LEGEND), ...legendPatch } } : w);
    if (activeDashboard) saveWidgets(updated);
  };

  // Metrics
  const totalLeads = leads.length;
  const messagesSent = messages.filter(m => m.direction === 'outbound').length;
  const convertedLeads = leads.filter(l => l.status === 'converted').length;
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0;
  const pipelineValue = leads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);

  const funnelData = [
    { name: 'Awareness', value: leads.filter(l => l.funnel_stage === 'awareness').length, color: '#38b6ff' },
    { name: 'Prospect', value: leads.filter(l => l.funnel_stage === 'prospect').length, color: '#3572b9' },
    { name: 'MQL', value: leads.filter(l => l.funnel_stage === 'mql').length, color: '#38b6ff' },
    { name: 'SQL', value: leads.filter(l => l.funnel_stage === 'sql').length, color: '#cb6ce6' },
    { name: 'Customer', value: leads.filter(l => l.funnel_stage === 'customer').length, color: '#22c55e' },
  ];
  const channelData = [
    { name: 'WhatsApp', value: messages.filter(m => m.channel === 'whatsapp').length, color: '#25D366' },
    { name: 'Email', value: messages.filter(m => m.channel === 'email').length, color: '#38b6ff' },
    { name: 'LinkedIn', value: messages.filter(m => m.channel === 'linkedin').length, color: '#0077b5' },
  ];
  const weeklyData = [
    { day: 'Mon', leads: 12, messages: 45 }, { day: 'Tue', leads: 8, messages: 32 },
    { day: 'Wed', leads: 15, messages: 58 }, { day: 'Thu', leads: 22, messages: 67 },
    { day: 'Fri', leads: 18, messages: 52 }, { day: 'Sat', leads: 5, messages: 12 },
    { day: 'Sun', leads: 3, messages: 8 },
  ];

  const renderWidgetContent = (widget) => {
    const legend = widget.legend || DEFAULT_WIDGET_LEGEND;
    const showChartLegend = legend.show?.includes('chart');
    const showTooltipLegend = legend.show?.includes('tooltip');
    const legendPos = legend.position || 'bottom';

    // Colored dot helper for tooltip
    const tooltipDot = (color) => (
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: color, marginRight: 6, verticalAlign: 'middle' }} />
    );

    // Legend formatter with color
    const legendFmt = (colorMap) => (value) => {
      const color = colorMap[value] ?? '#ccc';
      return <span style={{ color, fontSize: 12 }}>{value}</span>;
    };

    switch (widget.type) {
      case 'area_chart': {
        const areaColors = { leads: '#38b6ff', messages: '#cb6ce6' };
        return (
          <div>
            <p className="text-xs text-gray-500 mb-2 px-1">Daily volume of new leads acquired and outbound messages sent this week</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="cL" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#38b6ff" stopOpacity={0.3} /><stop offset="95%" stopColor="#38b6ff" stopOpacity={0} /></linearGradient>
                  <linearGradient id="cM" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#cb6ce6" stopOpacity={0.3} /><stop offset="95%" stopColor="#cb6ce6" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="day" stroke="#666" tick={{ fill: '#999' }} />
                <YAxis stroke="#666" tick={{ fill: '#999' }} />
                {showTooltipLegend && (
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}
                    formatter={(value, name) => {
                      const color = areaColors[name] ?? '#ccc';
                      return [<span>{tooltipDot(color)}<span style={{ color }}>{value}</span></span>, <span style={{ color }}>{name}</span>];
                    }}
                  />
                )}
                {showChartLegend && <Legend verticalAlign={legendPos === 'top' ? 'top' : legendPos === 'bottom' ? 'bottom' : 'middle'} align={legendPos === 'left' ? 'left' : legendPos === 'right' ? 'right' : 'center'} layout={legendPos === 'left' || legendPos === 'right' ? 'vertical' : 'horizontal'} wrapperStyle={{ paddingTop: legendPos === 'bottom' ? 8 : 0 }} formatter={legendFmt(areaColors)} />}
                <Area type="monotone" dataKey="leads" stroke="#38b6ff" fillOpacity={1} fill="url(#cL)" />
                <Area type="monotone" dataKey="messages" stroke="#cb6ce6" fillOpacity={1} fill="url(#cM)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );
      }
      case 'pie_chart': {
        const pieColorMap = Object.fromEntries(channelData.map(d => [d.name, d.color]));
        return (
          <div>
            <p className="text-xs text-gray-500 mb-2 px-1">Share of messages sent per communication channel</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={channelData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={5} dataKey="value">
                  {channelData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                {showTooltipLegend && (
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value, name) => {
                      const color = pieColorMap[name] ?? '#ccc';
                      return [<span>{tooltipDot(color)}<span style={{ color }}>{value}</span></span>, <span style={{ color }}>{name}</span>];
                    }}
                  />
                )}
                {showChartLegend && <Legend verticalAlign={legendPos === 'top' ? 'top' : legendPos === 'bottom' ? 'bottom' : 'middle'} align={legendPos === 'left' ? 'left' : legendPos === 'right' ? 'right' : 'center'} layout={legendPos === 'left' || legendPos === 'right' ? 'vertical' : 'horizontal'} wrapperStyle={{ paddingTop: legendPos === 'bottom' ? 8 : 0 }} formatter={legendFmt(pieColorMap)} />}
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      }
      case 'bar_chart': {
        return (
          <div>
            <p className="text-xs text-gray-500 mb-2 px-1">Number of leads at each stage of your sales funnel</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis type="number" stroke="#666" tick={{ fill: '#999' }} />
                <YAxis dataKey="name" type="category" stroke="#666" width={70} tick={{ fill: '#999' }} />
                {showTooltipLegend && (
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff', fontWeight: 600 }}
                    formatter={(value, name, props) => {
                      const color = props?.payload?.color ?? '#ccc';
                      return [<span>{tooltipDot(color)}<span style={{ color }}>{value} leads</span></span>, <span style={{ color }}>Count</span>];
                    }}
                  />
                )}
                {showChartLegend && (
                  <Legend verticalAlign={legendPos === 'top' ? 'top' : legendPos === 'bottom' ? 'bottom' : 'middle'} align={legendPos === 'left' ? 'left' : legendPos === 'right' ? 'right' : 'center'} layout={legendPos === 'left' || legendPos === 'right' ? 'vertical' : 'horizontal'} wrapperStyle={{ paddingTop: legendPos === 'bottom' ? 8 : 0 }}
                    content={() => (
                      <div className={`flex flex-wrap gap-2 px-1 ${legendPos === 'top' ? 'mb-2' : 'mt-2'}`}>
                        {funnelData.map(d => (
                          <span key={d.name} className="flex items-center gap-1 text-xs" style={{ color: d.color }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: d.color, display: 'inline-block' }} />
                            {d.name}
                          </span>
                        ))}
                      </div>
                    )}
                  />
                )}
                <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                  {funnelData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }
      case 'stat_card': return (
        <div className="grid grid-cols-2 gap-3 p-2">
          {[
            { label: 'Email Open Rate', value: '45%', color: '#38b6ff' },
            { label: 'WhatsApp Response', value: '68%', color: '#25D366' },
            { label: 'LinkedIn Connection', value: '32%', color: '#0077b5' },
            { label: 'Meeting Booking', value: '12%', color: '#cb6ce6' },
          ].map(item => (
            <div key={item.label} className="p-3 rounded-xl bg-black/20 text-center">
              <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
              <p className="text-gray-500 text-xs mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      );
      default: return <div className="h-32 flex items-center justify-center text-gray-500 text-sm">Widget</div>;
    }
  };

  const getSizeClass = (size) => {
    switch (size) {
      case 'small': return 'col-span-1';
      case 'large': return 'col-span-1 md:col-span-2 lg:col-span-3';
      default: return 'col-span-1 md:col-span-2';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            {t('dashboardsTitle')}
          </h1>
          <p className="text-gray-400 mt-1">Multiple dashboards " Customizable widgets " Resizable layouts</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px] bg-white/5 border-white/10 text-white">
              <Calendar size={16} className="mr-2 text-gray-400" /><SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-white/10">
              <SelectItem value="7d" className="text-white">Last 7 days</SelectItem>
              <SelectItem value="30d" className="text-white">Last 30 days</SelectItem>
              <SelectItem value="90d" className="text-white">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowNewDashboard(true)} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
            <Plus size={18} /> New Dashboard
          </Button>
          {activeDashboard && (
            <Button variant="outline" onClick={() => setIsEditing(!isEditing)}
              className={`border-white/10 gap-2 ${isEditing ? 'bg-[#38b6ff]/20 text-[#38b6ff] border-[#38b6ff]/50' : 'text-white hover:bg-white/5'}`}>
              <Edit3 size={18} /> {isEditing ? 'Done Editing' : 'Edit Dashboard'}
            </Button>
          )}
        </div>
      </div>

      {/* Dashboard Tabs */}
      {dashboards.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
          {dashboards.map(dash => (
            <div key={dash.id} className={`group flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all flex-shrink-0
              ${activeDashboard?.id === dash.id ? 'bg-[#38b6ff]/20 border-[#38b6ff]/50 text-[#38b6ff]' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'}`}
              onClick={() => setActiveDashboardId(dash.id)}>
              {dash.is_default && <Star size={12} className="text-yellow-400" />}
              <span className="text-sm font-medium">{dash.name}</span>
              {isEditing && activeDashboard?.id === dash.id && (
                <div className="flex items-center gap-1 ml-1">
                  {!dash.is_default && (
                    <button onClick={(e) => { e.stopPropagation(); setAsMain(dash); }}
                      className="p-1 rounded hover:bg-white/10" title="Set as main">
                      <Star size={12} className="text-gray-500 hover:text-yellow-400" />
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(dash.id); }}
                    className="p-1 rounded hover:bg-red-500/10 text-gray-500 hover:text-red-400">
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats Cards - always visible */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t('totalLeads')} value={totalLeads} icon={Users} trend={12} trendLabel={t('fromLastMonth')} color="blue" />
        <StatsCard title={t('messagesSent')} value={messagesSent} icon={MessageSquare} trend={8} trendLabel={t('fromLastMonth')} color="cyan" />
        <StatsCard title={t('conversionRate')} value={`${conversionRate}%`} icon={Target} trend={5} trendLabel={t('fromLastMonth')} color="green" />
        <StatsCard title={t('pipelineValue')} value={`$${pipelineValue.toLocaleString()}`} icon={TrendingUp} trend={15} trendLabel={t('fromLastMonth')} color="magenta" />
      </div>

      {/* Dashboard Widgets */}
      {activeDashboard ? (
        <>
          {isEditing && (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-[#38b6ff]/10 border border-[#38b6ff]/30">
              <div>
                <p className="text-[#38b6ff] font-medium text-sm">Editing: {activeDashboard.name}</p>
                <p className="text-gray-400 text-xs">Drag to reorder widgets. Resize with size selector. Remove with •.</p>
              </div>
              <Button onClick={() => setShowAddWidget(true)} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2" size="sm">
                <Plus size={16} /> Add Widget
              </Button>
            </div>
          )}
          <DragDropContext onDragEnd={(result) => {
            if (!result.destination || !isEditing) return;
            const items = Array.from(currentWidgets);
            const [reordered] = items.splice(result.source.index, 1);
            items.splice(result.destination.index, 0, reordered);
            if (activeDashboard) saveWidgets(items);
          }}>
            <Droppable droppableId="dashboard-widgets" direction="horizontal">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentWidgets.map((widget, index) => {
                    const config = WIDGET_TYPES.find(t => t.id === widget.type);
                    const Icon = config?.icon || BarChart3;
                    return (
                      <Draggable key={widget.id} draggableId={widget.id} index={index} isDragDisabled={!isEditing}>
                        {(provided, snapshot) => (
                          <div ref={provided.innerRef} {...provided.draggableProps}
                            className={`${getSizeClass(widget.size)} rounded-2xl bg-white/5 border overflow-hidden transition-all
                              ${isEditing ? 'border-dashed border-[#38b6ff]/30' : 'border-white/10'}
                              ${snapshot.isDragging ? 'shadow-xl shadow-[#38b6ff]/20 border-[#38b6ff]/60 scale-[1.02]' : ''}`}>
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                              <div className="flex items-center gap-2">
                                {isEditing && (
                                  <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-white">
                                    <GripVertical size={14} />
                                  </div>
                                )}
                                <Icon size={16} style={{ color: config?.color }} />
                                <h3 className="text-white font-medium text-sm">{widget.title}</h3>
                              </div>
                              {isEditing && (
                                <div className="flex items-center gap-2">
                                  <select value={widget.size} onChange={e => updateWidgetSize(widget.id, e.target.value)}
                                    className="text-xs bg-black/30 border border-white/10 text-white rounded-lg px-2 py-1" onClick={e => e.stopPropagation()}>
                                    {SIZE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                  </select>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setLegendSettingsWidgetId(legendSettingsWidgetId === widget.id ? null : widget.id); }}
                                    className={`p-1 rounded transition-colors ${legendSettingsWidgetId === widget.id ? 'text-[#38b6ff] bg-[#38b6ff]/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                                    title="Legend settings">
                                    <Settings2 size={14} />
                                  </button>
                                  <button onClick={() => removeWidget(widget.id)} className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10">
                                    <X size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                            {legendSettingsWidgetId === widget.id && widget.type !== 'stat_card' && (
                              <div className="px-4 py-3 border-b border-white/10 bg-black/20 space-y-3">
                                <p className="text-xs font-medium text-[#38b6ff]">Legend Settings</p>
                                <div className="space-y-1.5">
                                  <p className="text-xs text-gray-400">Show legends in:</p>
                                  <div className="flex flex-wrap gap-3">
                                    {[{ id: 'chart', label: 'Chart' }, { id: 'tooltip', label: 'Hover popup' }].map(opt => {
                                      const show = widget.legend?.show ?? ['chart', 'tooltip'];
                                      const checked = show.includes(opt.id);
                                      return (
                                        <label key={opt.id} className="flex items-center gap-1.5 cursor-pointer">
                                          <input type="checkbox" checked={checked}
                                            onChange={() => {
                                              const next = checked ? show.filter(s => s !== opt.id) : [...show, opt.id];
                                              updateWidgetLegend(widget.id, { show: next });
                                            }}
                                            className="w-3.5 h-3.5 accent-[#38b6ff]" />
                                          <span className="text-xs text-gray-300">{opt.label}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                                {(widget.legend?.show ?? ['chart']).includes('chart') && (
                                  <div className="space-y-1.5">
                                    <p className="text-xs text-gray-400">Legend position:</p>
                                    <div className="flex gap-2 flex-wrap">
                                      {['top', 'bottom', 'left', 'right'].map(pos => {
                                        const current = widget.legend?.position ?? 'bottom';
                                        return (
                                          <button key={pos} onClick={() => updateWidgetLegend(widget.id, { position: pos })}
                                            className={`px-2.5 py-1 rounded-lg text-xs border transition-all capitalize
                                              ${current === pos ? 'border-[#38b6ff] bg-[#38b6ff]/10 text-[#38b6ff]' : 'border-white/10 text-gray-400 hover:border-white/20'}`}>
                                            {pos}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="p-4">{renderWidgetContent(widget)}</div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl bg-white/5 border border-dashed border-white/20 text-center">
          <BarChart3 size={48} className="text-gray-600 mb-4" />
          <h3 className="text-white font-semibold mb-2">No Dashboards Yet</h3>
          <p className="text-gray-400 text-sm mb-6">Create your first dashboard to start visualizing your data</p>
          <Button onClick={() => setShowNewDashboard(true)} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
            <Plus size={18} /> Create First Dashboard
          </Button>
        </div>
      )}

      {/* New Dashboard Dialog */}
      <Dialog open={showNewDashboard} onOpenChange={setShowNewDashboard}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-lg">
          <DialogHeader><DialogTitle>Create New Dashboard</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <label className="text-gray-400 text-sm mb-1.5 block">Dashboard Name</label>
              <Input value={newDashboardName} onChange={e => setNewDashboardName(e.target.value)}
                placeholder="e.g., Sales Overview, Marketing KPIs..."
                className="bg-black/30 border-white/10 text-white"
                onKeyDown={e => e.key === 'Enter' && createDashboard()} />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Start with a template</label>
              <div className="grid grid-cols-1 gap-2">
                {DASHBOARD_TEMPLATES.map(tmpl => (
                  <button key={tmpl.id} onClick={() => {
                    setSelectedTemplate(tmpl.id);
                    if (!newDashboardName.trim()) setNewDashboardName(tmpl.name);
                  }}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all
                      ${selectedTemplate === tmpl.id
                        ? 'border-[#38b6ff] bg-[#38b6ff]/10'
                        : 'border-white/10 hover:border-white/20 bg-white/5'}`}>
                    <span className="text-2xl flex-shrink-0">{tmpl.emoji}</span>
                    <div>
                      <p className="text-white text-sm font-medium">{tmpl.name}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{tmpl.description}</p>
                      {tmpl.widgets.length > 0 && (
                        <p className="text-[#38b6ff] text-xs mt-1">{tmpl.widgets.length} widgets pre-built</p>
                      )}
                    </div>
                    {selectedTemplate === tmpl.id && (
                      <Check size={16} className="text-[#38b6ff] ml-auto flex-shrink-0 mt-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewDashboard(false)} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
              <Button onClick={() => createDashboard()} disabled={!newDashboardName.trim()} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]">
                <Check size={16} className="mr-2" /> Create Dashboard
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Widget Dialog */}
      <Dialog open={showAddWidget} onOpenChange={setShowAddWidget}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Widget</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Widget Title</label>
              <Input value={newWidget.title} onChange={e => setNewWidget({ ...newWidget, title: e.target.value })}
                placeholder="Enter widget title..." className="bg-black/30 border-white/10 text-white" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Widget Type</label>
              <div className="grid grid-cols-2 gap-2">
                {WIDGET_TYPES.map(type => {
                  const Icon = type.icon;
                  return (
                    <button key={type.id} onClick={() => setNewWidget({ ...newWidget, type: type.id })}
                      className={`flex items-center gap-2 p-3 rounded-xl border transition-all
                        ${newWidget.type === type.id ? 'border-[#38b6ff] bg-[#38b6ff]/10' : 'border-white/10 hover:border-white/20 bg-white/5'}`}>
                      <Icon size={20} style={{ color: type.color }} />
                      <span className="text-sm text-white">{type.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Data Selection */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Data to Display</label>
              <div className="border border-white/10 rounded-xl overflow-hidden">
                {DATA_CATALOG.map(cat => (
                  <div key={cat.category}>
                    <button
                      onClick={() => setExpandedDataCategory(expandedDataCategory === cat.category ? null : cat.category)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-white/5 hover:bg-white/10 transition-colors">
                      <span className="text-white text-sm font-medium">{cat.category}</span>
                      <div className="flex items-center gap-2">
                        {cat.items.filter(i => selectedDataItems.includes(i.id)).length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#38b6ff]/20 text-[#38b6ff]">
                            {cat.items.filter(i => selectedDataItems.includes(i.id)).length} selected
                          </span>
                        )}
                        {expandedDataCategory === cat.category ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      </div>
                    </button>
                    {expandedDataCategory === cat.category && (
                      <div className="divide-y divide-white/5">
                        {cat.items.map(item => (
                          <div key={item.id}>
                            <button
                              onClick={() => {
                                if (item.isCustom) return; // handled separately
                                setSelectedDataItems(prev =>
                                  prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]
                                );
                                if (!newWidget.title) setNewWidget(w => ({ ...w, title: item.label }));
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                                ${!item.isCustom && selectedDataItems.includes(item.id) ? 'bg-[#38b6ff]/10' : 'hover:bg-white/5'}`}>
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                                ${!item.isCustom && selectedDataItems.includes(item.id) ? 'bg-[#38b6ff] border-[#38b6ff]' : 'border-white/30'}`}>
                                {!item.isCustom && selectedDataItems.includes(item.id) && <Check size={10} className="text-white" />}
                              </div>
                              <span className="text-gray-300 text-sm">{item.label}</span>
                            </button>
                            {item.isCustom && expandedDataCategory === cat.category && (
                              <div className="px-4 pb-3 space-y-2">
                                <p className="text-gray-500 text-xs">Describe a custom metric and AI will calculate it from your data:</p>
                                <div className="flex gap-2">
                                  <Input value={customMetricPrompt} onChange={e => setCustomMetricPrompt(e.target.value)}
                                    placeholder="e.g. conversion rate by channel over last 30 days..."
                                    className="flex-1 h-8 text-xs bg-black/30 border-white/10 text-white" />
                                  <Button size="sm" onClick={generateCustomMetric} disabled={isGeneratingMetric || !customMetricPrompt.trim()}
                                    className="h-8 bg-[#cb6ce6]/20 text-[#cb6ce6] border border-[#cb6ce6]/30 hover:bg-[#cb6ce6]/30 gap-1">
                                    {isGeneratingMetric ? <div className="w-3 h-3 rounded-full border border-[#cb6ce6] border-t-transparent animate-spin" /> : <Sparkles size={12} />}
                                    Build
                                  </Button>
                                </div>
                                {generatedMetricDesc && (
                                  <div className="p-2 rounded-lg bg-[#cb6ce6]/10 border border-[#cb6ce6]/20 text-xs text-[#cb6ce6]">
                                    <p className="font-medium mb-1">Calculation description:</p>
                                    <p>{generatedMetricDesc}</p>
                                    <button
                                      onClick={() => {
                                        setSelectedDataItems(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]);
                                        if (!newWidget.title) setNewWidget(w => ({ ...w, title: customMetricPrompt.slice(0, 40) }));
                                      }}
                                      className={`mt-2 w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border text-xs transition-all
                                        ${selectedDataItems.includes(item.id) ? 'border-[#cb6ce6] bg-[#cb6ce6]/20 text-[#cb6ce6]' : 'border-[#cb6ce6]/40 text-[#cb6ce6] hover:bg-[#cb6ce6]/10'}`}>
                                      {selectedDataItems.includes(item.id) ? <Check size={10} /> : <Plus size={10} />}
                                      {selectedDataItems.includes(item.id) ? 'Selected as widget metric' : 'Add this metric to widget'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {selectedDataItems.length > 0 && (
                <p className="text-xs text-[#38b6ff] mt-1.5">{selectedDataItems.length} data source(s) selected for this widget</p>
              )}
            </div>

            {newWidget.type !== 'stat_card' && (
              <div className="rounded-xl border border-white/10 p-4 space-y-3 bg-white/3">
                <p className="text-sm text-gray-400 font-medium">Legend Settings</p>
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500">Show legends in:</p>
                  <div className="flex gap-4">
                    {[{ id: 'chart', label: 'Chart' }, { id: 'tooltip', label: 'Hover popup' }].map(opt => {
                      const show = newWidget.legend?.show ?? ['chart', 'tooltip'];
                      const checked = show.includes(opt.id);
                      return (
                        <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={checked}
                            onChange={() => {
                              const next = checked ? show.filter(s => s !== opt.id) : [...show, opt.id];
                              setNewWidget(w => ({ ...w, legend: { ...(w.legend || DEFAULT_WIDGET_LEGEND), show: next } }));
                            }}
                            className="w-4 h-4 accent-[#38b6ff]" />
                          <span className="text-sm text-gray-300">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                {(newWidget.legend?.show ?? ['chart']).includes('chart') && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-500">Legend position (chart):</p>
                    <div className="flex gap-2">
                      {['top', 'bottom', 'left', 'right'].map(pos => (
                        <button key={pos} onClick={() => setNewWidget(w => ({ ...w, legend: { ...(w.legend || DEFAULT_WIDGET_LEGEND), position: pos } }))}
                          className={`flex-1 py-1.5 rounded-lg border text-xs transition-all capitalize
                            ${(newWidget.legend?.position ?? 'bottom') === pos ? 'border-[#38b6ff] bg-[#38b6ff]/10 text-[#38b6ff]' : 'border-white/10 text-gray-400 hover:border-white/20'}`}>
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Widget Size</label>
              <div className="flex gap-2">
                {SIZE_OPTIONS.map(s => (
                  <button key={s.value} onClick={() => setNewWidget({ ...newWidget, size: s.value, width: s.cols })}
                    className={`flex-1 py-2 rounded-xl border text-sm transition-all
                      ${newWidget.size === s.value ? 'border-[#38b6ff] bg-[#38b6ff]/10 text-[#38b6ff]' : 'border-white/10 text-gray-400 hover:border-white/20'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddWidget(false)} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
              <Button onClick={addWidget} disabled={!newWidget.title} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]">Add Widget</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}