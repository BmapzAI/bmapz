import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Users, Circle, Loader2, Info, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '@/api/entities';

/**
 * Availability options. These are not cosmetic — they decide whether a new lead
 * can be routed to this person (see backend lib/leadAssignment.js).
 */
export const SALES_STATUSES = [
  {
    key: 'online',
    en: 'Online', pt: 'Online',
    enDesc: 'Available for lead assignment — new leads can be routed to you.',
    ptDesc: 'Disponível para receber leads — novos leads podem ser atribuídos a você.',
    dot: 'text-green-400', chip: 'text-green-400 bg-green-500/10 border-green-500/20',
  },
  {
    key: 'standby',
    en: 'Stand by', pt: 'Em espera',
    enDesc: 'Not taking new leads — the SDR agent handles them instead.',
    ptDesc: 'Não recebe novos leads — o agente SDR cuida deles.',
    dot: 'text-yellow-400', chip: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  },
  {
    key: 'offline',
    en: 'Offline', pt: 'Offline',
    enDesc: 'Not available for lead assignment.',
    ptDesc: 'Indisponível para atribuição de leads.',
    dot: 'text-gray-500', chip: 'text-gray-400 bg-white/5 border-white/10',
  },
];

/** Small status chip reusable anywhere a sales member is shown. */
export function SalesStatusChip({ status, className = '' }) {
  const { isPt } = useLanguage();
  const s = SALES_STATUSES.find(x => x.key === status) || SALES_STATUSES[2];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${s.chip} ${className}`}>
      <Circle size={7} className={`${s.dot} fill-current`} /> {isPt ? s.pt : s.en}
    </span>
  );
}

/**
 * Settings → Sales Team.
 *
 * A company admin picks who belongs to the sales team. Each member then sets
 * their own availability, which controls lead routing.
 */
export default function SalesTeamTab({ currentUser }) {
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();

  const isAdmin = ['company_admin', 'owner', 'system_admin'].includes(currentUser?.role);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['companyUsers'],
    queryFn: () => User.list(),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['companyUsers'] });
    queryClient.invalidateQueries({ queryKey: ['currentUser'] });
  };

  const membershipMutation = useMutation({
    mutationFn: ({ id, isMember }) => User.setSalesTeam(id, isMember),
    onSuccess: (_d, v) => {
      toast.success(v.isMember
        ? (isPt ? 'Adicionado ao time de vendas' : 'Added to the sales team')
        : (isPt ? 'Removido do time de vendas' : 'Removed from the sales team'));
      refresh();
    },
    onError: (e) => toast.error((isPt ? 'Falha: ' : 'Failed: ') + e.message),
  });

  const statusMutation = useMutation({
    mutationFn: (status) => User.setSalesStatus(status),
    onSuccess: () => { toast.success(isPt ? 'Status atualizado' : 'Status updated'); refresh(); },
    onError: (e) => toast.error((isPt ? 'Falha ao atualizar status: ' : 'Could not update status: ') + e.message),
  });

  const me = users.find(u => u.id === currentUser?.id) || currentUser;
  const salesTeam = users.filter(u => u.is_sales_team);
  const onlineCount = salesTeam.filter(u => u.sales_status === 'online').length;

  return (
    <div className="space-y-6">
      {/* My availability — only for people actually on the team */}
      {me?.is_sales_team && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Circle size={16} className="text-green-400 fill-current" />
              {isPt ? 'Minha disponibilidade' : 'My availability'}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {isPt
                ? 'Define se novos leads podem ser atribuídos a você agora.'
                : 'Controls whether new leads can be assigned to you right now.'}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {SALES_STATUSES.map(s => {
              const active = (me.sales_status || 'offline') === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => statusMutation.mutate(s.key)}
                  disabled={statusMutation.isPending}
                  className={`text-left p-3 rounded-xl border transition-all ${active
                    ? 'bg-[#38b6ff]/10 border-[#38b6ff]/40'
                    : 'bg-black/20 border-white/10 hover:border-white/25'}`}
                >
                  <span className="flex items-center gap-1.5 text-white text-sm font-medium">
                    <Circle size={8} className={`${s.dot} fill-current`} />
                    {isPt ? s.pt : s.en}
                  </span>
                  <p className="text-gray-500 text-xs mt-1 leading-snug">{isPt ? s.ptDesc : s.enDesc}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Team membership — admin only */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users size={18} className="text-[#38b6ff]" />
              {isPt ? 'Time de vendas' : 'Sales team'}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {isAdmin
                ? (isPt
                  ? 'Escolha quem faz parte do time de vendas. Só membros do time podem receber leads.'
                  : 'Choose who belongs to the sales team. Only team members can be assigned leads.')
                : (isPt
                  ? 'Somente um administrador pode alterar os membros do time.'
                  : 'Only a company admin can change who is on the team.')}
            </p>
          </div>
          <span className="text-xs text-gray-400 bg-black/30 border border-white/10 rounded-full px-2.5 py-1">
            {salesTeam.length} {isPt ? 'no time' : 'on team'} · {onlineCount} {isPt ? 'online' : 'online'}
          </span>
        </div>

        {/* What happens when nobody is online */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[#38b6ff]/10 border border-[#38b6ff]/20">
          {onlineCount > 0
            ? <Info size={15} className="text-[#38b6ff] flex-shrink-0 mt-0.5" />
            : <Bot size={15} className="text-[#cb6ce6] flex-shrink-0 mt-0.5" />}
          <p className="text-gray-300 text-xs">
            {onlineCount > 0
              ? (isPt
                ? `Novos leads são distribuídos automaticamente entre os ${onlineCount} membro(s) online, sempre para quem tem menos leads em aberto.`
                : `New leads are shared automatically between the ${onlineCount} member(s) who are online, always going to whoever has the fewest open leads.`)
              : (isPt
                ? 'Ninguém está online. Novos leads ficam sem responsável e o agente SDR cuida deles — que é exatamente para isso que serve "Em espera".'
                : 'Nobody is online. New leads stay unassigned and the SDR agent handles them — which is exactly what "Stand by" is for.')}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#38b6ff]" /></div>
        ) : (
          <div className="space-y-1.5">
            {users.map(u => {
              const isMember = !!u.is_sales_team;
              return (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/10">
                  <label className={`flex items-center ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                    <input
                      type="checkbox"
                      checked={isMember}
                      disabled={!isAdmin || membershipMutation.isPending}
                      onChange={(e) => membershipMutation.mutate({ id: u.id, isMember: e.target.checked })}
                      className="w-4 h-4 accent-[#38b6ff]"
                    />
                  </label>
                  {u.profile_picture
                    ? <img src={u.profile_picture} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#3572b9] to-[#38b6ff] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {(u.full_name || u.email || '?')[0]?.toUpperCase()}
                    </div>}
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm truncate">
                      {u.full_name || u.email}
                      {u.id === currentUser?.id && <span className="text-gray-500 text-xs ml-1">({isPt ? 'você' : 'you'})</span>}
                    </p>
                    <p className="text-gray-500 text-xs truncate capitalize">{String(u.role || 'user').replace(/_/g, ' ')}</p>
                  </div>
                  {isMember && <SalesStatusChip status={u.sales_status} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
