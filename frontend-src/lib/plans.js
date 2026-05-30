// Centralized plan definitions for BMAPZ
export const PLANS = {
  trial: {
    id: 'trial',
    name: 'Trial',
    name_pt: 'Trial',
    price_monthly: 0,
    price_annual: 0,
    ai_credits: 8000,
    contacts: 1500,
    users: 1,
    scan_tokens: 0,
    company_profiles: 1,
    duration_days: 14,
    features_en: ['Acesso completo por 14 dias', 'Todos os recursos do Starter', 'Sem cartão de crédito'],
    features_pt: ['Acesso completo por 14 dias', 'Todos os recursos do Starter', 'Sem cartão de crédito'],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    name_pt: 'Starter',
    price_monthly: 79.90,
    price_annual: 67.90, // 15% off annual
    ai_credits: 15000,
    contacts: 1500,
    users: 1,
    scan_tokens: 0,
    company_profiles: 1,
    color: '#38b6ff',
    gradient: 'from-[#3572b9] to-[#38b6ff]',
    extra_user_price: 79.90,
    extra_credit_pack_price: 79.90,
    extra_credit_pack_size: 15000,
    extra_full_scan_price: 800,
    expected_usage: 4500,
    allowed_model_tiers: ['smart'],
    target_en: 'Solo founders & micro businesses',
    target_pt: 'Empreendedores solo e micro negócios',
    features_en: [
      '15,000 AI credits / month',
      '1,500 contacts',
      '1 user (extra users R$ 79.90/mo)',
      '1 company profile',
      'CRM + Lead Scoring',
      'Email Automation',
      'Social Content Generation',
      'Workflow Builder (up to 3)',
      'Basic Analytics',
      'All integrations',
      'Full Scan add-on R$ 800',
    ],
    features_pt: [
      '15.000 créditos de IA / mês',
      '1.500 contatos',
      '1 usuário (usuários extras R$ 79,90/mês)',
      '1 perfil de empresa',
      'CRM + Lead Scoring',
      'Automação de Email',
      'Geração de Conteúdo Social',
      'Workflow Builder (até 3)',
      'Analytics básico',
      'Todas as integrações',
      'Full Scan avulso R$ 800',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    name_pt: 'Growth',
    price_monthly: 298,
    price_annual: 253.30,
    ai_credits: 40000,
    contacts: 8000,
    users: 3,
    scan_tokens: 0,
    lite_scans_monthly: 1,
    company_profiles: 1,
    color: '#cb6ce6',
    gradient: 'from-[#cb6ce6] to-[#38b6ff]',
    extra_user_price: 79.90,
    extra_credit_pack_price: 79.90,
    extra_credit_pack_size: 15000,
    extra_full_scan_price: 800,
    expected_usage: 11600,
    recommended: true,
    allowed_model_tiers: ['smart', 'smarter'],
    target_en: 'SMBs & growing SaaS teams',
    target_pt: 'PMEs e times SaaS em crescimento',
    features_en: [
      'Everything in Starter',
      '40,000 AI credits / month',
      '8,000 contacts',
      'Up to 3 users (extra users R$ 79.90/mo)',
      '1 company profile',
      '1 Lite Scan / month',
      'Advanced Automation',
      'CRM Enrichment',
      'Advanced Analytics',
      'Campaign Orchestration',
      'Full Scan add-on R$ 800',
    ],
    features_pt: [
      'Tudo do Starter',
      '40.000 créditos de IA / mês',
      '8.000 contatos',
      'Até 3 usuários (usuários extras R$ 79,90/mês)',
      '1 perfil de empresa',
      '1 Lite Scan / mês',
      'Automação avançada',
      'CRM Enrichment',
      'Analytics avançado',
      'Orquestração de Campanhas',
      'Full Scan avulso R$ 800',
    ],
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    name_pt: 'Scale',
    price_monthly: 785,
    price_annual: 667.25, // 15% off annual
    ai_credits: 150000,
    contacts: 50000,
    users: 7,
    scan_tokens: 2,
    company_profiles: 1,
    color: '#00e7ff',
    gradient: 'from-[#00e7ff] to-[#cb6ce6]',
    extra_user_price: 79.90,
    extra_credit_pack_price: 79.90,
    extra_credit_pack_size: 15000,
    extra_full_scan_price: 800,
    expected_usage: 57000,
    allowed_model_tiers: ['smart', 'smarter', 'smartest'],
    target_en: 'High-growth companies & agencies',
    target_pt: 'Empresas em hypergrowth e agências',
    features_en: [
      'Everything in Growth',
      '150,000 AI credits / month',
      '50,000 contacts',
      'Up to 7 users (extra users R$ 79.90/mo)',
      '1 company profile',
      '2 Full Scan tokens / month',
      'Strategic Planning Suite',
      'Multi-channel Campaign Automation',
      'AI Sales Workflows',
      'Executive Reporting',
      'Priority Processing',
    ],
    features_pt: [
      'Tudo do Growth',
      '150.000 créditos de IA / mês',
      '50.000 contatos',
      'Até 7 usuários (usuários extras R$ 79,90/mês)',
      '1 perfil de empresa',
      '2 Full Scan tokens / mês',
      'Suite de Planejamento Estratégico',
      'Automação Multi-canal',
      'AI Sales Workflows',
      'Relatórios Executivos',
      'Processamento Prioritário',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    name_pt: 'Enterprise',
    price_monthly: 2350,
    price_annual: 1997.50,
    ai_credits: 400000,
    contacts: 100000,
    users: 15,
    scan_tokens: 5,
    company_profiles: 3,
    color: '#f59e0b',
    gradient: 'from-[#f59e0b] to-[#cb6ce6]',
    extra_user_price: 79.90,
    extra_credit_pack_price: 79.90,
    extra_credit_pack_size: 15000,
    extra_full_scan_price: 800,
    extra_company_profile_price: 750,
    expected_usage: 142000,
    allowed_model_tiers: ['smart', 'smarter', 'smartest'],
    target_en: 'Agencies, enterprise teams & multi-brand operations',
    target_pt: 'Agências, times enterprise e operações multi-marca',
    features_en: [
      'Everything in Scale',
      '400,000 AI credits / month',
      '100,000 contacts',
      '15 users included (extra users R$ 79.90/mo)',
      '3 company profiles',
      '5 Full Scan tokens / month',
      'Multi-workspace',
      'White-label Reporting',
      'API Access',
      'Premium Support',
      'Advanced access control',
    ],
    features_pt: [
      'Tudo do Scale',
      '400.000 créditos de IA / mês',
      '100.000 contatos',
      '15 usuários incluídos (usuários extras R$ 79,90/mês)',
      '3 perfis de empresa',
      '5 Full Scan tokens / mês',
      'Multi-workspace',
      'White-label Reporting',
      'Acesso via API',
      'Suporte Premium',
      'Controle de acesso avançado',
    ],
  },
};

// ─── ADD-ON PRICING (consistent across all plans) ────────────────────────────
export const ADDON_PRICES = {
  extra_credit_pack: { price: 79.90, credits: 15000, label_en: 'Extra Credit Pack', label_pt: 'Pacote de Créditos Extra' },
  extra_full_scan:   { price: 800,                   label_en: 'Full Scan Token',  label_pt: 'Token de Full Scan' },
  extra_user:        { price: 79.90,                 label_en: 'Extra User',       label_pt: 'Usuário Adicional' },
  extra_company:     { price: 750,                   label_en: 'Extra Company Profile', label_pt: 'Perfil de Empresa Adicional' },
};

// ─── ANNUAL CANCELLATION FEE ─────────────────────────────────────────────────
// Cancelling an annual plan before 12 months charges the prorated savings
// (you got annual prices = 15% off; if you leave early we recover that discount
// applied to the months you actually used). Computed dynamically per cancellation.
export const ANNUAL_CANCELLATION_POLICY = {
  enabled: true,
  reason: 'Recover the annual discount applied to the months used.',
};

/**
 * Compute the cancellation fee for cancelling an annual subscription early.
 * Fee = (monthly_price - annual_monthly_equivalent) × months_used
 * i.e. claw back the 15% discount on the months consumed.
 *
 * @param {string} planId           — 'starter' | 'growth' | 'scale' | 'enterprise'
 * @param {Date} subscriptionStart  — when the annual sub began
 * @param {Date} cancellationDate   — when the customer is cancelling (default now)
 * @returns { fee: number, monthsUsed: number, refund: number }
 */
export function computeAnnualCancellationFee(planId, subscriptionStart, cancellationDate = new Date()) {
  const plan = PLANS[planId];
  if (!plan || !subscriptionStart) return { fee: 0, monthsUsed: 0, refund: 0 };

  const start = new Date(subscriptionStart);
  const end = new Date(cancellationDate);
  const monthsUsed = Math.max(0, Math.floor((end - start) / (30 * 86400_000)));

  // If they've been a customer for 12+ months, no fee
  if (monthsUsed >= 12) return { fee: 0, monthsUsed, refund: 0 };

  const monthlyPrice = plan.price_monthly || 0;
  const annualMonthly = plan.price_annual || 0;
  const monthlyDiscount = Math.max(0, monthlyPrice - annualMonthly);
  const fee = +(monthlyDiscount * monthsUsed).toFixed(2);

  // Customer prepaid 12 months at annual rate; refund = remaining months × annual rate
  const remainingMonths = 12 - monthsUsed;
  const prepaidRefund = +(annualMonthly * remainingMonths).toFixed(2);

  // Net refund = prepaid refund minus cancellation fee (don't go negative)
  const refund = Math.max(0, +(prepaidRefund - fee).toFixed(2));
  return { fee, monthsUsed, refund };
}

// Reference credit costs for documentation only. Actual billing is per-token
// via computeCreditCost() in backend/src/lib/aiCredits.js. Scan actions are
// NOT here — they use scan_tokens, a separate budget.
export const CREDIT_COSTS = {
  email: 50,
  email_sequence: 300,
  workflow: 800,
  crm_enrichment: 400,
  lead_scoring: 500,
  ai_report: 200,
  social_post: 40,
  social_week: 120,
  social_month: 480,
  campaign_plan: 600,
  marketing_plan: 2500,
  sales_marketing_plan: 4000,
};

export const ANNUAL_DISCOUNT = 0.15; // 15% off

export function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function getPlanById(id) {
  return PLANS[id] || PLANS.starter;
}

export function getCreditsRemaining(subscription) {
  if (!subscription) return 0;
  const total = (subscription.ai_credits_total || 0) + (subscription.topup_credits_purchased || 0);
  const used = subscription.ai_credits_used || 0;
  return Math.max(0, total - used);
}

export function getCreditsPercent(subscription) {
  if (!subscription) return 0;
  const total = (subscription.ai_credits_total || 0) + (subscription.topup_credits_purchased || 0);
  if (total === 0) return 0;
  return Math.min(100, Math.round(((subscription.ai_credits_used || 0) / total) * 100));
}

// Model tier mapping — must match backend MODEL_TIER in backend/src/lib/aiCredits.js
export const MODEL_TIER = {
  'gpt-4o-mini': 'smart',
  'gpt-3.5-turbo': 'smart',
  'claude-3-5-haiku-20241022': 'smart',
  'claude-haiku-3-5': 'smart',
  'gpt-4o': 'smarter',
  'gpt-4-turbo': 'smarter',
  'claude-3-5-sonnet-20241022': 'smarter',
  'claude-sonnet-3-5': 'smarter',
  'claude-sonnet-4-5': 'smartest',
  'claude-3-opus-20240229': 'smartest',
  'claude-opus-4-5': 'smartest',
};

export const MODEL_TIER_LABELS = {
  smart: 'Smart (fast & affordable)',
  smarter: 'Smarter (more reasoning)',
  smartest: 'Smartest (max capability)',
};

export function isModelAllowedForPlan(model, planId) {
  const plan = PLANS[planId] || PLANS.trial;
  const tier = MODEL_TIER[model] || 'smart';
  return (plan.allowed_model_tiers || ['smart']).includes(tier);
}