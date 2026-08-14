import React from 'react';
import { History, RotateCcw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/ui/LanguageContext';

/**
 * The last five SEO analyses, reloadable.
 *
 * They were already being saved and even fetched — there was simply no way to
 * load one back, so every look at a previous result meant paying for a fresh
 * analysis. This is the missing half.
 *
 * Five is the cap the query already used; showing more would bury the recent ones
 * and each row carries a full report.
 */
export default function SEOHistory({ analyses = [], currentUrl, onLoad }) {
  const { isPt } = useLanguage();
  if (!analyses.length) return null;

  const when = (a) => {
    const raw = a.analyzed_at || a.created_at || a.created_date;
    const ms = Date.parse(raw);
    if (Number.isNaN(ms)) return '';
    return new Date(ms).toLocaleString(isPt ? 'pt-BR' : 'en-US', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  };

  const scoreOf = (a) => (typeof a.score === 'number' ? a.score : a.overall_score);

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
      <h3 className="text-white font-semibold text-sm inline-flex items-center gap-2 mb-3">
        <History size={15} className="text-[#38b6ff]" />
        {isPt ? 'Análises anteriores' : 'Previous analyses'}
        <span className="text-gray-500 font-normal">({analyses.length})</span>
      </h3>

      <div className="space-y-2">
        {analyses.slice(0, 5).map((a) => {
          const score = scoreOf(a);
          const isCurrent = currentUrl && a.url === currentUrl;
          return (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-black/25 border border-white/5"
            >
              <div className="min-w-0">
                <p className="text-white text-xs truncate">{a.url}</p>
                <p className="text-gray-500 text-[11px] inline-flex items-center gap-1.5 mt-0.5">
                  <Clock size={10} /> {when(a)}
                  {a.scan_type ? <span>· {a.scan_type}</span> : null}
                  {isCurrent ? (
                    <span className="text-[#38b6ff]">· {isPt ? 'em tela' : 'on screen'}</span>
                  ) : null}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {typeof score === 'number' ? (
                  <span className={`text-sm font-semibold ${
                    score >= 80 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {score}
                  </span>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onLoad(a)}
                  className="h-7 border-white/10 text-white hover:bg-white/5 gap-1.5 text-xs"
                >
                  <RotateCcw size={12} /> {isPt ? 'Carregar' : 'Load'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-gray-600 text-[11px] mt-3">
        {isPt
          ? 'As 5 análises mais recentes ficam salvas. Carregar uma não gasta créditos.'
          : 'The 5 most recent analyses are kept. Loading one costs no credits.'}
      </p>
    </div>
  );
}
