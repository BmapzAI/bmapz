import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/components/ui/LanguageContext';
import { LifeBuoy, X, Send, Loader2, Minus, Sparkles } from 'lucide-react';
import { api } from '@/api/apiClient';

/**
 * The always-available support assistant.
 *
 * Sits as a bubble in the bottom-right corner of every screen and toggles open
 * into a small chat panel. This is the HELP agent: it can read the account to
 * diagnose problems and point at the right screen, but it can never create or
 * edit anything — those permissions belong to the Company Brain agent and the
 * SDR agent.
 */
export default function SupportAssistant() {
  const { isPt } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const greeting = isPt
    ? 'Oi! Sou o assistente de suporte do Bmapz. Posso explicar como usar o app, verificar sua conta e te levar até a tela certa. Não consigo criar nem editar nada — mas te mostro exatamente como fazer.'
    : "Hi! I'm the Bmapz support assistant. I can explain how the app works, check your account, and take you to the right screen. I can't create or edit anything myself — but I'll show you exactly how.";

  const SUGGESTIONS = isPt
    ? ['Por que meu post não salva?', 'Como ativo o SDR?', 'Verifique minha conta', 'Como crio um fluxo?']
    : ['Why is my post not saving?', 'How do I turn on the SDR?', 'Check my account', 'How do I build a workflow?'];

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open, busy]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 80); }, [open]);

  // Close on Escape so the panel never traps the user.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    const history = [...messages, { role: 'user', content: question }];
    setMessages(history);
    setInput('');
    setBusy(true);
    try {
      const res = await api.post('/api/help/assistant', { messages: history });
      setMessages([...history, { role: 'assistant', content: res.content || '…' }]);
    } catch (e) {
      setMessages([...history, {
        role: 'assistant',
        content: (isPt ? '⚠️ Não consegui responder agora: ' : '⚠️ I could not answer just now: ') + (e?.message || 'unknown error'),
      }]);
    } finally { setBusy(false); }
  };

  // Render the assistant's markdown-ish links as real in-app navigation.
  const renderContent = (text) => {
    const parts = String(text).split(/(\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, i) => {
      const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (!m) return <span key={i}>{part}</span>;
      const [, label, href] = m;
      const internal = href.startsWith('/');
      return internal ? (
        <button key={i} onClick={() => { navigate(href); setOpen(false); }}
          className="text-[#38b6ff] underline underline-offset-2 hover:text-[#5cc5ff]">{label}</button>
      ) : (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer"
          className="text-[#38b6ff] underline underline-offset-2">{label}</a>
      );
    });
  };

  return (
    <>
      {/* Bubble — always visible, above everything else */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={isPt ? 'Abrir assistente de suporte' : 'Open support assistant'}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[100] w-14 h-14 rounded-full
            bg-gradient-to-br from-[#3572b9] to-[#38b6ff] shadow-2xl shadow-[#38b6ff]/25
            flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
        >
          <LifeBuoy size={24} />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[100]
          w-[calc(100vw-2rem)] max-w-sm h-[min(70vh,520px)]
          bg-[#111] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">

          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3572b9] to-[#38b6ff] flex items-center justify-center flex-shrink-0">
                <LifeBuoy size={15} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">{isPt ? 'Assistente de Suporte' : 'Support Assistant'}</p>
                <p className="text-gray-500 text-[10px] truncate">{isPt ? 'Só leitura — te guia, não altera nada' : 'Read-only — guides you, changes nothing'}</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={() => setOpen(false)} title={isPt ? 'Minimizar' : 'Minimize'}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"><Minus size={15} /></button>
              <button onClick={() => { setOpen(false); setMessages([]); }} title={isPt ? 'Fechar' : 'Close'}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"><X size={15} /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {messages.length === 0 && (
              <>
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#38b6ff]/15 flex items-center justify-center flex-shrink-0">
                    <Sparkles size={12} className="text-[#38b6ff]" />
                  </div>
                  <div className="bg-white/5 rounded-2xl rounded-tl-sm px-3 py-2 text-gray-200 text-xs leading-relaxed">
                    {greeting}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="px-2.5 py-1 rounded-full text-[11px] bg-black/30 border border-white/10 text-gray-300 hover:border-[#38b6ff]/50 hover:text-[#38b6ff] transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'gap-2'}`}>
                {m.role !== 'user' && (
                  <div className="w-6 h-6 rounded-lg bg-[#38b6ff]/15 flex items-center justify-center flex-shrink-0">
                    <Sparkles size={12} className="text-[#38b6ff]" />
                  </div>
                )}
                <div className={`max-w-[85%] px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-[#3572b9] to-[#38b6ff] text-white rounded-2xl rounded-br-sm'
                    : 'bg-white/5 text-gray-200 rounded-2xl rounded-tl-sm'
                }`}>
                  {m.role === 'user' ? m.content : renderContent(m.content)}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#38b6ff]/15 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={12} className="text-[#38b6ff]" />
                </div>
                <div className="bg-white/5 rounded-2xl rounded-tl-sm px-3 py-2">
                  <Loader2 size={13} className="animate-spin text-[#38b6ff]" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="p-2.5 border-t border-white/10 flex gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={isPt ? 'Pergunte qualquer coisa…' : 'Ask anything…'}
              className="flex-1 px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-xs
                placeholder:text-gray-600 focus:outline-none focus:border-[#38b6ff]/50"
            />
            <button onClick={() => send()} disabled={busy || !input.trim()}
              className="px-3 rounded-xl bg-gradient-to-r from-[#3572b9] to-[#38b6ff] text-white
                disabled:opacity-40 disabled:cursor-not-allowed">
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
