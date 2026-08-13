import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Bot, Users, Check } from 'lucide-react';
import { useLanguage } from '@/components/ui/LanguageContext';
import { User, Company } from '@/api/entities';

/**
 * Owner field with @mention autocomplete.
 *
 * Type a few characters and a dropdown offers the people who match, the AI agent
 * (by its configured name as well as "AI"), and everyone. Selecting one writes the
 * canonical handle into the field, which is what the backend resolves — so the
 * value stays typeable by hand for anyone who prefers that, and the dropdown is a
 * convenience rather than a cage.
 *
 * Matching is on @username, full name and email, because people reach for whichever
 * they remember.
 */
export default function OwnerPicker({ value, onChange, placeholder, className = '' }) {
  const { isPt } = useLanguage();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef(null);

  const { data: team = [] } = useQuery({
    queryKey: ['teamForTasks'],
    queryFn: () => User.list(),
    staleTime: 5 * 60 * 1000,
  });

  // The agent's name is configurable per company, so "Alfred" should find it just
  // as "AI" does.
  const { data: company } = useQuery({
    queryKey: ['companies'],
    queryFn: () => Company.get(),
    staleTime: 5 * 60 * 1000,
  });
  const agentName = company?.personal_agent_name || 'Bmapz AI';

  const options = useMemo(() => {
    const list = [
      { key: 'ai', handle: 'AI', label: agentName, hint: isPt ? 'agente de IA' : 'AI agent', icon: 'bot',
        aliases: ['ai', 'ia', 'bmapz', 'agent', 'agente', String(agentName).toLowerCase()] },
      { key: 'all', handle: isPt ? '@todos' : '@all', label: isPt ? 'Todos' : 'Everyone',
        hint: isPt ? 'toda a empresa' : 'the whole company', icon: 'users',
        aliases: ['all', 'todos', 'everyone', 'equipe', 'team'] },
    ];
    for (const u of team || []) {
      const handle = u.username ? `@${u.username}` : (u.email || '');
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

  // The text after the last "@" is what the user is searching for; with no "@" the
  // whole value is the query, so typing a bare name still filters.
  const query = String(value || '').split('@').pop().trim().toLowerCase();
  const matches = useMemo(() => {
    if (!query) return options.slice(0, 8);
    return options
      .filter(o => o.aliases.some(a => a.includes(query)) || o.handle.toLowerCase().includes(query))
      .slice(0, 8);
  }, [options, query]);

  const choose = (opt) => {
    onChange(opt.key === 'ai' ? 'AI' : opt.handle);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open || !matches.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => (h + 1) % matches.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => (h - 1 + matches.length) % matches.length); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(matches[highlight] || matches[0]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div className="relative">
      <Input
        value={value || ''}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        // Delayed so a click on an option registers before the list unmounts.
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder || (isPt ? '@usuario / IA' : '@user / AI')}
        className={className}
      />

      {open && matches.length ? (
        <ul
          className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-[#1a1a1a] shadow-xl"
          onMouseDown={() => clearTimeout(blurTimer.current)}
        >
          {matches.map((opt, i) => (
            <li key={opt.key}>
              <button
                type="button"
                onClick={() => choose(opt)}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-2.5 py-1.5 flex items-center gap-2 text-xs ${
                  i === highlight ? 'bg-[#38b6ff]/15 text-white' : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                {opt.icon === 'bot' ? <Bot size={13} className="text-[#38b6ff] shrink-0" />
                  : opt.icon === 'users' ? <Users size={13} className="text-gray-400 shrink-0" />
                    : <span className="w-[13px] text-center text-gray-500 shrink-0">@</span>}
                <span className="truncate">{opt.label}</span>
                <span className="ml-auto text-[10px] text-gray-500 truncate max-w-[45%]">{opt.handle}</span>
                {String(value || '').toLowerCase() === opt.handle.toLowerCase()
                  ? <Check size={12} className="text-green-400 shrink-0" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
