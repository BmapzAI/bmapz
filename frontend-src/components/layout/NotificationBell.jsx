import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Notification } from '@/api/entities';

const TYPE_ICON = { lead: '🆕', handover: '🤝', sdr: '🤖', qualification: '📈', workflow: '⚙️', system: '🛎️', info: '💬' };

function timeAgo(iso, isPt) {
  const d = new Date(iso), diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
  if (m < 1) return isPt ? 'agora' : 'now';
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
}

export default function NotificationBell() {
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: countData } = useQuery({
    queryKey: ['notifUnread'],
    queryFn: () => Notification.unreadCount(),
    refetchInterval: 60000,
  });
  const unread = countData?.count || 0;

  const { data: items = [] } = useQuery({
    queryKey: ['notifList'],
    queryFn: () => Notification.list({ limit: 20 }),
    enabled: open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifUnread'] });
    queryClient.invalidateQueries({ queryKey: ['notifList'] });
  };
  const markRead = useMutation({ mutationFn: (id) => Notification.markRead(id), onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: () => Notification.readAll(), onSuccess: invalidate });

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/5 transition-colors"
        title={isPt ? 'Notificações' : 'Notifications'}>
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#ef4444] text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[92vw] z-50 rounded-2xl bg-[#141414] border border-white/10 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-white font-semibold text-sm">{isPt ? 'Notificações' : 'Notifications'}</span>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={() => readAll.mutate()} className="text-[#38b6ff] text-xs hover:underline flex items-center gap-1">
                    <CheckCheck size={12} /> {isPt ? 'Marcar todas' : 'Mark all'}
                  </button>
                )}
                <Link to="/Notifications" onClick={() => setOpen(false)} className="text-gray-400 text-xs hover:text-white">
                  {isPt ? 'Ver tudo' : 'View all'}
                </Link>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 ? (
                <div className="py-10 text-center text-gray-500 text-sm">{isPt ? 'Nenhuma notificação' : 'No notifications'}</div>
              ) : items.map(n => (
                <div key={n.id}
                  className={`flex gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${!n.read ? 'bg-[#38b6ff]/5' : ''}`}>
                  <div className="text-lg flex-shrink-0">{n.icon || TYPE_ICON[n.type] || '💬'}</div>
                  <Link to={n.link || '/Notifications'} onClick={() => { if (!n.read) markRead.mutate(n.id); setOpen(false); }} className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${n.read ? 'text-gray-300' : 'text-white font-medium'}`}>{n.title}</p>
                    {n.body && <p className="text-gray-500 text-xs line-clamp-2">{n.body}</p>}
                    <p className="text-gray-600 text-[10px] mt-0.5">{timeAgo(n.created_at, isPt)}</p>
                  </Link>
                  {!n.read && (
                    <button onClick={() => markRead.mutate(n.id)} title={isPt ? 'Marcar lida' : 'Mark read'}
                      className="text-gray-500 hover:text-[#38b6ff] flex-shrink-0"><Check size={14} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
