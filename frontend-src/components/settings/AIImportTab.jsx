import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Trash2, Brain, FileJson, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/ui/LanguageContext';
import { api } from '@/api/apiClient';

/**
 * Import AI history from Claude or ChatGPT into the Company Brain.
 *
 * One-way by design: nothing leaves Bmapz. The point is that context scattered
 * across other assistants ends up here, working through the company's own brain
 * and its own provider keys.
 *
 * The conversations themselves are NOT stored — they are distilled into durable
 * lessons, because the brain runs on a fixed budget and a single session export
 * can be tens of thousands of messages. The panel shows what was learned so the
 * user can judge it, and remove it in one click if it is wrong.
 */

const SOURCE_LABEL = {
  claude_code: 'Claude Code / Cowork',
  claude_export: 'Claude',
  chatgpt_export: 'ChatGPT',
  markdown: 'Notes',
};

export default function AIImportTab() {
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const { data: imports = [] } = useQuery({
    queryKey: ['aiImports'],
    queryFn: () => api.get('/api/ai-imports'),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['aiImports'] });

  const removeIt = useMutation({
    mutationFn: (id) => api.delete(`/api/ai-imports/${id}`),
    onSuccess: () => {
      refresh();
      toast.success(isPt ? 'Importação removida' : 'Import removed');
    },
    onError: (e) => toast.error(e.message || 'Could not remove that import.'),
  });

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';           // let the same file be chosen again after a failure
    if (!file) return;

    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/api/ai-imports', form);
      refresh();
      toast.success(isPt
        ? `${res.lessons_added} aprendizado(s) adicionados ao cérebro`
        : `${res.lessons_added} lesson(s) added to the brain`);
    } catch (err) {
      // A repeat upload is a normal thing to do, not an error worth alarming about.
      if (err?.code === 'ALREADY_IMPORTED' || /already been imported/i.test(err.message || '')) {
        toast.info(isPt ? 'Este arquivo já foi importado.' : 'This file has already been imported.');
      } else {
        toast.error(err.message || (isPt ? 'Falha ao importar.' : 'Import failed.'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#cb6ce6]/20 flex items-center justify-center shrink-0">
            <Brain size={20} className="text-[#cb6ce6]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {isPt ? 'Importar histórico de IA' : 'Import AI history'}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {isPt
                ? 'Traga o contexto das suas conversas do Claude ou ChatGPT para o cérebro da empresa. Tudo fica aqui — nada é enviado de volta para esses aplicativos.'
                : 'Bring the context from your Claude or ChatGPT conversations into the company brain. Everything stays here — nothing is sent back out to those apps.'}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-black/25 border border-white/5 p-4 text-xs text-gray-400 space-y-2">
          <p className="text-gray-300 font-medium">{isPt ? 'O que enviar' : 'What to upload'}</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              <span className="text-gray-300">ChatGPT</span> — {isPt ? 'Configurações → Controles de dados → Exportar dados' : 'Settings → Data controls → Export data'} → <code className="text-[#38b6ff]">conversations.json</code>
            </li>
            <li>
              <span className="text-gray-300">Claude</span> — {isPt ? 'Configurações → Exportar dados' : 'Settings → Export data'} → <code className="text-[#38b6ff]">conversations.json</code>
            </li>
            <li>
              <span className="text-gray-300">Claude Code / Cowork</span> — {isPt ? 'um arquivo de sessão' : 'a session file'} <code className="text-[#38b6ff]">.jsonl</code>
            </li>
            <li>{isPt ? 'Ou qualquer arquivo de notas' : 'Or any notes file'} <code className="text-[#38b6ff]">.md</code></li>
          </ul>
          <p className="text-gray-500 pt-1">
            {isPt
              ? 'As conversas não são armazenadas. Elas são destiladas em fatos duráveis sobre o negócio — o resto é descartado.'
              : 'Conversations are not stored. They are distilled into durable facts about the business; the rest is discarded.'}
          </p>
        </div>

        <input ref={fileRef} type="file" onChange={onPick} className="hidden"
          accept=".json,.jsonl,.md,.txt,application/json,text/markdown,text/plain" />

        <Button onClick={() => fileRef.current?.click()} disabled={busy}
          className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {busy
            ? (isPt ? 'Lendo e destilando...' : 'Reading and distilling...')
            : (isPt ? 'Escolher arquivo' : 'Choose a file')}
        </Button>
      </div>

      {imports.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h3 className="text-white font-semibold text-sm">
            {isPt ? 'Importado' : 'Imported'} <span className="text-gray-500 font-normal">({imports.length})</span>
          </h3>

          {imports.map(imp => (
            <div key={imp.id} className="rounded-xl bg-black/25 border border-white/5 p-3">
              <div className="flex items-start gap-3">
                <FileJson size={15} className="text-[#38b6ff] mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm truncate">{imp.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {SOURCE_LABEL[imp.source] || imp.source}
                    {` · ${imp.conversations} ${isPt ? 'conversa(s)' : 'conversation(s)'}`}
                    {` · ${imp.messages_seen} ${isPt ? 'mensagens lidas' : 'messages read'}`}
                    {` · ${new Date(imp.created_at).toLocaleDateString(isPt ? 'pt-BR' : 'en-US')}`}
                  </p>

                  {imp.status === 'done' && (
                    <p className="text-green-400 text-xs mt-1.5 inline-flex items-center gap-1.5">
                      <CheckCircle2 size={12} />
                      {imp.lessons_added} {isPt ? 'aprendizado(s) no cérebro' : 'lesson(s) in the brain'}
                    </p>
                  )}
                  {imp.status === 'failed' && (
                    <p className="text-red-400 text-xs mt-1.5 inline-flex items-start gap-1.5">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      <span>{imp.error || (isPt ? 'Falhou' : 'Failed')}</span>
                    </p>
                  )}

                  {imp.summary && (
                    <p className="text-gray-400 text-xs mt-2 leading-relaxed">{imp.summary}</p>
                  )}
                </div>

                {/* Removing an import removes exactly the lessons it created —
                    they carry its id, so nothing else is disturbed. */}
                <button
                  onClick={() => {
                    if (window.confirm(isPt
                      ? 'Remover esta importação e o que ela ensinou?'
                      : 'Remove this import and everything it taught?')) removeIt.mutate(imp.id);
                  }}
                  title={isPt ? 'Remover' : 'Remove'}
                  className="text-gray-600 hover:text-red-400 p-1 shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
