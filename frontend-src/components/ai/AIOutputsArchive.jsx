import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Search, Copy, Eye, RotateCcw, Archive, Loader2, Sparkles,
  CheckCircle2, XCircle, Clock, PencilLine, Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { AIOutput } from '@/api/entities';

/**
 * AI Outputs → Archive tab.
 *
 * Everything the AI has ever generated for this company, with the outcome the
 * team gave it (approved / edited / rejected / pending), the date and time, and
 * the ability to view, copy or reuse it. Company-level access: the API scopes
 * every query to req.companyId.
 *
 * The same outcomes feed the Company Brain's learning loop
 * (backend/src/lib/companyBrain.js → recordOutcomeLearning), so this page is
 * both the audit trail and the training signal.
 */

const STATUS_META = {
  approved: { label: 'Approved', labelPt: 'Aprovado', icon: CheckCircle2, cls: 'text-green-400 bg-green-400/10 border-green-400/20' },
  rejected: { label: 'Rejected', labelPt: 'Rejeitado', icon: XCircle, cls: 'text-red-400 bg-red-400/10 border-red-400/20' },
  pending: { label: 'Pending approval', labelPt: 'Aguardando aprovação', icon: Clock, cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  applied: { label: 'Applied', labelPt: 'Aplicado', icon: CheckCircle2, cls: 'text-[#38b6ff] bg-[#38b6ff]/10 border-[#38b6ff]/20' },
};

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All categories', labelPt: 'Todas as categorias' },
  { value: 'message_templates', label: 'Message Templates', labelPt: 'Modelos de mensagem' },
  { value: 'email_templates', label: 'Email Templates', labelPt: 'Modelos de e-mail' },
  { value: 'strategies', label: 'Strategies', labelPt: 'Estratégias' },
  { value: 'prospect_list', label: 'Prospect List', labelPt: 'Lista de prospects' },
  { value: 'copies', label: 'Copies', labelPt: 'Copies' },
  { value: 'blogposts', label: 'Blog Posts', labelPt: 'Posts de blog' },
  { value: 'workflows', label: 'Workflows', labelPt: 'Workflows' },
  { value: 'ad_copy', label: 'Ad Copy', labelPt: 'Copy de anúncios' },
  { value: 'social_media', label: 'Social Media Posts', labelPt: 'Posts de redes sociais' },
];

const asText = (content) => {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') return content;
  try { return JSON.stringify(content, null, 2); } catch { return String(content); }
};

const fmtWhen = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

export default function AIOutputsArchive() {
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [viewing, setViewing] = useState(null);
  const [draft, setDraft] = useState('');

  // Debounce the search box so typing doesn't fire a query per keystroke.
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['aiOutputsArchive', status, category, debounced],
    queryFn: () => AIOutput.list({
      limit: 100,
      ...(status !== 'all' ? { status } : {}),
      ...(category !== 'all' ? { category } : {}),
      ...(debounced ? { q: debounced } : {}),
    }),
  });

  // The API returns { data, total }; entities.js already unwraps .data when
  // present, so accept both shapes. Conversations are chat threads, not outputs.
  const rows = (Array.isArray(data) ? data : data?.data || []).filter(o => o?.type !== 'conversation');

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }) => AIOutput.update(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiOutputsArchive'] });
      queryClient.invalidateQueries({ queryKey: ['aiOutputs'] });
    },
    onError: (e) => toast.error('Save failed: ' + (e?.response?.data?.error || e.message)),
  });

  const copy = async (output) => {
    try {
      await navigator.clipboard.writeText(asText(output.content ?? output.output));
      toast.success(isPt ? 'Copiado para a área de transferência' : 'Copied to clipboard');
    } catch {
      toast.error(isPt ? 'Não foi possível copiar' : 'Could not copy');
    }
  };

  const openViewer = (output) => {
    setViewing(output);
    setDraft(asText(output.content ?? output.output));
  };

  // Save an edit WITHOUT deciding the outcome — the user keeps a draft of their
  // edits and can choose to use it later. The backend preserves the original AI
  // text (metadata.original_content) the first time it's edited.
  const saveDraft = () => {
    updateMutation.mutate(
      { id: viewing.id, patch: { content: draft, draft_saved_at: new Date().toISOString() } },
      { onSuccess: () => { toast.success(isPt ? 'Rascunho salvo' : 'Draft saved'); setViewing(null); } },
    );
  };

  // saveAndApprove was removed with the new approval flow — see the dialog footer.
  // Left out rather than kept unused so the file does not carry a second, dead
  // definition of "approve" for someone to wire up again by mistake.

  const setOutcome = (output, next) => {
    updateMutation.mutate({ id: output.id, patch: { status: next } }, {
      onSuccess: () => toast.success(
        next === 'pending'
          ? (isPt ? 'Movido para pendente' : 'Moved back to pending')
          : (isPt ? 'Resultado atualizado' : 'Outcome updated'),
      ),
    });
  };

  const counts = rows.reduce((acc, o) => {
    const s = o.status || 'pending';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isPt ? 'Buscar por título ou conteúdo…' : 'Search title or content…'}
            className="pl-9 bg-black/30 border-white/10 text-white"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[190px] bg-black/30 border-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            <SelectItem value="all" className="text-white">{isPt ? 'Todos os resultados' : 'All outcomes'}</SelectItem>
            <SelectItem value="pending" className="text-white">{isPt ? 'Aguardando aprovação' : 'Pending approval'}</SelectItem>
            <SelectItem value="approved" className="text-white">{isPt ? 'Aprovados' : 'Approved'}</SelectItem>
            <SelectItem value="rejected" className="text-white">{isPt ? 'Rejeitados' : 'Rejected'}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-[200px] bg-black/30 border-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            {CATEGORY_OPTIONS.map(c => (
              <SelectItem key={c.value} value={c.value} className="text-white">{isPt ? c.labelPt : c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Outcome summary */}
      {!isLoading && rows.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-gray-500">{rows.length} {isPt ? 'registros' : 'records'}</span>
          {Object.entries(counts).map(([s, n]) => {
            const meta = STATUS_META[s] || STATUS_META.pending;
            return (
              <span key={s} className={`px-2 py-0.5 rounded-full border ${meta.cls}`}>
                {n} {isPt ? meta.labelPt.toLowerCase() : meta.label.toLowerCase()}
              </span>
            );
          })}
          <span className="text-gray-600 ml-auto">
            {isPt
              ? 'Estes resultados treinam o cérebro da empresa.'
              : 'These outcomes train your Company Brain.'}
          </span>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#38b6ff]" /></div>
      )}

      {isError && !isLoading && (
        <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-8 text-center">
          <p className="text-white mb-3">{isPt ? 'Não foi possível carregar o arquivo.' : 'Could not load the archive.'}</p>
          <Button variant="outline" onClick={() => refetch()} className="border-white/10 text-white hover:bg-white/5">
            {isPt ? 'Tentar novamente' : 'Retry'}
          </Button>
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl bg-white/5 border border-white/10">
          <Archive size={38} className="text-[#38b6ff] mb-3" />
          <h3 className="text-lg font-semibold text-white mb-1">{isPt ? 'Nada no arquivo ainda' : 'Nothing archived yet'}</h3>
          <p className="text-gray-400 text-sm max-w-md">
            {isPt
              ? 'Tudo que a IA gerar aparece aqui com data, hora e o resultado que a equipe deu.'
              : 'Everything the AI generates lands here with its date, time and the outcome your team gave it.'}
          </p>
        </div>
      )}

      {/* Records */}
      <div className="space-y-2">
        {rows.map(output => {
          const meta = STATUS_META[output.status] || STATUS_META.pending;
          const StatusIcon = meta.icon;
          return (
            <div key={output.id} className="rounded-xl bg-white/5 border border-white/10 p-4 hover:border-white/20 transition-colors">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">
                    {output.title || output.type || (isPt ? 'Saída sem título' : 'Untitled output')}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${meta.cls}`}>
                      <StatusIcon size={10} /> {isPt ? meta.labelPt : meta.label}
                    </span>
                    {output.was_edited && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-[#cb6ce6]/30 bg-[#cb6ce6]/10 text-[#cb6ce6] inline-flex items-center gap-1">
                        <PencilLine size={10} /> {isPt ? 'editado' : 'edited'}
                      </span>
                    )}
                    <span className="text-gray-500 text-[11px]">{fmtWhen(output.created_at || output.created_date)}</span>
                    {output.category && <span className="text-gray-600 text-[11px] capitalize">{String(output.category).replace(/_/g, ' ')}</span>}
                    {output.status_by && <span className="text-gray-600 text-[11px]">· {output.status_by}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openViewer(output)}
                    className="border-white/10 text-white hover:bg-white/5 gap-1 h-8">
                    <Eye size={13} /> {isPt ? 'Ver' : 'View'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copy(output)}
                    className="border-white/10 text-white hover:bg-white/5 gap-1 h-8">
                    <Copy size={13} /> {isPt ? 'Copiar' : 'Reuse'}
                  </Button>
                  {output.status !== 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => setOutcome(output, 'pending')}
                      className="border-white/10 text-gray-400 hover:bg-white/5 h-8" title={isPt ? 'Voltar para pendente' : 'Move back to pending'}>
                      <RotateCcw size={13} />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-gray-500 text-xs mt-2 line-clamp-2 whitespace-pre-wrap">
                {asText(output.content ?? output.output).slice(0, 220)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Viewer / editor */}
      <Dialog open={!!viewing} onOpenChange={(v) => { if (!v) setViewing(null); }}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles size={16} className="text-[#38b6ff]" />
              {viewing?.title || (isPt ? 'Saída da IA' : 'AI output')}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
              <span>{fmtWhen(viewing?.created_at || viewing?.created_date)}</span>
              {viewing?.model && <span>· {viewing.model}</span>}
              {viewing?.category && <span>· {String(viewing.category).replace(/_/g, ' ')}</span>}
            </div>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[280px] bg-black/30 border-white/10 text-white font-mono text-xs"
            />
            {viewing?.original_content !== undefined && viewing?.original_content !== null && (
              <details className="rounded-xl bg-black/20 border border-white/10 p-3">
                <summary className="text-gray-400 text-xs cursor-pointer">
                  {isPt ? 'Ver o texto original da IA (antes das edições)' : "See the AI's original text (before edits)"}
                </summary>
                <pre className="text-gray-500 text-[11px] whitespace-pre-wrap mt-2 max-h-48 overflow-y-auto">
                  {asText(viewing.original_content)}
                </pre>
              </details>
            )}
          </div>
          {/* "Save draft" and "Save & approve" were removed with the new approval
              flow. Work arriving here has ALREADY been approved on the chat card,
              so a second approve step asked for the same permission twice — the
              confusion that made the flow feel broken. Editing then saving is the
              one action that remains meaningful. */}
          <DialogFooter className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setViewing(null)} className="border-white/10 text-white hover:bg-white/5">
              {isPt ? 'Fechar' : 'Close'}
            </Button>
            <Button onClick={saveDraft} disabled={updateMutation.isPending}
              className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
              <Save size={15} /> {isPt ? 'Salvar alterações' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
