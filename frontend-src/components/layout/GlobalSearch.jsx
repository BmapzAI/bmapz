import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Search, Loader2, CornerDownLeft, X } from 'lucide-react';
import { api } from '@/api/apiClient';

/**
 * One search box for the whole app.
 *
 * Finds records (leads, messages, posts, campaigns, ads, workflows, saved work,
 * teammates) AND screens/settings, so someone who does not yet know where a
 * feature lives can type what they want to do and be taken there.
 *
 * Keyboard: Ctrl/Cmd+K focuses it, ↑/↓ moves, Enter opens, Esc closes.
 */
export default function GlobalSearch({ className = '' }) {
  const { isPt } = useLanguage();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [debounced, setDebounced] = useState('');
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  // Wait for a pause in typing so we don't query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ['globalSearch', debounced],
    queryFn: () => api.get('/api/search', { q: debounced }),
    enabled: debounced.length >= 2,
    staleTime: 15_000,
  });

  // Flatten for keyboard navigation while keeping the group headings.
  const groups = data?.groups || [];
  const flat = groups.flatMap(g => g.items.map(i => ({ ...i, group: g.label })));

  useEffect(() => { setActive(0); }, [debounced]);

  // Ctrl/Cmd+K from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close when clicking away.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const go = (item) => {
    if (!item) return;
    setOpen(false);
    setQ('');
    navigate(item.path);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return; }
    if (!flat.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, flat.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); go(flat[active]); }
  };

  let idx = -1;

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={isPt ? 'Buscar em tudo…' : 'Search anything…'}
          aria-label={isPt ? 'Buscar no aplicativo' : 'Search the app'}
          className="w-full h-9 pl-9 pr-16 rounded-xl bg-black/30 border border-white/10 text-white text-sm
            placeholder:text-gray-600 focus:outline-none focus:border-[#38b6ff]/50 transition-colors"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isFetching && <Loader2 size={13} className="animate-spin text-[#38b6ff]" />}
          {q ? (
            <button type="button" onClick={() => { setQ(''); inputRef.current?.focus(); }}
              className="text-gray-500 hover:text-white p-0.5" aria-label="Clear">
              <X size={13} />
            </button>
          ) : (
            <kbd className="hidden lg:inline text-[10px] text-gray-600 border border-white/10 rounded px-1 py-0.5">Ctrl K</kbd>
          )}
        </div>
      </div>

      {open && debounced.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 max-h-[70vh] overflow-y-auto rounded-2xl
          bg-[#141414] border border-white/10 shadow-2xl z-[130] py-1.5">
          {flat.length === 0 && !isFetching && (
            <p className="text-gray-500 text-xs text-center py-6">
              {isPt ? `Nada encontrado para “${debounced}”.` : `Nothing found for “${debounced}”.`}
            </p>
          )}

          {groups.map(g => (
            <div key={g.key}>
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-white/30 uppercase tracking-wider">{g.label}</p>
              {g.items.map(item => {
                idx += 1;
                const mine = idx;
                return (
                  <button
                    key={`${g.key}-${item.id}`}
                    type="button"
                    onMouseEnter={() => setActive(mine)}
                    onClick={() => go(item)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${
                      active === mine ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-xs truncate">{item.title}</p>
                      {item.subtitle && <p className="text-gray-500 text-[11px] truncate">{item.subtitle}</p>}
                    </div>
                    {active === mine && <CornerDownLeft size={12} className="text-gray-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
