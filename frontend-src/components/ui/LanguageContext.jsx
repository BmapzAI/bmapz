import React, { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  en: {
    // Navigation
    home: 'Home',
    sales: 'Sales',
    workflows: 'Workflows',
    aiChat: 'AI Chat',
    dashboards: 'Dashboards',
    integrations: 'Integrations',
    settings: 'Settings',
    help: 'Help',
    signOut: 'Sign Out',
    viewProfile: 'View Profile',

    // Home
    welcomeBack: 'WELCOME BACK!',
    hereIsWhatsHappening: "Here's what's happening with your sales today.",
    totalLeads: 'Total Leads',
    messagesSent: 'Messages Sent',
    conversionRate: 'Conversion Rate',
    pipelineValue: 'Pipeline Value',
    fromLastMonth: 'from last month',
    salesFunnel: 'Sales Funnel',
    yourLeadProgression: 'Your lead progression overview',
    recentActivity: 'Recent Activity',
    latestInteractions: 'Latest interactions',
    noRecentActivity: 'No recent activity',
    startByAdding: 'Start by adding leads or sending messages',
    gettingStarted: 'Getting Started',
    completeSteps: 'Complete these steps to set up your sales automation',
    defineYourICP: 'Define Your ICP',
    setUpICP: 'Set up your ideal customer profile criteria',
    importLeads: 'Import Leads',
    addLeadsManually: 'Add leads manually or import from CSV',
    createWorkflows: 'Create Workflows',
    buildAutomated: 'Build automated outreach sequences',
    addNewLead: 'Add New Lead',
    createMessage: 'Create Message',
    buildWorkflow: 'Build Workflow',

    // Sales
    leadManagement: 'Lead Management',
    manageLeads: 'Manage and track your leads through the sales funnel',
    kanbanView: 'Kanban View',
    listView: 'List View',
    qualificationView: 'Qualification Review',
    searchLeads: 'Search leads...',
    filterByStage: 'Filter by stage',
    allStages: 'All Stages',
    noLeadsFound: 'No leads found',
    addYourFirst: 'Add your first lead to get started',
    lists: 'Lists',
    allLists: 'All Lists',

    // Workflows
    workflowBuilder: 'Workflow Builder',
    createAndManage: 'Create and manage your automated outreach sequences',
    newWorkflow: 'New Workflow',
    activeWorkflows: 'Active Workflows',
    draftWorkflows: 'Draft Workflows',
    templates: 'Templates',
    optimizeLayout: 'Optimize Layout',
    createWorkflow: 'Create Workflow',

    // AI Chat
    aiSalesAgent: 'BMAPZ Sales Agent',
    intelligentProspecting: 'Intelligent Prospecting',
    askMeAnything: 'Ask me anything about lead research, outreach messages, or sales strategy...',
    send: 'Send',
    recordAudio: 'Record audio',
    stopRecording: 'Stop recording',
    transcribing: 'Transcribing...',

    // Dashboards
    dashboardsTitle: 'Dashboards',
    customizeYourView: 'Customize your data visualization',

    // Integrations
    integrationsTitle: 'Integrations',
    connectYourTools: 'Connect your tools and platforms',
    connected: 'Connected',
    disconnected: 'Disconnected',
    connect: 'Connect',
    disconnect: 'Disconnect',
    configured: 'Configured',

    // Settings
    settingsTitle: 'Settings',
    generalSettings: 'General Settings',
    companyProfile: 'Company Profile',
    icpSettings: 'ICP Settings',
    subscriptionPlan: 'Subscription Plan',
    language: 'Language',
    theme: 'Theme',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    briefing: 'Briefing',
    apiKeys: 'API Keys',
    companyInfo: 'Company Information',
    tofObjective: 'TOF Objective (Top of Funnel)',
    mofObjective: 'MOF Objective (Middle of Funnel)',
    bofObjective: 'BOF Objective (Bottom of Funnel)',
    billing: 'Billing',
    aiCredits: 'AI Credits',
    scanTokens: 'Scan Tokens',
    upgrade: 'Upgrade',
    currentPlan: 'Current Plan',

    // Common
    save: 'Save Changes',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    close: 'Close',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    leads: 'leads',
    messages: 'messages',
    generate: 'Generate',
    optimize: 'Optimize',
    addContext: 'Add context (optional)',
    contextPlaceholder: 'Extra context for AI: specific instructions, tone, target audience, product details...',
    generateNew: 'Generate New',
    optimizeExisting: 'Optimize Existing',

    // Lead statuses
    awareness: 'Awareness',
    leadCapture: 'Lead Capture',
    prospect: 'Prospect',
    mql: 'MQL',
    sql: 'SQL',
    opportunity: 'Opportunity',
    customer: 'Customer',

    // Growth funnel
    acquisition: 'Acquisition',
    activation: 'Activation',
    retention: 'Retention',
    revenue: 'Revenue',
    referral: 'Referral',

    // Blog
    blog: 'Blog',
    blogDescription: 'Create SEO-optimized blog posts and publish to your website',
    newPost: 'New Post',
    backToPosts: '← Back to Posts',
    postTitle: 'Post Title (H1)',
    urlSlug: 'URL Slug',
    keywords: 'Keywords',
    addKeyword: 'Add keyword...',
    metaDescription: 'Meta Description (150-160 chars)',
    content: 'Content (Markdown)',
    aiGenerate: 'AI Generate',
    saveDraft: 'Save Draft',
    updatePost: 'Update Post',
    publish: 'Publish',
    publishOptions: 'Publish Options',
    seoScore: 'SEO Score',
    wordCount: 'words',
    minWords: 'Min: 800 words',

    // Social Media
    socialMedia: 'Social Media',
    socialMediaDesc: 'Plan, create and schedule your social media content',
    planning: 'Planning',
    contentTab: 'Content',
    analytics: 'Analytics',
    posts: 'Posts',
    schedulePost: 'Schedule Post',
    editPost: 'Edit Post',
    deletePost: 'Delete Post',
    newPostBtn: 'New Post',
    generateWithAI: 'Generate with AI',
    boostSuggestion: 'Boost Suggestion',
    postedPosts: 'Published Posts',
    boostRecommended: 'Boost Recommended',
    selectPeriod: 'Select Period',
    last30Days: 'Last 30 Days',
    last7Days: 'Last 7 Days',
    last90Days: 'Last 90 Days',
    dayView: 'Day View',

    // Ads
    ads: 'Ads',
    adsDesc: 'Create AI-powered ad strategies and copies',
    strategy: 'Strategy',
    copy: 'Copy',
    creatives: 'Creatives',
    performance: 'Performance',
    generateStrategy: 'Generate Strategy',
    generateCopy: 'Generate Copy',
    abTest: 'A/B Test',
    variantA: 'Variant A',
    variantB: 'Variant B',
    extraContext: 'Extra Context (optional)',

    // Help
    helpCenter: 'Help Center',
    helpDesc: 'Find answers, ask our AI, or contact support',
    searchHelp: 'Search help or ask the AI assistant...',
    askAI: 'Ask AI',
    emailSupport: 'Email Support',
    liveChat: 'Live Chat (WhatsApp)',
    aiAssistant: 'AI Assistant',
    stillNeedHelp: 'Still need help?',
    supportReady: 'Our support team is ready to assist you',
    documentation: 'Documentation',
    videoTutorials: 'Video Tutorials',
    apiReference: 'API Reference',
    gettingStartedFaq: 'Getting Started',
    enterpriseOnly: 'Enterprise plan required',
    privacyPolicy: 'Privacy Policy',
    privacyPolicyDesc: 'Read how BMAPZ handles and protects your data',
    viewPolicy: 'View Policy',

    // Analytics / Workflow Analytics
    workflowAnalytics: 'Workflow Analytics',
    recommendations: 'Recommendations',
    goToPage: 'Go to Page',

    // Brand Scan
    brandScan: 'Brand Scan',
    importantInfo: 'Important Information',

    // Lead Lists
    dynamicList: 'Dynamic List',
    autoAddsLeads: 'Auto-adds leads based on rules',
    createList: 'Create New List',
    editList: 'Edit List',
    listName: 'List Name',
    description: 'Description',

    // Workflow Builder shortcuts
    shortcutUndo: 'Ctrl+Z: Undo',
    shortcutRedo: 'Ctrl+Y: Redo',
    shortcutZoom: 'Scroll: Zoom',
    shortcutPan: 'Right-click drag: Pan',
    shortcutSelect: 'Shift+Click: Multi-select',
    shortcutBox: 'Left-drag: Box select',
  },
  'pt-BR': {
    // Navigation
    home: 'Início',
    sales: 'Vendas',
    workflows: 'Fluxos',
    aiChat: 'Chat IA',
    dashboards: 'Dashboards',
    integrations: 'Integrações',
    settings: 'Configurações',
    help: 'Ajuda',
    signOut: 'Sair',
    viewProfile: 'Ver Perfil',

    // Home
    welcomeBack: 'BEM-VINDO DE VOLTA!',
    hereIsWhatsHappening: 'Veja o que está acontecendo com suas vendas hoje.',
    totalLeads: 'Total de Leads',
    messagesSent: 'Mensagens Enviadas',
    conversionRate: 'Taxa de Conversão',
    pipelineValue: 'Valor do Pipeline',
    fromLastMonth: 'do mês passado',
    salesFunnel: 'Funil de Vendas',
    yourLeadProgression: 'Visão geral da progressão dos leads',
    recentActivity: 'Atividade Recente',
    latestInteractions: 'Últimas interações',
    noRecentActivity: 'Sem atividade recente',
    startByAdding: 'Comece adicionando leads ou enviando mensagens',
    gettingStarted: 'Primeiros Passos',
    completeSteps: 'Complete estas etapas para configurar sua automação de vendas',
    defineYourICP: 'Defina seu ICP',
    setUpICP: 'Configure os critérios do perfil de cliente ideal',
    importLeads: 'Importar Leads',
    addLeadsManually: 'Adicione leads manualmente ou importe do CSV',
    createWorkflows: 'Criar Fluxos',
    buildAutomated: 'Construa sequências de contato automatizadas',
    addNewLead: 'Novo Lead',
    createMessage: 'Criar Mensagem',
    buildWorkflow: 'Criar Fluxo',

    // Sales
    leadManagement: 'Gestão de Leads',
    manageLeads: 'Gerencie e acompanhe seus leads pelo funil de vendas',
    kanbanView: 'Visão Kanban',
    listView: 'Visão de Lista',
    qualificationView: 'Revisão de Qualificação',
    searchLeads: 'Buscar leads...',
    filterByStage: 'Filtrar por etapa',
    allStages: 'Todos os Estágios',
    noLeadsFound: 'Nenhum lead encontrado',
    addYourFirst: 'Adicione seu primeiro lead para começar',
    lists: 'Listas',
    allLists: 'Todas as Listas',

    // Workflows
    workflowBuilder: 'Construtor de Fluxos',
    createAndManage: 'Crie e gerencie suas sequências de contato automatizadas',
    newWorkflow: 'Novo Fluxo',
    activeWorkflows: 'Fluxos Ativos',
    draftWorkflows: 'Rascunhos',
    templates: 'Modelos',
    optimizeLayout: 'Otimizar Layout',
    createWorkflow: 'Criar Fluxo',

    // AI Chat
    aiSalesAgent: 'Agente BMAPZ',
    intelligentProspecting: 'Prospecção Inteligente',
    askMeAnything: 'Pergunte-me sobre pesquisa de leads, mensagens de contato ou estratégia de vendas...',
    send: 'Enviar',
    recordAudio: 'Gravar áudio',
    stopRecording: 'Parar gravação',
    transcribing: 'Transcrevendo...',

    // Dashboards
    dashboardsTitle: 'Dashboards',
    customizeYourView: 'Personalize sua visualização de dados',

    // Integrations
    integrationsTitle: 'Integrações',
    connectYourTools: 'Conecte suas ferramentas e plataformas',
    connected: 'Conectado',
    disconnected: 'Desconectado',
    connect: 'Conectar',
    disconnect: 'Desconectar',
    configured: 'Configurado',

    // Settings
    settingsTitle: 'Configurações',
    generalSettings: 'Configurações Gerais',
    companyProfile: 'Perfil da Empresa',
    icpSettings: 'Configurações de ICP',
    subscriptionPlan: 'Plano de Assinatura',
    language: 'Idioma',
    theme: 'Tema',
    darkMode: 'Modo Escuro',
    lightMode: 'Modo Claro',
    briefing: 'Briefing',
    apiKeys: 'Chaves de API',
    companyInfo: 'Informações da Empresa',
    tofObjective: 'Objetivo TOF (Topo do Funil)',
    mofObjective: 'Objetivo MOF (Meio do Funil)',
    bofObjective: 'Objetivo BOF (Fundo do Funil)',
    billing: 'Billing',
    aiCredits: 'Créditos de IA',
    scanTokens: 'Scan Tokens',
    upgrade: 'Upgrade',
    currentPlan: 'Plano Atual',

    // Common
    save: 'Salvar',
    cancel: 'Cancelar',
    delete: 'Excluir',
    edit: 'Editar',
    create: 'Criar',
    close: 'Fechar',
    loading: 'Carregando...',
    error: 'Erro',
    success: 'Sucesso',
    confirm: 'Confirmar',
    back: 'Voltar',
    next: 'Próximo',
    leads: 'leads',
    messages: 'mensagens',
    generate: 'Gerar',
    optimize: 'Otimizar',
    addContext: 'Adicionar contexto (opcional)',
    contextPlaceholder: 'Contexto extra para a IA: instruções específicas, tom, público-alvo, detalhes do produto...',
    generateNew: 'Gerar Novo',
    optimizeExisting: 'Otimizar Existente',

    // Lead statuses
    awareness: 'Consciência',
    leadCapture: 'Captura de Lead',
    prospect: 'Prospecto',
    mql: 'MQL',
    sql: 'SQL',
    opportunity: 'Oportunidade',
    customer: 'Cliente',

    // Growth funnel
    acquisition: 'Aquisição',
    activation: 'Ativação',
    retention: 'Retenção',
    revenue: 'Receita',
    referral: 'Indicação',

    // Blog
    blog: 'Blog',
    blogDescription: 'Crie artigos otimizados para SEO e publique no seu site',
    newPost: 'Novo Artigo',
    backToPosts: '← Voltar aos Artigos',
    postTitle: 'Título do Artigo (H1)',
    urlSlug: 'Slug da URL',
    keywords: 'Palavras-chave',
    addKeyword: 'Adicionar palavra-chave...',
    metaDescription: 'Meta Descrição (150-160 caracteres)',
    content: 'Conteúdo (Markdown)',
    aiGenerate: 'Gerar com IA',
    saveDraft: 'Salvar Rascunho',
    updatePost: 'Atualizar Artigo',
    publish: 'Publicar',
    publishOptions: 'Opções de Publicação',
    seoScore: 'Score SEO',
    wordCount: 'palavras',
    minWords: 'Mínimo: 800 palavras',

    // Social Media
    socialMedia: 'Redes Sociais',
    socialMediaDesc: 'Planeje, crie e agende seu conteúdo nas redes sociais',
    planning: 'Planejamento',
    contentTab: 'Conteúdo',
    analytics: 'Análise',
    posts: 'Posts',
    schedulePost: 'Agendar Post',
    editPost: 'Editar Post',
    deletePost: 'Excluir Post',
    newPostBtn: 'Novo Post',
    generateWithAI: 'Gerar com IA',
    boostSuggestion: 'Sugestão de Impulsionamento',
    postedPosts: 'Posts Publicados',
    boostRecommended: 'Impulsionamento Recomendado',
    selectPeriod: 'Selecionar Período',
    last30Days: 'Últimos 30 Dias',
    last7Days: 'Últimos 7 Dias',
    last90Days: 'Últimos 90 Dias',
    dayView: 'Visão do Dia',

    // Ads
    ads: 'Anúncios',
    adsDesc: 'Crie estratégias e textos de anúncios com IA',
    strategy: 'Estratégia',
    copy: 'Copys',
    creatives: 'Criativos',
    performance: 'Desempenho',
    generateStrategy: 'Gerar Estratégia',
    generateCopy: 'Gerar Copy',
    abTest: 'Teste A/B',
    variantA: 'Variante A',
    variantB: 'Variante B',
    extraContext: 'Contexto Extra (opcional)',

    // Help
    helpCenter: 'Central de Ajuda',
    helpDesc: 'Encontre respostas, pergunte à IA ou entre em contato com o suporte',
    searchHelp: 'Buscar ajuda ou perguntar à IA...',
    askAI: 'Perguntar à IA',
    emailSupport: 'Suporte por E-mail',
    liveChat: 'Chat ao Vivo (WhatsApp)',
    aiAssistant: 'Assistente IA',
    stillNeedHelp: 'Ainda precisa de ajuda?',
    supportReady: 'Nossa equipe de suporte está pronta para ajudar',
    documentation: 'Documentação',
    videoTutorials: 'Tutoriais em Vídeo',
    apiReference: 'Referência de API',
    gettingStartedFaq: 'Primeiros Passos',
    enterpriseOnly: 'Plano Enterprise necessário',
    privacyPolicy: 'Política de Privacidade',
    privacyPolicyDesc: 'Leia como o BMAPZ trata e protege seus dados',
    viewPolicy: 'Ver Política',

    // Analytics / Workflow Analytics
    workflowAnalytics: 'Análise de Fluxos',
    recommendations: 'Recomendações',
    goToPage: 'Ir para Página',

    // Brand Scan
    brandScan: 'Brand Scan',
    importantInfo: 'Informações Importantes',

    // Lead Lists
    dynamicList: 'Lista Dinâmica',
    autoAddsLeads: 'Adiciona leads automaticamente com base em regras',
    createList: 'Criar Nova Lista',
    editList: 'Editar Lista',
    listName: 'Nome da Lista',
    description: 'Descrição',

    // Workflow Builder shortcuts
    shortcutUndo: 'Ctrl+Z: Desfazer',
    shortcutRedo: 'Ctrl+Y: Refazer',
    shortcutZoom: 'Scroll: Zoom',
    shortcutPan: 'Botão dir. do mouse: Mover',
    shortcutSelect: 'Shift+Clique: Multi-seleção',
    shortcutBox: 'Arrastar: Seleção em área',
  }
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('bmapz_language') || 'en';
  });

  const t = (key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('bmapz_language', lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export default LanguageContext;