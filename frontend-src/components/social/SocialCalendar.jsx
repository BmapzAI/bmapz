import React, { useState, useEffect } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay,
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  startOfYear, endOfYear, eachMonthOfInterval,
  isToday, getDay
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PLATFORMS = [
  { value: 'instagram', icon: '📸', color: '#E1306C' },
  { value: 'linkedin', icon: '💼', color: '#0077b5' },
  { value: 'tiktok', icon: '🎵', color: '#555555' },
  { value: 'twitter', icon: '𝕏', color: '#1DA1F2' },
  { value: 'youtube', icon: '▶️', color: '#FF0000' },
  { value: 'facebook', icon: '📘', color: '#1877F2' },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SocialCalendar({ posts = [], onDayClick, onPostClick, onPostDoubleClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoom, setZoom] = useState('month');
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    const year = format(currentDate, 'yyyy');
    fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/US`)
      .then(r => r.json())
      .then(data => setHolidays(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [format(currentDate, 'yyyy')]);

  const getPostsForDay = (day) =>
    posts.filter(p => p.scheduled_for && isSameDay(new Date(p.scheduled_for), day));

  const getHolidayForDay = (day) =>
    holidays.find(h => h.date === format(day, 'yyyy-MM-dd'));

  const navigate = (dir) => {
    if (zoom === 'day') setCurrentDate(dir === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1));
    else if (zoom === 'week') setCurrentDate(dir === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    else if (zoom === 'month') setCurrentDate(dir === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    else setCurrentDate(new Date(currentDate.getFullYear() + (dir === 'prev' ? -1 : 1), 0));
  };

  const getTitle = () => {
    if (zoom === 'day') return format(currentDate, 'EEEE, MMMM d, yyyy');
    if (zoom === 'week') {
      const s = startOfWeek(currentDate, { weekStartsOn: 0 });
      const e = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`;
    }
    if (zoom === 'month') return format(currentDate, 'MMMM yyyy');
    return format(currentDate, 'yyyy');
  };

  // Heatmap data: simulate best times based on day of week
  const HEATMAP = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => ({
      day, hour,
      score: Math.round(30 + Math.random() * 70),
      best: (day >= 1 && day <= 5) && ((hour >= 8 && hour <= 11) || (hour >= 13 && hour <= 17)),
    }))
  );

  const heatColor = (score, best) => {
    if (best && score > 60) return 'rgba(56,182,255,0.85)';
    if (score > 70) return 'rgba(56,182,255,0.55)';
    if (score > 40) return 'rgba(56,182,255,0.28)';
    return 'rgba(255,255,255,0.04)';
  };

  const renderDayView = () => {
    const dayPosts = getPostsForDay(currentDate);
    const holiday = getHolidayForDay(currentDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const postsByHour = {};
    dayPosts.forEach(p => {
      if (p.scheduled_for) {
        const h = new Date(p.scheduled_for).getHours();
        if (!postsByHour[h]) postsByHour[h] = [];
        postsByHour[h].push(p);
      }
    });
    const dayOfWeek = currentDate.getDay();
    const dayHeatmap = HEATMAP[dayOfWeek];
    return (
      <div className="space-y-1">
        {holiday && (
          <div className="px-3 py-1.5 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs mb-2">
            🎉 {holiday.localName}
          </div>
        )}
        <div className="flex items-center justify-between px-2 mb-2">
          <span className={`text-sm font-bold ${isToday(currentDate) ? 'text-[#38b6ff]' : 'text-white'}`}>
            {isToday(currentDate) ? '📅 Today' : format(currentDate, 'EEEE')}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-gray-500 flex items-center gap-1">🔥 Best posting times highlighted</span>
            <button onClick={() => onDayClick && onDayClick(currentDate)}
              className="text-xs px-3 py-1 rounded-lg bg-[#38b6ff]/20 text-[#38b6ff] hover:bg-[#38b6ff]/30 transition-colors">
              + New Post
            </button>
          </div>
        </div>
        <div className="space-y-0.5 max-h-[500px] overflow-y-auto pr-1">
          {hours.map(h => {
            const hPosts = postsByHour[h] || [];
            const heat = dayHeatmap[h];
            const bg = heatColor(heat.score, heat.best);
            return (
              <div key={h} className={`flex gap-3 min-h-[44px] group`}>
                <div className="w-12 flex-shrink-0 text-right pt-1">
                  <span className="text-[10px] text-gray-500">{`${h.toString().padStart(2, '0')}:00`}</span>
                  {heat.best && <div className="text-[8px] text-[#38b6ff] text-right">🔥best</div>}
                </div>
                <div className="flex-1 rounded-lg border border-white/5 p-1.5 transition-all"
                  style={{ backgroundColor: bg }}>
                  {hPosts.length === 0 ? (
                    <div className="h-full w-full cursor-pointer min-h-[28px]" onClick={() => {
                      const d = new Date(currentDate);
                      d.setHours(h, 0, 0, 0);
                      onDayClick && onDayClick(d);
                    }} />
                  ) : (
                    <div className="space-y-1">
                      {hPosts.map((post, i) => {
                        const pl = PLATFORMS.find(p => p.value === post.platforms?.[0]);
                        return (
                          <div key={i}
                            onClick={(e) => { e.stopPropagation(); onPostClick && onPostClick(post); }}
                            onDoubleClick={(e) => { e.stopPropagation(); onPostDoubleClick ? onPostDoubleClick(post) : onPostClick && onPostClick(post); }}
                            className="flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ backgroundColor: `${pl?.color || '#38b6ff'}25` }}
                          >
                            <span className="text-xs">{pl?.icon || '📝'}</span>
                            <span className="text-xs font-medium truncate" style={{ color: pl?.color || '#38b6ff' }}>{post.title}</span>
                            <span className="text-[9px] text-gray-500 ml-auto flex-shrink-0">{format(new Date(post.scheduled_for), 'HH:mm')}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayCell = (day, inMonth = true) => {
    const dayPosts = getPostsForDay(day);
    const holiday = getHolidayForDay(day);
    let clickTimer = null;

    const handleClick = (e) => {
      if (!inMonth) return;
      // Use a short delay so double-click can cancel the single-click
      clickTimer = setTimeout(() => {
        onDayClick && onDayClick(day);
      }, 200);
    };

    const handleDoubleClick = (e) => {
      if (!inMonth) return;
      if (clickTimer) clearTimeout(clickTimer);
      setCurrentDate(day);
      setZoom('day');
    };

    return (
      <div
        key={day.toString()}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        className={`min-h-[80px] rounded-xl border p-1.5 transition-all group
          ${!inMonth ? 'opacity-25 border-white/5 bg-transparent' :
            isToday(day) ? 'border-[#38b6ff] bg-[#38b6ff]/10 cursor-pointer hover:bg-[#38b6ff]/20' :
            'border-white/10 bg-white/5 cursor-pointer hover:border-[#38b6ff]/50 hover:bg-white/10'}`}
      >
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-xs font-bold ${isToday(day) ? 'text-[#38b6ff]' : inMonth ? 'text-white' : 'text-gray-600'}`}>
            {format(day, 'd')}
          </span>
          {dayPosts.length > 0 && (
            <span className="text-[9px] bg-[#38b6ff]/30 text-[#38b6ff] rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {dayPosts.length}
            </span>
          )}
        </div>
        {holiday && inMonth && (
          <div className="text-[8px] text-yellow-400 truncate leading-tight mb-0.5">{holiday.localName}</div>
        )}
        <div className="flex flex-wrap gap-0.5">
          {dayPosts.slice(0, 4).map((post, i) => {
            const pl = PLATFORMS.find(p => p.value === post.platforms?.[0]);
            return (
              <div
                key={i}
                onClick={(e) => { e.stopPropagation(); onPostClick && onPostClick(post); }}
                onDoubleClick={(e) => { e.stopPropagation(); onPostDoubleClick ? onPostDoubleClick(post) : onPostClick && onPostClick(post); }}
                title={post.title + ' (double-click to edit)'}
                className="w-3 h-3 rounded-full cursor-pointer hover:scale-125 transition-transform"
                style={{ backgroundColor: pl?.color || '#38b6ff' }}
              />
            );
          })}
          {dayPosts.length > 4 && <span className="text-[7px] text-gray-500 self-center">+{dayPosts.length - 4}</span>}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    // Best posting hours for the week (top 3 per day from heatmap)
    const bestHoursByDay = HEATMAP.map(dayData =>
      [...dayData].sort((a, b) => b.score - a.score).slice(0, 3).map(h => h.hour)
    );
    return (
      <div className="space-y-2">
        <div className="text-[10px] text-gray-500 flex items-center gap-1 mb-1">🔥 Double-click a day to drill into day view · Heatmap shows best posting times</div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS.map(d => <div key={d} className="text-center text-xs text-gray-500 font-medium py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const dayPosts = getPostsForDay(day);
            const holiday = getHolidayForDay(day);
            const dowIdx = getDay(day);
            const bestHours = bestHoursByDay[dowIdx];
            return (
              <div
                key={day.toString()}
                onClick={() => onDayClick && onDayClick(day)}
                onDoubleClick={() => { setCurrentDate(day); setZoom('day'); }}
                className={`min-h-[140px] rounded-xl border p-2 cursor-pointer transition-all
                  ${isToday(day) ? 'border-[#38b6ff] bg-[#38b6ff]/10 hover:bg-[#38b6ff]/20' : 'border-white/10 bg-white/5 hover:border-[#38b6ff]/50 hover:bg-white/10'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-bold ${isToday(day) ? 'text-[#38b6ff]' : 'text-white'}`}>{format(day, 'd')}</span>
                  <span className="text-[9px] text-gray-500">{DAYS[getDay(day)]}</span>
                </div>
                {holiday && <div className="text-[9px] text-yellow-400 bg-yellow-400/10 rounded px-1 mb-1 truncate">{holiday.localName}</div>}
                {/* Heatmap mini indicator */}
                <div className="flex gap-px mb-1.5 flex-wrap">
                  {bestHours.map(h => (
                    <span key={h} className="text-[8px] px-1 rounded" style={{ backgroundColor: 'rgba(56,182,255,0.25)', color: '#38b6ff' }}>
                      {h}h
                    </span>
                  ))}
                </div>
                <div className="space-y-1">
                  {dayPosts.slice(0, 4).map((post, i) => {
                    const pl = PLATFORMS.find(p => p.value === post.platforms?.[0]);
                    return (
                      <div
                        key={i}
                        onClick={(e) => { e.stopPropagation(); onPostClick && onPostClick(post); }}
                        onDoubleClick={(e) => { e.stopPropagation(); onPostDoubleClick ? onPostDoubleClick(post) : onPostClick && onPostClick(post); }}
                        title="Double-click to edit"
                        className="text-[9px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: `${pl?.color || '#38b6ff'}25`, color: pl?.color || '#38b6ff' }}
                      >
                        {pl?.icon} {post.title}
                      </div>
                    );
                  })}
                  {dayPosts.length > 4 && <div className="text-[9px] text-gray-500">+{dayPosts.length - 4} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: calStart, end: calEnd });
    return (
      <div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS.map(d => <div key={d} className="text-center text-xs text-gray-500 font-medium py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => renderDayCell(day, isSameMonth(day, currentDate)))}
        </div>
      </div>
    );
  };

  const renderYearView = () => {
    const yearStart = startOfYear(currentDate);
    const yearEnd = endOfYear(currentDate);
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });
    return (
      <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
        {months.map(month => {
          const mStart = startOfMonth(month);
          const mEnd = endOfMonth(month);
          const mDays = eachDayOfInterval({ start: mStart, end: mEnd });
          const monthPosts = posts.filter(p => p.scheduled_for && isSameMonth(new Date(p.scheduled_for), month));
          return (
            <div
              key={month.toString()}
              onClick={() => { setCurrentDate(month); setZoom('month'); }}
              className="rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer hover:border-[#38b6ff]/50 hover:bg-white/10 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-white text-sm font-semibold">{format(month, 'MMMM')}</p>
                {monthPosts.length > 0 && (
                  <span className="text-[10px] bg-[#38b6ff]/20 text-[#38b6ff] rounded-full px-1.5 py-0.5">{monthPosts.length}</span>
                )}
              </div>
              <div className="grid grid-cols-7 gap-px">
                {Array.from({ length: getDay(mStart) }).map((_, i) => <div key={`e${i}`} className="w-3 h-3" />)}
                {mDays.map(day => {
                  const dp = getPostsForDay(day);
                  return (
                    <div
                      key={day.toString()}
                      className={`w-3 h-3 rounded-sm flex items-center justify-center text-[6px]
                        ${isToday(day) ? 'bg-[#38b6ff] text-white' : dp.length > 0 ? 'bg-[#cb6ce6]/50' : 'bg-white/5 text-gray-700'}`}
                    >
                      {format(day, 'd')}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('prev')} className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <h3 className="text-white font-semibold text-base min-w-[180px] text-center">{getTitle()}</h3>
          <button onClick={() => navigate('next')} className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-colors">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="text-xs text-[#38b6ff] hover:underline ml-1">Today</button>
        </div>
        <div className="flex gap-1">
          {['day', 'week', 'month', 'year'].map(z => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all
                ${zoom === z ? 'bg-[#38b6ff]/20 text-[#38b6ff] border border-[#38b6ff]/30' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'}`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      {/* Platform Legend */}
      <div className="flex flex-wrap gap-3">
        {PLATFORMS.map(p => (
          <div key={p.value} className="flex items-center gap-1 text-xs text-gray-400">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
            {p.icon} {p.value.charAt(0).toUpperCase() + p.value.slice(1)}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      {zoom === 'day' && renderDayView()}
      {zoom === 'week' && renderWeekView()}
      {zoom === 'month' && renderMonthView()}
      {zoom === 'year' && renderYearView()}
    </div>
  );
}