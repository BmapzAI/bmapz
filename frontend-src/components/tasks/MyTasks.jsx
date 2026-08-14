import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  LayoutGrid, List, Calendar as CalendarIcon, Plus, Bot, Eye, EyeOff,
  Trash2, Loader2, Sparkles, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/ui/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { Task, User } from '@/api/entities';
import MentionTextarea from '@/components/mentions/MentionTextarea';
import TaskCard from './TaskCard';
import TaskSuggestions from './TaskSuggestions';
import TaskResultPanel from './TaskResultPanel';
import TaskCalendar from './TaskCalendar';
import {
  BOARD_STATUSES, ALL_STATUSES, PRIORITIES, SECTIONS,
  statusLabel, priorityLabel, sectionLabel, assigneeLabel, formatDue,
  STATUS_CLASS,
} from './taskMeta';

/**
 * My Tasks — the work-management tab in the AI Chat section.
 *
 * Three views over the same data: a kanban board (To do / Doing / Done), a flat
 * list, and a month calendar keyed on the deadline. Tasks can be assigned to a
 * teammate or to the AI agent, followed, prioritised and scoped private or
 * company-wide.
 *
 * Every mutation invalidates both the task list and the summary, so the Home
 * widget and the board never disagree about what is outstanding.
 */
export default function MyTasks({ initialTaskId = null }) {
  const { isPt } = useLanguage();
  // dbUser is the app's own users row (where auto_assign_tasks_to_ai lives), as
  // opposed to `user`, which is the Supabase auth identity.
  const { dbUser, setDbUser } = useAuth();
  const queryClient = useQueryClient();

  const [view, setView] = useState('kanban');
  const [scope, setScope] = useState('all');            // all | me | ai
  const [creating, setCreating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [openTaskId, setOpenTaskId] = useState(initialTaskId);

  const [draft, setDraft] = useState({
    title: '', description: '', priority: 'medium', due_at: '',
    section: 'general', visibility: 'company', assignee_type: 'unassigned', assignee_id: '',
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['taskSummary'] });
  };

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', scope],
    queryFn: () => Task.list(scope === 'all' ? {} : { assignee: scope === 'me' ? 'me' : 'ai' }),
    /**
     * Poll while the agent is mid-task.
     *
     * Every AI run is fire-and-forget on the backend, so the result lands seconds
     * after the request that started it returns. This query is invalidated once at
     * that moment — which fetches the PRE-run row — and then never again, because
     * refetchOnWindowFocus is off globally and nothing else refetches it. The
     * effect was that a task the AI completed sat on "Doing" and showed no result
     * until an unrelated action or a page reload.
     *
     * Polls only while something is actually running, so an idle board costs
     * nothing.
     */
    refetchInterval: (query) => {
      const rows = query?.state?.data;
      const working = Array.isArray(rows) && rows.some(t => t.status === 'doing');
      return working ? 4000 : false;
    },
  });

  const { data: followedIds = [] } = useQuery({
    queryKey: ['taskFollowedIds'],
    queryFn: () => Task.followedIds(),
  });

  // Team list for the assignee picker. Members only — the backend rejects anyone
  // outside the company anyway, so the picker should not offer them.
  const { data: team = [] } = useQuery({
    queryKey: ['teamForTasks'],
    queryFn: () => User.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => Task.create(data),
    onSuccess: (task) => {
      invalidate();
      setCreating(false);
      setDraft({
        title: '', description: '', priority: 'medium', due_at: '',
        section: 'general', visibility: 'company', assignee_type: 'unassigned', assignee_id: '',
      });
      toast.success(task?.assignee_type === 'ai'
        ? (isPt ? 'Tarefa criada e enviada para a IA' : 'Task created and handed to the AI')
        : (isPt ? 'Tarefa criada' : 'Task created'));
    },
    onError: (e) => toast.error((isPt ? 'Falha ao criar: ' : 'Could not create: ') + (e?.message || '')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => Task.update(id, data),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error((isPt ? 'Falha ao atualizar: ' : 'Could not update: ') + (e?.message || '')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => Task.delete(id),
    onSuccess: () => { invalidate(); setOpenTaskId(null); toast.success(isPt ? 'Tarefa excluída' : 'Task deleted'); },
    onError: (e) => toast.error((isPt ? 'Falha ao excluir: ' : 'Could not delete: ') + (e?.message || '')),
  });

  const runAIMutation = useMutation({
    mutationFn: (id) => Task.runWithAI(id),
    onSuccess: () => {
      invalidate();
      toast.success(isPt ? 'A IA está trabalhando nesta tarefa' : 'The AI is working on this task');
    },
    onError: (e) => toast.error((isPt ? 'Falha: ' : 'Could not start: ') + (e?.message || '')),
  });

  const followMutation = useMutation({
    mutationFn: ({ id, following }) => (following ? Task.unfollow(id) : Task.follow(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['taskFollowedIds'] }),
  });

  // User.update('me', …) resolves to PATCH /api/users/me, which returns the updated
  // row — pushed straight into the auth context so the switch reflects the saved
  // value without a refetch.
  const autoAssignMutation = useMutation({
    mutationFn: (on) => User.update('me', { auto_assign_tasks_to_ai: !!on }),
    onSuccess: (updated) => {
      if (updated?.id) setDbUser?.(updated);
      toast.success(updated?.auto_assign_tasks_to_ai
        ? (isPt ? 'Novas tarefas irão para a IA' : 'New tasks will go to the AI')
        : (isPt ? 'Atribuição automática desligada' : 'Auto-assign turned off'));
    },
    onError: (e) => toast.error((isPt ? 'Falha ao salvar: ' : 'Could not save: ') + (e?.message || '')),
  });

  const openTask = useMemo(
    () => tasks.find(t => t.id === openTaskId) || null,
    [tasks, openTaskId],
  );

  const byStatus = useMemo(() => {
    const map = {};
    for (const s of ALL_STATUSES) map[s] = [];
    for (const t of tasks) (map[t.status] || (map[t.status] = [])).push(t);
    return map;
  }, [tasks]);

  const submitDraft = () => {
    if (!draft.title.trim()) {
      toast.error(isPt ? 'Dê um título à tarefa' : 'Give the task a title');
      return;
    }
    createMutation.mutate({
      ...draft,
      // An empty string is not a valid timestamp; send null instead.
      due_at: draft.due_at || null,
      assignee_id: draft.assignee_type === 'user' ? (draft.assignee_id || null) : null,
    });
  };

  return (
    <div className="space-y-4">
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1">
          {[
            { key: 'kanban', icon: LayoutGrid, label: isPt ? 'Kanban' : 'Kanban' },
            { key: 'list', icon: List, label: isPt ? 'Lista' : 'List' },
            { key: 'calendar', icon: CalendarIcon, label: isPt ? 'Calendário' : 'Calendar' },
          ].map(v => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                view === v.key ? 'bg-[#38b6ff]/20 text-[#38b6ff]' : 'text-gray-400 hover:text-white'
              }`}
            >
              <v.icon size={14} /> {v.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="h-9 w-[150px] bg-white/5 border-white/10 text-white text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
              <SelectItem value="all">{isPt ? 'Todas da empresa' : 'All company tasks'}</SelectItem>
              <SelectItem value="me">{isPt ? 'Minhas tarefas' : 'Assigned to me'}</SelectItem>
              <SelectItem value="ai">{isPt ? 'Com a IA' : 'With the AI'}</SelectItem>
            </SelectContent>
          </Select>

          <label className="inline-flex items-center gap-2 text-xs text-gray-400 px-2">
            <Bot size={14} className="text-[#38b6ff]" />
            {isPt ? 'Atribuir à IA automaticamente' : 'Auto-assign to AI'}
            <Switch
              checked={!!dbUser?.auto_assign_tasks_to_ai}
              onCheckedChange={(v) => autoAssignMutation.mutate(v)}
            />
          </label>

          <Button
            variant="outline"
            onClick={() => setSuggesting(s => !s)}
            className="h-9 border-[#38b6ff]/30 text-[#38b6ff] hover:bg-[#38b6ff]/10 gap-1.5 text-xs"
          >
            <Sparkles size={14} /> {isPt ? 'Sugerir com IA' : 'Suggest with AI'}
          </Button>

          <Button
            onClick={() => setCreating(c => !c)}
            className="h-9 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1.5 text-xs"
          >
            <Plus size={14} /> {isPt ? 'Nova tarefa' : 'New task'}
          </Button>
        </div>
      </div>

      {/* ── AI suggestions ────────────────────────────────────────────────── */}
      {suggesting ? <TaskSuggestions onClose={() => setSuggesting(false)} /> : null}

      {/* ── Create form ───────────────────────────────────────────────────── */}
      {creating ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-white text-sm font-semibold">{isPt ? 'Nova tarefa' : 'New task'}</h4>
            <button type="button" onClick={() => setCreating(false)} className="text-gray-500 hover:text-white">
              <X size={16} />
            </button>
          </div>

          <Input
            value={draft.title}
            onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))}
            placeholder={isPt ? 'O que precisa ser feito?' : 'What needs to be done?'}
            className="bg-black/30 border-white/10 text-white"
          />
          {/* @ mentions a teammate, the agent by its configured name, or everyone. */}
          <MentionTextarea
            value={draft.description}
            onChange={(v) => setDraft(d => ({ ...d, description: v }))}
            placeholder={isPt ? 'Detalhes — use @ para mencionar (opcional)' : 'Details — use @ to mention someone (optional)'}
            className="bg-black/30 border-white/10 text-white min-h-[70px]"
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Select value={draft.priority} onValueChange={(v) => setDraft(d => ({ ...d, priority: v }))}>
              <SelectTrigger className="bg-black/30 border-white/10 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                {PRIORITIES.map(p => (
                  <SelectItem key={p} value={p}>{priorityLabel(p, isPt)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={draft.section} onValueChange={(v) => setDraft(d => ({ ...d, section: v }))}>
              <SelectTrigger className="bg-black/30 border-white/10 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                {SECTIONS.map(s => (
                  <SelectItem key={s} value={s}>{sectionLabel(s, isPt)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={draft.due_at}
              onChange={(e) => setDraft(d => ({ ...d, due_at: e.target.value }))}
              className="bg-black/30 border-white/10 text-white text-xs"
            />

            <Select
              value={draft.assignee_type === 'user' ? (draft.assignee_id || 'unassigned') : draft.assignee_type}
              onValueChange={(v) => {
                if (v === 'ai' || v === 'unassigned') setDraft(d => ({ ...d, assignee_type: v, assignee_id: '' }));
                else setDraft(d => ({ ...d, assignee_type: 'user', assignee_id: v }));
              }}
            >
              <SelectTrigger className="bg-black/30 border-white/10 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                <SelectItem value="unassigned">{isPt ? 'Sem responsável' : 'Unassigned'}</SelectItem>
                <SelectItem value="ai">Bmapz AI</SelectItem>
                {(team || []).map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.username ? `@${u.username}` : (u.full_name || u.email)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-xs text-gray-400">
              <Switch
                checked={draft.visibility === 'private'}
                onCheckedChange={(v) => setDraft(d => ({ ...d, visibility: v ? 'private' : 'company' }))}
              />
              {isPt
                ? 'Privada (só eu e o responsável)'
                : 'Private (only me and the assignee)'}
            </label>
            <Button
              onClick={submitDraft}
              disabled={createMutation.isPending}
              className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1.5 text-xs"
            >
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {isPt ? 'Criar' : 'Create'}
            </Button>
          </div>
        </div>
      ) : null}

      {/* ── Views ─────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : view === 'kanban' ? (
        <KanbanView
          byStatus={byStatus}
          isPt={isPt}
          followedIds={followedIds}
          onOpen={(t) => setOpenTaskId(t.id)}
          onMove={(task, status) => updateMutation.mutate({ id: task.id, data: { status } })}
        />
      ) : view === 'list' ? (
        <ListView
          tasks={tasks}
          isPt={isPt}
          followedIds={followedIds}
          onOpen={(t) => setOpenTaskId(t.id)}
        />
      ) : (
        // Day / week / month / year with public holidays, matching the Social
        // Media calendar so the two surfaces behave the same way.
        <TaskCalendar tasks={tasks} onOpen={(t) => setOpenTaskId(t.id)} />
      )}

      {/* ── Detail ────────────────────────────────────────────────────────── */}
      <TaskDetailDialog
        task={openTask}
        isPt={isPt}
        team={team}
        isFollowing={openTask ? followedIds.includes(openTask.id) : false}
        onClose={() => setOpenTaskId(null)}
        onUpdate={(data) => openTask && updateMutation.mutate({ id: openTask.id, data })}
        onDelete={() => openTask && deleteMutation.mutate(openTask.id)}
        onRunAI={() => openTask && runAIMutation.mutate(openTask.id)}
        onToggleFollow={() => openTask && followMutation.mutate({
          id: openTask.id, following: followedIds.includes(openTask.id),
        })}
        busy={updateMutation.isPending || runAIMutation.isPending}
      />
    </div>
  );
}

/* ── Kanban ─────────────────────────────────────────────────────────────── */
/**
 * Drag a card between columns to change its status.
 *
 * The move buttons are KEPT alongside the drag handles rather than replaced.
 * Drag-and-drop is unusable with a keyboard or a screen reader and awkward on a
 * phone, so the buttons stay as the accessible path to the same action — they
 * simply reveal on hover/focus instead of taking up room.
 */
function KanbanView({ byStatus, isPt, followedIds, onOpen, onMove }) {
  const handleDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    // Dropped outside a column, or back where it started — nothing to do.
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const task = (byStatus[source.droppableId] || []).find(t => t.id === draggableId);
    if (!task) return;
    onMove(task, destination.droppableId);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {BOARD_STATUSES.map(status => (
        <div key={status} className="rounded-2xl bg-white/5 border border-white/10 p-3">
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs px-2 py-1 rounded ${STATUS_CLASS[status]}`}>
              {statusLabel(status, isPt)}
            </span>
            <span className="text-gray-500 text-xs">{(byStatus[status] || []).length}</span>
          </div>

          <Droppable droppableId={status}>
            {(dropProvided, dropSnapshot) => (
              <div
                ref={dropProvided.innerRef}
                {...dropProvided.droppableProps}
                className={`space-y-2 min-h-[80px] rounded-xl transition-colors ${
                  dropSnapshot.isDraggingOver ? 'bg-[#38b6ff]/5 ring-1 ring-[#38b6ff]/30' : ''
                }`}
              >
                {(byStatus[status] || []).length === 0 && !dropSnapshot.isDraggingOver ? (
                  <p className="text-gray-600 text-xs py-6 text-center">
                    {isPt ? 'Nada aqui' : 'Nothing here'}
                  </p>
                ) : null}

                {(byStatus[status] || []).map((task, index) => (
                  <Draggable key={task.id} draggableId={task.id} index={index}>
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        className={`group ${dragSnapshot.isDragging ? 'opacity-90 rotate-1' : ''}`}
                      >
                        <TaskCard
                          task={task}
                          isPt={isPt}
                          isFollowing={followedIds.includes(task.id)}
                          onClick={onOpen}
                        />
                        {/* The accessible equivalent of dragging. */}
                        <div className="flex flex-wrap gap-1 mt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          {BOARD_STATUSES.filter(s => s !== status).map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => onMove(task, s)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                            >
                              → {statusLabel(s, isPt)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {dropProvided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      ))}

      {/* Blocked and cancelled live off the board but must not vanish. */}
      {['blocked', 'cancelled'].some(s => (byStatus[s] || []).length) ? (
        <div className="md:col-span-2 xl:col-span-4 rounded-2xl bg-white/5 border border-white/10 p-3">
          <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300">
            {isPt ? 'Bloqueadas / canceladas' : 'Blocked / cancelled'}
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
            {['blocked', 'cancelled'].flatMap(s => byStatus[s] || []).map(task => (
              <TaskCard
                key={task.id}
                task={task}
                isPt={isPt}
                isFollowing={followedIds.includes(task.id)}
                onClick={onOpen}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
    </DragDropContext>
  );
}

/* ── List ───────────────────────────────────────────────────────────────── */
function ListView({ tasks, isPt, followedIds, onOpen }) {
  if (!tasks.length) {
    return (
      <p className="text-gray-500 text-sm text-center py-12">
        {isPt ? 'Nenhuma tarefa ainda.' : 'No tasks yet.'}
      </p>
    );
  }
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs border-b border-white/10">
              <th className="p-3">{isPt ? 'Tarefa' : 'Task'}</th>
              <th className="p-3">{isPt ? 'Responsável' : 'Owner'}</th>
              <th className="p-3">{isPt ? 'Prioridade' : 'Priority'}</th>
              <th className="p-3">{isPt ? 'Prazo' : 'Deadline'}</th>
              <th className="p-3">{isPt ? 'Status' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => (
              <tr
                key={t.id}
                onClick={() => onOpen(t)}
                className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
              >
                <td className="p-3 text-white">
                  {t.title}
                  {followedIds.includes(t.id) ? <Eye size={11} className="inline ml-1.5 text-[#38b6ff]" /> : null}
                </td>
                <td className="p-3 text-gray-400">{assigneeLabel(t, isPt)}</td>
                <td className="p-3 text-gray-400">{priorityLabel(t.priority, isPt)}</td>
                <td className="p-3 text-gray-400">{formatDue(t.due_at, isPt) || '—'}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_CLASS[t.status]}`}>
                    {statusLabel(t.status, isPt)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Detail dialog ──────────────────────────────────────────────────────── */
function TaskDetailDialog({
  task, isPt, team, isFollowing, onClose, onUpdate, onDelete, onRunAI, onToggleFollow, busy,
}) {
  if (!task) return null;

  return (
    <Dialog open={!!task} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {task.description ? (
            <p className="text-gray-300 text-sm whitespace-pre-wrap">{task.description}</p>
          ) : null}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Select value={task.status} onValueChange={(v) => onUpdate({ status: v })}>
              <SelectTrigger className="bg-black/30 border-white/10 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                {ALL_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{statusLabel(s, isPt)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={task.priority} onValueChange={(v) => onUpdate({ priority: v })}>
              <SelectTrigger className="bg-black/30 border-white/10 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                {PRIORITIES.map(p => (
                  <SelectItem key={p} value={p}>{priorityLabel(p, isPt)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              defaultValue={task.due_at ? new Date(task.due_at).toISOString().slice(0, 10) : ''}
              onChange={(e) => onUpdate({ due_at: e.target.value || null })}
              className="bg-black/30 border-white/10 text-white text-xs"
            />

            <Select
              value={task.assignee_type === 'user' ? (task.assignee_id || 'unassigned') : task.assignee_type}
              onValueChange={(v) => {
                if (v === 'ai' || v === 'unassigned') onUpdate({ assignee_type: v, assignee_id: null });
                else onUpdate({ assignee_type: 'user', assignee_id: v });
              }}
            >
              <SelectTrigger className="bg-black/30 border-white/10 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                <SelectItem value="unassigned">{isPt ? 'Sem responsável' : 'Unassigned'}</SelectItem>
                <SelectItem value="ai">Bmapz AI</SelectItem>
                {(team || []).map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.username ? `@${u.username}` : (u.full_name || u.email)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
            <span>{isPt ? 'Seção' : 'Section'}: {sectionLabel(task.section, isPt)}</span>
            <span>·</span>
            <span>
              {isPt ? 'Criada por' : 'Created by'}{' '}
              {task.creator?.username ? `@${task.creator.username}` : (task.creator?.full_name || task.creator?.email || '—')}
            </span>
            {task.visibility === 'private' ? (
              <>
                <span>·</span>
                <span className="text-purple-300">{isPt ? 'Privada' : 'Private'}</span>
              </>
            ) : null}
          </div>

          {/* The AI result (editable), the comment thread, and send-to-section.
              A finished task stays correctable and its output can be moved on. */}
          <TaskResultPanel task={task} />

          {task.ai_error ? (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-300 text-sm">
              {task.ai_error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
            <Button
              size="sm"
              onClick={onRunAI}
              disabled={busy}
              className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1.5 text-xs"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
              {isPt ? 'Fazer com a IA' : 'Do it with AI'}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={onToggleFollow}
              className="border-white/10 text-white hover:bg-white/5 gap-1.5 text-xs"
            >
              {isFollowing ? <EyeOff size={13} /> : <Eye size={13} />}
              {isFollowing
                ? (isPt ? 'Deixar de seguir' : 'Unfollow')
                : (isPt ? 'Seguir' : 'Follow')}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={onDelete}
              className="border-red-500/20 text-red-400 hover:bg-red-500/10 gap-1.5 text-xs ml-auto"
            >
              <Trash2 size={13} /> {isPt ? 'Excluir' : 'Delete'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
