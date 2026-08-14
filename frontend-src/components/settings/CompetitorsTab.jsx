import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ChevronUp, ChevronDown, Save, Loader2, Swords } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Company } from '@/api/entities';

const MAX = 5;
const blank = () => ({ name: '', website: '', social: '', notes: '' });

/**
 * Up to five ranked competitors.
 *
 * Rank is the point, not decoration: the company brain hands this list to the
 * agent on every generation and states that 1 outweighs 5, so positioning, ads,
 * SEO and content are written against the real competitive set rather than a
 * generic market. Order is the rank — moving a row up genuinely changes how much
 * weight the agent gives it.
 */
export default function CompetitorsTab({ company }) {
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState([]);

  // Seed from the saved company, and re-seed if it is refetched underneath us.
  useEffect(() => {
    const saved = Array.isArray(company?.competitors) ? company.competitors : [];
    setRows(saved.length ? saved.map(c => ({ ...blank(), ...c })) : [blank()]);
  }, [company?.id, company?.competitors]);

  const setRow = (i, patch) => setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows(rs => (rs.length >= MAX ? rs : [...rs, blank()]));
  const removeRow = (i) => setRows(rs => (rs.length === 1 ? [blank()] : rs.filter((_, idx) => idx !== i)));

  const move = (i, dir) => setRows(rs => {
    const j = i + dir;
    if (j < 0 || j >= rs.length) return rs;
    const next = [...rs];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const saveMutation = useMutation({
    // Rank is derived from position on save, so the stored order and the displayed
    // order can never disagree.
    mutationFn: () => Company.update(null, {
      competitors: rows
        .filter(r => r.name.trim() || r.website.trim())
        .map((r, i) => ({ ...r, rank: i + 1 })),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success(isPt ? 'Concorrentes salvos' : 'Competitors saved');
    },
    onError: (e) => toast.error((isPt ? 'Falha ao salvar: ' : 'Could not save: ') + (e?.message || '')),
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white inline-flex items-center gap-2">
          <Swords size={17} className="text-[#38b6ff]" />
          {isPt ? 'Concorrentes' : 'Competitors'}
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          {isPt
            ? 'Até 5 concorrentes, em ordem de importância (1 = mais importante). A IA usa esta lista em todas as gerações — posicionamento, anúncios, SEO e conteúdo.'
            : 'Up to 5 competitors, in order of importance (1 = most important). The AI uses this list in every generation — positioning, ads, SEO and content.'}
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="rounded-xl bg-black/25 border border-white/10 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs px-2 py-0.5 rounded bg-[#38b6ff]/15 text-[#38b6ff]">
                #{i + 1}{i === 0 ? (isPt ? ' · principal' : ' · primary') : ''}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  className="p-1 rounded text-gray-400 hover:bg-white/10 disabled:opacity-30"
                  aria-label={isPt ? 'Subir' : 'Move up'}>
                  <ChevronUp size={14} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1}
                  className="p-1 rounded text-gray-400 hover:bg-white/10 disabled:opacity-30"
                  aria-label={isPt ? 'Descer' : 'Move down'}>
                  <ChevronDown size={14} />
                </button>
                <button type="button" onClick={() => removeRow(i)}
                  className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                  aria-label={isPt ? 'Remover' : 'Remove'}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <Label className="text-gray-400 text-xs">{isPt ? 'Nome' : 'Company name'}</Label>
                <Input
                  value={r.name}
                  onChange={(e) => setRow(i, { name: e.target.value })}
                  placeholder={isPt ? 'Nome do concorrente' : 'Competitor name'}
                  className="bg-black/30 border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">{isPt ? 'Site' : 'Website'}</Label>
                <Input
                  value={r.website}
                  onChange={(e) => setRow(i, { website: e.target.value })}
                  placeholder="https://…"
                  className="bg-black/30 border-white/10 text-white mt-1"
                />
              </div>
            </div>

            <div className="mt-2">
              <Label className="text-gray-400 text-xs">
                {isPt ? 'Redes sociais' : 'Social pages'}
              </Label>
              <Input
                value={r.social}
                onChange={(e) => setRow(i, { social: e.target.value })}
                placeholder={isPt ? 'LinkedIn, Instagram…' : 'LinkedIn, Instagram…'}
                className="bg-black/30 border-white/10 text-white mt-1"
              />
            </div>

            <div className="mt-2">
              <Label className="text-gray-400 text-xs">
                {isPt ? 'Notas (posicionamento, preço, diferenciais)' : 'Notes (positioning, pricing, strengths)'}
              </Label>
              <Textarea
                value={r.notes}
                onChange={(e) => setRow(i, { notes: e.target.value })}
                className="bg-black/30 border-white/10 text-white mt-1 min-h-[60px]"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={addRow}
          disabled={rows.length >= MAX}
          className="border-white/10 text-white hover:bg-white/5 gap-2"
        >
          <Plus size={16} />
          {isPt ? 'Adicionar concorrente' : 'Add competitor'}
          {rows.length >= MAX ? ` (${isPt ? 'máx.' : 'max'} ${MAX})` : ''}
        </Button>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2"
        >
          {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isPt ? 'Salvar' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
