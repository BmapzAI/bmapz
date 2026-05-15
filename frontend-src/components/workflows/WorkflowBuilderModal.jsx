import React, { useState, useEffect, useCallback, useRef } from 'react';

import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Search, Layout, BookOpen, Check, Undo2, Redo2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from 'sonner';
import WorkflowCanvas, { NODE_TYPES } from './WorkflowCanvas';
import WorkflowNodePanel from './WorkflowNodePanel';
import WorkflowAIPanel from './WorkflowAIPanel';
import { Company, Lead, Workflow } from '@/api/entities';

const TEMPLATES = {
  email_sequence: {
    name: 'Email Outreach Sequence', type: 'sales_outreach',
    nodes: [
      { id: 't', type: 'trigger', name: 'Start', x: 380, y: 40 },
      { id: 'e1', type: 'send_message', name: 'Initial Email', x: 380, y: 170, channel: 'email' },
      { id: 'w1', type: 'wait', name: 'Wait 3 days', x: 380, y: 300, delay_days: 3 },
      { id: 'e2', type: 'send_message', name: 'Follow-up', x: 380, y: 430, channel: 'email' },
      { id: 'w2', type: 'wait', name: 'Wait 5 days', x: 380, y: 560, delay_days: 5 },
      { id: 'e3', type: 'send_message', name: 'Final Touch', x: 380, y: 690, channel: 'email' },
      { id: 'ok', type: 'end_success', name: 'Success', x: 380, y: 820 },
    ],
    connections: [
      { from: { nodeId: 't', port: 'default' }, to: 'e1' }, { from: { nodeId: 'e1', port: 'default' }, to: 'w1' },
      { from: { nodeId: 'w1', port: 'default' }, to: 'e2' }, { from: { nodeId: 'e2', port: 'default' }, to: 'w2' },
      { from: { nodeId: 'w2', port: 'default' }, to: 'e3' }, { from: { nodeId: 'e3', port: 'default' }, to: 'ok' },
    ]
  },
  multi_channel: {
    name: 'Multi-Channel Outreach', type: 'sales_outreach',
    nodes: [
      { id: 't', type: 'trigger', name: 'Start', x: 380, y: 40 },
      { id: 'li', type: 'send_message', name: 'LinkedIn Connect', x: 380, y: 170, channel: 'linkedin' },
      { id: 'w1', type: 'wait', name: 'Wait 2 days', x: 380, y: 300, delay_days: 2 },
      { id: 'e1', type: 'send_message', name: 'Email Intro', x: 380, y: 430, channel: 'email' },
      { id: 'w2', type: 'wait', name: 'Wait 3 days', x: 380, y: 560, delay_days: 3 },
      { id: 'c1', type: 'condition', name: 'Email Opened?', x: 380, y: 690, condition: 'opened' },
      { id: 'wa', type: 'send_message', name: 'WhatsApp Follow-up', x: 200, y: 820, channel: 'whatsapp' },
      { id: 'li2', type: 'send_message', name: 'LinkedIn DM', x: 560, y: 820, channel: 'linkedin' },
      { id: 'ok', type: 'end_success', name: 'Success', x: 380, y: 950 },
    ],
    connections: [
      { from: { nodeId: 't', port: 'default' }, to: 'li' }, { from: { nodeId: 'li', port: 'default' }, to: 'w1' },
      { from: { nodeId: 'w1', port: 'default' }, to: 'e1' }, { from: { nodeId: 'e1', port: 'default' }, to: 'w2' },
      { from: { nodeId: 'w2', port: 'default' }, to: 'c1' },
      { from: { nodeId: 'c1', port: 'yes' }, to: 'li2' }, { from: { nodeId: 'c1', port: 'no' }, to: 'wa' },
      { from: { nodeId: 'wa', port: 'default' }, to: 'ok' }, { from: { nodeId: 'li2', port: 'default' }, to: 'ok' },
    ]
  },
  social_warming: {
    name: 'Social Warming + Outreach', type: 'sales_outreach',
    nodes: [
      { id: 't',   type: 'trigger',       name: 'Start',                        x: 380, y: 40  },
      { id: 'e1',  type: 'enrich_lead',   name: 'Enrich Lead Data',             x: 380, y: 170, enrich_provider: 'apollo', enrich_fields: ['email','linkedin_profile','phone'] },
      { id: 'w0',  type: 'wait',          name: 'Wait 1 day',                   x: 380, y: 300, delay_days: 1 },
      { id: 's1',  type: 'social_action', name: 'LinkedIn Connect',             x: 380, y: 430, social_platform: 'linkedin', social_action_type: 'connect', timing_mode: 'business_hours', skip_if_done: true },
      { id: 'w1',  type: 'wait',          name: 'Wait 2 days',                  x: 380, y: 560, delay_days: 2 },
      { id: 's2',  type: 'social_action', name: 'Like LinkedIn Post',           x: 380, y: 690, social_platform: 'linkedin', social_action_type: 'like_post', post_target: 'most_recent', timing_mode: 'business_hours' },
      { id: 'w2',  type: 'wait',          name: 'Wait 1 day',                   x: 380, y: 820, delay_days: 1 },
      { id: 's3',  type: 'social_action', name: 'Comment on LinkedIn Post',     x: 380, y: 950, social_platform: 'linkedin', social_action_type: 'comment_post', post_target: 'most_recent', timing_mode: 'business_hours' },
      { id: 'w3',  type: 'wait',          name: 'Wait 2 days',                  x: 380, y: 1080, delay_days: 2 },
      { id: 'c1',  type: 'condition',     name: 'Connection Accepted?',         x: 380, y: 1210, condition: 'connected_linkedin' },
      { id: 'li1', type: 'send_message',  name: 'LinkedIn DM (warm)',           x: 200, y: 1340, channel: 'linkedin' },
      { id: 'em1', type: 'send_message',  name: 'Email Intro',                  x: 560, y: 1340, channel: 'email' },
      { id: 'ok',  type: 'end_success',   name: 'Success',                      x: 380, y: 1470 },
    ],
    connections: [
      { from: { nodeId: 't',   port: 'default' }, to: 'e1'  },
      { from: { nodeId: 'e1',  port: 'default' }, to: 'w0'  },
      { from: { nodeId: 'w0',  port: 'default' }, to: 's1'  },
      { from: { nodeId: 's1',  port: 'default' }, to: 'w1'  },
      { from: { nodeId: 'w1',  port: 'default' }, to: 's2'  },
      { from: { nodeId: 's2',  port: 'default' }, to: 'w2'  },
      { from: { nodeId: 'w2',  port: 'default' }, to: 's3'  },
      { from: { nodeId: 's3',  port: 'default' }, to: 'w3'  },
      { from: { nodeId: 'w3',  port: 'default' }, to: 'c1'  },
      { from: { nodeId: 'c1',  port: 'yes'     }, to: 'li1' },
      { from: { nodeId: 'c1',  port: 'no'      }, to: 'em1' },
      { from: { nodeId: 'li1', port: 'default' }, to: 'ok'  },
      { from: { nodeId: 'em1', port: 'default' }, to: 'ok'  },
    ]
  },
  instagram_warm: {
    name: 'Instagram Warm → DM', type: 'sales_outreach',
    nodes: [
      { id: 't',  type: 'trigger',       name: 'Start',                    x: 380, y: 40  },
      { id: 's1', type: 'social_action', name: 'Follow on Instagram',      x: 380, y: 170, social_platform: 'instagram', social_action_type: 'follow', timing_mode: 'business_hours' },
      { id: 'w1', type: 'wait',          name: 'Wait 2 days',              x: 380, y: 300, delay_days: 2 },
      { id: 's2', type: 'social_action', name: 'Like Recent Post',         x: 380, y: 430, social_platform: 'instagram', social_action_type: 'like_post', post_target: 'most_recent' },
      { id: 'w2', type: 'wait',          name: 'Wait 1 day',               x: 380, y: 560, delay_days: 1 },
      { id: 's3', type: 'social_action', name: 'Like Another Post',        x: 380, y: 690, social_platform: 'instagram', social_action_type: 'like_post', post_target: 'last_7_days_2' },
      { id: 'w3', type: 'wait',          name: 'Wait 3 days',              x: 380, y: 820, delay_days: 3 },
      { id: 'm1', type: 'send_message',  name: 'Send Initial DM',          x: 380, y: 950, channel: 'whatsapp' },
      { id: 'ok', type: 'end_success',   name: 'Success',                  x: 380, y: 1080 },
    ],
    connections: [
      { from: { nodeId: 't',  port: 'default' }, to: 's1' },
      { from: { nodeId: 's1', port: 'default' }, to: 'w1' },
      { from: { nodeId: 'w1', port: 'default' }, to: 's2' },
      { from: { nodeId: 's2', port: 'default' }, to: 'w2' },
      { from: { nodeId: 'w2', port: 'default' }, to: 's3' },
      { from: { nodeId: 's3', port: 'default' }, to: 'w3' },
      { from: { nodeId: 'w3', port: 'default' }, to: 'm1' },
      { from: { nodeId: 'm1', port: 'default' }, to: 'ok' },
    ]
  },
  meeting_scheduler: {
    name: 'Meeting Scheduler', type: 'sales_outreach',
    nodes: [
      { id: 't', type: 'trigger', name: 'Start', x: 380, y: 40 },
      { id: 'e1', type: 'send_message', name: 'Meeting Invite', x: 380, y: 170, channel: 'email' },
      { id: 'w1', type: 'wait', name: 'Wait 3 days', x: 380, y: 300, delay_days: 3 },
      { id: 'c1', type: 'condition', name: 'Booked?', x: 380, y: 430, condition: 'meeting_booked' },
      { id: 'sm', type: 'schedule_meeting', name: 'Schedule Meeting', x: 200, y: 560 },
      { id: 'e2', type: 'send_message', name: 'Reminder Email', x: 560, y: 560, channel: 'email' },
      { id: 'ok', type: 'end_success', name: 'Success', x: 200, y: 690 },
      { id: 'fail', type: 'end_failed', name: 'No Show', x: 560, y: 690 },
    ],
    connections: [
      { from: { nodeId: 't', port: 'default' }, to: 'e1' }, { from: { nodeId: 'e1', port: 'default' }, to: 'w1' },
      { from: { nodeId: 'w1', port: 'default' }, to: 'c1' },
      { from: { nodeId: 'c1', port: 'yes' }, to: 'sm' }, { from: { nodeId: 'c1', port: 'no' }, to: 'e2' },
      { from: { nodeId: 'sm', port: 'default' }, to: 'ok' }, { from: { nodeId: 'e2', port: 'default' }, to: 'fail' },
    ]
  },
  nurturing: {
    name: 'Lead Nurturing Campaign', type: 'nurturing',
    nodes: [
      { id: 't', type: 'trigger', name: 'Start', x: 380, y: 40 },
      { id: 'e1', type: 'send_message', name: 'Welcome Email', x: 380, y: 170, channel: 'email' },
      { id: 'w1', type: 'wait', name: 'Wait 3 days', x: 380, y: 300, delay_days: 3 },
      { id: 'e2', type: 'send_message', name: 'Value Content', x: 380, y: 430, channel: 'email' },
      { id: 'w2', type: 'wait', name: 'Wait 4 days', x: 380, y: 560, delay_days: 4 },
      { id: 'c1', type: 'condition', name: 'Engaged?', x: 380, y: 690, condition: 'clicked' },
      { id: 'e3', type: 'send_message', name: 'Case Study', x: 200, y: 820, channel: 'email' },
      { id: 'wa', type: 'send_message', name: 'Personal Touch', x: 560, y: 820, channel: 'whatsapp' },
      { id: 'ok', type: 'end_success', name: 'Success', x: 380, y: 950 },
    ],
    connections: [
      { from: { nodeId: 't', port: 'default' }, to: 'e1' }, { from: { nodeId: 'e1', port: 'default' }, to: 'w1' },
      { from: { nodeId: 'w1', port: 'default' }, to: 'e2' }, { from: { nodeId: 'e2', port: 'default' }, to: 'w2' },
      { from: { nodeId: 'w2', port: 'default' }, to: 'c1' },
      { from: { nodeId: 'c1', port: 'yes' }, to: 'e3' }, { from: { nodeId: 'c1', port: 'no' }, to: 'wa' },
      { from: { nodeId: 'e3', port: 'default' }, to: 'ok' }, { from: { nodeId: 'wa', port: 'default' }, to: 'ok' },
    ]
  },
};

export default function WorkflowBuilderModal({ workflow, company: companyProp, onClose }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(workflow?.name || '');
  const [type, setType] = useState(workflow?.type || 'sales_outreach');
  const parseArr = (arr) => Array.isArray(arr) ? arr.map(item => typeof item === 'string' ? JSON.parse(item) : item) : [];
  const [nodes, setNodes] = useState(() => {
    if (workflow?.nodes?.length) return parseArr(workflow.nodes);
    return [{ id: 'trigger', type: 'trigger', name: 'Start', x: 380, y: 40 }];
  });
  const [connections, setConnections] = useState(() => workflow?.connections?.length ? parseArr(workflow.connections) : []);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [unsaved, setUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTab, setActiveTab] = useState('ai'); // 'ai' | 'properties'
  const autoSaveTimer = useRef(null);

  // Use company passed from parent (already loaded) — fallback to fetching if not provided
  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => Company.list(),
    enabled: !companyProp,
  });
  const company = companyProp || companies[0];
  const { data: leads = [] } = useQuery({ queryKey: ['leads'], queryFn: () => Lead.filter({ company_id: company?.id }, '-created_date', 20), enabled: !!company?.id });

  const [savedWorkflowId, setSavedWorkflowId] = useState(workflow?.id || null);
  // Undo/Redo history
  const historyRef = useRef([{ nodes: nodes, connections: connections }]);
  const historyIndexRef = useRef(0);

  const createMutation = useMutation({
    mutationFn: (data) => {
      if (!company?.id) throw new Error('Company not loaded yet');
      return Workflow.create({ ...data, company_id: company.id, status: 'draft' });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setSavedWorkflowId(created.id);
      setUnsaved(false);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => Workflow.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workflows'] }); setUnsaved(false); },
  });

  const buildSaveData = useCallback(() => ({
    name: name || 'Untitled Workflow',
    type,
    nodes: nodes.map(n => JSON.stringify(n)),
    connections: connections.map(c => JSON.stringify(c)),
    triggers: (workflow?.triggers && typeof workflow.triggers === 'object' && !Array.isArray(workflow.triggers))
      ? workflow.triggers
      : {},
    steps: nodes.filter(n => n.type !== 'trigger' && !n.type.startsWith('end')).map(n => ({
      id: n.id, type: n.type, name: n.name, channel: n.channel || null,
      delay_days: n.delay_days || 0, delay_hours: n.delay_hours || 0,
      template_id: n.template_id, conditions: n.condition ? { type: n.condition } : null, auto_send: n.auto_send || false,
      // Social action fields
      ...(n.type === 'social_action' ? {
        social_platform: n.social_platform, social_action_type: n.social_action_type,
        post_target: n.post_target, post_target_date: n.post_target_date,
        social_comment: n.social_comment, connect_note: n.connect_note,
        timing_mode: n.timing_mode, timing_time: n.timing_time, timing_date: n.timing_date,
        skip_if_done: n.skip_if_done, retry_on_failure: n.retry_on_failure,
      } : {}),
      // Enrichment fields
      ...(n.type === 'enrich_lead' ? {
        enrich_provider: n.enrich_provider, enrich_fields: n.enrich_fields,
        enrich_fallback: n.enrich_fallback, enrich_overwrite: n.enrich_overwrite,
      } : {}),
      // Wait fields
      ...(n.type === 'wait' ? { wait_until: n.wait_until, business_days_only: n.business_days_only } : {}),
      // Schedule meeting fields
      ...(n.type === 'schedule_meeting' ? {
        meeting_tool: n.meeting_tool, meeting_title: n.meeting_title,
        meeting_duration: n.meeting_duration, meeting_date: n.meeting_date,
        calendly_url: n.calendly_url, message_content: n.message_content,
        invite_channel: n.invite_channel, auto_send: n.auto_send,
        meeting_description: n.meeting_description,
      } : {}),
    })),
  }), [name, type, nodes, connections, workflow?.triggers]);

  // Auto-save with debounce — saves to existing workflow or creates if new
  useEffect(() => {
    if (!unsaved) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const saveData = buildSaveData();
      if (savedWorkflowId) {
        updateMutation.mutate({ id: savedWorkflowId, data: saveData });
      } else if (name.trim() && company?.id) {
        // Auto-create new workflow on first save
        createMutation.mutate(saveData);
      }
    }, 1500);
    return () => clearTimeout(autoSaveTimer.current);
  }, [unsaved, nodes, connections, name, type, savedWorkflowId]);

  const markUnsaved = () => setUnsaved(true);

  const pushHistory = (n, c) => {
    const truncated = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current = [...truncated, { nodes: n, connections: c }].slice(-50);
    historyIndexRef.current = historyRef.current.length - 1;
  };

  const undo = () => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    const state = historyRef.current[historyIndexRef.current];
    setNodes(state.nodes);
    setConnections(state.connections);
    markUnsaved();
  };

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    const state = historyRef.current[historyIndexRef.current];
    setNodes(state.nodes);
    setConnections(state.connections);
    markUnsaved();
  };

  const handleNodesChange = (n) => { pushHistory(n, connections); setNodes(n); markUnsaved(); };
  const handleConnectionsChange = (c) => { pushHistory(nodes, c); setConnections(c); markUnsaved(); };

  const handleNodeUpdate = (id, updates) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    markUnsaved();
  };

  const handleNodeDelete = (id) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setConnections(prev => prev.filter(c => c.from.nodeId !== id && c.to !== id));
    setSelectedNodeId(null);
    markUnsaved();
  };

  const addNode = (type) => {
    const last = nodes[nodes.length - 1];
    const newNode = {
      id: `node_${Date.now()}`, type, name: NODE_TYPES[type]?.name || 'Node',
      x: last ? last.x : 380, y: last ? last.y + 130 : 170,
      delay_days: type === 'wait' ? 1 : 0, delay_hours: 0,
      channel: type === 'send_message' ? 'email' : null,
      ...(type === 'social_action' ? { social_platform: 'linkedin', timing_mode: 'business_hours', skip_if_done: true, retry_on_failure: true } : {}),
      ...(type === 'enrich_lead' ? { enrich_provider: 'apollo', enrich_fields: ['email', 'linkedin_profile'], enrich_fallback: 'continue' } : {}),
    };
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    setSelectedNodeId(newNode.id);
    if (last && !last.type.startsWith('end')) {
      const port = last.type === 'condition' ? 'yes' : 'default';
      setConnections(prev => [...prev, { from: { nodeId: last.id, port }, to: newNode.id }]);
    }
    markUnsaved();
  };

  const autoLayout = () => {
    const trigger = nodes.find(n => n.type === 'trigger');
    if (!trigger) return;
    const visited = new Set();
    const levels = {};
    const buildLevels = (id, level = 0) => {
      if (visited.has(id)) return;
      visited.add(id);
      if (!levels[level]) levels[level] = [];
      levels[level].push(id);
      connections.filter(c => c.from.nodeId === id).forEach(c => buildLevels(c.to, level + 1));
    };
    buildLevels(trigger.id);
    const newNodes = nodes.map(node => {
      const level = Object.keys(levels).find(l => levels[l].includes(node.id));
      if (level === undefined) return node;
      const idx = levels[level].indexOf(node.id);
      const total = levels[level].length;
      return { ...node, x: 380 - ((total - 1) * 220) / 2 + idx * 220, y: 40 + parseInt(level) * 130 };
    });
    setNodes(newNodes);
    markUnsaved();
    toast.success('Layout optimized');
  };

  const saveNow = async () => {
    if (!name.trim()) { toast.error('Workflow name is required'); return; }
    if (!company?.id) { toast.error('Company not loaded yet, please wait'); return; }
    setSaving(true);
    try {
      const saveData = buildSaveData();
      if (savedWorkflowId) {
        await updateMutation.mutateAsync({ id: savedWorkflowId, data: saveData });
        toast.success('Saved!');
      } else {
        const created = await createMutation.mutateAsync(saveData);
        setSavedWorkflowId(created.id);
        toast.success('Workflow created!');
      }
    } finally { setSaving(false); }
  };

  const handleClose = () => {
    if (unsaved && savedWorkflowId) updateMutation.mutate({ id: savedWorkflowId, data: buildSaveData() });
    onClose();
  };

  // Undo/Redo keyboard shortcuts + ESC close (only when canvas has nothing selected)
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    const escCloseHandler = () => handleClose();
    window.addEventListener('keydown', handler);
    window.addEventListener('workflow-esc-close', escCloseHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('workflow-esc-close', escCloseHandler);
    };
  }, [unsaved, savedWorkflowId]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const filteredNodeTypes = Object.entries(NODE_TYPES).filter(([key, cfg]) =>
    cfg.category !== 'trigger' && (!searchQuery || cfg.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleApplySuggestion = (suggestion) => {
    const { type: sType, target_nodes = [], implementation = '' } = suggestion;

    if (sType === 'timing') {
      const daysMatch = implementation.match(/(\d+)\s*day/i);
      const waitNodes = nodes.filter(n => n.type === 'wait');
      if (daysMatch && waitNodes.length > 0) {
        setNodes(prev => prev.map(n => n.type === 'wait' ? { ...n, delay_days: parseInt(daysMatch[1]) } : n));
      }
    } else if (sType === 'channel') {
      // Suggest adding a new channel message after last send_message
      const lastMsg = [...nodes].reverse().find(n => n.type === 'send_message');
      if (lastMsg) {
        const newNode = { id: `node_${Date.now()}`, type: 'send_message', name: 'Additional Touchpoint', x: lastMsg.x + 220, y: lastMsg.y, channel: 'whatsapp' };
        setNodes(prev => [...prev, newNode]);
      }
    } else if (sType === 'logic') {
      // Add a condition node after first send_message
      const firstMsg = nodes.find(n => n.type === 'send_message');
      if (firstMsg) {
        const newNode = { id: `node_${Date.now()}`, type: 'condition', name: 'Check Response', x: firstMsg.x, y: firstMsg.y + 150, condition: 'replied' };
        setNodes(prev => [...prev, newNode]);
      }
    }
    markUnsaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full h-full max-w-[1400px] max-h-[92vh] bg-[#111] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0">
          <Input value={name} onChange={(e) => { setName(e.target.value); markUnsaved(); }}
            placeholder="Workflow name..." className="bg-black/30 border-white/10 text-white font-semibold text-base w-60" />
          <Select value={type} onValueChange={(v) => { setType(v); markUnsaved(); }}>
            <SelectTrigger className="w-44 bg-black/30 border-white/10 text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-white/10">
              <SelectItem value="sales_outreach" className="text-white">Sales Outreach</SelectItem>
              <SelectItem value="follow_up" className="text-white">Follow Up</SelectItem>
              <SelectItem value="nurturing" className="text-white">Nurturing</SelectItem>
              <SelectItem value="qualification" className="text-white">Qualification</SelectItem>
              <SelectItem value="custom" className="text-white">Custom</SelectItem>
            </SelectContent>
          </Select>

          <Popover open={showTemplates} onOpenChange={setShowTemplates}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-2 text-sm">
                <BookOpen size={14} /> Templates
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 bg-[#1a1a1a] border-white/10 p-3">
              <p className="text-white font-medium text-sm mb-2">Quick Start Templates</p>
              <div className="space-y-1.5">
                {Object.entries(TEMPLATES).map(([key, t]) => (
                  <button key={key} onClick={() => {
                    setNodes(t.nodes); setConnections(t.connections);
                    setName(t.name); setType(t.type);
                    setShowTemplates(false); markUnsaved(); toast.success('Template loaded');
                  }} className="w-full text-left p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#38b6ff]/30 transition-all">
                    <p className="text-white text-xs font-medium">{t.name}</p>
                    <p className="text-gray-500 text-[10px]">{t.nodes.length} steps</p>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" onClick={autoLayout} className="border-white/10 text-white hover:bg-white/5 text-sm gap-1.5" title="Optimize node positions">
            <Layout size={14} /> Optimize Layout
          </Button>
          <Button variant="ghost" size="icon" onClick={undo} title="Undo (Ctrl+Z)" className="text-gray-400 hover:text-white hover:bg-white/10 h-8 w-8">
            <Undo2 size={15} />
          </Button>
          <Button variant="ghost" size="icon" onClick={redo} title="Redo (Ctrl+Y)" className="text-gray-400 hover:text-white hover:bg-white/10 h-8 w-8">
            <Redo2 size={15} />
          </Button>

          <div className="flex-1" />
          {unsaved && <span className="text-xs text-yellow-400">● Unsaved changes</span>}
          {!unsaved && savedWorkflowId && <span className="text-xs text-green-400 flex items-center gap-1"><Check size={10} /> Saved</span>}
          <Button onClick={saveNow} disabled={saving || createMutation.isPending}
            className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] text-sm gap-1.5">
            {saving ? <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : null}
            {savedWorkflowId ? 'Save' : 'Create Workflow'}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleClose} className="text-gray-400 hover:text-white hover:bg-white/10">
            <X size={18} />
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left toolbox */}
          <div className="w-52 border-r border-white/10 flex flex-col overflow-hidden flex-shrink-0">
            <div className="p-3 border-b border-white/10">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search nodes..." className="pl-7 h-8 text-xs bg-black/30 border-white/10 text-white" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {['action', 'delay', 'logic', 'end'].map(cat => {
                const catNodes = filteredNodeTypes.filter(([, cfg]) => cfg.category === cat);
                if (!catNodes.length) return null;
                return (
                  <div key={cat}>
                    <p className="text-gray-600 text-[10px] font-semibold uppercase mb-1 px-1">{cat}</p>
                    {catNodes.map(([key, cfg]) => {
                      const Icon = cfg.icon;
                      return (
                        <button key={key} draggable
                          onDragStart={(e) => { e.dataTransfer.setData('nodeType', key); e.dataTransfer.effectAllowed = 'copy'; }}
                          onClick={() => addNode(key)}
                          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg border border-white/10 hover:bg-white/5 hover:border-white/20 transition-colors text-left mb-1 cursor-pointer">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cfg.color}25` }}>
                            <Icon size={14} style={{ color: cfg.color }} />
                          </div>
                          <span className="text-white text-xs">{cfg.name}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-hidden relative"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const nodeType = e.dataTransfer.getData('nodeType');
              if (nodeType) {
                const rect = e.currentTarget.getBoundingClientRect();
                const newNode = {
                  id: `node_${Date.now()}`, type: nodeType, name: NODE_TYPES[nodeType]?.name || 'Node',
                  x: e.clientX - rect.left - 88, y: e.clientY - rect.top - 35,
                  delay_days: nodeType === 'wait' ? 1 : 0, delay_hours: 0,
                  channel: nodeType === 'send_message' ? 'email' : null,
                  ...(nodeType === 'social_action' ? { social_platform: 'linkedin', timing_mode: 'business_hours', skip_if_done: true, retry_on_failure: true } : {}),
                  ...(nodeType === 'enrich_lead' ? { enrich_provider: 'apollo', enrich_fields: ['email', 'linkedin_profile'], enrich_fallback: 'continue' } : {}),
                };
                setNodes(prev => [...prev, newNode]);
                setSelectedNodeId(newNode.id);
                markUnsaved();
              }
            }}>
            <WorkflowCanvas
              nodes={nodes} connections={connections}
              onNodesChange={handleNodesChange} onConnectionsChange={handleConnectionsChange}
              onNodeSelect={(id) => { setSelectedNodeId(id); if (id) setActiveTab('properties'); }}
              selectedNodeId={selectedNodeId}
            />
          </div>

          {/* Right Panel */}
          <div className="w-80 border-l border-white/10 flex flex-col overflow-hidden flex-shrink-0">
            {/* Tabs */}
            <div className="flex border-b border-white/10 flex-shrink-0">
              <button onClick={() => setActiveTab('ai')}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeTab === 'ai' ? 'text-[#38b6ff] border-b-2 border-[#38b6ff]' : 'text-gray-400 hover:text-white'}`}>
                ✨ AI Assistant
              </button>
              <button onClick={() => setActiveTab('properties')}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeTab === 'properties' ? 'text-[#38b6ff] border-b-2 border-[#38b6ff]' : 'text-gray-400 hover:text-white'}`}>
                ⚙ Properties {selectedNode ? `(${selectedNode.name})` : ''}
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              {activeTab === 'ai' ? (
                <WorkflowAIPanel
                  workflow={workflow} nodes={nodes} connections={connections}
                  company={company} leads={leads}
                  onApplySuggestion={handleApplySuggestion}
                  onApplyAll={(suggestions) => suggestions.forEach(s => handleApplySuggestion(s))}
                  onGenerateWorkflow={(data) => {
                    if (data.nodes) setNodes(data.nodes);
                    if (data.connections) setConnections(data.connections);
                    if (data.name) setName(data.name);
                    if (data.type) setType(data.type);
                    markUnsaved();
                  }}
                />
              ) : (
                <WorkflowNodePanel node={selectedNode} onUpdate={handleNodeUpdate} onDelete={handleNodeDelete} company={company} integrationStatus={company?.integration_status || {}} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
