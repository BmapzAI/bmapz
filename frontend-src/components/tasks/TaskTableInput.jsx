import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Loader2, Table2, Send, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Task } from '@/api/entities';
import { PRIORITIES, priorityLabel } from './taskMeta';
import OwnerPicker from './OwnerPicker';

const emptyRow = () => ({ title: '', owner: '', priority: 'medium', deadline: '' });

/**
 * Task-table entry mode for AI chat.
 *
 * Lets the user type work as a table — task / owner / priority / deadline — and
 * send the whole thing to the agent in one go instead of describing it in prose.
 *
 * `owner` is free text on purpose: an @username, an email, or "AI" to hand it
 * straight to the agent. The backend resolves those in one query and reports any it
 * could not match rather than failing the whole table, so a typo costs one row, not
 * the batch.
 */
export default function TaskTableInput({ onClose, onSent }) {
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState([emptyRow()]);

  const setRow = (i, patch) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () => setRows(rs => [...rs, emptyRow()]);
  const removeRow = (i) => setRows(rs => (rs.length === 1 ? [emptyRow()] : rs.filter((_, idx) => idx !== i)));

  const sendMutation = useMutation({
    mutationFn: (tasks) => Task.bulkCreate(tasks),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskSummary'] });

      const n = res?.created ?? 0;
      toast.success(isPt ? `${n} tarefa(s) criada(s)` : `${n} task(s) created`);

      // Surface anything the backend could not take, instead of pretending the
      // whole table landed.
      if (Array.isArray(res?.problems) && res.problems.length) {
        for (const p of res.problems.slice(0, 4)) {
          toast.warning(`${isPt ? 'Linha' : 'Row'} ${p.row}: ${p.reason}`);
        }
      }
      setRows([emptyRow()]);
      onSent?.(res);
      onClose?.();
    },
    onError: (e) => toast.error((isPt ? 'Falha ao enviar: ' : 'Could not send: ') + (e?.message || '')),
  });

  const send = () => {
    const filled = rows.filter(r => r.title.trim());
    if (!filled.length) {
      toast.error(isPt ? 'Escreva pelo menos uma tarefa' : 'Write at least one task');
      return;
    }
    sendMutation.mutate(filled);
  };

  return (
    <div className="rounded-2xl bg-white/5 border border-[#38b6ff]/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-white text-sm font-semibold inline-flex items-center gap-2">
          <Table2 size={15} className="text-[#38b6ff]" />
          {isPt ? 'Modo tabela de tarefas' : 'Task table mode'}
        </h4>
        <span className="text-[11px] text-gray-500 inline-flex items-center gap-1">
          <Bot size={12} /> {isPt ? 'escreva "IA" no responsável' : 'type "AI" as the owner'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="pb-2 pr-2 font-normal">{isPt ? 'Tarefa' : 'Task'}</th>
              <th className="pb-2 pr-2 font-normal w-[130px]">{isPt ? 'Responsável' : 'Owner'}</th>
              <th className="pb-2 pr-2 font-normal w-[120px]">{isPt ? 'Prioridade' : 'Priority'}</th>
              <th className="pb-2 pr-2 font-normal w-[140px]">{isPt ? 'Prazo' : 'Deadline'}</th>
              <th className="pb-2 w-[32px]" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="pr-2 pb-2">
                  <Input
                    value={r.title}
                    onChange={(e) => setRow(i, { title: e.target.value })}
                    placeholder={isPt ? 'O que fazer' : 'What to do'}
                    className="h-8 bg-black/30 border-white/10 text-white text-xs"
                  />
                </td>
                <td className="pr-2 pb-2">
                  {/* @mention autocomplete: teammates by @username, the AI agent by
                      its configured name, and everyone. */}
                  <OwnerPicker
                    value={r.owner}
                    onChange={(v) => setRow(i, { owner: v })}
                    className="h-8 bg-black/30 border-white/10 text-white text-xs"
                  />
                </td>
                <td className="pr-2 pb-2">
                  <select
                    value={r.priority}
                    onChange={(e) => setRow(i, { priority: e.target.value })}
                    className="h-8 w-full rounded-md bg-black/30 border border-white/10 text-white text-xs px-2"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p} value={p} className="bg-[#1a1a1a]">
                        {priorityLabel(p, isPt)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="pr-2 pb-2">
                  <Input
                    type="date"
                    value={r.deadline}
                    onChange={(e) => setRow(i, { deadline: e.target.value })}
                    className="h-8 bg-black/30 border-white/10 text-white text-xs"
                  />
                </td>
                <td className="pb-2">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-gray-500 hover:text-red-400 p-1"
                    aria-label={isPt ? 'Remover linha' : 'Remove row'}
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          onClick={addRow}
          className="h-8 border-white/10 text-white hover:bg-white/5 gap-1.5 text-xs"
        >
          <Plus size={13} /> {isPt ? 'Adicionar linha' : 'Add row'}
        </Button>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            className="h-8 border-white/10 text-gray-300 hover:bg-white/5 text-xs"
          >
            {isPt ? 'Cancelar' : 'Cancel'}
          </Button>
          <Button
            size="sm"
            onClick={send}
            disabled={sendMutation.isPending}
            className="h-8 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1.5 text-xs"
          >
            {sendMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {isPt ? 'Enviar para o agente' : 'Send to the agent'}
          </Button>
        </div>
      </div>
    </div>
  );
}
