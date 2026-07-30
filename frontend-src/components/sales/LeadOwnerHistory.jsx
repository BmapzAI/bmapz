import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCircle2, History, Send, Loader2, Bot, GitBranch, Settings2, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Lead, User } from '@/api/entities';
import { SalesStatusChip } from '@/components/settings/SalesTeamTab';

const UNASSIGNED = '__unassigned__';

/** Small coloured chip showing who owns a lead. Visible to the whole company. */
export function LeadOwnerBadge({ owner, className = '' }) {
  const { isPt } = useLanguage();
  if (!owner) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-gray-400 ${className}`}>
        <UserCircle2 size={11} /> {isPt ? 'Sem responsável' : 'Unassigned'}
      </span>
    );
  }
  const name = owner.full_name || owner.email || 'Owner';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-[#38b6ff]/30 bg-[#38b6ff]/10 text-[#38b6ff] ${className}`}
      title={`${isPt ? 'Responsável' : 'Owner'}: ${name}`}>
      {owner.profile_picture
        ? <img src={owner.profile_picture} alt="" className="w-3 h-3 rounded-full object-cover" />
        : <UserCircle2 size={11} />}
      {name.split(' ')[0]}
    </span>
  );
}

const ACTOR_ICON = {
  sdr: Bot,
  workflow: GitBranch,
  system: Settings2,
  ai: Bot,
  user: UserIcon,
};

/**
 * Owner assignment + the lead's full handling history.
 *
 * A lead has exactly ONE owner (a single select, not multi-assign). The owner
 * and the entire timeline are readable by everyone in the company, so anyone can
 * see who is handling a lead and everything that has happened to it — including
 * automated SDR replies and workflow steps.
 */
export default function LeadOwnerHistory({ lead, onChanged }) {
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');

  const { data: teammates = [] } = useQuery({
    queryKey: ['companyUsers'],
    queryFn: () => User.list(),
  });

  const { data: activities = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['leadActivities', lead?.id],
    queryFn: () => Lead.activities(lead.id),
    enabled: !!lead?.id,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['leadActivities', lead?.id] });
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    onChanged?.();
  };

  const assignMutation = useMutation({
    mutationFn: (ownerId) => Lead.assign(lead.id, ownerId),
    onSuccess: () => { toast.success(isPt ? 'Responsável atualizado' : 'Owner updated'); refresh(); },
    onError: (e) => toast.error((isPt ? 'Falha ao atribuir: ' : 'Could not assign: ') + e.message),
  });

  const noteMutation = useMutation({
    mutationFn: (text) => Lead.addNote(lead.id, text),
    onSuccess: () => { setNote(''); toast.success(isPt ? 'Nota adicionada' : 'Note added'); refresh(); },
    onError: (e) => toast.error((isPt ? 'Falha ao salvar a nota: ' : 'Could not save the note: ') + e.message),
  });

  if (!lead?.id) return null;
  const ownerId = lead.owner_id || lead.owner?.id || null;
  // Prefer the sales team; fall back to everyone if no team has been set up yet
  // (or before migration 011). The current owner always stays selectable.
  const salesTeam = teammates.filter(u => u.is_sales_team);
  const assignable = salesTeam.length
    ? [...salesTeam, ...teammates.filter(u => !u.is_sales_team && u.id === ownerId)]
    : teammates;

  return (
    <div className="space-y-4">
      {/* Owner — exactly one person is responsible */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
        <p className="text-white text-sm font-semibold flex items-center gap-2">
          <UserCircle2 size={15} className="text-[#38b6ff]" /> {isPt ? 'Responsável pelo lead' : 'Lead owner'}
        </p>
        <p className="text-gray-500 text-xs">
          {isPt
            ? 'Apenas uma pessoa é responsável por este lead. Todos na empresa podem ver quem é.'
            : 'Exactly one person is responsible for this lead. Everyone in the company can see who.'}
        </p>
        <Select
          value={ownerId || UNASSIGNED}
          onValueChange={(v) => assignMutation.mutate(v === UNASSIGNED ? null : v)}
          disabled={assignMutation.isPending}
        >
          <SelectTrigger className="bg-black/30 border-white/10 text-white text-sm">
            <SelectValue placeholder={isPt ? 'Escolher responsável' : 'Choose an owner'} />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            <SelectItem value={UNASSIGNED}>{isPt ? '— Sem responsável —' : '— Unassigned —'}</SelectItem>
            {assignable.map(u => (
              <SelectItem key={u.id} value={u.id}>
                <span className="flex items-center gap-2">
                  {u.full_name || u.email}
                  {u.is_sales_team && <SalesStatusChip status={u.sales_status} />}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {salesTeam.length > 0 && (
          <p className="text-gray-600 text-[10px]">
            {isPt
              ? 'Mostrando o time de vendas. Quem está "Em espera" ou "Offline" não recebe leads automaticamente, mas ainda pode ser atribuído manualmente.'
              : 'Showing the sales team. People on "Stand by" or "Offline" are skipped by automatic routing, but you can still assign them by hand.'}
          </p>
        )}
        {lead.owner_assigned_at && (
          <p className="text-gray-600 text-[10px]">
            {isPt ? 'Atribuído em ' : 'Assigned '}{new Date(lead.owner_assigned_at).toLocaleString()}
          </p>
        )}
      </div>

      {/* History — every step, by anyone or anything */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
        <p className="text-white text-sm font-semibold flex items-center gap-2">
          <History size={15} className="text-[#cb6ce6]" /> {isPt ? 'Histórico do lead' : 'Lead history'}
          <span className="text-gray-500 text-xs font-normal">({activities.length})</span>
        </p>

        <div className="flex gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) noteMutation.mutate(note.trim()); }}
            placeholder={isPt ? 'Adicionar uma nota ao histórico…' : 'Add a note to the history…'}
            className="bg-black/30 border-white/10 text-white text-sm" />
          <Button size="sm" onClick={() => note.trim() && noteMutation.mutate(note.trim())}
            disabled={!note.trim() || noteMutation.isPending} className="bg-[#3572b9]">
            {noteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </Button>
        </div>

        {loadingHistory ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#38b6ff]" size={18} /></div>
        ) : activities.length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-6">
            {isPt ? 'Nada registrado ainda. Cada passo aparecerá aqui.' : 'Nothing recorded yet. Every step will appear here.'}
          </p>
        ) : (
          <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
            {activities.map(a => {
              const Icon = ACTOR_ICON[a.actor_type] || UserIcon;
              const who = a.actor?.full_name || a.actor?.email || a.actor_label
                || (a.actor_type === 'sdr' ? 'SDR' : a.actor_type === 'workflow' ? 'Workflow' : 'System');
              return (
                <div key={a.id} className="flex gap-2.5 p-2.5 rounded-xl bg-black/20 border border-white/5">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${a.actor_type === 'user' ? 'bg-[#38b6ff]/15 text-[#38b6ff]' : 'bg-[#cb6ce6]/15 text-[#cb6ce6]'}`}>
                    <Icon size={12} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-xs leading-snug">{a.summary}</p>
                    <p className="text-gray-500 text-[10px] mt-0.5">
                      {who} · {new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
