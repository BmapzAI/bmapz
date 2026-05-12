import { api } from '@/api/apiClient';
import { InvokeLLM } from '@/api/integrations';
import React, { useState, useEffect, useRef, useMemo } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Mail, MessageSquare, Linkedin, RefreshCw, Send, Search,
  ChevronRight, Inbox as InboxIcon, Sparkles, AlertCircle,
  ThumbsUp, ThumbsDown, Minus, Clock, User, ArrowLeft, Instagram
} from 'lucide-react';
import { Company, Message } from '@/api/entities';

const CHANNEL_CONFIG = {
  email:     { label: 'Email',     icon: Mail,          color: '#38b6ff', bg: 'bg-[#38b6ff]/10',  border: 'border-[#38b6ff]/30'  },
  whatsapp:  { label: 'WhatsApp',  icon: MessageSquare, color: '#25d366', bg: 'bg-[#25d366]/10',  border: 'border-[#25d366]/30'  },
  linkedin:  { label: 'LinkedIn',  icon: Linkedin,      color: '#0a66c2', bg: 'bg-[#0a66c2]/10',  border: 'border-[#0a66c2]/30'  },
  instagram: { label: 'Instagram', icon: Instagram,     color: '#e1306c', bg: 'bg-[#e1306c]/10',  border: 'border-[#e1306c]/30'  },
};

const SENTIMENT_CONFIG = {
  positive: { icon: ThumbsUp,   color: 'text-green-400', bg: 'bg-green-500/10',   label: 'Positive'  },
  neutral:  { icon: Minus,      color: 'text-gray-400',  bg: 'bg-gray-500/10',    label: 'Neutral'   },
  negative: { icon: ThumbsDown, color: 'text-red-400',   bg: 'bg-red-500/10',     label: 'Negative'  },
};

const INTENT_COLORS = {
  interested:       'bg-green-500/20 text-green-400',
  meeting_request:  'bg-[#38b6ff]/20 text-[#38b6ff]',
  question:         'bg-yellow-500/20 text-yellow-400',
  objection:        'bg-orange-500/20 text-orange-400',
  not_interested:   'bg-red-500/20 text-red-400',
  unsubscribe:      'bg-red-600/20 text-red-500',
  other:            'bg-gray-500/20 text-gray-400',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

function MessageThread({ messages, lead, onReply, isSending }) {
  const [replyText, setReplyText] = useState('');
  const [generating, setGenerating] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!replyText.trim()) return;
    onReply(replyText);
    setReplyText('');
  };

  const generateAIReply = async () => {
    const lastInbound = [...messages].reverse().find(m => m.direction === 'inbound');
    if (!lastInbound) { toast.error('No inbound message to reply to'); return; }
    setGenerating(true);
    try {
      const companies = await Company.list();
      const company = companies[0];
      const res = await InvokeLLM({
        prompt: `Write a professional, concise reply to this message in the same language as the message.
Context: You are a sales/marketing professional at "${company?.name || 'the company'}".
Services: ${company?.services_description || ''}
Lead name: ${lead?.lead_name || lead?.lead_company_name || 'the prospect'}
Their message: "${lastInbound.content}"
Their sentiment: ${lastInbound.metadata?.sentiment || 'neutral'}, intent: ${lastInbound.metadata?.intent || 'other'}
Reply goal: ${lastInbound.metadata?.intent === 'interested' || lastInbound.metadata?.intent === 'meeting_request' ? 'schedule a call/meeting' : 'keep the conversation warm and address their concern'}
Return JSON: { reply: string }`,
        response_json_schema: { type: 'object', properties: { reply: { type: 'string' } } }
      });
      if (res?.reply) setReplyText(res.reply);
      toast.success('AI reply generated!');
    } catch {
      toast.error('Failed to generate reply');
    } finally {
      setGenerating(false);
    }
  };

  const channel = messages[0]?.channel || 'email';
  const cfg = CHANNEL_CONFIG[channel] || CHANNEL_CONFIG.email;
  const Icon = cfg.icon;

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className={`flex items-center gap-3 p-4 border-b border-white/10 ${cfg.bg}`}>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${cfg.border}`}>
          <Icon size={16} style={{ color: cfg.color }} />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">{lead?.lead_name || lead?.lead_company_name || 'Unknown Lead'}</p>
          <p className="text-gray-400 text-xs">{lead?.lead_company_name} · {cfg.label}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isInbound = msg.direction === 'inbound';
          const sentiment = SENTIMENT_CONFIG[msg.metadata?.sentiment] || SENTIMENT_CONFIG.neutral;
          const SentIcon = sentiment.icon;
          return (
            <div key={msg.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[75%] ${isInbound ? '' : 'items-end'} flex flex-col gap-1`}>
                {isInbound && msg.metadata?.ai_summary && (
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] w-fit ${sentiment.bg} ${sentiment.color}`}>
                    <SentIcon size={9} />
                    <span>{sentiment.label}</span>
                    {msg.metadata?.intent && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${INTENT_COLORS[msg.metadata.intent] || INTENT_COLORS.other}`}>
                        {msg.metadata.intent.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                )}
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                  ${isInbound
                    ? 'bg-white/8 text-white border border-white/10 rounded-tl-sm'
                    : 'bg-[#3572b9] text-white rounded-tr-sm'}`}>
                  {msg.metadata?.subject && isInbound && (
                    <p className="text-[10px] text-gray-400 mb-1 font-medium">{msg.metadata.subject}</p>
                  )}
                  {msg.content}
                </div>
                <p className="text-[10px] text-gray-500 px-1">{formatDate(msg.sent_at || msg.created_date)}</p>
                {isInbound && msg.metadata?.ai_summary && (
                  <p className="text-[10px] text-gray-500 italic px-1">AI: {msg.metadata.ai_summary}</p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      <div className="p-4 border-t border-white/10 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-gray-400 text-xs">Reply via {cfg.label}</p>
          <Button size="sm" onClick={generateAIReply} disabled={generating}
            className="h-6 px-2 text-[10px] bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-1">
            {generating
              ? <div className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" />
              : <Sparkles size={9} />}
            AI Write
          </Button>
        </div>
        <Textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder={`Write your ${cfg.label} reply...`}
          className="min-h-[80px] bg-white/5 border-white/10 text-white text-sm resize-none"
          onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleSend(); }}
        />
        <div className="flex justify-between items-center">
          <p className="text-gray-600 text-[10px]">Ctrl+Enter to send</p>
          <Button onClick={handleSend} disabled={!replyText.trim() || isSending} size="sm"
            className="gap-1.5 bg-[#3572b9] hover:bg-[#3572b9]/80">
            {isSending
              ? <div className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" />
              : <Send size={12} />}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Inbox() {
  const queryClient = useQueryClient();
  const [channelFilter, setChannelFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedConvKey, setSelectedConvKey] = useState(null);

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => Company.list() });
  const company = companies[0];

  // Load all inbound messages grouped by lead
  const { data: allMessages = [], isLoading, refetch } = useQuery({
    queryKey: ['inbox_messages', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      return Message.filter({ company_id: company.id });
    },
    enabled: !!company?.id,
    refetchInterval: 30000, // poll every 30s for new messages
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads_for_inbox', company?.id],
    queryFn: () => company?.id ? Lead.filter({ company_id: company.id }) : [],
    enabled: !!company?.id,
  });

  const leadsById = Object.fromEntries(leads.map(l => [l.id, l]));

  // Group messages by lead + channel, sorted by most recent
  // Unmatched messages (no lead_id) are grouped by sender id
  const conversations = React.useMemo(() => {
    const groups = {};
    for (const msg of allMessages) {
      const key = msg.lead_id
        ? `${msg.lead_id}::${msg.channel}`
        : `unmatched::${msg.channel}::${msg.metadata?.ig_sender_id || msg.metadata?.from_phone || msg.id}`;
      if (!groups[key]) {
        groups[key] = { lead_id: msg.lead_id || null, channel: msg.channel, messages: [], last_message: null, has_unread: false, unmatched: !msg.lead_id, sender_name: msg.metadata?.ig_sender_name || msg.metadata?.from_name || 'Unknown sender' };
      }
      groups[key].messages.push(msg);
      const msgDate = new Date(msg.sent_at || msg.created_date);
      if (!groups[key].last_message || msgDate > new Date(groups[key].last_message.sent_at || groups[key].last_message.created_date)) {
        groups[key].last_message = msg;
      }
      if (msg.direction === 'inbound' && msg.metadata?.sentiment) {
        groups[key].has_unread = true;
      }
    }

    return Object.values(groups)
      .sort((a, b) => new Date(b.last_message?.sent_at || b.last_message?.created_date) - new Date(a.last_message?.sent_at || a.last_message?.created_date));
  }, [allMessages]);

  const filteredConversations = conversations.filter(c => {
    if (channelFilter !== 'all' && c.channel !== channelFilter) return false;
    if (search) {
      const lead = leadsById[c.lead_id];
      const name = `${lead?.lead_name || ''} ${lead?.lead_company_name || ''} ${c.sender_name || ''}`.toLowerCase();
      if (!name.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const selectedConv = selectedConvKey
    ? conversations.find(c => {
        const key = c.lead_id
          ? `${c.lead_id}::${c.channel}`
          : `unmatched::${c.channel}::${c.last_message?.metadata?.ig_sender_id || c.last_message?.metadata?.from_phone || ''}`;
        return key === selectedConvKey;
      })
    : null;

  const selectedLeadObj = selectedConv?.lead_id ? leadsById[selectedConv.lead_id] : null;

  const getConvKey = (c) => c.lead_id
    ? `${c.lead_id}::${c.channel}`
    : `unmatched::${c.channel}::${c.last_message?.metadata?.ig_sender_id || c.last_message?.metadata?.from_phone || ''}`;

  const threadMessages = selectedConv
    ? [...selectedConv.messages].sort((a, b) => new Date(a.sent_at || a.created_date) - new Date(b.sent_at || b.created_date))
    : [];

  const syncInbox = async (channel = null) => {
    setSyncing(true);
    try {
      const payload = { sync_to_crm: true, limit: 30 };
      if (channel && channel !== 'all') payload.channel = channel;
      const res = await api.get('/api/messaging', payload);
      const d = res?.data || {};

      // Surface per-channel errors
      if (d.email_error) toast.warning(`Email: ${d.email_error}`);
      if (d.instagram_error) toast.warning(`Instagram: ${d.instagram_error}`);

      if (!d.email_error && !d.instagram_error) {
        toast.success(`Inbox synced! ${d.synced || 0} new messages imported.`);
      } else if (d.synced > 0) {
        toast.success(`${d.synced} new messages imported.`);
      }

      queryClient.invalidateQueries({ queryKey: ['inbox_messages'] });
    } catch (e) {
      toast.error('Sync failed: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  // Auto-sync on mount
  useEffect(() => {
    if (company?.id) syncInbox(null);
  }, [company?.id]);

  const handleReply = async (replyContent) => {
    if (!selectedConv?.last_message) return;
    setIsSending(true);
    try {
      const lastInbound = threadMessages.slice().reverse().find(m => m.direction === 'inbound');
      const targetMsg = lastInbound || selectedConv.last_message;
      await api.post('/api/email/send', {
        message_id: targetMsg.id,
        reply_content: replyContent,
      });
      toast.success('Reply sent!');
      queryClient.invalidateQueries({ queryKey: ['inbox_messages'] });
    } catch (e) {
      toast.error('Failed to send reply: ' + e.message);
    } finally {
      setIsSending(false);
    }
  };

  const hasInbound = (conv) => conv.messages.some(m => m.direction === 'inbound');
  const inboundCount = conversations.filter(hasInbound).length;

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            Inbox
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Unified inbox — Email, WhatsApp, LinkedIn & Instagram DMs with AI sentiment analysis
          </p>
        </div>
        <Button onClick={(e) => { e.preventDefault(); syncInbox(channelFilter); }} disabled={syncing} variant="outline" className="gap-2 border-white/10">
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : channelFilter === 'all' ? 'Sync All' : `Sync ${CHANNEL_CONFIG[channelFilter]?.label || channelFilter}`}
        </Button>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 gap-0 rounded-2xl overflow-hidden border border-white/10 bg-[#0f0f0f] min-h-0">
        {/* Conversation list */}
        <div className={`flex flex-col border-r border-white/10 ${selectedConv ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] flex-shrink-0`}>
          {/* Filter bar */}
          <div className="p-3 border-b border-white/10 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..." className="pl-8 bg-white/5 border-white/10 text-white text-sm h-8" />
            </div>
            <div className="flex gap-1">
              {['all', 'email', 'whatsapp', 'linkedin', 'instagram'].map(ch => (
                <button key={ch} onClick={() => setChannelFilter(ch)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize
                    ${channelFilter === ch ? 'bg-[#38b6ff]/20 text-[#38b6ff] border border-[#38b6ff]/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                  {ch === 'all' ? `All (${inboundCount})` : ch}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 rounded-full border-2 border-[#38b6ff] border-t-transparent animate-spin" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                <InboxIcon size={32} className="text-gray-600 mb-3" />
                <p className="text-gray-400 text-sm font-medium">No conversations yet</p>
                <p className="text-gray-600 text-xs mt-1">Send messages to leads and their replies will appear here</p>
                <Button onClick={() => syncInbox(channelFilter)} size="sm" variant="outline" className="mt-3 border-white/10 text-gray-300 gap-1.5 text-xs">
                  <RefreshCw size={12} /> {channelFilter === 'all' ? 'Sync Inbox' : `Sync ${CHANNEL_CONFIG[channelFilter]?.label || channelFilter}`}
                </Button>
              </div>
            ) : (
              filteredConversations.map(conv => {
                const lead = conv.lead_id ? leadsById[conv.lead_id] : null;
                const cfg = CHANNEL_CONFIG[conv.channel] || CHANNEL_CONFIG.email;
                const ChIcon = cfg.icon;
                const convKey = getConvKey(conv);
                const isSelected = selectedConvKey === convKey;
                const inbound = conv.messages.filter(m => m.direction === 'inbound');
                const lastInbound = inbound[inbound.length - 1];
                const sentiment = lastInbound?.metadata?.sentiment;
                const sentCfg = SENTIMENT_CONFIG[sentiment];
                const displayName = lead?.lead_name || lead?.lead_company_name || conv.sender_name || 'Unknown sender';

                return (
                  <button key={convKey}
                    onClick={() => setSelectedConvKey(convKey)}
                    className={`w-full text-left p-3 border-b border-white/5 hover:bg-white/5 transition-all
                      ${isSelected ? 'bg-[#38b6ff]/8 border-l-2 border-l-[#38b6ff]' : ''}`}>
                    <div className="flex items-start gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${cfg.border} ${cfg.bg}`}>
                        <ChIcon size={14} style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-white text-xs font-semibold truncate">{displayName}</p>
                          <span className="text-[10px] text-gray-500 flex-shrink-0">
                            {formatDate(conv.last_message?.sent_at || conv.last_message?.created_date)}
                          </span>
                        </div>
                        <p className="text-gray-500 text-[10px] truncate">
                          {lead?.lead_company_name || (conv.unmatched ? <span className="text-yellow-500/70">Unmatched — no lead linked</span> : '')}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {sentCfg && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 ${sentCfg.bg} ${sentCfg.color}`}>
                              <sentCfg.icon size={8} />
                              {sentCfg.label}
                            </span>
                          )}
                          {lastInbound?.metadata?.intent && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${INTENT_COLORS[lastInbound.metadata.intent] || INTENT_COLORS.other}`}>
                              {lastInbound.metadata.intent.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-[11px] mt-1 line-clamp-1">{conv.last_message?.content}</p>
                      </div>
                      {inbound.length > 0 && (
                        <div className="flex-shrink-0">
                          <span className="w-5 h-5 rounded-full bg-[#38b6ff] text-white text-[10px] font-bold flex items-center justify-center">
                            {inbound.length}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Thread view */}
        <div className={`flex-1 flex flex-col ${selectedConv ? 'flex' : 'hidden md:flex'}`}>
          {selectedConv ? (
            <>
              {/* Mobile back button */}
              <div className="md:hidden p-2 border-b border-white/10">
                <Button variant="ghost" size="sm" onClick={() => setSelectedConvKey(null)}
                  className="gap-1 text-gray-400 text-xs">
                  <ArrowLeft size={12} /> Back
                </Button>
              </div>
              {selectedConv.unmatched && (
                <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-2">
                  <AlertCircle size={13} className="text-yellow-400 flex-shrink-0" />
                  <p className="text-yellow-400 text-xs">This sender is not linked to any lead. Add them as a lead to enable replies and full tracking.</p>
                </div>
              )}
              <MessageThread
                messages={threadMessages}
                lead={selectedLeadObj || { lead_name: selectedConv.sender_name, lead_company_name: selectedConv.channel }}
                onReply={handleReply}
                isSending={isSending}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                <InboxIcon size={28} className="text-gray-500" />
              </div>
              <p className="text-gray-300 font-medium mb-2">Select a conversation</p>
              <p className="text-gray-500 text-sm max-w-xs">
                Click any conversation from the list to view messages and reply directly from here.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3 w-full max-w-sm">
                {Object.entries(CHANNEL_CONFIG).map(([ch, cfg]) => {
                  const Icon = cfg.icon;
                  const count = conversations.filter(c => c.channel === ch).length;
                  return (
                    <div key={ch} className={`p-3 rounded-xl border text-center ${cfg.bg} ${cfg.border}`}>
                      <Icon size={20} style={{ color: cfg.color }} className="mx-auto mb-1" />
                      <p style={{ color: cfg.color }} className="text-xs font-semibold">{cfg.label}</p>
                      <p className="text-gray-400 text-xs">{count} conv.</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}