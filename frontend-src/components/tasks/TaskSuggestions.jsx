import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Plus, X, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Task } from '@/api/entities';
import { priorityLabel, sectionLabel, PRIORITY_CLASS } from './taskMeta';

/**
 * "Ask the AI what needs doing."
 *
 * Two steps on purpose: the agent PROPOSES, the user ACCEPTS. Creating straight
 * from a model response would fill someone's board with work they never asked
 * for, so suggestions arrive as a checklist and only the ticked ones are created.
 *
 * Accepted suggestions go through the same bulk endpoint the table mode uses, so
 * there is one creation path with one set of validation rules.
 */
export default function TaskSuggestions({ onClose }) {
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [suggestions, setSuggestions] = useState(null);
  const [chosen, setChosen] = useState({});

  const suggestMutation = useMutation({
    mutationFn: (p) => Task.suggest({ prompt: p }),
    onSuccess: (list) => {
      const items = Array.isArray(list) ? list : [];
      if (!items.length) {
        toast.info(isPt ? 'A IA não sugeriu nada. Tente detalhar mais.' : 'The AI suggested nothing. Try adding detail.');
        return;
      }
      setSuggestions(items);
      // Everything ticked by default — the user is reviewing, not building a list
      // from scratch.
      setChosen(Object.fromEntries(items.map((_, i) => [i, true])));
    },
    onError: (e) => {
      if (e?.code === 'CREDITS_EXHAUSTED' || /credits/i.test(e?.message || '')) {
        toast.error(isPt ? 'Sem créditos de IA.' : 'Out of AI credits.');
        return;
      }
      toast.error((isPt ? 'Falha ao sugerir: ' : 'Could not suggest: ') + (e?.message || ''));
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (tasks) => Task.bulkCreate(tasks),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskSummary'] });
      toast.success(isPt ? `${res?.created ?? 0} tarefa(s) criada(s)` : `${res?.created ?? 0} task(s) created`);
      setSuggestions(null);
      setPrompt('');
      onClose?.();
    },
    onError: (e) => toast.error((isPt ? 'Falha ao criar: ' : 'Could not create: ') + (e?.message || '')),
  });

  const accept = () => {
    const picked = (suggestions || []).filter((_, i) => chosen[i]);
    if (!picked.length) {
      toast.error(isPt ? 'Selecione ao menos uma tarefa' : 'Pick at least one task');
      return;
    }
    acceptMutation.mutate(picked.map(s => ({
      title: s.title,
      description: s.description,
      priority: s.priority,
      section: s.section,
      // The model's judgement of "the agent could finish this alone" becomes the
      // owner. Anything it flagged as needing a person stays unassigned.
      owner: s.suggest_ai ? 'AI' : '',
      deadline: Number.isFinite(s.due_in_days)
        ? new Date(Date.now() + s.due_in_days * 86400000).toISOString().slice(0, 10)
        : null,
    })));
  };

  return (
    <div className="rounded-2xl bg-white/5 border border-[#38b6ff]/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-white text-sm font-semibold inline-flex items-center gap-2">
          <Sparkles size={15} className="text-[#38b6ff]" />
          {isPt ? 'Pedir sugestões à IA' : 'Ask the AI for tasks'}
        </h4>
        <button type="button" onClick={onClose} className="text-gray-500 hover:text-white">
          <X size={16} />
        </button>
      </div>

      {!suggestions ? (
        <>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={isPt
              ? 'Ex.: precisamos lançar a campanha do Q4 no Meta e no Google até o fim do mês'
              : 'e.g. we need to launch the Q4 campaign on Meta and Google by month end'}
            className="bg-black/30 border-white/10 text-white min-h-[80px] text-sm"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                if (!prompt.trim()) {
                  toast.error(isPt ? 'Descreva o que precisa ser feito' : 'Describe what needs doing');
                  return;
                }
                suggestMutation.mutate(prompt.trim());
              }}
              disabled={suggestMutation.isPending}
              className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1.5 text-xs"
            >
              {suggestMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {isPt ? 'Sugerir tarefas' : 'Suggest tasks'}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-gray-400 text-xs">
            {isPt
              ? 'Desmarque o que não quiser. Itens marcados com o robô serão feitos pela IA.'
              : 'Untick anything you do not want. Items marked with the robot will be done by the AI.'}
          </p>

          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {suggestions.map((s, i) => (
              <label
                key={i}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                  chosen[i] ? 'bg-black/30 border-[#38b6ff]/30' : 'bg-black/10 border-white/5 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={!!chosen[i]}
                  onChange={(e) => setChosen(c => ({ ...c, [i]: e.target.checked }))}
                  className="mt-1 accent-[#38b6ff]"
                />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm">{s.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_CLASS[s.priority]}`}>
                      {priorityLabel(s.priority, isPt)}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">
                      {sectionLabel(s.section, isPt)}
                    </span>
                    {s.suggest_ai ? <Bot size={12} className="text-[#38b6ff]" /> : null}
                  </span>
                  {s.description ? (
                    <span className="block text-gray-500 text-xs mt-0.5">{s.description}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>

          <div className="flex justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSuggestions(null)}
              className="border-white/10 text-gray-300 hover:bg-white/5 text-xs"
            >
              {isPt ? 'Recomeçar' : 'Start over'}
            </Button>
            <Button
              size="sm"
              onClick={accept}
              disabled={acceptMutation.isPending}
              className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1.5 text-xs"
            >
              {acceptMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {isPt ? 'Adicionar selecionadas' : 'Add selected'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
