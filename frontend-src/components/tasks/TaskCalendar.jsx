import React, { useEffect, useMemo, useState } from 'react';
import {
  format, isSameDay, isToday, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, addDays, subDays, addWeeks, subWeeks,
  addMonths, subMonths, addYears, subYears, startOfYear, endOfYear, eachMonthOfInterval,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/components/ui/LanguageContext';
import { STATUS_CLASS, statusLabel, isOverdue, assigneeLabel } from './taskMeta';

/**
 * Task calendar with day / week / month / year zoom and public holidays,
 * mirroring the Social Media calendar so the two feel like one product.
 *
 * One deliberate difference: the country for holidays follows the user's
 * language rather than being hard-coded to US. A Brazilian team planning around
 * American holidays is worse than showing none, and this app is bilingual by
 * design. The lookup is best-effort — a failed fetch simply means no holiday
 * markers, never a broken calendar.
 */
const HOLIDAY_COUNTRY = (isPt) => (isPt ? 'BR' : 'US');

export default function TaskCalendar({ tasks = [], onOpen }) {
  const { isPt } = useLanguage();
  const [cursor, setCursor] = useState(new Date());
  const [zoom, setZoom] = useState('month');
  const [holidays, setHolidays] = useState([]);

  const year = format(cursor, 'yyyy');
  useEffect(() => {
    let cancelled = false;
    fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${HOLIDAY_COUNTRY(isPt)}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setHolidays(Array.isArray(data) ? data : []); })
      // Best effort: no holidays is a fine outcome, a crash is not.
      .catch(() => { if (!cancelled) setHolidays([]); });
    return () => { cancelled = true; };
  }, [year, isPt]);

  const locale = isPt ? 'pt-BR' : 'en-US';
  const dayNames = isPt
    ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const dated = useMemo(() => tasks.filter(t => t.due_at && !Number.isNaN(Date.parse(t.due_at))), [tasks]);
  const undated = useMemo(() => tasks.filter(t => !t.due_at), [tasks]);

  const tasksOn = (day) => dated.filter(t => isSameDay(new Date(t.due_at), day));
  const holidayOn = (day) => holidays.find(h => h.date === format(day, 'yyyy-MM-dd'));

  const move = (dir) => {
    const d = dir === 'prev' ? -1 : 1;
    if (zoom === 'day') setCursor(c => (d < 0 ? subDays(c, 1) : addDays(c, 1)));
    else if (zoom === 'week') setCursor(c => (d < 0 ? subWeeks(c, 1) : addWeeks(c, 1)));
    else if (zoom === 'month') setCursor(c => (d < 0 ? subMonths(c, 1) : addMonths(c, 1)));
    else setCursor(c => (d < 0 ? subYears(c, 1) : addYears(c, 1)));
  };

  const heading = () => {
    if (zoom === 'day') return cursor.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (zoom === 'week') {
      const s = startOfWeek(cursor); const e = endOfWeek(cursor);
      return `${s.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (zoom === 'month') return cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    return year;
  };

  /** One task, as a chip. Overdue is the thing worth seeing at a glance. */
  const Chip = ({ task, showOwner = false }) => (
    <button
      type="button"
      onClick={() => onOpen?.(task)}
      title={`${task.title} · ${statusLabel(task.status, isPt)}`}
      className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate hover:opacity-80 ${
        isOverdue(task) ? 'bg-red-500/20 text-red-300' : STATUS_CLASS[task.status] || 'bg-white/10 text-white'
      }`}
    >
      {task.title}{showOwner ? ` · ${assigneeLabel(task, isPt)}` : ''}
    </button>
  );

  const DayCell = ({ day, muted }) => {
    const items = tasksOn(day);
    const holiday = holidayOn(day);
    return (
      <div className={`min-h-[86px] rounded-lg border p-1.5 ${
        isToday(day) ? 'border-[#38b6ff]/50 bg-[#38b6ff]/5'
          : muted ? 'border-white/5 bg-black/10 opacity-50' : 'border-white/5 bg-black/20'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[11px] ${isToday(day) ? 'text-[#38b6ff]' : 'text-gray-500'}`}>
            {format(day, 'd')}
          </span>
          {holiday ? (
            <span className="text-[9px] text-amber-300 truncate max-w-[70%]" title={holiday.localName || holiday.name}>
              🎉 {holiday.localName || holiday.name}
            </span>
          ) : null}
        </div>
        <div className="space-y-1">
          {items.slice(0, 3).map(t => <Chip key={t.id} task={t} />)}
          {items.length > 3 ? (
            <button type="button" onClick={() => { setCursor(day); setZoom('day'); }}
              className="text-[10px] text-gray-500 hover:text-white">
              +{items.length - 3} {isPt ? 'mais' : 'more'}
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  /* ── Views ─────────────────────────────────────────────────────────── */
  const renderDay = () => {
    const items = tasksOn(cursor);
    const holiday = holidayOn(cursor);
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
        {holiday ? (
          <p className="text-amber-300 text-sm mb-3">🎉 {holiday.localName || holiday.name}</p>
        ) : null}
        {items.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">
            {isPt ? 'Nenhuma tarefa com prazo neste dia.' : 'No tasks due this day.'}
          </p>
        ) : (
          <div className="space-y-2">{items.map(t => <Chip key={t.id} task={t} showOwner />)}</div>
        )}
      </div>
    );
  };

  const renderWeek = () => {
    const days = eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(cursor) });
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {days.map(d => (
            <div key={d.toISOString()} className="text-center text-[11px] text-gray-500 py-1">
              {dayNames[d.getDay()]} {format(d, 'd')}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(d => <DayCell key={d.toISOString()} day={d} />)}
        </div>
      </div>
    );
  };

  const renderMonth = () => {
    // Full weeks so the grid never has ragged edges; days outside the month are dimmed.
    const days = eachDayOfInterval({
      start: startOfWeek(startOfMonth(cursor)),
      end: endOfWeek(endOfMonth(cursor)),
    });
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayNames.map(d => (
            <div key={d} className="text-center text-[11px] text-gray-500 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(d => (
            <DayCell key={d.toISOString()} day={d} muted={!isSameMonth(d, cursor)} />
          ))}
        </div>
      </div>
    );
  };

  const renderYear = () => {
    const months = eachMonthOfInterval({ start: startOfYear(cursor), end: endOfYear(cursor) });
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {months.map(m => {
          const count = dated.filter(t => isSameMonth(new Date(t.due_at), m)).length;
          const overdue = dated.filter(t => isSameMonth(new Date(t.due_at), m) && isOverdue(t)).length;
          return (
            <button
              key={m.toISOString()}
              type="button"
              onClick={() => { setCursor(m); setZoom('month'); }}
              className="rounded-xl bg-white/5 border border-white/10 p-3 text-left hover:border-[#38b6ff]/40"
            >
              <p className="text-white text-sm capitalize">{m.toLocaleDateString(locale, { month: 'long' })}</p>
              <p className="text-gray-500 text-xs mt-1">
                {count} {isPt ? 'tarefa(s)' : 'task(s)'}
                {overdue ? <span className="text-red-400"> · {overdue} {isPt ? 'atrasada(s)' : 'overdue'}</span> : null}
              </p>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1">
          {['day', 'week', 'month', 'year'].map(z => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                zoom === z ? 'bg-[#38b6ff]/20 text-[#38b6ff]' : 'text-gray-400 hover:text-white'
              }`}
            >
              {isPt
                ? { day: 'Dia', week: 'Semana', month: 'Mês', year: 'Ano' }[z]
                : z.charAt(0).toUpperCase() + z.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-semibold capitalize">{heading()}</span>
          <button type="button" onClick={() => move('prev')}
            className="p-1 rounded hover:bg-white/10 text-gray-400"><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => setCursor(new Date())}
            className="px-2 py-1 rounded text-xs text-gray-400 hover:bg-white/10">
            {isPt ? 'Hoje' : 'Today'}
          </button>
          <button type="button" onClick={() => move('next')}
            className="p-1 rounded hover:bg-white/10 text-gray-400"><ChevronRight size={16} /></button>
        </div>
      </div>

      {zoom === 'day' ? renderDay()
        : zoom === 'week' ? renderWeek()
          : zoom === 'month' ? renderMonth()
            : renderYear()}

      {undated.length ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
          <p className="text-gray-400 text-xs mb-2">
            {isPt ? 'Sem prazo definido' : 'No deadline set'} ({undated.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {undated.map(t => (
              <button key={t.id} type="button" onClick={() => onOpen?.(t)}
                className="text-[11px] px-2 py-1 rounded bg-black/30 border border-white/10 text-white hover:border-[#38b6ff]/40">
                {t.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
