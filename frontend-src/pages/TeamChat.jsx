import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  MessageSquare, Send, Plus, Search, Paperclip, Loader2, Users2,
  BellOff, Bell, ExternalLink, X, AlertCircle, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/apiClient';
import { User } from '@/api/entities';
import MentionTextarea from '@/components/mentions/MentionTextarea';
import { useAuth } from '@/lib/AuthContext';

/**
 * Internal team chat.
 *
 * People in the same company talk here, and can attach any item in the app —
 * a lead, report, draft, campaign, automation, SDR configuration, saved AI work —
 * as a clickable reference. Every message notifies the other members.
 *
 * This is staff-only: nothing typed here reaches a client.
 */
export default function TeamChat() {
  const { isPt } = useLanguage();
  const { dbUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeId, setActiveId] = useState(() => new URLSearchParams(window.location.search).get('c') || null);
  const [draft, setDraft] = useState('');
  const [pendingShare, setPendingShare] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const endRef = useRef(null);

  const { data: conversations = [], error: convError, isLoading } = useQuery({
    queryKey: ['teamConversations'],
    queryFn: () => api.get('/api/team-chat/conversations'),
    refetchInterval: 20_000,          // light polling keeps threads current
    retry: false,
  });

  const active = conversations.find(c => c.id === activeId) || null;

  const { data: messages = [] } = useQuery({
    queryKey: ['teamMessages', activeId],
    queryFn: () => api.get(`/api/team-chat/conversations/${activeId}/messages`),
    enabled: !!activeId,
    refetchInterval: 12_000,
    retry: false,
  });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, activeId]);

  // Opening a thread clears its badge.
  useEffect(() => {
    if (!activeId) return;
    api.post(`/api/team-chat/conversations/${activeId}/read`)
      .then(() => queryClient.invalidateQueries({ queryKey: ['teamConversations'] }))
      .catch(() => {});
  }, [activeId, messages.length, queryClient]);

  const send = useMutation({
    mutationFn: () => api.post(`/api/team-chat/conversations/${activeId}/messages`, {
      body: draft.trim() || undefined,
      shared_ref: pendingShare || undefined,
    }),
    onSuccess: () => {
      setDraft(''); setPendingShare(null);
      queryClient.invalidateQueries({ queryKey: ['teamMessages', activeId] });
      queryClient.invalidateQueries({ queryKey: ['teamConversations'] });
    },
    onError: (e) => toast.error(`${isPt ? 'Falha ao enviar: ' : 'Could not send: '}${e.message}`),
  });

  const toggleMute = useMutation({
    mutationFn: () => api.patch(`/api/team-chat/conversations/${activeId}`, { muted: !active?.muted }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teamConversations'] }),
  });

  if (convError) {
    const pending = convError.code === 'MIGRATION_PENDING' || convError.message?.includes('migration 017');
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-10 text-center">
        <AlertCircle size={28} className="text-yellow-400 mx-auto mb-3" />
        <p className="text-white font-medium">{pending ? (isPt ? 'Quase pronto' : 'Almost ready') : (isPt ? 'Não foi possível carregar' : 'Could not load team chat')}</p>
        <p className="text-gray-400 text-sm mt-1 max-w-md mx-auto">
          {pending
            ? (isPt ? 'As tabelas do chat interno ainda precisam ser criadas. Rode a migração 017 no Supabase.' : 'The team chat tables still need to be created. Run migration 017 in Supabase and this switches on.')
            : convError.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            {isPt ? 'Chat da Equipe' : 'Team Chat'}
          </h1>
          <p className="text-gray-400 mt-1">
            {isPt
              ? 'Converse com sua equipe e compartilhe leads, relatórios, rascunhos e configurações — nada aqui vai para clientes.'
              : 'Talk to your team and share leads, reports, drafts and settings — nothing here reaches a client.'}
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
          <Plus size={16} /> {isPt ? 'Nova conversa' : 'New conversation'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        {/* Threads */}
        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#38b6ff]" /></div>
          ) : conversations.length === 0 ? (
            <p className="text-gray-500 text-xs text-center py-10 px-4">
              {isPt ? 'Nenhuma conversa ainda. Comece uma com um colega.' : 'No conversations yet. Start one with a teammate.'}
            </p>
          ) : conversations.map(c => (
            <button key={c.id} onClick={() => setActiveId(c.id)}
              className={`w-full text-left p-3 border-b border-white/5 transition-colors ${
                activeId === c.id ? 'bg-[#38b6ff]/10' : 'hover:bg-white/5'}`}>
              <div className="flex items-center gap-2">
                {c.kind === 'group'
                  ? <Users2 size={14} className="text-[#cb6ce6] flex-shrink-0" />
                  : <MessageSquare size={14} className="text-[#38b6ff] flex-shrink-0" />}
                <span className="text-white text-sm truncate flex-1">{c.display_title}</span>
                {c.unread > 0 && (
                  <span className="text-[10px] bg-[#38b6ff] text-white rounded-full px-1.5 py-0.5 flex-shrink-0">
                    {c.unread > 9 ? '9+' : c.unread}
                  </span>
                )}
              </div>
              {c.last_message_preview && (
                <p className="text-gray-500 text-[11px] truncate mt-0.5 pl-6">{c.last_message_preview}</p>
              )}
            </button>
          ))}
        </div>

        {/* Thread */}
        <div className="rounded-2xl bg-white/5 border border-white/10 flex flex-col h-[70vh]">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              {isPt ? 'Escolha uma conversa' : 'Pick a conversation'}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{active.display_title}</p>
                  <p className="text-gray-500 text-[11px] truncate">
                    {active.members?.map(m => m.full_name || m.email).join(', ')}
                  </p>
                </div>
                <button onClick={() => toggleMute.mutate()} title={active.muted ? 'Unmute' : 'Mute notifications'}
                  className="text-gray-500 hover:text-white p-1.5">
                  {active.muted ? <BellOff size={15} /> : <Bell size={15} />}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(m => {
                  const mine = m.sender_id === dbUser?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] ${mine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                        {!mine && (
                          <span className="text-gray-500 text-[10px] px-1">
                            {m.sender?.full_name || m.sender?.email}
                          </span>
                        )}
                        {m.body && (
                          <div className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                            mine ? 'bg-gradient-to-r from-[#3572b9] to-[#38b6ff] text-white rounded-br-sm'
                              : 'bg-white/8 text-gray-100 rounded-bl-sm'}`}>
                            {m.body}
                          </div>
                        )}
                        {/* A shared item opens exactly where it lives */}
                        {m.shared_ref && (
                          <button onClick={() => m.shared_ref.path && navigate(m.shared_ref.path)}
                            className="text-left p-2.5 rounded-xl bg-black/30 border border-[#38b6ff]/30 hover:border-[#38b6ff]/60 transition-colors max-w-full">
                            <p className="text-[10px] text-[#38b6ff] uppercase tracking-wide flex items-center gap-1">
                              <Paperclip size={9} /> {m.shared_ref.kind || 'item'}
                            </p>
                            <p className="text-white text-xs truncate">{m.shared_ref.title}</p>
                            {m.shared_ref.subtitle && <p className="text-gray-500 text-[10px] truncate">{m.shared_ref.subtitle}</p>}
                            {m.shared_ref.path && (
                              <span className="text-[#38b6ff] text-[10px] inline-flex items-center gap-1 mt-1">
                                {isPt ? 'Abrir' : 'Open'} <ExternalLink size={9} />
                              </span>
                            )}
                          </button>
                        )}
                        <span className="text-gray-600 text-[10px] px-1">
                          {new Date(m.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {/* Composer */}
              <div className="border-t border-white/10 p-3 space-y-2">
                {pendingShare && (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-[#38b6ff]/10 border border-[#38b6ff]/30">
                    <Paperclip size={12} className="text-[#38b6ff] flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-xs truncate">{pendingShare.title}</p>
                      <p className="text-gray-500 text-[10px] truncate">{pendingShare.kind}</p>
                    </div>
                    <button onClick={() => setPendingShare(null)} className="text-gray-500 hover:text-red-400">
                      <X size={13} />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setShowShare(true)} title={isPt ? 'Compartilhar algo do app' : 'Share something from the app'}
                    className="px-2.5 rounded-xl bg-black/30 border border-white/10 text-gray-400 hover:text-[#38b6ff] hover:border-[#38b6ff]/40">
                    <Paperclip size={15} />
                  </button>
                  {/* singleLine keeps this an Input, so Enter still sends — the
                      mention list intercepts Enter only while it is open. */}
                  <MentionTextarea
                    singleLine
                    value={draft}
                    onChange={setDraft}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (draft.trim() || pendingShare) send.mutate(); } }}
                    placeholder={isPt ? 'Escreva para a equipe — use @ para mencionar…' : 'Message your team — use @ to mention…'}
                    className="bg-black/30 border-white/10 text-white text-sm"
                  />
                  <Button onClick={() => send.mutate()} disabled={send.isPending || (!draft.trim() && !pendingShare)}
                    className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]">
                    {send.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <NewConversationDialog open={showNew} onClose={() => setShowNew(false)}
        onCreated={(c) => { setActiveId(c.id); queryClient.invalidateQueries({ queryKey: ['teamConversations'] }); }} />

      <SharePickerDialog open={showShare} onClose={() => setShowShare(false)}
        onPick={(item) => { setPendingShare(item); setShowShare(false); }} />
    </div>
  );
}

/* ───────────────── Start a conversation ───────────────── */

function NewConversationDialog({ open, onClose, onCreated }) {
  const { isPt } = useLanguage();
  const { dbUser } = useAuth();
  const [selected, setSelected] = useState([]);
  const [title, setTitle] = useState('');

  const { data: users = [] } = useQuery({
    queryKey: ['companyUsers'],
    queryFn: () => User.list(),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () => api.post('/api/team-chat/conversations', {
      user_ids: selected,
      title: selected.length > 1 ? (title || undefined) : undefined,
    }),
    onSuccess: (c) => { onCreated(c); setSelected([]); setTitle(''); onClose(); },
    onError: (e) => toast.error(`${isPt ? 'Falha: ' : 'Failed: '}${e.message}`),
  });

  const others = users.filter(u => u.id !== dbUser?.id);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-[#111] border-white/10 text-white">
        <DialogHeader><DialogTitle>{isPt ? 'Nova conversa' : 'New conversation'}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-gray-400 text-xs">
            {isPt ? 'Escolha uma pessoa para uma conversa direta, ou várias para um grupo.' : 'Pick one person for a direct message, or several for a group.'}
          </p>
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {others.length === 0 && (
              <p className="text-gray-500 text-xs py-4 text-center">
                {isPt ? 'Ninguém mais na empresa ainda. Convide colegas em Configurações.' : 'Nobody else in the company yet. Invite teammates in Settings.'}
              </p>
            )}
            {others.map(u => {
              const on = selected.includes(u.id);
              return (
                <button key={u.id} onClick={() => setSelected(s => on ? s.filter(x => x !== u.id) : [...s, u.id])}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors ${
                    on ? 'bg-[#38b6ff]/15 border-[#38b6ff]/40' : 'bg-black/20 border-white/10 hover:border-white/25'}`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    on ? 'bg-[#38b6ff] border-[#38b6ff]' : 'border-white/30'}`}>
                    {on && <Check size={11} className="text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">{u.full_name || u.email}</p>
                    <p className="text-gray-500 text-[11px] truncate capitalize">{String(u.role || 'user').replace(/_/g, ' ')}</p>
                  </div>
                </button>
              );
            })}
          </div>
          {selected.length > 1 && (
            <Input value={title} onChange={e => setTitle(e.target.value)}
              placeholder={isPt ? 'Nome do grupo (opcional)' : 'Group name (optional)'}
              className="bg-black/30 border-white/10 text-white text-sm" />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} className="border-white/10 text-white">{isPt ? 'Cancelar' : 'Cancel'}</Button>
            <Button onClick={() => create.mutate()} disabled={!selected.length || create.isPending}
              className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
              {create.isPending && <Loader2 size={14} className="animate-spin" />}
              {isPt ? 'Começar' : 'Start'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────── Share anything from the app ───────────────── */

function SharePickerDialog({ open, onClose, onPick }) {
  const { isPt } = useLanguage();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);

  // Reuses the global search, so anything findable is shareable.
  const { data, isFetching } = useQuery({
    queryKey: ['shareSearch', debounced],
    queryFn: () => api.get('/api/search', { q: debounced }),
    enabled: open && debounced.length >= 2,
  });

  const groups = (data?.groups || []).filter(g => g.key !== 'pages');
  const pages = (data?.groups || []).find(g => g.key === 'pages');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg bg-[#111] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Paperclip size={16} className="text-[#38b6ff]" />
            {isPt ? 'Compartilhar com a equipe' : 'Share with your team'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-gray-400 text-xs">
            {isPt
              ? 'Busque qualquer coisa do app — leads, relatórios, rascunhos, campanhas, automações, configurações — e anexe à conversa.'
              : 'Find anything in the app — leads, reports, drafts, campaigns, automations, settings — and attach it to the conversation.'}
          </p>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <Input value={q} onChange={e => setQ(e.target.value)} autoFocus
              placeholder={isPt ? 'Buscar para compartilhar…' : 'Search to share…'}
              className="pl-9 bg-black/30 border-white/10 text-white text-sm" />
            {isFetching && <Loader2 size={13} className="animate-spin text-[#38b6ff] absolute right-3 top-1/2 -translate-y-1/2" />}
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2">
            {debounced.length >= 2 && groups.length === 0 && !isFetching && (
              <p className="text-gray-500 text-xs text-center py-6">
                {isPt ? 'Nada encontrado.' : 'Nothing found.'}
              </p>
            )}
            {groups.map(g => (
              <div key={g.key}>
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider px-1 py-1">{g.label}</p>
                {g.items.map(item => (
                  <button key={`${g.key}-${item.id}`}
                    onClick={() => onPick({ kind: g.label, id: item.id, title: item.title, subtitle: item.subtitle, path: item.path })}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10">
                    <p className="text-white text-xs truncate">{item.title}</p>
                    {item.subtitle && <p className="text-gray-500 text-[11px] truncate">{item.subtitle}</p>}
                  </button>
                ))}
              </div>
            ))}
            {/* Screens can be shared too — useful for "go set this up here" */}
            {pages?.items?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider px-1 py-1">
                  {isPt ? 'Telas & configurações' : 'Screens & settings'}
                </p>
                {pages.items.map(item => (
                  <button key={item.id}
                    onClick={() => onPick({ kind: 'screen', id: item.id, title: item.title, subtitle: item.subtitle, path: item.path })}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10">
                    <p className="text-white text-xs truncate">{item.title}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
