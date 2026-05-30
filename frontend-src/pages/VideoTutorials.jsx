import React, { useState } from 'react';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Play, Clock, ChevronRight, BookOpen, Star, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const TUTORIALS = [
  {
    category: 'Getting Started',
    categoryPt: 'Primeiros Passos',
    icon: '=',
    color: '#38b6ff',
    videos: [
      {
        id: 1,
        title: 'Welcome to BMAPZ  Platform Overview',
        titlePt: 'Bem-vindo ao BMAPZ  Visão Geral da Plataforma',
        description: 'A complete walkthrough of the BMAPZ platform: sidebar navigation, key sections, and how everything connects.',
        descriptionPt: 'Um tour completo pela plataforma BMAPZ: navegação pelo menu, seções principais e como tudo se conecta.',
        duration: '8 min',
        level: 'Beginner',
        levelPt: 'Iniciante',
        thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=640&q=80',
        embedId: null,
        steps: [
          'Log in and explore the dashboard',
          'Navigate through the sidebar sections',
          'Set up your company profile in Settings',
          'Invite your first team member',
        ],
        stepsPt: [
          'Faça login e explore o painel principal',
          'Navegue pelas seções do menu lateral',
          'Configure seu perfil de empresa nas Configurações',
          'Convide seu primeiro membro da equipe',
        ],
      },
      {
        id: 2,
        title: 'Setting Up Your Company Profile & ICP',
        titlePt: 'Configurando Perfil da Empresa e ICP',
        description: 'How to fill in your company details, define your Ideal Customer Profile (ICP), and configure your strategic briefing so the AI can work effectively.',
        descriptionPt: 'Como preencher os dados da empresa, definir seu Perfil de Cliente Ideal (ICP) e configurar o briefing estratégico para a IA funcionar ao máximo.',
        duration: '10 min',
        level: 'Beginner',
        levelPt: 'Iniciante',
        thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=640&q=80',
        embedId: null,
        steps: [
          'Go to Settings → General',
          'Fill in company name, website, and industry',
          'Navigate to the ICP tab and define your ideal customer',
          'Complete the Briefing tab for AI context',
        ],
        stepsPt: [
          'Acesse Configurações → Geral',
          'Preencha nome, site e segmento da empresa',
          'Vê → aba ICP e defina seu cliente ideal',
          'Complete a aba Briefing para contexto da IA',
        ],
      },
    ],
  },
  {
    category: 'Sales & Lead Management',
    categoryPt: 'Vendas e Gestão de Leads',
    icon: '<',
    color: '#cb6ce6',
    videos: [
      {
        id: 3,
        title: 'How to Add & Import Leads',
        titlePt: 'Como Adicionar e Importar Leads',
        description: 'Add leads manually or import from CSV/Excel. Learn how to map columns from any CRM export to BMAPZ fields.',
        descriptionPt: 'Adicione leads manualmente ou importe via CSV/Excel. Aprenda a mapear colunas de qualquer CRM para os campos do BMAPZ.',
        duration: '7 min',
        level: 'Beginner',
        levelPt: 'Iniciante',
        thumbnail: 'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?w=640&q=80',
        embedId: null,
        steps: [
          'Go to Sales and click "Add Lead"',
          'Fill in company name, contact, and source',
          'Or: go to Integrations → Import CSV',
          'Review imported leads in the Sales Kanban',
        ],
        stepsPt: [
          'Acesse Vendas e clique em "Novo Lead"',
          'Preencha empresa, contato e origem',
          'Ou: vê em Integrações → Importar CSV',
          'Revise os leads importados no Kanban de Vendas',
        ],
      },
      {
        id: 4,
        title: 'Using the Sales Kanban & Funnel Stages',
        titlePt: 'Usando o Kanban de Vendas e Etapas do Funil',
        description: 'Navigate the Kanban view, move leads between stages, use filters, and understand ICP scoring.',
        descriptionPt: 'Navegue pelo Kanban, mova leads entre etapas, use filtros e entenda o score ICP.',
        duration: '9 min',
        level: 'Beginner',
        levelPt: 'Iniciante',
        thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=640&q=80',
        embedId: null,
        steps: [
          'Drag and drop leads between funnel stages',
          'Double-click a card to open lead details',
          'Use filters to view by ICP score, status, or source',
          'Disqualify leads with a reason for tracking',
        ],
        stepsPt: [
          'Arraste e solte leads entre as etapas do funil',
          'Clique duas vezes em um card para abrir o detalhe',
          'Use filtros por score ICP, status ou origem',
          'Desqualifique leads com uma razão para rastreamento',
        ],
      },
      {
        id: 5,
        title: 'Lead Lists: Dynamic & Manual',
        titlePt: 'Listas de Leads: Dinâmicas e Manuais',
        description: 'Create lead lists that automatically populate based on criteria like funnel stage, ICP score, or source. Schedule automatic updates.',
        descriptionPt: 'Crie listas de leads que se populam automaticamente com base em critérios como etapa do funil, score ICP ou origem.',
        duration: '6 min',
        level: 'Intermediate',
        levelPt: 'Intermediário',
        thumbnail: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=640&q=80',
        embedId: null,
        steps: [
          'In Sales, click "Manage Lists"',
          'Create a new list with dynamic criteria',
          'Set filters: funnel stage, ICP min score, status',
          'Lists auto-update every time criteria match new leads',
        ],
        stepsPt: [
          'Em Vendas, clique em "Gerenciar Listas"',
          'Crie uma nova lista com critérios dinâmicos',
          'Defina filtros: etapa do funil, score ICP mínimo, status',
          'As listas se atualizam automaticamente quando novos leads correspondem',
        ],
      },
    ],
  },
  {
    category: 'AI Agent & Chat',
    categoryPt: 'Agente IA e Chat',
    icon: '>',
    color: '#38b6ff',
    videos: [
      {
        id: 6,
        title: 'Your First AI Conversation',
        titlePt: 'Sua Primeira Conversa com a IA',
        description: 'Start a conversation with the BMAPZ AI agent. Use quick actions, upload files, and use voice input to dictate your prompts.',
        descriptionPt: 'Inicie uma conversa com o agente IA do BMAPZ. Use a••es rápidas, faça upload de arquivos e use entrada de voz.',
        duration: '8 min',
        level: 'Beginner',
        levelPt: 'Iniciante',
        thumbnail: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=640&q=80',
        embedId: null,
        steps: [
          'Click "AI Chat" in the sidebar',
          'Click a Quick Action button to start',
          'Or type your own request in the input box',
          'Use the mic button to record voice and auto-transcribe',
          'Attach files (PDF, images, CSV) for analysis',
        ],
        stepsPt: [
          'Clique em "Chat IA" no menu lateral',
          'Clique em um botão de A••o Rápida para começar',
          'Ou escreva sua pr•pria solicita••o na caixa de texto',
          'Use o botão de microfone para gravar e transcrever voz',
          'Anexe arquivos (PDF, imagens, CSV) para análise',
        ],
      },
      {
        id: 7,
        title: 'Generating Messages with AI',
        titlePt: 'Gerando Mensagens com IA',
        description: 'Ask the AI to write personalized outreach messages for WhatsApp, Email, and LinkedIn. Learn how to use the context field for better results.',
        descriptionPt: 'Peça para a IA escrever mensagens personalizadas para WhatsApp, Email e LinkedIn. Aprenda a usar o campo de contexto para melhores resultados.',
        duration: '7 min',
        level: 'Beginner',
        levelPt: 'Iniciante',
        thumbnail: 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=640&q=80',
        embedId: null,
        steps: [
          'Open a lead detail page or AI Chat',
          'Click "Generate Message" for a lead, or type in AI Chat',
          'Choose the channel (WhatsApp, Email, LinkedIn)',
          'Add context in the optional "Context" field',
          'Select tone and click Generate',
        ],
        stepsPt: [
          'Abra o detalhe de um lead ou o Chat IA',
          'Clique em "Gerar Mensagem" para um lead, ou escreva no Chat IA',
          'Escolha o canal (WhatsApp, Email, LinkedIn)',
          'Adicione contexto no campo opcional "Contexto"',
          'Selecione o tom e clique em Gerar',
        ],
      },
    ],
  },
  {
    category: 'Workflows & Automation',
    categoryPt: 'Fluxos e Automação',
    icon: '•',
    color: '#10b981',
    videos: [
      {
        id: 8,
        title: 'Building Your First Workflow',
        titlePt: 'Criando Seu Primeiro Fluxo de Trabalho',
        description: 'Step-by-step guide to building a multi-channel sales outreach workflow with email, WhatsApp, and LinkedIn steps.',
        descriptionPt: 'Guia passo a passo para criar um fluxo de prospecção multicanal com etapas de e-mail, WhatsApp e LinkedIn.',
        duration: '12 min',
        level: 'Intermediate',
        levelPt: 'Intermediário',
        thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=640&q=80',
        embedId: null,
        steps: [
          'Go to Workflows and click "New Workflow"',
          'Drag action nodes from the left panel',
          'Connect nodes with arrows',
          'Set delays between steps',
          'Add conditions for branching logic',
          'Activate the workflow',
        ],
        stepsPt: [
          'Acesse Fluxos e clique em "Novo Fluxo"',
          'Arraste nós de a••o do painel esquerdo',
          'Conecte os nós com setas',
          'Defina intervalos entre as etapas',
          'Adicione condições para lógica de ramificação',
          'Ative o fluxo',
        ],
      },
    ],
  },
  {
    category: 'Social Media & Content',
    categoryPt: 'Redes Sociais e Conteúdo',
    icon: '=',
    color: '#e1306c',
    videos: [
      {
        id: 9,
        title: 'Planning Social Media Content with AI',
        titlePt: 'Planejando Conteúdo de Redes Sociais com IA',
        description: 'Use the AI to generate a full content calendar for Instagram, LinkedIn, and other platforms based on your briefing.',
        descriptionPt: 'Use a IA para gerar um calendário de conteúdo completo para Instagram, LinkedIn e outras plataformas com base no seu briefing.',
        duration: '10 min',
        level: 'Beginner',
        levelPt: 'Iniciante',
        thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=640&q=80',
        embedId: null,
        steps: [
          'Go to Social Media',
          'Click "Generate Content" with AI',
          'Add optional context about tone and objective',
          'Review posts in the calendar view',
          'Edit, schedule, or publish directly',
        ],
        stepsPt: [
          'Acesse Redes Sociais',
          'Clique em "Gerar Conteúdo" com IA',
          'Adicione contexto opcional sobre tom e objetivo',
          'Revise os posts na visualização de calendário',
          'Edite, agende ou publique diretamente',
        ],
      },
    ],
  },
  {
    category: 'Brand Scan',
    categoryPt: 'Brand Scan',
    icon: '=',
    color: '#f59e0b',
    videos: [
      {
        id: 10,
        title: 'Running Your First Brand Scan',
        titlePt: 'Rodando Seu Primeiro Brand Scan',
        description: 'Learn how to generate an AI-powered Brand Scan report: digital presence analysis, buyer personas, SEO keywords, and go-to-market strategy.',
        descriptionPt: 'Aprenda a gerar um relatório de Brand Scan com IA: análise de presença digital, buyer personas, keywords de SEO e estratégia go-to-market.',
        duration: '9 min',
        level: 'Beginner',
        levelPt: 'Iniciante',
        thumbnail: 'https://images.unsplash.com/photo-1542744095-291d1f67b221?w=640&q=80',
        embedId: null,
        steps: [
          'Go to Brand Scan in the sidebar',
          'Fill in the setup form with company info',
          'Click "Generate Brand Scan"',
          'Wait ~30 seconds for the AI report',
          'Export as PDF or TXT',
          'Start a new scan to compare over time',
        ],
        stepsPt: [
          'Acesse Brand Scan no menu lateral',
          'Preencha o formul•rio com informações da empresa',
          'Clique em "Gerar Brand Scan"',
          'Aguarde ~30 segundos pelo relatório da IA',
          'Exporte em PDF ou TXT',
          'Inicie um novo scan para comparar ao longo do tempo',
        ],
      },
    ],
  },
];

const LEVEL_COLORS = {
  Beginner: 'bg-green-500/20 text-green-400 border-green-500/30',
  Intermediate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Advanced: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function VideoCard({ video, language, onClick }) {
  const title = language === 'pt' ? video.titlePt : video.title;
  const description = language === 'pt' ? video.descriptionPt : video.description;
  const level = language === 'pt' ? video.levelPt : video.level;
  const levelKey = video.level;

  return (
    <button
      onClick={() => onClick(video)}
      className="group text-left bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-[#38b6ff]/40 transition-all duration-200 hover:scale-[1.01]"
    >
      <div className="relative overflow-hidden h-40">
        <img src={video.thumbnail} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-14 h-14 rounded-full bg-[#38b6ff]/90 flex items-center justify-center">
            <Play className="w-6 h-6 text-white ml-1" />
          </div>
        </div>
        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 rounded-lg px-2 py-1">
          <Clock className="w-3 h-3 text-gray-300" />
          <span className="text-white text-xs">{video.duration}</span>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge className={`text-[10px] border ${LEVEL_COLORS[levelKey] || LEVEL_COLORS.Beginner}`}>{level}</Badge>
        </div>
        <h3 className="text-white font-semibold text-sm leading-snug mb-1">{title}</h3>
        <p className="text-gray-400 text-xs line-clamp-2 leading-relaxed">{description}</p>
      </div>
    </button>
  );
}

function VideoModal({ video, language, onClose }) {
  if (!video) return null;
  const title = language === 'pt' ? video.titlePt : video.title;
  const description = language === 'pt' ? video.descriptionPt : video.description;
  const steps = language === 'pt' ? video.stepsPt : video.steps;
  const level = language === 'pt' ? video.levelPt : video.level;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#111] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Video placeholder */}
        <div className="relative bg-black rounded-t-2xl overflow-hidden h-64">
          <img src={video.thumbnail} alt={title} className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-[#38b6ff]/20 border-2 border-[#38b6ff]/50 flex items-center justify-center mb-3">
              <Play className="w-8 h-8 text-[#38b6ff] ml-1" />
            </div>
            <p className="text-white/70 text-sm bg-black/50 px-3 py-1 rounded-full">
              {language === 'pt' ? 'Vídeo em breve' : 'Video coming soon'}
            </p>
          </div>
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"></button>
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-white font-bold text-lg">{title}</h2>
            <div className="flex items-center gap-1 text-gray-400 text-sm flex-shrink-0">
              <Clock className="w-4 h-4" /> {video.duration}
            </div>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed mb-5">{description}</p>

          {steps && steps.length > 0 && (
            <div>
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#38b6ff]" />
                {language === 'pt' ? 'Passos deste tutorial:' : 'Tutorial steps:'}
              </h3>
              <ol className="space-y-2">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#38b6ff]/20 text-[#38b6ff] text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5">{i + 1}</div>
                    <span className="text-gray-300 text-sm">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-2 text-gray-500 text-xs">
            <Star className="w-3 h-3" />
            {language === 'pt' ? 'Vídeos completos estarão disponíveis em breve.' : 'Full videos will be available soon.'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VideoTutorials() {
  const { language } = useLanguage();
  const [search, setSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const allCategories = TUTORIALS.map(t => ({ key: t.category, label: language === 'pt' ? t.categoryPt : t.category }));

  const filtered = TUTORIALS.map(cat => ({
    ...cat,
    videos: cat.videos.filter(v => {
      const matchCat = selectedCategory === 'all' || selectedCategory === cat.category;
      const title = language === 'pt' ? v.titlePt : v.title;
      const desc = language === 'pt' ? v.descriptionPt : v.description;
      const matchSearch = !search || title.toLowerCase().includes(search.toLowerCase()) || desc.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    }),
  })).filter(cat => cat.videos.length > 0);

  const totalVideos = TUTORIALS.reduce((acc, cat) => acc + cat.videos.length, 0);

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link to="/Help" className="text-gray-500 hover:text-white text-sm flex items-center gap-1 transition-colors">
            Help <ChevronRight className="w-3 h-3" />
          </Link>
          <span className="text-gray-400 text-sm">{language === 'pt' ? 'Tutoriais em Vídeo' : 'Video Tutorials'}</span>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
          {language === 'pt' ? 'Tutoriais em Vídeo' : 'Video Tutorials'}
        </h1>
        <p className="text-gray-400 mt-1">
          {language === 'pt'
            ? `${totalVideos} tutoriais para aprender do zero, sem conhecimento técnico necessário.`
            : `${totalVideos} tutorials to learn from scratch  no technical knowledge required.`}
        </p>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={language === 'pt' ? 'Buscar tutoriais...' : 'Search tutorials...'}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${selectedCategory === 'all' ? 'bg-[#38b6ff]/20 border-[#38b6ff]/40 text-[#38b6ff]' : 'border-white/10 text-gray-400 hover:border-white/20'}`}
          >
            {language === 'pt' ? 'Todos' : 'All'}
          </button>
          {allCategories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${selectedCategory === cat.key ? 'bg-[#38b6ff]/20 border-[#38b6ff]/40 text-[#38b6ff]' : 'border-white/10 text-gray-400 hover:border-white/20'}`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Getting started banner */}
      {selectedCategory === 'all' && !search && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-[#3572b9]/20 to-[#cb6ce6]/20 border border-[#38b6ff]/20 flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-xl bg-[#38b6ff]/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-6 h-6 text-[#38b6ff]" />
          </div>
          <div>
            <p className="text-white font-semibold">
              {language === 'pt' ? '= Novo por aqui? Comece aqui!' : '= New here? Start here!'}
            </p>
            <p className="text-gray-400 text-sm">
              {language === 'pt'
                ? 'Assista os tutoriais de "Primeiros Passos" primeiro para ter uma visão geral da plataforma.'
                : 'Watch the "Getting Started" tutorials first to get a full overview of the platform.'}
            </p>
          </div>
        </div>
      )}

      {/* Tutorial categories */}
      {filtered.map(cat => (
        <div key={cat.category} className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{cat.icon}</span>
            <h2 className="text-white font-bold text-xl">{language === 'pt' ? cat.categoryPt : cat.category}</h2>
            <Badge className="bg-white/10 text-gray-400 border-0">{cat.videos.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cat.videos.map(video => (
              <VideoCard key={video.id} video={video} language={language} onClick={setSelectedVideo} />
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Play className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{language === 'pt' ? 'Nenhum tutorial encontrado' : 'No tutorials found'}</p>
        </div>
      )}

      {/* Modal */}
      {selectedVideo && (
        <VideoModal video={selectedVideo} language={language} onClose={() => setSelectedVideo(null)} />
      )}
    </div>
  );
}