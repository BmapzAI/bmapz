import React, { useState, useEffect } from 'react';
import { AtSign, Check, X, Loader2, Lock, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { api } from '@/api/apiClient';
import { useLanguage } from '@/components/ui/LanguageContext';

/**
 * View and change an @handle — a user's @username or a company's @companyname.
 *
 * A handle is an identity: teammates learn it, mention it and search by it, so it
 * may only change once every 90 days. That rule is enforced by a database trigger
 * (migration 027); this component only explains the wait and prevents a doomed
 * request. Availability is checked live and case-insensitively.
 *
 * Props:
 *  - value          current handle, without the '@'
 *  - changedAt      ISO timestamp of the last change (null = never changed)
 *  - checkPath      GET endpoint for availability, e.g. '/api/users/username-available'
 *  - checkParam     query param name, e.g. 'username'
 *  - onSave         async (cleanHandle) => void; should throw on failure
 *  - label, hint    copy
 *  - canEdit        false renders read-only (e.g. a non-admin viewing the company)
 */
const HANDLE_RE = /^[A-Za-z0-9_]{3,30}$/;
const COOLDOWN_DAYS = 90;

function daysRemaining(changedAt) {
  if (!changedAt) return 0;
  const elapsed = Date.now() - new Date(changedAt).getTime();
  if (Number.isNaN(elapsed)) return 0;
  const left = COOLDOWN_DAYS * 86400000 - elapsed;
  return left <= 0 ? 0 : Math.ceil(left / 86400000);
}

export default function HandleEditor({
  value, changedAt, checkPath, checkParam, onSave, label, hint, canEdit = true,
}) {
  const { isPt } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [availability, setAvailability] = useState(null); // null | 'checking' | 'free' | 'taken' | 'invalid'
  const [saving, setSaving] = useState(false);

  const locked = daysRemaining(changedAt);
  const clean = String(draft || '').trim().replace(/^@+/, '');
  const unchanged = clean.toLowerCase() === String(value || '').toLowerCase();

  useEffect(() => { setDraft(value || ''); }, [value]);

  // Debounced availability check. Skipped when the handle is unchanged, so
  // "your own handle" never shows as taken.
  useEffect(() => {
    if (!editing || unchanged) { setAvailability(null); return; }
    if (!HANDLE_RE.test(clean)) { setAvailability('invalid'); return; }
    setAvailability('checking');
    const id = setTimeout(async () => {
      try {
        const res = await api.get(checkPath, { [checkParam]: clean });
        setAvailability(res?.available ? 'free' : (res?.reason === 'invalid' ? 'invalid' : 'taken'));
      } catch {
        setAvailability(null);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [clean, editing, unchanged, checkPath, checkParam]);

  const save = async () => {
    if (!HANDLE_RE.test(clean)) return;
    setSaving(true);
    try {
      await onSave(clean);
      toast.success(isPt ? `Alterado para @${clean}` : `Changed to @${clean}`);
      setEditing(false);
    } catch (e) {
      const data = e?.response?.data;
      toast.error(data?.error || e.message || (isPt ? 'Não foi possível salvar' : 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-gray-400 text-sm">{label}</label>
        {canEdit && !editing && (
          locked > 0 ? (
            <span className="text-gray-500 text-[11px] inline-flex items-center gap-1">
              <Lock size={11} />
              {isPt
                ? `Pode mudar em ${locked} dia${locked === 1 ? '' : 's'}`
                : `Changeable in ${locked} day${locked === 1 ? '' : 's'}`}
            </span>
          ) : (
            <button onClick={() => setEditing(true)}
              className="text-[#38b6ff] text-[11px] hover:underline inline-flex items-center gap-1">
              <Pencil size={11} /> {isPt ? 'Alterar' : 'Change'}
            </button>
          )
        )}
      </div>

      {!editing ? (
        <div className="relative mt-1.5">
          <AtSign size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#38b6ff]" />
          <Input
            value={value || ''}
            disabled
            className="pl-10 bg-black/30 border-white/10 text-white disabled:opacity-100"
          />
        </div>
      ) : (
        <div className="mt-1.5 space-y-2">
          <div className="relative">
            <AtSign size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#38b6ff]" />
            <Input
              autoFocus
              value={clean}
              onChange={(e) => setDraft(e.target.value)}
              className="pl-10 bg-black/30 border-white/10 text-white"
              placeholder={isPt ? 'seu_identificador' : 'your_handle'}
              maxLength={30}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {availability === 'checking' && <Loader2 size={15} className="animate-spin text-gray-400" />}
              {availability === 'free' && <Check size={15} className="text-green-400" />}
              {(availability === 'taken' || availability === 'invalid') && <X size={15} className="text-red-400" />}
            </span>
          </div>

          <p className="text-[11px] text-gray-500">
            {availability === 'taken'
              ? (isPt ? `@${clean} já está em uso.` : `@${clean} is already taken.`)
              : availability === 'invalid'
                ? (isPt ? '3–30 caracteres: letras, números e underscore.' : '3–30 characters: letters, numbers and underscore.')
                : (isPt
                  ? 'Só pode ser alterado uma vez a cada 90 dias.'
                  : 'Can only be changed once every 90 days.')}
          </p>

          <div className="flex gap-2">
            <Button size="sm" onClick={save}
              disabled={saving || unchanged || availability !== 'free'}
              className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1.5 h-8">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {isPt ? 'Salvar' : 'Save'}
            </Button>
            <Button size="sm" variant="outline"
              onClick={() => { setEditing(false); setDraft(value || ''); setAvailability(null); }}
              className="border-white/10 text-white hover:bg-white/5 h-8">
              {isPt ? 'Cancelar' : 'Cancel'}
            </Button>
          </div>
        </div>
      )}

      {hint && !editing && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
