import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Button } from '@/components/ui/button';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { Notification } from '@/api/entities';

const TYPE_ICON = { lead: '🆕', handover: '🤝', sdr: '🤖', qualification: '📈', workflow: '⚙️', system: '🛎️', info: '💬' };

export default function Notifications() {
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['notifPage'],
    queryFn: () => Notification.list({ limit: 200 }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifPage'] });
    queryClient.invalidateQueries({ queryKey: ['notifUnread'] });
    queryClient.invalidateQueries({ queryKey: ['notifList'] });
  };
  const markRead = useMutation({ mutationFn: (id) => Notification.markRead(id), onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: () => Notification.readAll(), onSuccess: invalidate });
  const del = useMutation({ mutationFn: (id) => Notification.delete(id), onSuccess: invalidate });

  const unread = items.filter(n => !n.read).length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            {isPt ? 'Notificações' : 'Notifications'}
          </h1>
          <p className="text-gray-400 mt-1">
            {isPt ? 'Tudo o que acontece na sua conta — leads, handovers, SDR e fluxos.' : 'Everything happening in your account — leads, hand-overs, SDR and workflows.'}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={() => readAll.mutate()} className="border-white/10 text-white hover:bg-white/5 gap-2">
            <CheckCheck size={15} /> {isPt ? 'Marcar todas como lidas' : 'Mark all read'}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full border-2 border-[#38b6ff] border-t-transparent animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-white/10">
          <Bell size={40} className="text-gray-600 mb-3" />
          <p className="text-white font-medium">{isPt ? 'Nenhuma notificação ainda' : 'No notifications yet'}</p>
          <p className="text-gray-500 text-sm">{isPt ? 'Novos leads, qualificações e handovers aparecerão aqui.' : 'New leads, qualifications and hand-overs will show up here.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(n => (
            <div key={n.id}
              className={`flex gap-3 p-4 rounded-2xl border transition-all ${n.read ? 'bg-white/5 border-white/10' : 'bg-[#38b6ff]/5 border-[#38b6ff]/20'}`}>
              <div className="text-2xl flex-shrink-0">{n.icon || TYPE_ICON[n.type] || '💬'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm ${n.read ? 'text-gray-300' : 'text-white font-semibold'}`}>{n.title}</p>
                  {n.priority === 'high' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">{isPt ? 'urgente' : 'high'}</span>}
                </div>
                {n.body && <p className="text-gray-400 text-sm mt-0.5">{n.body}</p>}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-gray-600 text-xs">{new Date(n.created_at).toLocaleString()}</span>
                  {n.link && <Link to={n.link} className="text-[#38b6ff] text-xs hover:underline">{isPt ? 'Abrir' : 'Open'}</Link>}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                {!n.read && (
                  <button onClick={() => markRead.mutate(n.id)} title={isPt ? 'Marcar lida' : 'Mark read'}
                    className="text-gray-500 hover:text-[#38b6ff]"><Check size={16} /></button>
                )}
                <button onClick={() => del.mutate(n.id)} title={isPt ? 'Excluir' : 'Delete'}
                  className="text-gray-600 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
