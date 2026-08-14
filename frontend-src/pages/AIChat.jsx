import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { useLanguage } from '@/components/ui/LanguageContext';
import MyTasks from '@/components/tasks/MyTasks';
import TaskTableInput from '@/components/tasks/TaskTableInput';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Send, Plus, Trash2, MessageSquare, Bot,
  Loader2, Sparkles, ChevronLeft,
  Paperclip, Image, X, File, Video,
  Pin, PinOff, Edit3, Check, Mic, MicOff, LayoutDashboard,
  CheckSquare, Table2
} from 'lucide-react';
import { toast } from 'sonner';
import MessageBubble from '@/components/chat/MessageBubble';
import ActionApproval from '@/components/chat/ActionApproval';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/api/apiClient';
import { TranscribeAudio, UploadFile } from '@/api/integrations';
import { DashboardConfig, Company } from '@/api/entities';

const QUICK_ACTIONS = [
  { label: '🔍 Find ICP leads', prompt: 'Search for 50 contacts that fit my defined ICP profile. Use my company and ICP settings as context. Include name, company, role, LinkedIn URL, and email if available.' },
  { label: '📊 Analyze pipeline', prompt: 'Analyze my current sales pipeline. Show me conversion rates between stages, total pipeline value, and identify the biggest bottlenecks. Suggest concrete next steps.' },
  { label: '🔄 Create workflow', prompt: 'Create a multi-step outreach workflow for me based on my ICP and company data. Include email and WhatsApp steps with delays and conditions.' },
  { label: '✉️ Outreach message', prompt: 'Create 3 personalized outreach message templates (WhatsApp, Email, LinkedIn) using my company info, value propositions, and ICP data.' },
  { label: '📅 Social calendar', prompt: 'Build a 2-week social media content calendar for my company. Use my briefing data for tone and content focus. Include LinkedIn and Instagram posts.' },
  { label: '📣 Ad strategy', prompt: 'Create a complete paid media strategy for my company using all my briefing and company data. Include funnel architecture, hook angles, KPIs, and ready-to-use ad copies for Meta Ads.' },
  { label: '✍️ Blog post', prompt: 'Write a complete SEO-optimized blog post relevant to my ICP and industry. Use my company tone of voice and target keywords from my briefing.' },
  { label: '🎯 Update ICP', prompt: 'Review my current ICP settings and leads data. Suggest ICP optimizations and apply them if I approve.' },
  { label: '💬 Handle objection', prompt: 'Help me craft compelling responses to the top 3 most common sales objections based on my ICP and company data.' },
  { label: '🏷️ Message templates', prompt: 'Create 5 high-converting message templates (mix of WhatsApp, Email, LinkedIn) for cold outreach to my ICP using my company data and value propositions.' },
  { label: '📈 Funnel analysis', prompt: 'Deep-dive analysis of my sales funnel. What stages are losing the most leads? What is my overall conversion rate? Give me a prioritized action plan.' },
  { label: '📋 Meeting summary', prompt: 'I have a meeting transcript or notes to analyze. Upload the file and I will extract action items, decisions made, lead information, and next steps.' },
  { label: '🗃️ Sales dashboard', prompt: 'Create a Sales Metrics dashboard for me with widgets for pipeline value, funnel stages, lead sources and weekly activity.' },
  { label: '📉 Marketing dashboard', prompt: 'Create a Marketing Conversion dashboard for me tracking message volume, channel mix, conversion rates and workflow enrollments.' },
];

const CONTEXTUAL_SUGGESTIONS = {
  lead: ['Move this lead to next stage', 'Create outreach message for this lead', 'Analyze this lead\'s digital presence', 'Add this lead to a workflow'],
  workflow: ['Activate this workflow', 'Add leads to this workflow', 'Optimize this workflow sequence', 'Duplicate this workflow'],
  sales: ['Analyze current pipeline', 'Find new ICP leads', 'Create bulk outreach for all prospects', 'Show conversion bottlenecks'],
  social: ['Generate post for today', 'Plan this week\'s content', 'Analyze best posting times', 'Write a viral hook for LinkedIn'],
  ads: ['Build Meta Ads strategy from my briefing', 'Generate 6 ad copies for my product', 'How do I set up a retargeting campaign?'],
  blog: ['Write a blog post for my ICP', 'Audit my website SEO', 'Find keywords my competitors rank for'],
};

export default function AIChat() {
  const { t, isPt } = useLanguage();
  // Needed so a change the agent makes from chat (company settings, a new task)
  // refreshes the rest of the app immediately rather than showing stale data.
  const queryClient = useQueryClient();

  // Which message's proposed changes are currently being written.
  const [applyingIndex, setApplyingIndex] = useState(null);

  /**
   * Apply the changes the user just approved.
   *
   * `actions` comes from the card rather than from state, because the user may have
   * edited them before approving. The result stored on the message is the SERVER's
   * answer — what actually happened — not the model's claim about it.
   */
  /**
   * Write the conversation back so an outcome survives a reload.
   *
   * Without this, approving a change updated the message only in memory: after a
   * refresh the card reappeared as an un-approved proposal, and clicking Approve
   * again created a SECOND social post / blog draft / campaign from the same
   * request. Persisting the applied result is what makes the action idempotent
   * from the user's side.
   */
  const persistMessages = async (msgs) => {
    const convo = activeConversation;
    if (!convo) return;
    try {
      const payload = {
        type: 'conversation',
        title: convo.metadata?.name || 'Conversation',
        name: convo.metadata?.name || 'Conversation',
        pinned: !!convo.metadata?.pinned,
        client_id: convo.id,
        content: { messages: msgs },
      };
      const saved = convo.dbId
        ? await api.patch(`/api/ai/outputs/${convo.dbId}`, payload)
        : await api.post('/api/ai/outputs', payload);

      const next = { ...convo, dbId: saved?.id || convo.dbId, messages: msgs };
      setActiveConversation(next);
      setConversations(prev => prev.map(c => (c.id === convo.id ? next : c)));
    } catch (e) {
      // The change itself already succeeded — only the record of it failed, so say
      // so rather than implying the write was lost.
      console.error('[AIChat] could not persist conversation:', e?.message);
      toast.error(isPt
        ? 'A alteração foi aplicada, mas não consegui salvar o histórico da conversa.'
        : 'The change was applied, but I could not save the conversation history.');
    }
  };

  const approveActions = async (index, actions) => {
    setApplyingIndex(index);
    try {
      const res = await api.post('/api/ai/actions/apply', { actions });
      const applied = Array.isArray(res.applied) ? res.applied : [];

      // Drop the proposal at the same time as recording the result: a message that
      // has been acted on must never offer Approve again, in this session or after
      // a reload.
      const next = messages.map((m, i) => (
        i === index
          ? { ...m, action_result: applied, proposed_actions: undefined, action_preview: undefined }
          : m
      ));
      setMessages(next);
      await persistMessages(next);

      for (const a of applied.filter(x => x.ok)) {
        toast.success(a.summary || (isPt ? 'Alteração aplicada' : 'Change applied'));
      }
      if (res.warning) toast.error(res.warning, { duration: 30000, closeButton: true });

      // Whatever changed may be on screen elsewhere right now.
      if (applied.some(a => a.ok)) {
        for (const key of ['companies', 'tasks', 'taskSummary', 'socialPosts', 'blogPosts', 'aiOutputs', 'adCampaigns']) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      }
    } catch (e) {
      toast.error((isPt ? 'Falha ao aplicar: ' : 'Could not apply: ') + (e?.message || ''));
    } finally {
      setApplyingIndex(null);
    }
  };

  /** Declining drops the proposal so the card cannot be re-fired, now or after a reload. */
  const declineActions = async (index) => {
    const next = messages.map((m, i) => (
      i === index
        ? { ...m, proposed_actions: undefined, action_preview: undefined, action_declined: true }
        : m
    ));
    setMessages(next);
    await persistMessages(next);
    toast.info(isPt ? 'Alterações recusadas' : 'Changes declined');
  };

  // Chat ⇄ My Tasks, plus the task-table entry mode. Both read from the URL so
  // the Home widget and task notifications can deep-link straight to a task.
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'tasks' ? 'tasks' : 'chat');
  const [tableMode, setTableMode] = useState(false);
  const focusTaskId = searchParams.get('task') || null;

  // A later navigation to ?tab=tasks (the widget while already on this page)
  // must switch the tab too, not only the first render.
  useEffect(() => {
    if (searchParams.get('tab') === 'tasks') setActiveTab('tasks');
  }, [searchParams]);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [editingConvoId, setEditingConvoId] = useState(null);
  const [editingConvoTitle, setEditingConvoTitle] = useState('');
  const [contextualSuggestions, setContextualSuggestions] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [noApiKey, setNoApiKey] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Detect context from last AI message to show contextual suggestions
  useEffect(() => {
    if (messages.length === 0) return;
    const lastAiMsg = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAiMsg?.content) return;
    const content = lastAiMsg.content.toLowerCase();
    let suggestions = [];
    if (content.includes('lead') || content.includes('prospect') || content.includes('contact')) suggestions = CONTEXTUAL_SUGGESTIONS.lead;
    else if (content.includes('workflow') || content.includes('sequence') || content.includes('automation')) suggestions = CONTEXTUAL_SUGGESTIONS.workflow;
    else if (content.includes('pipeline') || content.includes('funnel') || content.includes('conversion')) suggestions = CONTEXTUAL_SUGGESTIONS.sales;
    else if (content.includes('instagram') || content.includes('linkedin post') || content.includes('social media')) suggestions = CONTEXTUAL_SUGGESTIONS.social;
    else if (content.includes('ad copy') || content.includes('meta ads') || content.includes('campaign')) suggestions = CONTEXTUAL_SUGGESTIONS.ads;
    else if (content.includes('blog') || content.includes('seo') || content.includes('keyword')) suggestions = CONTEXTUAL_SUGGESTIONS.blog;
    setContextualSuggestions(suggestions.slice(0, 3));
  }, [messages]);

  const { dbUser: user, company } = useAuth();

  // ─── Dashboard creation from AI Chat ─────────────────────────────────────────
  const DASHBOARD_TEMPLATES_CHAT = {
    sales: {
      name: 'Sales Metrics',
      widgets: [
        { id: 'ts1', type: 'area_chart',  title: 'Weekly Lead Acquisition',    dataSource: 'leads',    size: 'large',  width: 3, height: 2, legend: { show: ['chart','tooltip'], position: 'bottom' } },
        { id: 'ts2', type: 'bar_chart',   title: 'Funnel Stage Breakdown',     dataSource: 'funnel',   size: 'medium', width: 2, height: 2, legend: { show: ['chart','tooltip'], position: 'bottom' } },
        { id: 'ts3', type: 'pie_chart',   title: 'Lead Source Distribution',   dataSource: 'leads',    size: 'small',  width: 1, height: 2, legend: { show: ['chart','tooltip'], position: 'bottom' } },
        { id: 'ts4', type: 'stat_card',   title: 'Sales KPIs',                 dataSource: 'messages', size: 'medium', width: 2, height: 1, legend: { show: ['chart','tooltip'], position: 'bottom' } },
      ],
    },
    marketing: {
      name: 'Marketing Conversion',
      widgets: [
        { id: 'tm1', type: 'stat_card',   title: 'Conversion Metrics',         dataSource: 'messages', size: 'large',  width: 3, height: 1, legend: { show: ['chart','tooltip'], position: 'bottom' } },
        { id: 'tm2', type: 'area_chart',  title: 'Message Volume Over Time',   dataSource: 'messages', size: 'large',  width: 3, height: 2, legend: { show: ['chart','tooltip'], position: 'bottom' } },
        { id: 'tm3', type: 'pie_chart',   title: 'Channel Mix',                dataSource: 'messages', size: 'small',  width: 1, height: 2, legend: { show: ['chart','tooltip'], position: 'bottom' } },
        { id: 'tm4', type: 'bar_chart',   title: 'Leads by Status',            dataSource: 'leads',    size: 'medium', width: 2, height: 2, legend: { show: ['chart','tooltip'], position: 'bottom' } },
      ],
    },
  };

  const tryCreateDashboardFromMessage = async (userMessage) => {
    if (!company?.id) return false;
    const msg = userMessage.toLowerCase();
    const isSales = msg.includes('sales') || msg.includes('pipeline') || msg.includes('funnel');
    const isMarketing = msg.includes('marketing') || msg.includes('conversion') || msg.includes('channel');
    const wantsDashboard = msg.includes('dashboard') || msg.includes('create') || msg.includes('build');
    if (!wantsDashboard) return false;

    const tmplKey = isMarketing ? 'marketing' : 'sales';
    const tmpl = DASHBOARD_TEMPLATES_CHAT[tmplKey];
    try {
      const companies = await Company.list();
      const comp = companies[0];
      if (!comp?.id) return false;
      const existing = await DashboardConfig.filter({ company_id: comp.id });
      await DashboardConfig.create({
        company_id: comp.id,
        name: tmpl.name,
        is_default: !existing || existing.length === 0,
        widgets: tmpl.widgets,
      });
      toast.success(`✅ "${tmpl.name}" dashboard created! Go to Dashboards to view it.`, { duration: 5000 });
      return true;
    } catch (e) {
      console.error('Dashboard creation from AI failed:', e);
      return false;
    }
  };

  const loadConversations = async () => {
    try {
      const res = await api.get('/api/ai/outputs', { type: 'conversation' });
      const rows = Array.isArray(res) ? res : (res?.data || []);
      const convos = rows.map(r => ({
        id: r.client_id || r.id,
        dbId: r.id,
        messages: r.content?.messages || [],
        metadata: {
          name: r.name || r.title || 'Conversation',
          pinned: !!r.pinned,
        },
        created_at: r.created_at,
      }));
      setConversations(convos);
    } catch (e) { console.log('No conversations yet'); }
  };

  const createNewConversation = async (initialPrompt = null) => {
    try {
      const newId = crypto.randomUUID();
      const convo = { id: newId, dbId: null, messages: [], metadata: { name: 'New Conversation', pinned: false }, created_at: new Date().toISOString() };
      setConversations(prev => [convo, ...prev]);
      setActiveConversation(convo);
      setMessages([]);
      if (initialPrompt) {
        setTimeout(() => sendMessageToConvo(convo, initialPrompt), 100);
      }
    } catch (e) { toast.error('Failed to create conversation'); }
  };

  const loadConversation = async (convo) => {
    setActiveConversation(convo);
    setMessages(convo.messages || []);
  };

  // No subscription needed — state is updated directly after each message

  const updateConvoTitle = async (id, name) => {
    const convo = conversations.find(c => c.id === id);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, metadata: { ...c.metadata, name } } : c));
    setActiveConversation(prev => prev?.id === id ? { ...prev, metadata: { ...prev.metadata, name } } : prev);
    if (convo?.dbId) {
      await api.patch(`/api/ai/outputs/${convo.dbId}`, {
        name,
        title: name,
        pinned: !!convo.metadata?.pinned,
        client_id: convo.id,
      });
    }
  };

  const togglePin = async (convo, e) => {
    e.stopPropagation();
    const newPinned = !convo.metadata?.pinned;
    setConversations(prev => prev.map(c => c.id === convo.id ? { ...c, metadata: { ...c.metadata, pinned: newPinned } } : c));
    setActiveConversation(prev => prev?.id === convo.id ? { ...prev, metadata: { ...prev.metadata, pinned: newPinned } } : prev);
    if (convo.dbId) {
      await api.patch(`/api/ai/outputs/${convo.dbId}`, {
        name: convo.metadata?.name || 'Conversation',
        title: convo.metadata?.name || 'Conversation',
        pinned: newPinned,
        client_id: convo.id,
      });
    }
    toast.success(newPinned ? 'Conversation pinned' : 'Conversation unpinned');
  };

  const deleteConversation = async (convo, e) => {
    e.stopPropagation();
    try {
      if (convo.dbId) await api.delete(`/api/ai/outputs/${convo.dbId}`);
      setConversations(prev => prev.filter(c => c.id !== convo.id));
      if (activeConversation?.id === convo.id) {
        setActiveConversation(null);
        setMessages([]);
      }
      toast.success('Conversation deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete conversation');
    }
  };

  const startEditTitle = (convo, e) => {
    e.stopPropagation();
    setEditingConvoId(convo.id);
    setEditingConvoTitle(convo.metadata?.name || '');
  };

  const saveTitle = async (id, e) => {
    e?.stopPropagation();
    if (editingConvoTitle.trim()) await updateConvoTitle(id, editingConvoTitle.trim());
    setEditingConvoId(null);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingFiles(true);
    try {
      const uploaded = await Promise.all(files.map(async (file) => {
        const { url: file_url } = await UploadFile({ file });
        const canReadAsText = file.type.startsWith('text/')
          || /\.(txt|csv|vtt|srt)$/i.test(file.name);
        const text = canReadAsText ? (await file.text()).slice(0, 100000) : null;
        return { url: file_url, name: file.name, type: file.type, text };
      }));
      setAttachedFiles(prev => [...prev, ...uploaded]);
    } catch (e) { toast.error('Failed to upload file'); }
    finally { setUploadingFiles(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const sendMessageToConvo = async (convo, content, attachments = []) => {
    setIsLoading(true);
    const userMsg = { role: 'user', content: content || 'Please analyze the attached file(s).', created_at: new Date().toISOString() };
    if (attachments.length > 0) userMsg.attachments = attachments;

    // Optimistically add user message
    const updatedMessages = [...(convo.messages || []), userMsg];
    setMessages(updatedMessages);

    try {
      // Build message history for the AI
      const historyMsgs = updatedMessages.map(m => {
        if (m.role !== 'user' || !m.attachments?.length) return { role: m.role, content: m.content };
        const textParts = [m.content || 'Please analyze the attachments.'];
        const imageParts = [];
        for (const file of m.attachments) {
          if (file.text) {
            textParts.push(`\n\nAttached file "${file.name}":\n${file.text}`);
          } else if (file.type?.startsWith('image/')) {
            imageParts.push({ type: 'image_url', image_url: { url: file.url, detail: 'auto' } });
          } else {
            textParts.push(`\n\nAttached file "${file.name}" is stored at ${file.url}. Its binary contents are not included in this chat request.`);
          }
        }
        return {
          role: m.role,
          content: [{ type: 'text', text: textParts.join('') }, ...imageParts],
        };
      });

      // Get company context for the system prompt
      const systemPrompt = `You are Bmapz AI, an expert B2B sales and marketing automation assistant.
You help businesses with lead generation, outreach, social media, ads, SEO, and workflow automation.
Be concise, actionable, and data-driven. Always personalize advice to the user's context.`;

      const res = await api.post('/api/ai/chat', {
        messages: historyMsgs,
        system: systemPrompt,
      });

      // The agent PROPOSES changes; nothing is written until the user approves them
      // on the card attached to this message.
      const assistantMsg = {
        role: 'assistant',
        content: res.content,
        created_at: new Date().toISOString(),
        ...(res.proposed_actions?.length
          ? { proposed_actions: res.proposed_actions, action_preview: res.action_preview }
          : {}),
      };
      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      // Long duration + dismissible: the previous 4s default meant an action
      // failure flashed past before it could be read, which is precisely why the
      // real cause stayed hidden through two rounds of testing.
      if (res.action_warning) {
        toast.error(res.action_warning, { duration: 30000, closeButton: true });
      }

      // Update convo in state
      // Auto-title on first exchange
      let conversationName = convo.metadata?.name || 'Conversation';
      if (updatedMessages.length === 1 && convo.metadata?.name === 'New Conversation') {
        conversationName = (content || attachments[0]?.name || 'Conversation').slice(0, 60);
        if ((content || '').length > 60) conversationName += '...';
      }

      const savePayload = {
        type: 'conversation',
        title: conversationName,
        name: conversationName,
        pinned: !!convo.metadata?.pinned,
        client_id: convo.id,
        content: { messages: finalMessages },
      };
      const saved = convo.dbId
        ? await api.patch(`/api/ai/outputs/${convo.dbId}`, savePayload)
        : await api.post('/api/ai/outputs', savePayload);

      const updatedConvo = {
        ...convo,
        dbId: saved.id || convo.dbId,
        messages: finalMessages,
        metadata: { ...convo.metadata, name: conversationName },
      };
      setActiveConversation(updatedConvo);
      setConversations(prev => prev.map(c => c.id === convo.id ? updatedConvo : c));

      // Auto-create dashboard if the user asked for one
      if (content) tryCreateDashboardFromMessage(content).catch(() => {});
    } catch (e) {
      const msg = e?.message || '';
      // Only show the banner when there's literally no API key configured
      if (e?.code === 'MISSING_API_KEY') {
        setNoApiKey(true);
      } else {
        toast.error(msg || 'Failed to get AI response');
      }
      setMessages(updatedMessages.filter(m => m !== userMsg));
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;
    const content = input;
    const attachments = attachedFiles;
    setInput('');
    setAttachedFiles([]);
    setIsLoading(true);
    try {
      let convo = activeConversation;
      if (!convo) {
        const newId = crypto.randomUUID();
        convo = { id: newId, dbId: null, messages: [], metadata: { name: 'New Conversation', pinned: false }, created_at: new Date().toISOString() };
        setConversations(prev => [convo, ...prev]);
        setActiveConversation(convo);
      }
      await sendMessageToConvo(convo, content, attachments);
    } catch (e) {
      toast.error(e?.message || 'Failed to send message');
    } finally { setIsLoading(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleQuickAction = (prompt) => {
    setInput(prompt);
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Microphone not supported on this device/browser');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Determine supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/webm') 
          ? 'audio/webm' 
          : MediaRecorder.isTypeSupported('audio/mp4') 
            ? 'audio/mp4' 
            : 'audio/ogg';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await transcribeAudio(audioBlob);
      };
      mediaRecorder.start();
      setIsRecording(true);
      toast.success(t('recordAudio') || 'Recording... Click again to stop');
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        toast.error(t ? 'Microphone access denied. Allow mic access and try again.' : 'Microphone access denied');
      } else {
        toast.error('Could not start recording: ' + e.message);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob) => {
    setIsTranscribing(true);
    try {
      // Convert blob to base64 and send as JSON
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const audio_base64 = btoa(binary);

      const transcript = await TranscribeAudio({
        audio_base64,
        filename: 'recording.webm',
      });

      if (transcript) {
        setInput(prev => prev ? `${prev} ${transcript}` : transcript);
        toast.success('Audio transcribed!');
      } else {
        toast.error('Transcription failed');
      }
    } catch (e) {
      if (e?.code === 'MISSING_API_KEY') {
        setNoApiKey(true);
      } else {
        toast.error('Failed to transcribe audio: ' + (e?.message || ''));
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  // Sort: pinned first, then by date
  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.metadata?.pinned && !b.metadata?.pinned) return -1;
    if (!a.metadata?.pinned && b.metadata?.pinned) return 1;
    return 0;
  });

  const pinnedConvos = sortedConversations.filter(c => c.metadata?.pinned);
  const unpinnedConvos = sortedConversations.filter(c => !c.metadata?.pinned);

  const getFileIcon = (type) => {
    if (type?.startsWith('image/')) return Image;
    if (type?.startsWith('video/')) return Video;
    return File;
  };

  const ConvoItem = ({ convo }) => (
    <div
      onClick={() => loadConversation(convo)}
      className={`w-full text-left p-3 rounded-xl transition-all duration-200 group relative cursor-pointer
        ${activeConversation?.id === convo.id ? 'bg-[#38b6ff]/20 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
    >
      {editingConvoId === convo.id ? (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <Input
            value={editingConvoTitle}
            onChange={e => setEditingConvoTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveTitle(convo.id); if (e.key === 'Escape') setEditingConvoId(null); }}
            className="h-6 text-xs bg-black/30 border-white/20 text-white px-1 py-0"
            autoFocus
          />
          <button onClick={(e) => saveTitle(convo.id, e)} className="text-green-400 hover:text-green-300"><Check size={12} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2 pr-14">
          <MessageSquare size={14} className="flex-shrink-0" />
          <span className="truncate text-sm">{convo.metadata?.name || 'Conversation'}</span>
          {convo.metadata?.pinned && <Pin size={10} className="flex-shrink-0 text-[#38b6ff]" />}
        </div>
      )}
      {editingConvoId !== convo.id && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1">
          <button onClick={(e) => startEditTitle(convo, e)} className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white">
            <Edit3 size={11} />
          </button>
          <button onClick={(e) => togglePin(convo, e)} className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-[#38b6ff]">
            {convo.metadata?.pinned ? <PinOff size={11} /> : <Pin size={11} />}
          </button>
          <button onClick={(e) => deleteConversation(convo, e)} className="p-1 rounded hover:bg-red-500/10 text-gray-500 hover:text-red-400">
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );

  return (
    // Layout wraps content in `p-4 sm:p-6 pt-16 md:pt-4 pb-28 md:pb-6`.
    // Desktop: header invisible (0) + pt-4 (16px) + pb-6 (24px) = ~40px overhead → vh - 2.5rem
    // Mobile:  header h-14 (56px) + pt-16 (64px) + pb-28 (112px) + bottom nav = ~14rem → vh - 14rem
    // 100dvh handles mobile browser URL-bar collapse correctly.
    <div className="flex flex-col h-[calc(100dvh-14rem)] md:h-[calc(100dvh-2.5rem)]">
      {/* Chat ⇄ My Tasks. `?tab=tasks&task=<id>` deep-links here from the Home
          widget and from task notifications, so a notification opens the task. */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              activeTab === 'chat' ? 'bg-[#38b6ff]/20 text-[#38b6ff]' : 'text-gray-400 hover:text-white'
            }`}
          >
            <MessageSquare size={14} /> {isPt ? 'Conversa' : 'Chat'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              activeTab === 'tasks' ? 'bg-[#38b6ff]/20 text-[#38b6ff]' : 'text-gray-400 hover:text-white'
            }`}
          >
            <CheckSquare size={14} /> {isPt ? 'Minhas tarefas' : 'My Tasks'}
          </button>
        </div>

        {/* Task-table interface mode — only meaningful while chatting. */}
        {activeTab === 'chat' ? (
          <button
            type="button"
            onClick={() => setTableMode(m => !m)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              tableMode ? 'bg-[#38b6ff]/20 text-[#38b6ff]' : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
            title={isPt ? 'Inserir tarefas como tabela' : 'Enter tasks as a table'}
          >
            <Table2 size={14} /> {isPt ? 'Modo tabela' : 'Table mode'}
          </button>
        ) : null}
      </div>

      {activeTab === 'tasks' ? (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <MyTasks initialTaskId={focusTaskId} />
        </div>
      ) : (
      <>
      {tableMode ? (
        <div className="mb-3 flex-shrink-0">
          <TaskTableInput onClose={() => setTableMode(false)} />
        </div>
      ) : null}
      {noApiKey && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-500/15 border border-amber-500/30 rounded-xl mb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl">&#128273;</span>
            <div>
              <p className="text-amber-400 font-semibold text-sm">AI API Key Required</p>
              <p className="text-amber-300/70 text-xs">Add your OpenAI or Anthropic key in Settings &rarr; API Keys to enable AI features.</p>
            </div>
          </div>
          <a href="/Settings" className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30 transition-colors whitespace-nowrap">Add Key &rarr;</a>
        </div>
      )}
      <div className="flex flex-1 min-h-0 relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b]">
      {/* Sidebar — overlay on mobile, fixed-width column on desktop */}
      <div className={`
        ${showSidebar ? 'w-72 translate-x-0' : 'w-0 -translate-x-full md:w-0 md:translate-x-0'}
        transition-all duration-300 overflow-hidden border-r border-white/10 flex flex-col
        absolute md:relative top-0 bottom-0 left-0 z-20 bg-[#0d0d0d] md:bg-transparent
      `}>
        <div className="p-4 border-b border-white/10">
          <Button onClick={() => createNewConversation()} className="w-full bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
            <Plus size={18} /> New Conversation
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {pinnedConvos.length > 0 && (
            <>
              <p className="text-xs text-gray-500 px-3 py-1 font-medium uppercase tracking-wider flex items-center gap-1">
                <Pin size={10} /> Pinned
              </p>
              {pinnedConvos.map(c => <ConvoItem key={c.id} convo={c} />)}
              {unpinnedConvos.length > 0 && <div className="border-t border-white/5 my-2" />}
            </>
          )}
          {unpinnedConvos.length > 0 && (
            <>
              {pinnedConvos.length > 0 && (
                <p className="text-xs text-gray-500 px-3 py-1 font-medium uppercase tracking-wider">Recent</p>
              )}
              {unpinnedConvos.map(c => <ConvoItem key={c.id} convo={c} />)}
            </>
          )}
          {conversations.length === 0 && (
            <p className="text-gray-600 text-xs text-center py-4">No conversations yet</p>
          )}
        </div>
      </div>

      {/* Sidebar backdrop on mobile when open */}
      {showSidebar && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-10" onClick={() => setShowSidebar(false)} />
      )}

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="p-3 md:p-4 border-b border-white/10 bg-[#0d0d0d] flex items-center gap-2 md:gap-4">
          <button onClick={() => setShowSidebar(!showSidebar)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 shrink-0">
            <ChevronLeft size={20} className={`transform transition-transform ${!showSidebar ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-[#3572b9] to-[#cb6ce6] flex items-center justify-center shrink-0">
              <Bot size={20} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base md:text-lg font-bold text-white truncate">AI Sales & Marketing Agent</h1>
              <p className="text-xs md:text-sm text-gray-400 truncate hidden sm:block">Full platform access · {t('intelligentProspecting')}</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div className="px-2 md:px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> <span className="hidden sm:inline">Online</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#3572b9]/20 to-[#cb6ce6]/20 flex items-center justify-center mb-6">
                <Sparkles size={36} className="text-[#38b6ff]" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">BMAPZ Sales & Marketing Agent</h2>
              <p className="text-gray-400 text-center max-w-lg mb-2">
                I have full access to every section of the platform — leads, workflows, social media, ads, blog, SEO, settings, integrations, and dashboards.
              </p>
              {conversations.length === 0 && user ? (
                <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#3572b9]/10 to-[#cb6ce6]/10 border border-[#38b6ff]/20 max-w-md text-center">
                  <p className="text-white text-lg font-semibold mb-1">Hey {user?.full_name?.split(' ')[0] || 'there'}! 👋</p>
                  <p className="text-gray-300 text-sm">Don't know where to start? Ask me anything! How to use this platform, for example. 😉</p>
                </div>
              ) : (
                <p className="text-[#38b6ff] text-sm text-center mb-8">Just tell me what you need. I'll do it.</p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-3xl">
                {QUICK_ACTIONS.map((action, i) => (
                  <button key={i} onClick={() => handleQuickAction(action.prompt)}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-[#38b6ff]/30 hover:bg-white/10 transition-all duration-200 text-left">
                    <span className="text-white text-sm font-medium">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i}>
                  <MessageBubble message={msg} />
                  {/* Approval sits with the message that proposed it, so the user
                      can read the reply and the exact change list together. */}
                  {/* Shown while a proposal is pending AND afterwards as the
                      receipt — approving clears proposed_actions so the card can
                      never be fired twice, but the outcome must stay visible. */}
                  {msg.proposed_actions?.length || msg.action_result?.length || msg.action_declined ? (
                    <div className="pl-11">
                      <ActionApproval
                        preview={msg.action_preview}
                        actions={msg.proposed_actions || []}
                        isApplying={applyingIndex === i}
                        result={msg.action_result}
                        declined={!!msg.action_declined}
                        onApprove={(actions) => approveActions(i, actions)}
                        onDecline={() => declineActions(i)}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3572b9] to-[#cb6ce6] flex items-center justify-center">
                    <Bot size={16} className="text-white" />
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 size={16} className="animate-spin" /> Thinking...
                  </div>
                </div>
              )}
              {/* Contextual Suggestions */}
              {contextualSuggestions.length > 0 && !isLoading && (
                <div className="flex flex-wrap gap-2 pl-11">
                  {contextualSuggestions.map((s, i) => (
                    <button key={i} onClick={() => setInput(s)}
                      className="px-3 py-1.5 rounded-full bg-[#38b6ff]/10 border border-[#38b6ff]/20 text-[#38b6ff] text-xs hover:bg-[#38b6ff]/20 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="p-3 md:p-4 border-t border-white/10 bg-[#0d0d0d]">
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachedFiles.map((file, i) => {
                const FileIcon = getFileIcon(file.type);
                const isImg = file.type?.startsWith('image/');
                return (
                  <div key={i} className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                    {isImg ? <img src={file.url} alt={file.name} className="w-8 h-8 rounded object-cover" /> : <FileIcon size={18} className="text-[#38b6ff]" />}
                    <span className="text-sm text-white max-w-[120px] truncate">{file.name}</span>
                    <button onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))} className="ml-1 p-0.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"><X size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-end gap-2 md:gap-3">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,.csv,.vtt,.txt,.srt" multiple className="hidden" />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingFiles}
              className="h-[52px] px-3 md:px-4 border-white/10 text-gray-400 hover:text-white hover:bg-white/5 shrink-0">
              {uploadingFiles ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
              title={isRecording ? 'Stop recording' : 'Record audio'}
              className={`h-[52px] px-3 md:px-4 border-white/10 hover:bg-white/5 transition-colors shrink-0 ${isRecording ? 'text-red-400 border-red-400/40 animate-pulse' : 'text-gray-400 hover:text-white'}`}
            >
              {isTranscribing ? <Loader2 size={20} className="animate-spin" /> : isRecording ? <MicOff size={20} /> : <Mic size={20} />}
            </Button>
            <div className="flex-1 relative min-w-0">
              <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Ask me anything…"
                className="min-h-[52px] max-h-[200px] resize-none bg-white/5 border-white/10 text-white placeholder:text-gray-500 pr-12 focus:border-[#38b6ff]/50 text-sm md:text-base"
                rows={1} />
            </div>
            <Button onClick={sendMessage} disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
              className="h-[52px] px-3 md:px-6 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] hover:opacity-90 disabled:opacity-50 gap-2 shrink-0">
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              <span className="hidden md:inline">{t('send')}</span>
            </Button>
          </div>
        </div>
      </div>
      </div>
      </>
      )}
    </div>
  );
}
