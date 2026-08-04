import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Circle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '@/api/entities';
import { SALES_STATUSES } from '@/components/settings/SalesTeamTab';

/**
 * Compact availability switcher for sales team members.
 *
 * Dropped into section headers (SDR, Sales) so a rep can go Online / Stand by /
 * Offline without walking to Settings. Renders nothing for people who are not on
 * the sales team, so it never clutters other users' screens.
 */
export default function SalesStatusSwitcher({ className = '' }) {
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => User.me(),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: (status) => User.setSalesStatus(status),
    onSuccess: (_d, status) => {
      const s = SALES_STATUSES.find(x => x.key === status);
      toast.success(`${isPt ? 'Status' : 'Status'}: ${isPt ? s?.pt : s?.en}`);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['companyUsers'] });
    },
    onError: (e) => toast.error((isPt ? 'Falha ao mudar status: ' : 'Could not change status: ') + e.message),
  });

  if (!me?.is_sales_team) return null;

  const current = me.sales_status || 'offline';
  const active = SALES_STATUSES.find(s => s.key === current) || SALES_STATUSES[2];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="hidden sm:inline text-gray-500 text-xs">{isPt ? 'Meu status' : 'My status'}</span>
      <Select value={current} onValueChange={(v) => mutation.mutate(v)} disabled={mutation.isPending}>
        {/* The selected item already renders its own coloured dot, so the
            trigger must NOT add a second one — that is what produced two dots. */}
        <SelectTrigger className="h-8 w-[150px] bg-black/30 border-white/10 text-white text-xs">
          <span className="flex items-center gap-1.5 truncate">
            {mutation.isPending && <Loader2 size={11} className="animate-spin text-[#38b6ff] flex-shrink-0" />}
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent className="bg-[#1a1a1a] border-white/10">
          {SALES_STATUSES.map(s => (
            <SelectItem key={s.key} value={s.key}>
              <span className="flex items-center gap-2">
                <Circle size={8} className={`${s.dot} fill-current`} />
                {isPt ? s.pt : s.en}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
