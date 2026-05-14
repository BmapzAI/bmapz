import { api } from '@/api/apiClient';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, ScanLine, Users, Building2, Star, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/ui/LanguageContext';
import { PLANS, formatBRL, ANNUAL_DISCOUNT } from '@/lib/plans';

import { toast } from 'sonner';
import { Company } from '@/api/entities';

const PLAN_ORDER = ['starter', 'growth', 'scale', 'enterprise'];

function PlanCard({ plan, billing, language, onSelect, current, loading }) {
  const isPt = language === 'pt-BR';
  const price = billing === 'annual' ? plan.price_annual : plan.price_monthly;
  const features = isPt ? plan.features_pt : plan.features_en;
  const isRecommended = plan.recommended;

  return (
    <div className={`relative rounded-2xl border flex flex-col transition-all duration-300 hover:scale-[1.02]
      ${isRecommended
        ? 'border-[#cb6ce6]/60 bg-gradient-to-b from-[#cb6ce6]/10 to-[#1a1a1a] shadow-lg shadow-[#cb6ce6]/10'
        : 'border-white/10 bg-white/5 hover:border-white/20'
      } p-6`}>
      {isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] text-white text-xs font-bold whitespace-nowrap">
          ⭐ {isPt ? 'Mais Popular' : 'Most Popular'}
        </div>
      )}
      {current && (
        <div className="absolute -top-3 right-4 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-medium">
          {isPt ? 'Plano Atual' : 'Current Plan'}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h3 className="text-white font-bold text-xl">{plan.name}</h3>
        <p className="text-gray-400 text-sm mt-1">{isPt ? plan.target_pt : plan.target_en}</p>
      </div>

      {/* Price */}
      <div className="mb-6">
        <div className="flex items-end gap-1">
          <span className="text-gray-400 text-lg">R$</span>
          <span className="text-white font-black text-4xl">{price.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
          <span className="text-gray-400 text-sm mb-1">/{isPt ? 'mês' : 'mo'}</span>
        </div>
        {billing === 'annual' && (
          <p className="text-green-400 text-xs mt-1">
            {isPt ? `Economize ${formatBRL((plan.price_monthly - plan.price_annual) * 12)}/ano` : `Save ${formatBRL((plan.price_monthly - plan.price_annual) * 12)}/year`}
          </p>
        )}
        <p className="text-gray-500 text-xs mt-1">
          {isPt ? 'Cobrado ' : 'Billed '}
          {billing === 'annual' ? (isPt ? 'anualmente' : 'annually') : (isPt ? 'mensalmente' : 'monthly')}
        </p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 gap-2 mb-6 p-3 rounded-xl bg-black/20 border border-white/5">
        <div className="text-center">
          <p className="text-white font-bold text-sm">{plan.ai_credits >= 1000 ? `${(plan.ai_credits / 1000).toFixed(0)}K` : plan.ai_credits}</p>
          <p className="text-gray-500 text-xs">AI Credits</p>
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-sm">{plan.contacts >= 1000 ? `${(plan.contacts / 1000).toFixed(0)}K` : plan.contacts}</p>
          <p className="text-gray-500 text-xs">Contacts</p>
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-sm">{plan.users}</p>
          <p className="text-gray-500 text-xs">{isPt ? 'Usuários' : 'Users'}</p>
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-sm">{plan.scan_tokens > 0 ? plan.scan_tokens : plan.lite_scans_monthly ? '1 Lite' : '—'}</p>
          <p className="text-gray-500 text-xs">Scan Tokens</p>
        </div>
      </div>

      {/* Features */}
      <ul className="space-y-2 flex-1 mb-6">
        {features.slice(0, 8).map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Check size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
            <span className="text-gray-300">{f}</span>
          </li>
        ))}
        {features.length > 8 && (
          <li className="text-gray-500 text-xs pl-5">+{features.length - 8} {isPt ? 'recursos' : 'more features'}</li>
        )}
      </ul>

      {/* CTA */}
      <Button
        onClick={() => onSelect(plan.id)}
        className={`w-full gap-2 font-semibold ${current ? 'opacity-60 cursor-not-allowed' : ''}`}
        style={!current ? { background: `linear-gradient(135deg, ${plan.color || '#3572b9'}, #38b6ff)` } : {}}
        disabled={current || loading}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : current ? (isPt ? 'Plano atual' : 'Current plan') : (isPt ? 'Começar agora' : 'Get started')}
        {!current && !loading && <ArrowRight size={16} />}
      </Button>
    </div>
  );
}

export default function Pricing() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isPt = language === 'pt-BR';
  const [billing, setBilling] = useState('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState(null);

  const handleSelect = async (planId) => {
    setCheckoutLoading(planId);
    try {
      const res = await api.post('/api/billing/checkout', {
        type: 'subscription',
        plan_id: planId,
        billing_cycle: billing,
      });
      const url = res.data?.url;
      if (!url) throw new Error(res.data?.error || 'Could not create checkout');
      window.location.href = url;
    } catch (e) {
      toast.error('Checkout failed: ' + e.message);
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] py-12 px-4"><div className="space-y-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#38b6ff]/10 border border-[#38b6ff]/20 text-[#38b6ff] text-sm font-medium">
          <Zap size={14} /> {isPt ? 'Planos & Preços' : 'Plans & Pricing'}
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
          {isPt ? 'ESCOLHA SEU PLANO' : 'CHOOSE YOUR PLAN'}
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          {isPt
            ? 'Comece com 14 dias grátis com acesso completo. Sem cartão de crédito. Cancele quando quiser.'
            : 'Start with a 14-day full-access free trial. No credit card required. Cancel anytime.'}
        </p>

        {/* Trial Banner */}
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#3572b9]/20 to-[#cb6ce6]/20 border border-[#38b6ff]/30">
          <Star size={18} className="text-[#38b6ff]" />
          <span className="text-white font-semibold">
            {isPt ? '14 dias de trial grátis com acesso completo — sem cartão de crédito' : '14-day free trial with full access — no credit card required'}
          </span>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 mt-2">
          <span className={`text-sm ${billing === 'monthly' ? 'text-white' : 'text-gray-400'}`}>
            {isPt ? 'Mensal' : 'Monthly'}
          </span>
          <button
            onClick={() => setBilling(b => b === 'monthly' ? 'annual' : 'monthly')}
            className={`w-12 h-6 rounded-full transition-all relative ${billing === 'annual' ? 'bg-[#38b6ff]' : 'bg-white/20'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${billing === 'annual' ? 'left-7' : 'left-1'}`} />
          </button>
          <span className={`text-sm ${billing === 'annual' ? 'text-white' : 'text-gray-400'}`}>
            {isPt ? 'Anual' : 'Annual'}
            <span className="ml-1.5 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">
              {isPt ? '-15%' : '-15%'}
            </span>
          </span>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {PLAN_ORDER.map(id => (
          <PlanCard
            key={id}
            plan={PLANS[id]}
            billing={billing}
            language={language}
            onSelect={handleSelect}
            current={false}
            loading={checkoutLoading === id}
          />
        ))}
      </div>

      {/* Add-ons */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-white font-bold text-lg mb-4">{isPt ? 'Add-ons disponíveis' : 'Available Add-ons'}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Zap, label: isPt ? 'Pacote de Créditos Extra' : 'Extra Credit Pack', desc: isPt ? 'A partir de R$ 49/pacote' : 'From R$ 49/pack' },
            { icon: ScanLine, label: 'Full Scan', desc: isPt ? 'A partir de R$ 800/scan' : 'From R$ 800/scan' },
            { icon: Users, label: isPt ? 'Usuário Adicional' : 'Extra User', desc: isPt ? 'A partir de R$ 59/mês' : 'From R$ 59/mo' },
            { icon: Building2, label: isPt ? 'Perfil de Empresa' : 'Company Profile', desc: isPt ? 'R$ 750/mês (Enterprise)' : 'R$ 750/mo (Enterprise)' },
          ].map((addon) => (
            <div key={addon.label} className="flex items-start gap-3 p-3 rounded-xl bg-black/20 border border-white/5">
              <addon.icon size={18} className="text-[#38b6ff] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white text-sm font-medium">{addon.label}</p>
                <p className="text-gray-500 text-xs mt-0.5">{addon.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Credit Consumption */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-white font-bold text-lg mb-4">{isPt ? 'Consumo de Créditos de IA' : 'AI Credit Consumption'}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: isPt ? '1 Email' : '1 Email', credits: 50 },
            { label: isPt ? 'Sequência 5 Emails' : '5-Email Sequence', credits: 300 },
            { label: isPt ? 'Workflow Outbound' : 'Full Outbound Workflow', credits: 800 },
            { label: isPt ? 'Enrichment 100 Leads' : 'CRM Enrichment / 100', credits: 400 },
            { label: isPt ? 'Scoring 100 Leads' : 'Lead Scoring / 100', credits: 500 },
            { label: isPt ? '1 Post Social' : '1 Social Post', credits: 40 },
            { label: isPt ? 'Plano de Campanha' : 'Campaign Plan', credits: 600 },
            { label: isPt ? 'Plano de Marketing' : 'Full Marketing Plan', credits: 2500 },
            { label: 'Lite Scan', credits: 5000 },
            { label: isPt ? 'Relatório AI' : 'AI Report', credits: 200 },
            { label: isPt ? '1 Semana Social (3 posts)' : '1 Week Social (3 posts)', credits: 120 },
            { label: isPt ? '1 Mês Social (12 posts)' : '1 Month Social (12 posts)', credits: 480 },
          ].map((item) => (
            <div key={item.label} className="p-3 rounded-xl bg-black/20 border border-white/5 text-center">
              <p className="text-[#38b6ff] font-bold text-lg">{item.credits.toLocaleString('pt-BR')}</p>
              <p className="text-gray-400 text-xs mt-0.5 leading-tight">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <h2 className="text-white font-bold text-lg">{isPt ? 'Perguntas Frequentes' : 'Frequently Asked Questions'}</h2>
        {(isPt ? [
          ['O que são créditos de IA?', 'Créditos são a moeda interna para todas as operações com IA: geração de emails, scoring de leads, criação de conteúdo, planejamento de campanhas, scans e muito mais.'],
          ['O que é um Scan Token?', 'Um Scan Token permite gerar um Full Scan — nosso relatório estratégico premium de inteligência de mercado, posicionamento e análise competitiva.'],
          ['Posso cancelar a qualquer momento?', 'Sim. Você pode cancelar quando quiser. Seu acesso continua até o fim do período pago.'],
          ['Existe desconto anual?', 'Sim. No plano anual você economiza 15% em relação ao mensal.'],
          ['O trial é realmente grátis?', 'Sim. 14 dias com acesso completo, sem cartão de crédito necessário.'],
        ] : [
          ['What are AI credits?', 'Credits are the internal currency for all AI-powered operations: email generation, lead scoring, content creation, campaign planning, scans and more.'],
          ['What is a Scan Token?', 'A Scan Token unlocks a Full Scan — our premium strategic market intelligence report with competitive analysis, positioning, and GTM recommendations.'],
          ['Can I cancel anytime?', 'Yes. Cancel at any time. Your access continues until the end of the paid period.'],
          ['Is there an annual discount?', 'Yes. Annual billing saves you 15% compared to monthly.'],
          ['Is the trial really free?', 'Yes. 14 days with full access, no credit card required.'],
        ]).map(([q, a]) => (
          <div key={q} className="border-b border-white/5 pb-4">
            <p className="text-white font-medium">{q}</p>
            <p className="text-gray-400 text-sm mt-1">{a}</p>
          </div>
        ))}
      </div>
    </div></div>
  );
}
