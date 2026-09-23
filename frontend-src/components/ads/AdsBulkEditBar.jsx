import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, X, Pencil, Trash2, Percent, Replace, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/ui/LanguageContext';
import { AdsManager } from '@/api/entities';

/**
 * The bulk bar, in the spirit of Google Ads Editor.
 *
 * Three operations, because they are the three you actually reach for:
 *   set     — "pause all of these"
 *   adjust  — "raise these budgets 10%"   (the one a per-row form cannot do)
 *   replace — "swap Summer for Winter everywhere"
 *
 * It appears only when something is selected, and it reports what happened row by
 * row rather than claiming blanket success: a bulk action that silently does less
 * than it said is worse than one that refuses.
 */

const FIELDS_BY_LEVEL = {
  campaign: [
    { value: 'status', label: 'Status', kind: 'status' },
    { value: 'budget', label: 'Budget', kind: 'number' },
    { value: 'name', label: 'Name', kind: 'text' },
    { value: 'objective', label: 'Objective', kind: 'text' },
    { value: 'starts_at', label: 'Start date', kind: 'date' },
    { value: 'ends_at', label: 'End date', kind: 'date' },
  ],
  ad_group: [
    { value: 'status', label: 'Status', kind: 'status' },
    { value: 'budget', label: 'Budget', kind: 'number' },
    { value: 'bid_amount', label: 'Bid', kind: 'number' },
    { value: 'name', label: 'Name', kind: 'text' },
    { value: 'starts_at', label: 'Start date', kind: 'date' },
    { value: 'ends_at', label: 'End date', kind: 'date' },
  ],
  ad: [
    { value: 'status', label: 'Status', kind: 'status' },
    { value: 'headline', label: 'Headline', kind: 'text' },
    { value: 'primary_text', label: 'Primary text', kind: 'text' },
    { value: 'description', label: 'Description', kind: 'text' },
    { value: 'call_to_action', label: 'Call to action', kind: 'text' },
    { value: 'destination_url', label: 'Destination URL', kind: 'text' },
    { value: 'name', label: 'Name', kind: 'text' },
  ],
};

const STATUS_OPTIONS = ['draft', 'active', 'paused', 'archived'];

export default function AdsBulkEditBar({ level, selectedIds = [], onClear, onDone }) {
  const { isPt } = useLanguage();
  const [field, setField] = useState('status');
  const [op, setOp] = useState('set');
  const [value, setValue] = useState('');
  const [mode, setMode] = useState('percent');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);

  const fields = FIELDS_BY_LEVEL[level] || FIELDS_BY_LEVEL.ad;
  const current = fields.find(f => f.value === field) || fields[0];
  const count = selectedIds.length;

  if (!count) return null;

  // Only numbers can be adjusted, only prose can be replaced — the bar offers what
  // the field can actually do rather than letting the server refuse it later.
  const allowedOps = [
    { value: 'set', label: isPt ? 'Definir' : 'Set', Icon: Pencil },
    ...(current.kind === 'number' ? [{ value: 'adjust', label: isPt ? 'Ajustar' : 'Adjust', Icon: Percent }] : []),
    ...(current.kind === 'text' ? [{ value: 'replace', label: isPt ? 'Substituir' : 'Find & replace', Icon: Replace }] : []),
  ];
  const effectiveOp = allowedOps.some(o => o.value === op) ? op : 'set';

  const buildEdit = () => {
    if (effectiveOp === 'adjust') return { field, op: 'adjust', mode, value: Number(value) };
    if (effectiveOp === 'replace') return { field, op: 'replace', find, replace, matchCase: false };
    return { field, op: 'set', value };
  };

  const apply = async () => {
    const edit = buildEdit();
    if (effectiveOp === 'replace' ? !find : value === '') {
      toast.error(isPt ? 'Informe um valor.' : 'Enter a value first.');
      return;
    }
    setBusy(true);
    setReport(null);
    try {
      const res = await AdsManager.bulkEdit({ level, ids: selectedIds, edits: [edit] });
      setReport(res);
      if (res.updated) {
        toast.success(isPt ? `${res.updated} atualizado(s)` : `${res.updated} updated`);
        onDone?.();
      } else {
        toast.warning(isPt ? 'Nada foi alterado.' : 'Nothing changed.');
      }
    } catch (e) {
      toast.error(e.message || (isPt ? 'Falha ao aplicar.' : 'Could not apply.'));
    } finally {
      setBusy(false);
    }
  };

  const removeAll = async () => {
    setBusy(true);
    setReport(null);
    try {
      const res = await AdsManager.bulkDelete({ level, ids: selectedIds });
      setReport({ updated: res.deleted, unchanged: res.skipped, results: res.results });
      if (res.deleted) {
        toast.success(isPt ? `${res.deleted} removido(s)` : `${res.deleted} deleted`);
        onDone?.();
      } else {
        toast.warning(isPt ? 'Nada foi removido.' : 'Nothing was deleted.');
      }
    } catch (e) {
      toast.error(e.message || (isPt ? 'Falha ao remover.' : 'Could not delete.'));
    } finally {
      setBusy(false);
    }
  };

  // Rows that did nothing, with the reason — this is the part that saves an hour.
  const problems = (report?.results || []).filter(r => !r.ok);

  return (
    <div className="sticky bottom-3 z-20 rounded-2xl border border-[#38b6ff]/40 bg-[#111]/95 backdrop-blur p-3 shadow-xl space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[#38b6ff] text-sm font-semibold whitespace-nowrap">
          {count} {isPt ? 'selecionado(s)' : 'selected'}
        </span>

        <Select value={field} onValueChange={(v) => { setField(v); setReport(null); }}>
          <SelectTrigger className="w-[170px] h-9 bg-black/40 border-white/10 text-white"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            {fields.map(f => <SelectItem key={f.value} value={f.value} className="text-white">{f.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex gap-1 p-0.5 rounded-lg bg-white/5 border border-white/10">
          {allowedOps.map(o => (
            <button key={o.value} onClick={() => { setOp(o.value); setReport(null); }}
              className={`px-2.5 py-1.5 rounded-md text-xs inline-flex items-center gap-1 transition-all ${
                effectiveOp === o.value ? 'bg-[#38b6ff]/20 text-[#38b6ff]' : 'text-gray-400 hover:text-white'}`}>
              <o.Icon size={13} /> {o.label}
            </button>
          ))}
        </div>

        {effectiveOp === 'replace' ? (
          <>
            <Input value={find} onChange={(e) => setFind(e.target.value)}
              placeholder={isPt ? 'Encontrar...' : 'Find...'}
              className="w-[150px] h-9 bg-black/40 border-white/10 text-white" />
            <Input value={replace} onChange={(e) => setReplace(e.target.value)}
              placeholder={isPt ? 'Substituir por...' : 'Replace with...'}
              className="w-[150px] h-9 bg-black/40 border-white/10 text-white" />
          </>
        ) : current.kind === 'status' && effectiveOp === 'set' ? (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger className="w-[150px] h-9 bg-black/40 border-white/10 text-white">
              <SelectValue placeholder={isPt ? 'Escolher...' : 'Choose...'} />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-white/10">
              {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="text-white capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <>
            {effectiveOp === 'adjust' && (
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="w-[110px] h-9 bg-black/40 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  <SelectItem value="percent" className="text-white">%</SelectItem>
                  <SelectItem value="amount" className="text-white">{isPt ? 'valor' : 'amount'}</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              type={current.kind === 'date' ? 'date' : current.kind === 'number' || effectiveOp === 'adjust' ? 'number' : 'text'}
              placeholder={effectiveOp === 'adjust'
                ? (isPt ? 'ex: 10 ou -25' : 'e.g. 10 or -25')
                : (isPt ? 'Novo valor' : 'New value')}
              className="w-[170px] h-9 bg-black/40 border-white/10 text-white"
            />
          </>
        )}

        <Button onClick={apply} disabled={busy}
          className="h-9 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}
          {isPt ? 'Aplicar' : 'Apply'}
        </Button>

        <Button onClick={removeAll} disabled={busy} variant="outline"
          className="h-9 border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2">
          <Trash2 size={15} /> {isPt ? 'Excluir' : 'Delete'}
        </Button>

        <Button onClick={() => { setReport(null); onClear?.(); }} variant="outline"
          className="h-9 border-white/10 text-gray-400 hover:bg-white/5 ml-auto">
          <X size={15} />
        </Button>
      </div>

      {report && (
        <div className="text-xs space-y-1 border-t border-white/10 pt-2">
          <p className="text-gray-300 inline-flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-green-400" />
            {report.updated} {isPt ? 'alterado(s)' : 'changed'}
            {report.unchanged ? ` · ${report.unchanged} ${isPt ? 'sem alteração' : 'unchanged'}` : ''}
          </p>
          {/* The reasons matter more than the count: "Google sets budget on the
              campaign" is the difference between a puzzle and an explanation. */}
          {problems.slice(0, 6).map(p => (
            <p key={p.id} className="text-gray-500 inline-flex items-start gap-1.5">
              <AlertTriangle size={12} className="text-yellow-500 mt-0.5 shrink-0" />
              <span>{p.reason}</span>
            </p>
          ))}
          {problems.length > 6 && (
            <p className="text-gray-600">+{problems.length - 6} {isPt ? 'outros' : 'more'}</p>
          )}
        </div>
      )}
    </div>
  );
}
