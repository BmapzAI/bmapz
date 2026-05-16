import { api } from '@/api/apiClient';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Zap, ScanLine, Users, Building2, CreditCard, TrendingUp, ArrowRight, Plus, Check, Star, RefreshCw, BarChart3, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/components/ui/LanguageContext';
import { PLANS, formatBRL, getCreditsPercent, getCreditsRemaining, CREDIT_COSTS } from '@/lib/plans';
import UsageMeter from '@/components/billing/UsageMeter';
import UpgradePrompt from '@/components/billing/UpgradePrompt';
import { toast } from 'sonner';
import { Company, Subscription, CreditTransaction, BillingPurchase } from '@/api/entities';

const PLAN_ORDER = ['starter', 'growth', 'scale', 'enterprise'];

function StatCard({ icon: StatIcon, label, value, sub, color = '#38b6ff' }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <StatIcon size={16} style={{ color }} />
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <p className="text-white font-bold text-2xl">{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function Billing() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const isPt = language === 'pt-BR';
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedAddon, setSelectedAddon] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(null); // tracks which item is loading

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => Company.list() });
  const company = companies[0];

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions', company?.id],
    queryFn: () => company?.id ? Subscription.filter({ company_id: company.id }) : [],
    enabled: !!company?.id,
  });
  const subscription = subscriptions[0];

  const { data: transactions = [] } = useQuery({
    queryKey: ['credit_transactions', company?.id],
    queryFn: () => company?.id ? CreditTransaction.filter({ company_id: company.id }, '-created_date', 50) : [],
    enabled: !!company?.id,
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ['billing_purchases', company?.id],
    queryFn: () => company?.id ? BillingPurchase.filter({ company_id: company.id }, '-created_date', 20) : [],
    enabled: !!company?.id,
  });

  const plan = PLANS[subscription?.plan || 'starter'];
  const creditsTotal = (subscription?.ai_credits_total || plan?.ai_credits || 0) + (subscription?.topup_credits_purchased || 0);
  const creditsUsed = subscription?.ai_credits_used || 0;
  const creditsRemaining = Math.max(0, creditsTotal - creditsUsed);
  const creditsPct = creditsTotal > 0 ? Math.min(100, Math.round((creditsUsed / creditsTotal) * 100)) : 0;

  const scanTokensTotal = subscription?.scan_tokens_total || plan?.scan_tokens || 0;
  const scanTokensUsed = subscription?.scan_tokens_used || 0;
  const scanTokensRemaining = Math.max(0, scanTokensTotal - scanTokensUsed);

  // Handle Stripe redirect callbacks
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_success')) {
      toast.success(isPt ? 'Pagamento confirmado! Sua assinatura foi ativada.' : 'Payment confirmed! Your subscription is now active.');
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['billing_purchases'] });
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('stripe_cancel')) {
      toast.error(isPt ? 'Pagamento cancelado.' : 'Payment cancelled.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleStripeCheckout = async (type, opts = {}) => {
    if (!company?.id) return;
    const key = opts.key || type;
    setCheckoutLoading(key);
    try {
      const res = await api.post('/api/billing/checkout', { plan: type, ...opts });
      const url = res.data?.url;
      if (!url) throw new Error('Could not create checkout session');
      window.location.href = url;
    } catch (e) {
      toast.error('Checkout failed: ' + e.message);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePurchaseAddon = (addonType, amount, description, extras = {}) => {
    handleStripeCheckout('addon', {
      key: addonType,
      addon_type: addonType,
      amount_brl: amount,
      description,
      ...extras,
    });
  };

  const trialDaysLeft = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  const isTrial = subscription?.status === 'trialing';

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            {isPt ? 'ASSINATURA & BILLING' : 'SUBSCRIPTION & BILLING'}
          </h1>
          <p className="text-gray-400 mt-1">{isPt ? 'Gerencie seu plano, cr�ditos e add-ons' : 'Manage your plan, credits and add-ons'}</p>
        </div>
        <Button onClick={() => navigate('/Pricing')} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
          <Star size={16} /> {isPt ? 'Ver todos os planos' : 'View all plans'}
        </Button>
      </div>

      {/* Trial Banner */}
      {isTrial && trialDaysLeft !== null && (
        <div className="rounded-2xl border border-[#38b6ff]/30 bg-gradient-to-r from-[#3572b9]/20 to-[#cb6ce6]/20 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Star size={24} className="text-[#38b6ff]" />
            <div>
              <p className="text-white font-semibold">
                {isPt ? `Trial: ${trialDaysLeft} dias restantes` : `Trial: ${trialDaysLeft} days remaining`}
              </p>
              <p className="text-gray-400 text-sm">
                {isPt ? 'Assine um plano para continuar usando o BMAPZ ap�s o trial.' : 'Subscribe to a plan to continue using BMAPZ after your trial.'}
              </p>
            </div>
          </div>
          <Button onClick={() => navigate('/Pricing')} className="bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2">
            {isPt ? 'Escolher plano' : 'Choose plan'} <ArrowRight size={16} />
          </Button>
        </div>
      )}

      {/* Upgrade prompts */}
      {creditsPct >= 90 && <UpgradePrompt type="credits_90" subscription={subscription} inline />}
      {creditsPct >= 70 && creditsPct < 90 && <UpgradePrompt type="credits_70" subscription={subscription} inline />}
      {scanTokensRemaining === 0 && scanTokensTotal > 0 && <UpgradePrompt type="scan_depleted" subscription={subscription} inline />}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="overview" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <BarChart3 size={14} className="mr-1.5" />{isPt ? 'Vis�o Geral' : 'Overview'}
          </TabsTrigger>
          <TabsTrigger value="addons" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <Plus size={14} className="mr-1.5" />Add-ons
          </TabsTrigger>
          <TabsTrigger value="usage" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <Zap size={14} className="mr-1.5" />{isPt ? 'Uso' : 'Usage'}
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <Calendar size={14} className="mr-1.5" />{isPt ? 'Hist�rico' : 'History'}
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6">
          {/* Plan Info */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-white font-semibold text-lg">
                  {isPt ? 'Plano Atual' : 'Current Plan'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-3 py-1 rounded-full text-sm font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${plan?.color || '#3572b9'}, #38b6ff)` }}>
                    {plan?.name || 'Starter'}
                  </span>
                  {subscription?.billing_cycle === 'annual' && (
                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
                      {isPt ? 'Anual (-15%)' : 'Annual (-15%)'}
                    </span>
                  )}
                  {subscription?.founder_pricing && (
                    <span className="px-2 py-0.5 rounded-full bg-[#f59e0b]/20 text-[#f59e0b] text-xs">
                      Founder Price
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-black text-2xl">{formatBRL(subscription?.price_brl || plan?.price_monthly || 0)}</p>
                <p className="text-gray-500 text-xs">/{isPt ? 'm�s' : 'mo'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Zap} label="AI Credits" value={`${creditsRemaining.toLocaleString('pt-BR')}`} sub={isPt ? `de ${creditsTotal.toLocaleString('pt-BR')} restantes` : `of ${creditsTotal.toLocaleString('pt-BR')} remaining`} />
              <StatCard icon={ScanLine} label="Scan Tokens" value={scanTokensRemaining} sub={isPt ? `de ${scanTokensTotal} tokens` : `of ${scanTokensTotal} tokens`} color="#cb6ce6" />
              <StatCard icon={Users} label={isPt ? 'Usu�rios' : 'Users'} value={`${subscription?.extra_users || 0}+${plan?.users || 1}`} sub={isPt ? 'total dispon�vel' : 'total available'} color="#00e7ff" />
              <StatCard icon={Building2} label={isPt ? 'Empresas' : 'Companies'} value={plan?.company_profiles || 1} sub={isPt ? 'perfis de empresa' : 'company profiles'} color="#f59e0b" />
            </div>
          </div>

          {/* Usage Meter */}
          <UsageMeter subscription={subscription} />

          {/* Period Info */}
          {subscription?.current_period_end && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
              <Calendar size={16} className="text-gray-400" />
              <p className="text-gray-400 text-sm">
                {isPt ? 'Pr�xima renova��o: ' : 'Next renewal: '}
                <span className="text-white font-medium">
                  {new Date(subscription.current_period_end).toLocaleDateString(isPt ? 'pt-BR' : 'en-US', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </p>
            </div>
          )}

          {/* Quick Upgrade */}
          {subscription?.plan !== 'enterprise' && (
            <div className="rounded-2xl border border-[#cb6ce6]/20 bg-gradient-to-r from-[#cb6ce6]/10 to-[#38b6ff]/10 p-5 flex items-center justify-between">
              <div>
                <p className="text-white font-semibold">{isPt ? 'Get deeper strategic intelligence' : 'Get deeper strategic intelligence'}</p>
                <p className="text-gray-400 text-sm mt-0.5">
                  {isPt ? 'Fa�a upgrade e desbloqueie mais cr�ditos, Scan Tokens e recursos avan�ados.' : 'Upgrade and unlock more credits, Scan Tokens, and advanced features.'}
                </p>
              </div>
              <Button onClick={() => navigate('/Pricing')} className="bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2 flex-shrink-0" disabled={!!checkoutLoading}>
                {isPt ? 'Fazer Upgrade' : 'Upgrade'} <ArrowRight size={16} />
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Add-ons */}
        <TabsContent value="addons" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Credit Top-up */}
            <div className="rounded-2xl border border-[#38b6ff]/20 bg-white/5 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#38b6ff]/20 flex items-center justify-center">
                  <Zap size={20} className="text-[#38b6ff]" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">{isPt ? 'Pacote de Cr�ditos Extra' : 'Extra Credit Pack'}</h3>
                  <p className="text-gray-400 text-xs">{isPt ? 'Recarregue seus cr�ditos de IA' : 'Top up your AI credits'}</p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { credits: plan?.extra_credit_pack_size || 10000, price: plan?.extra_credit_pack_price || 79 },
                ].map((pack) => (
                  <div key={pack.credits} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/10">
                    <div>
                      <p className="text-white font-medium">{pack.credits.toLocaleString('pt-BR')} {isPt ? 'cr�ditos' : 'credits'}</p>
                      <p className="text-gray-500 text-xs">{isPt ? 'V�lido pelo per�odo atual' : 'Valid for the current period'}</p>
                    </div>
                    <Button size="sm" onClick={() => handlePurchaseAddon('credit_topup', pack.price, `${pack.credits} credit top-up`, { credits_granted: pack.credits })}
                      disabled={!!checkoutLoading}
                      className="bg-[#38b6ff]/20 text-[#38b6ff] hover:bg-[#38b6ff]/30 border border-[#38b6ff]/30">
                      {checkoutLoading === 'credit_topup' ? <Loader2 size={14} className="animate-spin" /> : formatBRL(pack.price)}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Full Scan */}
            <div className="rounded-2xl border border-[#cb6ce6]/20 bg-white/5 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#cb6ce6]/20 flex items-center justify-center">
                  <ScanLine size={20} className="text-[#cb6ce6]" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Full Scan</h3>
                  <p className="text-gray-400 text-xs">{isPt ? 'Relat�rio estrat�gico premium de mercado' : 'Premium strategic market intelligence report'}</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-black/20 border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">1 Full Scan Token</p>
                  <p className="text-gray-500 text-xs">{isPt ? 'An�lise competitiva completa + GTM' : 'Full competitive analysis + GTM strategy'}</p>
                </div>
                <Button size="sm" onClick={() => handlePurchaseAddon('full_scan', plan?.full_scan_price || 1500, 'Full Scan Token', { scan_tokens_granted: 1 })}
                  disabled={!!checkoutLoading}
                  className="bg-[#cb6ce6]/20 text-[#cb6ce6] hover:bg-[#cb6ce6]/30 border border-[#cb6ce6]/30">
                  {checkoutLoading === 'full_scan' ? <Loader2 size={14} className="animate-spin" /> : formatBRL(plan?.full_scan_price || 1500)}
                </Button>
              </div>
              <div className="mt-3 p-3 rounded-xl bg-[#cb6ce6]/10 border border-[#cb6ce6]/10">
                <p className="text-[#cb6ce6] text-xs font-medium">
                  {isPt ? '= Intelig�ncia de mercado que seria cobrada R$10.000R$30.000 por consultores tradicionais' : '= Market intelligence traditionally priced at R$10,000R$30,000 by consultants'}
                </p>
              </div>
            </div>

            {/* Extra User */}
            <div className="rounded-2xl border border-[#00e7ff]/20 bg-white/5 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#00e7ff]/20 flex items-center justify-center">
                  <Users size={20} className="text-[#00e7ff]" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">{isPt ? 'Usu�rio Adicional' : 'Extra User'}</h3>
                  <p className="text-gray-400 text-xs">{isPt ? 'Adicione membros ao time' : 'Add team members'}</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-black/20 border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">+1 {isPt ? 'usu�rio/m�s' : 'user/month'}</p>
                  <p className="text-gray-500 text-xs">{isPt ? 'Acesso completo � plataforma' : 'Full platform access'}</p>
                </div>
                <Button size="sm" onClick={() => handlePurchaseAddon('extra_user', plan?.extra_user_price || 79, 'Extra user seat')}
                  disabled={!!checkoutLoading}
                  className="bg-[#00e7ff]/20 text-[#00e7ff] hover:bg-[#00e7ff]/30 border border-[#00e7ff]/30">
                  {checkoutLoading === 'extra_user' ? <Loader2 size={14} className="animate-spin" /> : <>{formatBRL(plan?.extra_user_price || 79)}{isPt ? '/m�s' : '/mo'}</>}
                </Button>
              </div>
            </div>

            {/* Extra Company Profile (Enterprise only) */}
            <div className={`rounded-2xl border bg-white/5 p-6 ${subscription?.plan === 'enterprise' ? 'border-[#f59e0b]/20' : 'border-white/10 opacity-60'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/20 flex items-center justify-center">
                  <Building2 size={20} className="text-[#f59e0b]" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">{isPt ? 'Perfil de Empresa Adicional' : 'Extra Company Profile'}</h3>
                  <p className="text-gray-400 text-xs">{isPt ? 'Somente Enterprise' : 'Enterprise only'}</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-black/20 border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">+1 {isPt ? 'empresa/m�s' : 'company/month'}</p>
                  <p className="text-gray-500 text-xs">+5 {isPt ? 'usu�rios inclu�dos' : 'users included'}</p>
                </div>
                <Button size="sm"
                  disabled={subscription?.plan !== 'enterprise' || !!checkoutLoading}
                  onClick={() => handlePurchaseAddon('extra_company_profile', 750, 'Extra company profile')}
                  className="bg-[#f59e0b]/20 text-[#f59e0b] hover:bg-[#f59e0b]/30 border border-[#f59e0b]/30 disabled:opacity-40">
                  {checkoutLoading === 'extra_company_profile' ? <Loader2 size={14} className="animate-spin" /> : <>{formatBRL(750)}{isPt ? '/m�s' : '/mo'}</>}
                </Button>
              </div>
              {subscription?.plan !== 'enterprise' && (
                <p className="text-gray-500 text-xs mt-2">{isPt ? 'Dispon�vel apenas no plano Enterprise.' : 'Available on Enterprise plan only.'}</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Usage */}
        <TabsContent value="usage" className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-white font-semibold mb-4">{isPt ? 'Hist�rico de Uso de Cr�ditos' : 'Credit Usage History'}</h3>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Zap size={32} className="mx-auto mb-2 opacity-30" />
                <p>{isPt ? 'Nenhuma transa��o ainda' : 'No transactions yet'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                    <div>
                      <p className="text-white text-sm">{tx.description || tx.feature || tx.type}</p>
                      <p className="text-gray-500 text-xs">{new Date(tx.created_date).toLocaleString(isPt ? 'pt-BR' : 'en-US')}</p>
                    </div>
                    <span className={`font-mono font-medium ${tx.credits_delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.credits_delta > 0 ? '+' : ''}{tx.credits_delta.toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Consumption Reference */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-white font-semibold mb-4">{isPt ? 'Refer�ncia de Consumo' : 'Consumption Reference'}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(CREDIT_COSTS).map(([key, credits]) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                  <span className="text-gray-400 text-xs capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-[#38b6ff] font-mono font-medium text-sm">{credits.toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-white font-semibold mb-4">{isPt ? 'Hist�rico de Compras' : 'Purchase History'}</h3>
            {purchases.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CreditCard size={32} className="mx-auto mb-2 opacity-30" />
                <p>{isPt ? 'Nenhuma compra ainda' : 'No purchases yet'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {purchases.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${p.status === 'paid' ? 'bg-green-400' : p.status === 'pending' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                      <div>
                        <p className="text-white text-sm font-medium">{p.description || p.type}</p>
                        <p className="text-gray-500 text-xs">{new Date(p.created_date).toLocaleDateString(isPt ? 'pt-BR' : 'en-US')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium">{formatBRL(p.amount_brl)}</p>
                      <p className={`text-xs ${p.status === 'paid' ? 'text-green-400' : p.status === 'pending' ? 'text-yellow-400' : 'text-red-400'}`}>
                        {p.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}