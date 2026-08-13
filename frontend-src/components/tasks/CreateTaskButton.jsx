import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckSquare, Loader2, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Task } from '@/api/entities';
import { PRIORITIES, priorityLabel, sectionLabel } from './taskMeta';

/**
 * "Turn this into a task" — the entry point every section drops in.
 *
 * This is what connects task management to Ads, Sales, Inbox, Blog, SEO, Social
 * and the SDR agent: the caller passes its `section` and, when it has one, the
 * record the task is about (`linkedType` / `linkedId`). The section travels with
 * the task, and lib/taskRunner.js briefs the agent differently per section — so a
 * task raised from Ads is answered like an ads task, not generic prose.
 *
 * Props:
 *   section      one of taskMeta SECTIONS — required, it is the whole point
 *   linkedType   'lead' | 'campaign' | 'post' | 'blog_post' | 'workflow' | …
 *   linkedId     uuid of that record
 *   defaultTitle prefilled title, e.g. the lead or campaign name
 *   label        override the button text
 *   size/variant/className passed through to Button
 */
export default function CreateTaskButton({
  section = 'general',
  linkedType = null,
  linkedId = null,
  defaultTitle = '',
  defaultDescription = '',
  label = null,
  size = 'sm',
  variant = 'outline',
  className = '',
}) {
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [priority, setPriority] = useState('medium');
  const [dueAt, setDueAt] = useState('');
  const [toAI, setToAI] = useState(false);

  // Re-seed from props each time the dialog opens: the caller's record may have
  // changed since this component mounted (a different lead selected, say).
  const openDialog = () => {
    setTitle(defaultTitle);
    setDescription(defaultDescription);
    setPriority('medium');
    setDueAt('');
    setToAI(false);
    setOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (data) => Task.create(data),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskSummary'] });
      setOpen(false);
      toast.success(task?.assignee_type === 'ai'
        ? (isPt ? 'Tarefa criada — a IA já está trabalhando' : 'Task created — the AI is on it')
        : (isPt ? 'Tarefa criada' : 'Task created'));
    },
    onError: (e) => toast.error((isPt ? 'Falha ao criar a tarefa: ' : 'Could not create the task: ') + (e?.message || '')),
  });

  const submit = () => {
    if (!title.trim()) {
      toast.error(isPt ? 'Dê um título à tarefa' : 'Give the task a title');
      return;
    }
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      due_at: dueAt || null,
      section,
      linked_type: linkedType,
      linked_id: linkedId,
      assignee_type: toAI ? 'ai' : 'unassigned',
    });
  };

  return (
    <>
      <Button
        size={size}
        variant={variant}
        onClick={openDialog}
        className={`gap-1.5 ${variant === 'outline' ? 'border-white/10 text-white hover:bg-white/5' : ''} ${className}`}
      >
        <CheckSquare size={14} />
        {label || (isPt ? 'Criar tarefa' : 'Create task')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isPt ? 'Nova tarefa' : 'New task'}
              <span className="ml-2 text-xs text-gray-500 font-normal">
                {sectionLabel(section, isPt)}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isPt ? 'O que precisa ser feito?' : 'What needs to be done?'}
              className="bg-black/30 border-white/10 text-white"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isPt ? 'Contexto para a IA ou para o responsável (opcional)' : 'Context for the AI or the assignee (optional)'}
              className="bg-black/30 border-white/10 text-white min-h-[80px]"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="h-9 rounded-md bg-black/30 border border-white/10 text-white text-xs px-2"
              >
                {PRIORITIES.map(p => (
                  <option key={p} value={p} className="bg-[#1a1a1a]">{priorityLabel(p, isPt)}</option>
                ))}
              </select>
              <Input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="bg-black/30 border-white/10 text-white text-xs"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-300 p-2 rounded-lg bg-[#38b6ff]/5 border border-[#38b6ff]/20">
              <Switch checked={toAI} onCheckedChange={setToAI} />
              <Bot size={14} className="text-[#38b6ff]" />
              {isPt
                ? 'Deixar a IA fazer agora'
                : 'Let the AI do it now'}
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpen(false)}
                className="border-white/10 text-gray-300 hover:bg-white/5 text-xs"
              >
                {isPt ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button
                size="sm"
                onClick={submit}
                disabled={createMutation.isPending}
                className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1.5 text-xs"
              >
                {createMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckSquare size={13} />}
                {isPt ? 'Criar tarefa' : 'Create task'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
