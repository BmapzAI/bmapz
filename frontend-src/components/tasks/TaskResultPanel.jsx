import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Send, Loader2, MessageSquare, Bot, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Task } from '@/api/entities';
import { SECTIONS, sectionLabel } from './taskMeta';
import MentionTextarea from '@/components/mentions/MentionTextarea';

/**
 * The AI result, its comment thread, and the button that sends the work onward.
 *
 * Two things make a finished task useful rather than final:
 *  - the result is EDITABLE before it is sent to a section, because the agent's
 *    output is a starting draft, not a fait accompli;
 *  - a comment can be addressed to the agent, which re-runs the task with that
 *    feedback instead of leaving "done but wrong" as a dead end.
 */
export default function TaskResultPanel({ task }) {
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState(task.ai_result?.content || '');
  const [section, setSection] = useState(task.section || 'general');
  const [comment, setComment] = useState('');

  /**
   * Re-seed the editable draft when a NEW result arrives — and only then.
   *
   * The draft was seeded once at mount. This dialog stays mounted across refetches,
   * so after the AI revised a task the textarea still held the previous result:
   * "Send to section" then shipped the superseded text into a real blog/social/
   * campaign record. And when the dialog was already open while the agent worked,
   * the result landed but the box stayed blank — the output was invisible and Send
   * stayed disabled by the empty check.
   *
   * Keyed on `ai_result.at` (the result's timestamp) rather than on `task`,
   * because syncing on every task change would discard edits the user is part-way
   * through typing — and editing before sending is the whole point of this box.
   */
  const resultStamp = task.ai_result?.at || null;
  useEffect(() => {
    if (resultStamp) setDraft(task.ai_result?.content || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultStamp]);

  // While the agent is working, poll — the run is fire-and-forget on the backend,
  // so the reply and the revised result arrive seconds AFTER the request that
  // started them returns. Without this the thread showed the comment and then
  // nothing, forever.
  const agentWorking = task.status === 'doing' || task.metadata?.awaiting_ai === true;

  const { data: comments = [] } = useQuery({
    queryKey: ['taskComments', task.id],
    queryFn: () => Task.comments(task.id),
    refetchInterval: agentWorking ? 4000 : false,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['taskComments', task.id] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const sendMutation = useMutation({
    mutationFn: () => Task.sendToSection(task.id, { section, content: draft }),
    onSuccess: (res) => {
      refresh();
      toast.success(res?.summary || (isPt ? 'Enviado' : 'Sent'));
    },
    onError: (e) => toast.error((isPt ? 'Falha ao enviar: ' : 'Could not send: ') + (e?.message || '')),
  });

  const commentMutation = useMutation({
    mutationFn: ({ body, toAI }) => Task.comment(task.id, body, toAI),
    onSuccess: (_r, vars) => {
      setComment('');
      refresh();
      toast.success(vars.toAI
        ? (isPt ? 'A IA vai revisar com o seu feedback' : 'The AI will revise using your feedback')
        : (isPt ? 'Comentário adicionado' : 'Comment added'));
    },
    onError: (e) => toast.error((isPt ? 'Falha: ' : 'Could not comment: ') + (e?.message || '')),
  });

  const alreadySent = task.metadata?.sent_to?.section;

  return (
    <div className="space-y-4">
      {/* ── Result, editable ─────────────────────────────────────────────── */}
      {task.ai_result?.content ? (
        <div className="rounded-xl bg-black/30 border border-[#38b6ff]/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[#38b6ff] text-xs">
              <Sparkles size={12} /> {isPt ? 'Resultado da IA' : 'AI result'}
            </span>
            {alreadySent ? (
              <span className="text-[11px] text-gray-500">
                {isPt ? 'já enviado para' : 'already sent to'} {sectionLabel(alreadySent, isPt)}
              </span>
            ) : null}
          </div>

          {/* Editable on purpose — send what you want, not what it wrote. */}
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="bg-black/40 border-white/10 text-gray-200 text-sm min-h-[140px]"
          />

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="h-8 rounded-md bg-black/40 border border-white/10 text-white text-xs px-2"
            >
              {SECTIONS.map(s => (
                <option key={s} value={s} className="bg-[#1a1a1a]">{sectionLabel(s, isPt)}</option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !draft.trim()}
              className="h-8 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1.5 text-xs"
            >
              {sendMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              {isPt ? 'Enviar para a seção' : 'Send to section'}
            </Button>
          </div>
        </div>
      ) : null}

      {/* ── Thread ───────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 text-gray-400 text-xs">
          <MessageSquare size={12} /> {isPt ? 'Comentários' : 'Comments'}
          {comments.length ? <span className="text-gray-600">({comments.length})</span> : null}
        </span>

        {comments.map(c => (
          <div key={c.id} className="rounded-lg bg-black/20 border border-white/5 p-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              {c.author_type === 'ai' ? <Bot size={11} className="text-[#38b6ff]" /> : null}
              <span className="text-[11px] text-gray-400">{c.author_label}</span>
              {c.directed_to_ai ? (
                <span className="text-[10px] px-1.5 rounded bg-[#38b6ff]/15 text-[#38b6ff]">
                  {isPt ? 'para a IA' : 'to the AI'}
                </span>
              ) : null}
            </div>
            <p className="text-gray-200 text-xs whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}

        {/* @mentions: teammates, the agent by its configured name, or everyone. */}
        <MentionTextarea
          value={comment}
          onChange={setComment}
          placeholder={isPt
            ? 'Comente, use @ para mencionar, ou diga à IA o que corrigir…'
            : 'Comment, use @ to mention someone, or tell the AI what to fix…'}
          className="bg-black/30 border-white/10 text-white text-sm min-h-[60px]"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => comment.trim() && commentMutation.mutate({ body: comment, toAI: false })}
            disabled={commentMutation.isPending || !comment.trim()}
            className="h-8 border-white/10 text-white hover:bg-white/5 gap-1.5 text-xs"
          >
            <MessageSquare size={13} /> {isPt ? 'Comentar' : 'Comment'}
          </Button>
          <Button
            size="sm"
            onClick={() => comment.trim() && commentMutation.mutate({ body: comment, toAI: true })}
            disabled={commentMutation.isPending || !comment.trim()}
            className="h-8 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1.5 text-xs"
          >
            {commentMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {isPt ? 'Pedir revisão à IA' : 'Ask the AI to revise'}
          </Button>
        </div>
      </div>
    </div>
  );
}
