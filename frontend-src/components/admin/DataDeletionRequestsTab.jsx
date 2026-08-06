import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ShieldAlert, Loader2, Trash2, Check, X, Eye, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/apiClient';
import { useLanguage } from '@/components/ui/LanguageContext';

/**
 * GDPR / platform data-deletion requests.
 *
 * The public endpoint has always stored these rows, but nothing ever showed or
 * actioned them — requests arrived into a void. Meta's app review requires a
 * working data-deletion callback and GDPR requires a real, auditable outcome,
 * so every request now gets: preview → execute (or reject) → recorded report.
 */
const STATUS_STYLE = {
  pending: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  processing: 'text-[#38b6ff] bg-[#38b6ff]/10 border-[#38b6ff]/20',
  completed: 'text-green-400 bg-green-400/10 border-green-400/20',
  rejected: 'text-gray-400 bg-white/5 border-white/10',
};

const fmt = (v) => (v ? new Date(v).toLocaleString() : '—');

export default function DataDeletionRequestsTab() {
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();
  const [previewing, setPreviewing] = useState(null); // { request, preview }
  const [loadingPreview, setLoadingPreview] = useState(null);
  const [confirmText, setConfirmText] = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin_data_deletion'],
    queryFn: () => api.get('/api/admin/data-deletion-requests').then(r => (Array.isArray(r) ? r : r?.data || [])),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin_data_deletion'] });

  const setStatus = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/api/admin/data-deletion-requests/${id}`, { status }),
    onSuccess: () => { refresh(); toast.success(isPt ? 'Status atualizado' : 'Status updated'); },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  });

  const execute = useMutation({
    mutationFn: (id) => api.post(`/api/admin/data-deletion-requests/${id}/execute`),
    onSuccess: (res) => {
      refresh();
      setPreviewing(null);
      setConfirmText('');
      const r = res?.report || {};
      toast.success(
        (isPt ? 'Dados apagados — ' : 'Data erased — ')
        + `${r.leads || 0} leads, ${r.messages || 0} messages, ${r.users || 0} users`,
      );
      if (r.errors?.length) toast.error(`${r.errors.length} step(s) failed — see the report`);
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  });

  const openPreview = async (request) => {
    setLoadingPreview(request.id);
    try {
      const preview = await api.get(`/api/admin/data-deletion-requests/${request.id}/preview`);
      setPreviewing({ request, preview });
      setConfirmText('');
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    } finally {
      setLoadingPreview(null);
    }
  };

  const pending = requests.filter(r => (r.status || 'pending') === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-white font-semibold flex items-center gap-2">
            <ShieldAlert size={17} className="text-yellow-400" />
            {isPt ? 'Pedidos de exclusão de dados' : 'Data deletion requests'}
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            {isPt
              ? 'Pedidos de GDPR e das plataformas. Cada um precisa de um desfecho registrado.'
              : 'GDPR and platform requests. Each one needs a recorded outcome.'}
          </p>
        </div>
        {pending > 0 && (
          <span className="px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs">
            {pending} {isPt ? 'aguardando' : 'awaiting action'}
          </span>
        )}
      </div>

      {isLoading && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#38b6ff]" /></div>}

      {!isLoading && requests.length === 0 && (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-10 text-center">
          <ShieldAlert size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">{isPt ? 'Nenhum pedido recebido.' : 'No requests received.'}</p>
        </div>
      )}

      <div className="space-y-2">
        {requests.map(r => {
          const status = r.status || 'pending';
          return (
            <div key={r.id} className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{r.email}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border capitalize ${STATUS_STYLE[status]}`}>{status}</span>
                    <span className="text-gray-500 text-[11px]">{isPt ? 'recebido' : 'received'} {fmt(r.created_at)}</span>
                    {r.handled_by && <span className="text-gray-600 text-[11px]">· {r.handled_by} {fmt(r.handled_at)}</span>}
                  </div>
                  {r.instagram_username && <p className="text-gray-500 text-xs mt-1">Instagram: {r.instagram_username}</p>}
                  {r.reason && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{r.reason}</p>}
                  {r.deletion_report && (
                    <p className="text-green-400/80 text-[11px] mt-1">
                      {isPt ? 'Apagado: ' : 'Erased: '}
                      {r.deletion_report.leads || 0} leads · {r.deletion_report.messages || 0} messages · {r.deletion_report.users || 0} users
                      {r.deletion_report.errors?.length ? ` · ${r.deletion_report.errors.length} error(s)` : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {status !== 'completed' && (
                    <>
                      <Button size="sm" variant="outline" disabled={loadingPreview === r.id}
                        onClick={() => openPreview(r)}
                        className="border-white/10 text-white hover:bg-white/5 gap-1 h-8">
                        {loadingPreview === r.id ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
                        {isPt ? 'Revisar' : 'Review'}
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => setStatus.mutate({ id: r.id, status: 'rejected' })}
                        className="border-white/10 text-gray-400 hover:bg-white/5 gap-1 h-8">
                        <X size={13} /> {isPt ? 'Recusar' : 'Reject'}
                      </Button>
                    </>
                  )}
                  {status === 'completed' && <Check size={16} className="text-green-400" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview + confirm */}
      <Dialog open={!!previewing} onOpenChange={(v) => { if (!v) { setPreviewing(null); setConfirmText(''); } }}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle size={17} className="text-yellow-400" />
              {isPt ? 'Confirmar exclusão' : 'Confirm erasure'}
            </DialogTitle>
          </DialogHeader>
          {previewing && (
            <div className="space-y-3 py-1">
              <p className="text-gray-300 text-sm">
                {isPt ? 'Isto vai apagar permanentemente os dados de ' : 'This permanently erases the data for '}
                <span className="text-white font-medium">{previewing.request.email}</span>:
              </p>
              <div className="rounded-xl bg-black/30 border border-white/10 p-3 space-y-1 text-sm">
                <p className="text-gray-300">{previewing.preview.matches?.leads?.length || 0} {isPt ? 'leads' : 'leads'}</p>
                <p className="text-gray-300">{previewing.preview.matches?.message_count || 0} {isPt ? 'mensagens' : 'messages'}</p>
                <p className="text-gray-300">{previewing.preview.matches?.users?.length || 0} {isPt ? 'contas de usuário (e o login)' : 'user accounts (and their login)'}</p>
              </div>
              {previewing.preview.warning && (
                <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                  {previewing.preview.warning}
                </p>
              )}
              <p className="text-gray-500 text-xs">
                {isPt ? 'Não há como desfazer. Digite ' : 'This cannot be undone. Type '}
                <span className="text-white font-mono">DELETE</span>
                {isPt ? ' para confirmar.' : ' to confirm.'}
              </p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono"
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setPreviewing(null); setConfirmText(''); }}
              className="border-white/10 text-white hover:bg-white/5">
              {isPt ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button
              disabled={confirmText !== 'DELETE' || !previewing?.preview?.can_execute || execute.isPending}
              onClick={() => execute.mutate(previewing.request.id)}
              className="bg-red-600 hover:bg-red-700 gap-2"
            >
              {execute.isPending ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              {isPt ? 'Apagar dados' : 'Erase data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
