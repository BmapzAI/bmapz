import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, TrendingUp, ScanLine, Users, Building2, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/ui/LanguageContext';
import { getCreditsPercent, PLANS } from '@/lib/plans';

const PROMPTS = {
  credits_70: {
    icon: Zap,
    color: '#f59e0b',
    title_en: 'Unlock more AI power',
    title_pt: 'Desbloqueie mais poder de IA',
    msg_en: 'You\'ve used 70% of your AI credits this month. Upgrade to avoid interruptions.',
    msg_pt: 'Você usou 70% dos seus créditos de IA este mês. Faça upgrade para evitar interrupções.',
  },
  credits_90: {
    icon: Zap,
    color: '#ef4444',
    title_en: 'Unlock more AI power',
    title_pt: 'Desbloqueie mais poder de IA',
    msg_en: 'You\'re almost out of AI credits! Top up now or upgrade your plan.',
    msg_pt: 'Seus créditos de IA estão quase esgotados! Faça uma recarga ou upgrade agora.',
  },
  scan_depleted: {
    icon: ScanLine,
    color: '#cb6ce6',
    title_en: 'Need another market scan?',
    title_pt: 'Precisa de mais um scan de mercado?',
    msg_en: 'Your Scan Tokens are depleted. Purchase a Full Scan or upgrade for more tokens.',
    msg_pt: 'Seus Scan Tokens acabaram. Compre um Full Scan avulso ou faça upgrade para mais tokens.',
  },
  users_limit: {
    icon: Users,
    color: '#38b6ff',
    title_en: 'Scale your operation',
    title_pt: 'Escale sua operação',
    msg_en: 'You\'ve reached your user limit. Add more team members to collaborate.',
    msg_pt: 'Você atingiu o limite de usuários. Adicione mais membros ao time para colaborar.',
  },
  contacts_limit: {
    icon: TrendingUp,
    color: '#00e7ff',
    title_en: 'Scale your operation',
    title_pt: 'Escale sua operação',
    msg_en: 'You\'re approaching your contact limit. Upgrade to grow your pipeline.',
    msg_pt: 'Você está se aproximando do limite de contacts. Faça upgrade para crescer seu pipeline.',
  },
  company_limit: {
    icon: Building2,
    color: '#f59e0b',
    title_en: 'Add another company profile',
    title_pt: 'Adicione mais um perfil de empresa',
    msg_en: 'Manage multiple brands or clients. Upgrade to Enterprise for multi-company support.',
    msg_pt: 'Gerencie múltiplas marcas ou clientes. Faça upgrade para Enterprise com suporte multi-empresa.',
  },
};

export default function UpgradePrompt({ type, subscription, onDismiss, inline = false }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isPt = language === 'pt-BR';

  const prompt = PROMPTS[type];
  if (!prompt) return null;

  const Icon = prompt.icon;
  const title = isPt ? prompt.title_pt : prompt.title_en;
  const msg = isPt ? prompt.msg_pt : prompt.msg_en;

  if (inline) {
    return (
      <div className="rounded-xl border p-4 flex items-start gap-3" style={{ borderColor: `${prompt.color}30`, backgroundColor: `${prompt.color}10` }}>
        <Icon size={18} style={{ color: prompt.color }} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-white font-medium text-sm">{title}</p>
          <p className="text-gray-400 text-xs mt-0.5">{msg}</p>
        </div>
        <Button size="sm" onClick={() => navigate('/Billing')}
          className="text-xs flex-shrink-0 gap-1"
          style={{ background: `linear-gradient(135deg, ${prompt.color}, #38b6ff)` }}>
          {isPt ? 'Upgrade' : 'Upgrade'} <ArrowRight size={12} />
        </Button>
        {onDismiss && (
          <button onClick={onDismiss} className="text-gray-500 hover:text-white ml-1">
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl border shadow-2xl p-5"
      style={{ borderColor: `${prompt.color}40`, background: 'linear-gradient(135deg, #1a1a1a, #111)' }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${prompt.color}20` }}>
          <Icon size={20} style={{ color: prompt.color }} />
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">{title}</p>
          <p className="text-gray-400 text-xs mt-1 leading-relaxed">{msg}</p>
          <Button size="sm" className="mt-3 w-full gap-1.5" onClick={() => navigate('/Billing')}
            style={{ background: `linear-gradient(135deg, ${prompt.color}, #38b6ff)` }}>
            {isPt ? 'Ver planos' : 'View plans'} <ArrowRight size={14} />
          </Button>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-gray-500 hover:text-white">
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}