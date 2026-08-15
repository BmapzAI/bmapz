import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/apiClient';
import { useLanguage } from '@/components/ui/LanguageContext';
import ActionApproval from '@/components/chat/ActionApproval';

/**
 * Act on a finished brand scan.
 *
 * The scan used to be a dead end: a report on its own screen that nothing else
 * could use. It could not fill in the settings it had just researched, and it
 * could not raise the work it recommended.
 *
 * The proposals come from the same pipeline the AI chat uses and are approved with
 * the same component, so the scan gets no special powers — the user still sees
 * exactly what will change and approves, edits or rejects it before anything is
 * written.
 */
export default function BrandScanActions({ scanId }) {
  const { isPt } = useLanguage();
  const [actions, setActions] = useState(null);
  const [result, setResult] = useState(null);
  const [declined, setDeclined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const propose = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/api/brand-scans/${scanId}/actions`);
      if (!res?.actions?.length) {
        toast.info(isPt
          ? 'Nada concreto para aplicar a partir desta análise.'
          : 'Nothing concrete to apply from this scan.');
        return;
      }
      setActions(res.actions);
      setResult(null);
      setDeclined(false);
    } catch (e) {
      toast.error(e.message || (isPt ? 'Falha ao preparar as ações.' : 'Could not prepare the actions.'));
    } finally {
      setLoading(false);
    }
  };

  const approve = async (edited) => {
    setApplying(true);
    try {
      const res = await api.post('/api/ai/actions/apply', { actions: edited || actions });
      setResult(res.applied || []);
      if (res.warning) toast.warning(res.warning);
      else toast.success(isPt ? 'Aplicado.' : 'Applied.');
    } catch (e) {
      toast.error(e.message || (isPt ? 'Falha ao aplicar.' : 'Could not apply.'));
    } finally {
      setApplying(false);
    }
  };

  if (!scanId) return null;

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-white font-semibold text-sm">
            {isPt ? 'Usar estas descobertas' : 'Use these findings'}
          </h3>
          <p className="text-gray-400 text-xs mt-0.5">
            {isPt
              ? 'Preenche as configurações que a análise estabelece e cria tarefas para o que ela recomenda. Você aprova antes de qualquer alteração.'
              : 'Fills in the settings this scan establishes and raises tasks for what it recommends. You approve before anything changes.'}
          </p>
        </div>
        {!actions && (
          <Button onClick={propose} disabled={loading}
            className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2 shrink-0">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
            {isPt ? 'Preparar ações' : 'Prepare actions'}
          </Button>
        )}
      </div>

      {actions && (
        <ActionApproval
          actions={actions}
          onApprove={approve}
          onDecline={() => { setDeclined(true); setActions(null); }}
          isApplying={applying}
          result={result}
          declined={declined}
        />
      )}
    </div>
  );
}
