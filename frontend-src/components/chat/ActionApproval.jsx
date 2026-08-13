import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, X, Pencil, Loader2, AlertTriangle, Zap } from 'lucide-react';
import { useLanguage } from '@/components/ui/LanguageContext';

/**
 * "The assistant wants to change these things — approve, edit or decline."
 *
 * Nothing the agent proposes is written until the user acts on this card. It exists
 * because the previous behaviour applied whatever the model emitted and then
 * reported the model's own claim of success: a rejected write still read as "done".
 * Now the user sees the concrete list first, and the result reported afterwards is
 * the database's answer, not the model's.
 *
 * Edit drops to raw JSON deliberately. It is an escape hatch for the rare case
 * where a proposal is nearly right, not the main path — the main path is Approve or
 * Decline, and both are one click.
 */
export default function ActionApproval({ preview, actions, onApprove, onDecline, isApplying, result }) {
  const { isPt } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => JSON.stringify(actions, null, 2));
  const [editError, setEditError] = useState(null);

  // Once applied, the card becomes the receipt.
  if (result) {
    const failures = result.filter(r => !r.ok);
    return (
      <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3 space-y-1.5">
        {result.map((r, i) => (
          <div key={i} className={`flex items-start gap-2 text-xs ${r.ok ? 'text-green-400' : 'text-red-400'}`}>
            {r.ok ? <Check size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
            <span>{r.ok ? r.summary : `${r.op}: ${r.error}`}</span>
          </div>
        ))}
        {failures.length === 0 ? (
          <p className="text-[11px] text-gray-500 pt-1">
            {isPt ? 'Alterações aplicadas.' : 'Changes applied.'}
          </p>
        ) : null}
      </div>
    );
  }

  const approve = () => {
    if (!editing) return onApprove(actions);
    try {
      const parsed = JSON.parse(draft);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      setEditError(null);
      onApprove(list);
    } catch {
      setEditError(isPt ? 'JSON inválido — revise antes de aprovar.' : 'Invalid JSON — fix it before approving.');
    }
  };

  const anyDestructive = (preview || []).some(p => p.destructive);
  const anyUnknown = (preview || []).some(p => p.unknown);

  return (
    <div className={`mt-2 rounded-xl border p-3 ${
      anyDestructive ? 'border-amber-500/40 bg-amber-500/5' : 'border-[#38b6ff]/30 bg-[#38b6ff]/5'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <Zap size={14} className={anyDestructive ? 'text-amber-400' : 'text-[#38b6ff]'} />
        <span className="text-white text-sm font-medium">
          {isPt ? 'Aprovar estas alterações?' : 'Approve these changes?'}
        </span>
      </div>

      {!editing ? (
        <ul className="space-y-1.5 mb-3">
          {(preview || []).map((p, i) => (
            <li key={i} className="text-xs">
              <span className={p.unknown ? 'text-red-400' : 'text-gray-200'}>• {p.title}</span>
              {p.changes?.length ? (
                <span className="text-gray-500"> — {p.changes.join(', ')}</span>
              ) : null}
              {p.destructive ? (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  {isPt ? 'publica ao vivo' : 'goes live'}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mb-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="bg-black/40 border-white/10 text-white text-[11px] font-mono min-h-[160px]"
          />
          {editError ? <p className="text-red-400 text-[11px] mt-1">{editError}</p> : null}
        </div>
      )}

      {anyUnknown ? (
        <p className="text-red-400 text-[11px] mb-2">
          {isPt
            ? 'Uma das operações não é reconhecida e será recusada.'
            : 'One operation is not recognised and will be rejected.'}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={approve}
          disabled={isApplying}
          className="h-8 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1.5 text-xs"
        >
          {isApplying ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {isPt ? 'Aprovar' : 'Approve'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing(e => !e)}
          disabled={isApplying}
          className="h-8 border-white/10 text-white hover:bg-white/5 gap-1.5 text-xs"
        >
          <Pencil size={13} /> {editing ? (isPt ? 'Ver resumo' : 'Show summary') : (isPt ? 'Editar' : 'Edit')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDecline}
          disabled={isApplying}
          className="h-8 border-white/10 text-gray-300 hover:bg-white/5 gap-1.5 text-xs"
        >
          <X size={13} /> {isPt ? 'Recusar' : 'Decline'}
        </Button>
      </div>
    </div>
  );
}
