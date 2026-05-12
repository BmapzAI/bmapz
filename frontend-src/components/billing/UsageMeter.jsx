import React from 'react';
import { Zap, ScanLine, Users, Building2, Database } from 'lucide-react';
import { getCreditsPercent, getCreditsRemaining, formatBRL, PLANS } from '@/lib/plans';
import { useLanguage } from '@/components/ui/LanguageContext';

function MeterBar({ value, max, color = '#38b6ff', showPercent = true }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const colorClass = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : `bg-[${color}]`;
  return (
    <div className="w-full">
      <div className="w-full bg-white/10 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-400' : 'bg-[#38b6ff]'}`}
          style={{ width: `${pct}%`, backgroundColor: pct < 70 ? color : undefined }}
        />
      </div>
      {showPercent && (
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{value.toLocaleString('pt-BR')}</span>
          <span>{max.toLocaleString('pt-BR')} ({pct}%)</span>
        </div>
      )}
    </div>
  );
}

export default function UsageMeter({ subscription, compact = false }) {
  const { language } = useLanguage();
  const isPt = language === 'pt-BR';

  if (!subscription) return null;

  const plan = PLANS[subscription.plan] || PLANS.starter;
  const creditsTotal = (subscription.ai_credits_total || 0) + (subscription.topup_credits_purchased || 0);
  const creditsUsed = subscription.ai_credits_used || 0;
  const creditsPct = creditsTotal > 0 ? Math.min(100, Math.round((creditsUsed / creditsTotal) * 100)) : 0;

  const scanTokensTotal = subscription.scan_tokens_total || 0;
  const scanTokensUsed = subscription.scan_tokens_used || 0;

  const items = [
    {
      icon: Zap,
      label: isPt ? 'Créditos de IA' : 'AI Credits',
      used: creditsUsed,
      total: creditsTotal,
      color: '#38b6ff',
      pct: creditsPct,
      warn: creditsPct >= 70,
      danger: creditsPct >= 90,
    },
    {
      icon: ScanLine,
      label: 'Scan Tokens',
      used: scanTokensUsed,
      total: scanTokensTotal,
      color: '#cb6ce6',
      pct: scanTokensTotal > 0 ? Math.round((scanTokensUsed / scanTokensTotal) * 100) : 100,
      warn: scanTokensUsed >= scanTokensTotal,
      danger: scanTokensUsed >= scanTokensTotal,
    },
  ];

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <item.icon size={14} className="text-gray-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-gray-400">{item.label}</span>
                <span className={item.danger ? 'text-red-400' : item.warn ? 'text-yellow-400' : 'text-gray-300'}>
                  {item.used.toLocaleString('pt-BR')} / {item.total.toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${item.danger ? 'bg-red-500' : item.warn ? 'bg-yellow-400' : ''}`}
                  style={{
                    width: `${item.pct}%`,
                    backgroundColor: !item.warn && !item.danger ? item.color : undefined,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((item) => (
        <div key={item.label} className={`rounded-xl border p-4 ${item.danger ? 'border-red-500/30 bg-red-500/5' : item.warn ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-white/10 bg-white/5'}`}>
          <div className="flex items-center gap-2 mb-3">
            <item.icon size={16} style={{ color: item.danger ? '#ef4444' : item.warn ? '#eab308' : item.color }} />
            <span className="text-white font-medium text-sm">{item.label}</span>
            {item.danger && <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">{isPt ? 'Esgotado' : 'Depleted'}</span>}
            {item.warn && !item.danger && <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">{isPt ? 'Atenção' : 'Warning'}</span>}
          </div>
          <MeterBar value={item.used} max={item.total} color={item.color} />
        </div>
      ))}
    </div>
  );
}