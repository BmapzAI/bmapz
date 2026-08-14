import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bot, User as UserIcon, CheckSquare, Clock, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Task } from '@/api/entities';

/**
 * Task metrics for the Dashboards section: who is doing the work, how much is
 * outstanding, and what the agent is actually saving.
 *
 * "Time saved" is shown ONLY when there is a human baseline to compare against —
 * the backend reports has_human_baseline for exactly this reason. A saving figure
 * with nothing behind it is worse than no figure, because people make decisions on
 * it.
 */
export default function TaskMetricsCard() {
  const { isPt } = useLanguage();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['taskSummary'],
    queryFn: () => Task.summary(),
  });

  const m = summary?.metrics;

  const humanTime = (minutes) => {
    if (minutes === null || minutes === undefined) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = minutes / 60;
    if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`;
    return `${(hours / 24).toFixed(1)} ${isPt ? 'dias' : 'days'}`;
  };

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white inline-flex items-center gap-2">
            <CheckSquare size={18} className="text-[#38b6ff]" />
            {isPt ? 'Tarefas' : 'Tasks'}
          </h2>
          <p className="text-sm mt-0.5 text-gray-400">
            {isPt ? 'Quem está executando e o que a IA economiza' : 'Who is executing, and what the AI saves'}
          </p>
        </div>
        <Link to="/AIChat?tab=tasks" className="text-[#38b6ff] text-sm hover:underline inline-flex items-center gap-1">
          {isPt ? 'Abrir' : 'Open'} <ArrowRight size={13} />
        </Link>
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-[#38b6ff] border-t-transparent animate-spin" />
        </div>
      ) : !m || m.total === 0 ? (
        <p className="text-gray-500 text-sm py-6">
          {isPt
            ? 'Nenhuma tarefa ainda — crie uma e as métricas aparecem aqui.'
            : 'No tasks yet — create one and the metrics appear here.'}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: isPt ? 'Total' : 'Total', value: m.total },
              { label: isPt ? 'Concluídas' : 'Completed', value: m.completed },
              { label: isPt ? 'Pendentes' : 'Pending', value: m.pending },
              { label: isPt ? 'Taxa de conclusão' : 'Completion rate', value: `${m.completion_rate}%` },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-black/25 border border-white/5 p-3">
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* AI vs human split — the headline the section exists for. */}
          {m.completed > 0 ? (
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-[#38b6ff]">
                  <Bot size={13} /> {isPt ? 'IA' : 'AI'} {m.ai_share_pct}% ({m.done_by_ai})
                </span>
                <span className="inline-flex items-center gap-1.5 text-gray-300">
                  <UserIcon size={13} /> {isPt ? 'Pessoas' : 'People'} {m.human_share_pct}% ({m.done_by_human})
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden flex">
                <div className="bg-[#38b6ff]" style={{ width: `${m.ai_share_pct}%` }} />
                <div className="bg-gray-500" style={{ width: `${m.human_share_pct}%` }} />
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-black/25 border border-white/5 p-3">
              <p className="text-[11px] text-gray-400 mb-1 inline-flex items-center gap-1.5">
                <Clock size={12} /> {isPt ? 'Tempo mediano por tarefa' : 'Median time per task'}
              </p>
              <p className="text-sm text-white">
                <span className="text-[#38b6ff]">{isPt ? 'IA' : 'AI'}</span>{' '}
                {humanTime(m.median_minutes_ai) || '—'}
                <span className="text-gray-600 mx-2">·</span>
                <span className="text-gray-300">{isPt ? 'Pessoas' : 'People'}</span>{' '}
                {humanTime(m.median_minutes_human) || '—'}
              </p>
            </div>

            <div className="rounded-xl bg-black/25 border border-white/5 p-3">
              <p className="text-[11px] text-gray-400 mb-1">
                {isPt ? 'Tempo economizado pela IA' : 'Time saved by the AI'}
              </p>
              {m.has_human_baseline ? (
                <p className="text-sm text-green-400">{humanTime(m.minutes_saved_by_ai) || '0 min'}</p>
              ) : (
                // Deliberately honest: no human-completed task means no baseline,
                // and an invented saving would be a number someone acts on.
                <p className="text-xs text-gray-500">
                  {isPt
                    ? 'Sem base de comparação ainda — conclua algumas tarefas manualmente.'
                    : 'No baseline yet — complete a few tasks by hand to compare against.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
