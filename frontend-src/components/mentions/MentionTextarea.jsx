import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Bot, Users } from 'lucide-react';
import { useLanguage } from '@/components/ui/LanguageContext';
import { User, Company } from '@/api/entities';

/**
 * A text field with @mention autocomplete, for INTERNAL text.
 *
 * Use it wherever a person might address a teammate or the agent: task comments and
 * descriptions, group conversations, search. Deliberately NOT for public-facing
 * copy — a social post or ad body has no audience who could be mentioned, and an
 * "@" there is just a character.
 *
 * Unlike OwnerPicker, which owns an entire field, this triggers MID-TEXT: type "@"
 * anywhere and a list appears, filtered by what follows it, and picking one splices
 * the handle in at the cursor and leaves the rest of the sentence intact.
 *
 * Matching covers @username, full name and email, because people reach for
 * whichever they remember. The agent is matched by its CONFIGURED name too —
 * "@alfred" must find the agent when the company named it Alfred.
 */
export default function MentionTextarea({
  value,
  onChange,
  placeholder,
  className = '',
  rows,
  singleLine = false,
  onKeyDown,
  autoFocus,
}) {
  const { isPt } = useLanguage();
  const inputRef = useRef(null);
  const blurTimer = useRef(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  // Where the active "@" sits, so replacement is exact rather than a blind
  // search-and-replace that would corrupt an earlier mention of the same name.
  const [anchor, setAnchor] = useState(null);

  const { data: team = [] } = useQuery({
    queryKey: ['teamForMentions'],
    queryFn: () => User.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: company } = useQuery({
    queryKey: ['companies'],
    queryFn: () => Company.get(),
    staleTime: 5 * 60 * 1000,
  });
  const agentName = company?.personal_agent_name || 'Bmapz AI';

  const options = useMemo(() => {
    const agentHandle = String(agentName).trim().replace(/\s+/g, '');
    const list = [
      {
        key: 'ai',
        // The company's own name for the agent IS its handle — "@Alfred" when the
        // company called it Alfred. The generic aliases still resolve to the same
        // agent, so "@AI", "@bmapz" and "@bmapzai" all reach it whatever it was
        // renamed to.
        handle: agentHandle || 'AI',
        label: agentName,
        hint: isPt ? 'agente de IA' : 'AI agent',
        icon: 'bot',
        aliases: [
          'ai', 'ia', 'agent', 'agente', 'bmapz', 'bmapzai', 'bmapz ai',
          String(agentName).toLowerCase(),
          agentHandle.toLowerCase(),
        ].filter(Boolean),
      },
      {
        key: 'all',
        handle: isPt ? 'todos' : 'all',
        label: isPt ? 'Todos' : 'Everyone',
        hint: isPt ? 'toda a empresa' : 'the whole company',
        icon: 'users',
        aliases: ['all', 'todos', 'everyone', 'team', 'equipe'],
      },
    ];
    for (const u of team || []) {
      const handle = u.username || (u.email ? u.email.split('@')[0] : '');
      if (!handle) continue;
      list.push({
        key: u.id,
        handle,
        label: u.full_name || u.email,
        hint: u.email,
        icon: 'user',
        aliases: [u.username, u.full_name, u.email].filter(Boolean).map(s => String(s).toLowerCase()),
      });
    }
    return list;
  }, [team, agentName, isPt]);

  /**
   * The mention being typed right now, if any.
   *
   * Only counts when the "@" starts a word — so an email address does not open the
   * list — and stops at whitespace, so finished text is left alone.
   */
  const activeQuery = (text, caret) => {
    const upto = String(text || '').slice(0, caret);
    const at = upto.lastIndexOf('@');
    if (at === -1) return null;
    const before = at === 0 ? '' : upto[at - 1];
    if (before && !/\s/.test(before)) return null;   // mid-word "@" = an email
    const frag = upto.slice(at + 1);
    if (/\s/.test(frag)) return null;                // already past the mention
    return { at, frag: frag.toLowerCase() };
  };

  const matches = useMemo(() => {
    if (!anchor) return [];
    const q = anchor.frag;
    const pool = q
      ? options.filter(o => o.aliases.some(a => a && a.includes(q)) || o.handle.toLowerCase().includes(q))
      : options;
    return pool.slice(0, 6);
  }, [options, anchor]);

  const handleChange = (e) => {
    const text = e.target.value;
    onChange(text);
    const found = activeQuery(text, e.target.selectionStart ?? text.length);
    setAnchor(found);
    setOpen(!!found);
    setHighlight(0);
  };

  const choose = (opt) => {
    if (!anchor) return;
    const text = String(value || '');
    const caret = inputRef.current?.selectionStart ?? text.length;
    // Splice at the anchor: everything before the "@", the handle, then whatever
    // the user had already typed after the cursor.
    const next = `${text.slice(0, anchor.at)}@${opt.handle} ${text.slice(caret)}`;
    onChange(next);
    setOpen(false);
    setAnchor(null);
    // Put the caret after the inserted handle so typing continues naturally.
    const pos = anchor.at + opt.handle.length + 2;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  };

  const keyDown = (e) => {
    if (open && matches.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => (h + 1) % matches.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => (h - 1 + matches.length) % matches.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(matches[highlight] || matches[0]); return; }
      if (e.key === 'Escape') { setOpen(false); return; }
    }
    onKeyDown?.(e);
  };

  const Field = singleLine ? Input : Textarea;

  return (
    <div className="relative">
      <Field
        ref={inputRef}
        value={value || ''}
        onChange={handleChange}
        onKeyDown={keyDown}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
        placeholder={placeholder}
        className={className}
        rows={rows}
        autoFocus={autoFocus}
      />

      {open && matches.length ? (
        <ul
          className="absolute z-50 left-0 right-0 bottom-full mb-1 max-h-52 overflow-y-auto rounded-lg border border-white/10 bg-[#1a1a1a] shadow-xl"
          onMouseDown={() => clearTimeout(blurTimer.current)}
        >
          {matches.map((opt, i) => (
            <li key={opt.key}>
              <button
                type="button"
                /**
                 * onMouseDown, NOT onClick — and preventDefault.
                 *
                 * mousedown fires BEFORE the field loses focus. With onClick the
                 * blur landed first, the caret position was gone by the time the
                 * handler ran, and the pick silently did nothing: the list looked
                 * like it accepted the click while the text never changed.
                 * preventDefault stops focus leaving at all, so the caret is still
                 * where the user left it.
                 */
                onMouseDown={(e) => { e.preventDefault(); choose(opt); }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-2.5 py-1.5 flex items-center gap-2 text-xs transition-colors ${
                  i === highlight ? 'bg-[#38b6ff]/25 text-white' : 'text-gray-300 hover:bg-white/10'
                }`}
              >
                {opt.icon === 'bot' ? <Bot size={13} className="text-[#38b6ff] shrink-0" />
                  : opt.icon === 'users' ? <Users size={13} className="text-gray-400 shrink-0" />
                    : <span className="w-[13px] text-center text-gray-500 shrink-0">@</span>}
                <span className="truncate">{opt.label}</span>
                <span className="ml-auto text-[10px] text-gray-500 truncate max-w-[45%]">@{opt.handle}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
