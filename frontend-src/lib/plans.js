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
    price_monthly: 69.90,
    price_annual: 59.90,
    ai_credits: 8000,
    contacts: 1500,
    users: 1,
    scan_tokens: 0,
    company_profiles: 1,
    color: '#38b6ff',
    gradient: 'from-[#3572b9] to-[#38b6ff]',
    extra_user_price: 79,
    extra_credit_pack_price: 79,
    extra_credit_pack_size: 15000,
    full_scan_price: 1500,
    expected_usage: 2700,
    allowed_model_tiers: ['smart'],
    target_en: 'Solo founders & micro businesses',
    target_pt: 'Empreendedores solo e micro negócios',
    features_en: [
      '8.000 AI credits / mês',
      '1.500 contacts',
      '1 usuário',
      'CRM + Lead Scoring',
      'Email Automation',
      'Social Content Generation',
      'Workflow Builder (até 3)',
      'Analytics básico',
      'Todas as integrações',
      'Full Scan disponível para compra',
    ],
    features_pt: [
      '8.000 créditos de IA / mês',
      '1.500 contacts',
      '1 usuário',
      'CRM + Lead Scoring',
      'Automação de Email',
      'Geração de Conteúdo Social',
      'Workflow Builder (até 3)',
      'Analytics básico',
      'Todas as integrações',
      'Full Scan disponível avulso',
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
    extra_user_price: 79,
    extra_credit_pack_price: 69,
    extra_credit_pack_size: 15000,
    full_scan_price: 1200,
    expected_usage: 11600,
    recommended: true,
    allowed_model_tiers: ['smart', 'smarter'],
    target_en: 'SMBs & growing SaaS teams',
    target_pt: 'PMEs e times SaaS em crescimento',
    features_en: [
      'Tudo do Starter',
      '40.000 AI credits / mês',
      '8.000 contacts',
      'Até 3 usuários',
      '1 Lite Scan / mês (5.000 créditos)',
      'Automação avançada',
      'CRM Enrichment',
      'Analytics avançado',
      'Campaign Orchestration',
      'Full Scan disponível para compra',
    ],
    features_pt: [
      'Tudo do Starter',
      '40.000 créditos de IA / mês',
      '8.000 contacts',
      'Até 3 usuários',
      '1 Lite Scan / mês (5.000 créditos)',
      'Automação avançada',
      'CRM Enrichment',
      'Analytics avançado',
      'Orquestração de Campanhas',
      'Full Scan disponível avulso',
    ],
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    name_pt: 'Scale',
    price_monthly: 765,
    price_annual: 650.25,
    ai_credits: 150000,
    contacts: 50000,
    users: 10,
    scan_tokens: 2,
    company_profiles: 1,
    color: '#00e7ff',
    gradient: 'from-[#00e7ff] to-[#cb6ce6]',
    extra_user_price: 69,
    extra_credit_pack_price: 59,
    extra_credit_pack_size: 15000,
    full_scan_price: 1000,
    extra_full_scan_price: 1000,
    expected_usage: 57000,
    allowed_model_tiers: ['smart', 'smarter', 'smartest'],
    target_en: 'High-growth companies & agencies',
    target_pt: 'Empresas em hypergrowth e agências',
    features_en: [
      'Tudo do Growth',
      '150.000 AI credits / mês',
      '50.000 contacts',
      'Até 10 usuários',
      '2 Full Scan Tokens / mês',
      'Strategic Planning Suite',
      'Multi-channel Campaign Automation',
      'AI Sales Workflows',
      'Executive Reporting',
      'Priority Processing',
    ],
    features_pt: [
      'Tudo do Growth',
      '150.000 créditos de IA / mês',
      '50.000 contacts',
      'Até 10 usuários',
      '2 Full Scan Tokens / mês',
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
    extra_user_price: 59,
    extra_credit_pack_price: 49,
    extra_credit_pack_size: 15000,
    full_scan_price: 800,
    extra_full_scan_price: 800,
    extra_company_profile_price: 750,
    expected_usage: 142000,
    allowed_model_tiers: ['smart', 'smarter', 'smartest'],
    target_en: 'Agencies, enterprise teams & multi-brand operations',
    target_pt: 'Agências, times enterprise e operações multi-marca',
    features_en: [
      'Tudo do Scale',
      '400.000 AI credits / mês',
      '100.000 contacts',
      '15 usuários incluídos',
      '5 Full Scan Tokens / mês',
      '3 Company Profiles',
      'Multi-workspace',
      'White-label Reporting',
      'API Access',
      'Suporte Premium',
      'Controle de acesso avançado',
    ],
    features_pt: [
      'Tudo do Scale',
      '400.000 créditos de IA / mês',
      '100.000 contacts',
      '15 usuários incluídos',
      '5 Full Scan Tokens / mês',
      '3 Perfis de Empresa',
      'Multi-workspace',
      'White-label Reporting',
      'Acesso via API',
      'Suporte Premium',
      'Controle de acesso avançado',
    ],
  },
};

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
  lite_scan: 5000,
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