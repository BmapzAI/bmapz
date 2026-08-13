import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, ArrowRight, Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Task } from '@/api/entities';
import TaskCard from './TaskCard';
import { statusLabel, STATUS_CLASS } from './taskMeta';

/**
 * Home page "My Tasks" widget.
 *
 * To do / Doing / Done tabs, each task a clickable card that says who did it.
 * Clicking anything opens the same task in the My Tasks tab of the AI Chat
 * section, so there is one place where a task is actually worked on.
 */
export default function TasksWidget() {
  const { isPt } = useLanguage();
  const navigate = useNavigate();
  const [tab, setTab] = useState('todo');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', 'widget', tab],
    queryFn: () => Task.list({ status: tab, limit: 50 }),
  });

  const { data: summary } = useQuery({
    queryKey: ['taskSummary'],
    queryFn: () => Task.summary(),
  });

  const openTask = (task) => navigate(`/AIChat?tab=tasks&task=${task.id}`);
  const openBoard = () => navigate('/AIChat?tab=tasks');

  const count = (key) => (summary && typeof summary[key] === 'number' ? summary[key] : null);

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold inline-flex items-center gap-2">
          <CheckSquare size={16} className="text-[#38b6ff]" />
          {isPt ? 'Minhas tarefas' : 'My Tasks'}
          {count('overdue') ? (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
              {count('overdue')} {isPt ? 'atrasadas' : 'overdue'}
            </span>
          ) : null}
        </h3>
        <button
          type="button"
          onClick={openBoard}
          className="text-[#38b6ff] text-xs inline-flex items-center gap-1 hover:underline"
        >
          {isPt ? 'Ver tudo' : 'View all'} <ArrowRight size={12} />
        </button>
      </div>

      <div className="flex items-center gap-1 rounded-xl bg-black/20 p-1 mb-3">
        {['todo', 'doing', 'done'].map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setTab(s)}
            className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${
              tab === s ? STATUS_CLASS[s] : 'text-gray-400 hover:text-white'
            }`}
          >
            {statusLabel(s, isPt)}
            {count(s) !== null ? <span className="ml-1 opacity-70">{count(s)}</span> : null}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-gray-500">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">
          {tab === 'done'
            ? (isPt ? 'Nada concluído ainda.' : 'Nothing completed yet.')
            : (isPt ? 'Nenhuma tarefa aqui.' : 'No tasks here.')}
        </p>
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {tasks.slice(0, 8).map(task => (
            <TaskCard key={task.id} task={task} isPt={isPt} onClick={openTask} />
          ))}
          {tasks.length > 8 ? (
            <button
              type="button"
              onClick={openBoard}
              className="w-full text-center text-xs text-gray-400 hover:text-white py-2"
            >
              +{tasks.length - 8} {isPt ? 'mais' : 'more'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
