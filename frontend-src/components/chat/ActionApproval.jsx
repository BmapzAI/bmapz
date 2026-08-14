import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { Check, X, Pencil, Loader2, AlertTriangle, Zap, ExternalLink } from 'lucide-react';
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
 * Edit opens a typed form over the proposed values — see EDITABLE_FIELDS below. It
 * is the escape hatch for a proposal that is nearly right; the main path is Approve
 * or Decline, both one click.
 *
 * The card persists: once approved it becomes a receipt carrying links to whatever
 * was created, and that receipt is stored on the message, so a reload cannot turn
 * an applied change back into a pending proposal and let it be applied twice.
 */
/**
 * Which fields of an operation a human may edit, and how to render each.
 *
 * Deliberately a WHITELIST of scalar fields. The previous version exposed the raw
 * JSON in a textarea, which had three problems: people had to understand the
 * structure to change a word, a stray comma silently invalidated the whole thing so
 * edits appeared not to stick, and it handed the user a way to author arbitrary
 * operation payloads — the backend re-validates, but offering the surface at all is
 * wrong. Editing a title should not require editing JSON.
 *
 * `id`, `op` and anything structural are absent on purpose: they identify WHICH
 * record is being changed, and letting a person retype an id here only invites
 * pointing the write at the wrong row.
 */
const EDITABLE_FIELDS = {
  update_company: [],   // handled specially below (fields / briefing / icp maps)
  create_task: [
    { key: 'title', label: { en: 'Title', pt: 'Título' } },
    { key: 'description', label: { en: 'Details', pt: 'Detalhes' }, long: true },
    { key: 'priority', label: { en: 'Priority', pt: 'Prioridade' }, options: ['low', 'medium', 'high', 'urgent'] },
    { key: 'section', label: { en: 'Section', pt: 'Seção' } },
  ],
  update_task: [
    { key: 'title', label: { en: 'Title', pt: 'Título' } },
    { key: 'status', label: { en: 'Status', pt: 'Status' }, options: ['standby', 'todo', 'doing', 'done'] },
    { key: 'priority', label: { en: 'Priority', pt: 'Prioridade' }, options: ['low', 'medium', 'high', 'urgent'] },
  ],
  create_social_post: [
    { key: 'title', label: { en: 'Title', pt: 'Título' } },
    { key: 'content', label: { en: 'Post content', pt: 'Conteúdo do post' }, long: true },
  ],
  update_social_post: [
    { key: 'content', label: { en: 'Post content', pt: 'Conteúdo do post' }, long: true },
    { key: 'status', label: { en: 'Status', pt: 'Status' }, options: ['draft', 'approved', 'scheduled', 'published'] },
    { key: 'scheduled_for', label: { en: 'Scheduled for', pt: 'Agendado para' } },
  ],
  create_blog_post: [
    { key: 'title', label: { en: 'Title', pt: 'Título' } },
    { key: 'content', label: { en: 'Content', pt: 'Conteúdo' }, long: true },
  ],
  update_blog_post: [
    { key: 'title', label: { en: 'Title', pt: 'Título' } },
    { key: 'content', label: { en: 'Content', pt: 'Conteúdo' }, long: true },
    { key: 'status', label: { en: 'Status', pt: 'Status' }, options: ['draft', 'published'] },
  ],
  create_ad_campaign: [
    { key: 'name', label: { en: 'Campaign name', pt: 'Nome da campanha' } },
    { key: 'platform', label: { en: 'Platform', pt: 'Plataforma' }, options: ['meta', 'google', 'linkedin', 'tiktok'] },
    { key: 'objective', label: { en: 'Objective', pt: 'Objetivo' } },
  ],
  save_to_archive: [
    { key: 'title', label: { en: 'Title', pt: 'Título' } },
    { key: 'content', label: { en: 'Content', pt: 'Conteúdo' }, long: true },
  ],
};

export default function ActionApproval({ preview, actions, onApprove, onDecline, isApplying, result, declined = false }) {
  const { isPt } = useLanguage();
  const [editing, setEditing] = useState(false);
  // Edits are held as a structured copy of the actions, never as text. There is
  // nothing to re-parse, so an edit cannot silently fail to apply.
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(actions)));

  // Once applied, the card becomes the receipt — and stays that way after a
  // reload, because the result is persisted onto the message.
  if (result) {
    const failures = result.filter(r => !r.ok);
    return (
      <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3 space-y-1.5">
        {result.map((r, i) => (
          <div key={i} className={`flex items-start gap-2 text-xs ${r.ok ? 'text-green-400' : 'text-red-400'}`}>
            {r.ok ? <Check size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
            <span className="flex-1">
              {r.ok ? r.summary : `${r.op}: ${r.error}`}
              {/* Take me to what you just made. Without this the user is told a
                  draft exists somewhere and has to go hunting for it. */}
              {r.ok && r.link ? (
                <Link
                  to={r.link}
                  className="ml-2 inline-flex items-center gap-0.5 text-[#38b6ff] hover:underline"
                >
                  {isPt ? 'ver' : 'view'} <ExternalLink size={11} />
                </Link>
              ) : null}
            </span>
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

  // Declined earlier: say so rather than silently showing nothing, so the record
  // of the decision survives too.
  if (declined) {
    return (
      <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-2.5">
        <p className="text-[11px] text-gray-500">
          {isPt ? 'Alterações recusadas.' : 'Changes declined.'}
        </p>
      </div>
    );
  }

  if (!actions?.length) return null;

  // Approving sends the edited copy when the user has been editing, so a change
  // made in the form is always what gets applied — the old version could lose
  // edits whenever the text failed to parse.
  const approve = () => onApprove(editing ? draft : actions);

  const setField = (i, key, value) =>
    setDraft(d => d.map((a, idx) => (idx === i ? { ...a, [key]: value } : a)));

  /** update_company keeps its values in nested maps, so edit them in place. */
  const setNested = (i, group, key, value) =>
    setDraft(d => d.map((a, idx) => (
      idx === i ? { ...a, [group]: { ...(a[group] || {}), [key]: value } } : a
    )));

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
        <div className="mb-3 space-y-3 max-h-[340px] overflow-y-auto">
          {draft.map((action, i) => {
            const op = String(action.op || action.operation || '');
            const spec = EDITABLE_FIELDS[op] || [];

            return (
              <div key={i} className="rounded-lg bg-black/30 border border-white/10 p-2.5 space-y-2">
                <p className="text-[11px] text-gray-400">{preview?.[i]?.title || op}</p>

                {/* update_company edits the values inside fields / briefing / icp. */}
                {op === 'update_company'
                  ? ['fields', 'briefing', 'icp'].flatMap(group =>
                    Object.entries(action[group] || {})
                      // Objects and arrays (competitors, job_titles…) are not safely
                      // editable as a single box; they stay as proposed and are shown
                      // read-only rather than offering a broken editor.
                      .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
                      .map(([k, v]) => (
                        <div key={`${group}.${k}`}>
                          <label className="text-[10px] text-gray-500">{k.replace(/_/g, ' ')}</label>
                          <Textarea
                            value={String(v)}
                            onChange={(e) => setNested(i, group, k, e.target.value)}
                            className="bg-black/40 border-white/10 text-white text-xs min-h-[46px] mt-0.5"
                          />
                        </div>
                      )))
                  : spec.map(f => {
                    const value = action[f.key] ?? '';
                    if (f.options) {
                      return (
                        <div key={f.key}>
                          <label className="text-[10px] text-gray-500">{isPt ? f.label.pt : f.label.en}</label>
                          <select
                            value={value}
                            onChange={(e) => setField(i, f.key, e.target.value)}
                            className="w-full h-8 rounded-md bg-black/40 border border-white/10 text-white text-xs px-2 mt-0.5"
                          >
                            <option value="" className="bg-[#1a1a1a]">—</option>
                            {f.options.map(o => (
                              <option key={o} value={o} className="bg-[#1a1a1a]">{o}</option>
                            ))}
                          </select>
                        </div>
                      );
                    }
                    return (
                      <div key={f.key}>
                        <label className="text-[10px] text-gray-500">{isPt ? f.label.pt : f.label.en}</label>
                        <Textarea
                          value={String(value)}
                          onChange={(e) => setField(i, f.key, e.target.value)}
                          className={`bg-black/40 border-white/10 text-white text-xs mt-0.5 ${f.long ? 'min-h-[110px]' : 'min-h-[40px]'}`}
                        />
                      </div>
                    );
                  })}

                {op === 'update_company' || spec.length ? null : (
                  <p className="text-[11px] text-gray-500">
                    {isPt ? 'Nada para editar nesta operação.' : 'Nothing to edit on this operation.'}
                  </p>
                )}
              </div>
            );
          })}
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
