import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Book, ChevronRight, Users, GitBranch, MessageSquare, BarChart2, 
  Settings, Zap, Globe, Target, FileText, Bot, Image, Search,
  ArrowLeft, Hash, CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Lead, Workflow } from '@/api/entities';

const DOCS = [
  {
    id: 'getting-started',
    icon: Zap,
    color: '#38b6ff',
    title: 'Getting Started',
    titlePt: 'Primeiros Passos',
    sections: [
      {
        title: 'Platform Overview',
        titlePt: 'Visão Geral da Plataforma',
        content: `BMAPZ is an AI-powered sales and marketing automation platform designed to help businesses streamline their lead management, outreach, and content creation processes.

**Key Features:**
- AI-driven lead analysis and ICP scoring
- Multi-channel outreach workflows (Email, WhatsApp, LinkedIn)
- Social media content planning and scheduling
- SEO-optimized blog post generation
- Paid advertising strategy and copy generation
- Brand Scan deep analysis
- Real-time dashboards and analytics`,
        contentPt: `BMAPZ → uma plataforma de automação de vendas e marketing movida por IA, projetada para ajudar empresas a otimizar a gestão de leads, prospecção e criação de conteúdo.

**Principais Funcionalidades:**
- Análise de leads e pontuação de ICP com IA
- Fluxos de prospecção multicanal (E-mail, WhatsApp, LinkedIn)
- Planejamento e agendamento de conteúdo para redes sociais
- Geração de artigos de blog otimizados para SEO
- Geração de estratégia e copy para anúncios pagos
- Brand Scan  análise profunda de marca
- Dashboards e análises em tempo real`,
      },
      {
        title: 'Initial Setup',
        titlePt: 'Configuração Inicial',
        content: `Follow these steps to get started with BMAPZ:

1. **Company Profile**  Go to Settings → Company Profile. Fill in your company name, website, industry, services and value propositions. This information powers all AI features.

2. **Define your ICP**  Go to Settings → ICP. Set your ideal customer industries, company sizes, locations, job titles and pain points. This enables lead scoring.

3. **Strategic Briefing**  Go to Settings → Briefing. Fill in your objectives, marketing channels, budget, and tone of voice. The AI uses this for all content generation.

4. **Add Leads**  Go to Sales → Add New Lead. Add leads manually or import via CSV from the Integrations page.

5. **Create a Workflow**  Go to Workflows → New Workflow. Build an automated outreach sequence with the visual workflow builder.`,
        contentPt: `Siga estas etapas para começar com o BMAPZ:

1. **Perfil da Empresa**  Vê em Configurações → Perfil da Empresa. Preencha nome, site, setor, serviços e propostas de valor. Essas informações alimentam todas as funcionalidades de IA.

2. **Definir seu ICP**  Vê em Configurações → ICP. Configure o perfil de cliente ideal com setores, tamanhos de empresa, localização, cargos e desafios. Isso habilita a pontuação de leads.

3. **Briefing Estratégico**  Vê em Configurações → Briefing. Preencha seus objetivos, canais de marketing, orçamento e tom de voz. A IA usa isso em toda a geração de conteúdo.

4. **Adicionar Leads**  Vê em Vendas → Novo Lead. Adicione manualmente ou importe via CSV pela página de Integrações.

5. **Criar um Fluxo**  Vê em Fluxos → Novo Fluxo. Construa uma sequência de prospecção automatizada com o construtor visual.`,
      },
    ]
  },
  {
    id: 'sales',
    icon: Users,
    color: '#cb6ce6',
    title: 'Sales & Lead Management',
    titlePt: 'Vendas e Gestão de Leads',
    sections: [
      {
        title: 'Kanban View',
        titlePt: 'Visão Kanban',
        content: `The Kanban view displays leads organized by funnel stage in a drag-and-drop board.

- **Drag cards** between columns to move leads through stages
- **Double-click** a card to open the lead's full details page
- **Right-click menu** provides quick actions: View Details, Send Message, Disqualify
- **ICP Score** is shown on each card  green (70+), yellow (40-70), red (below 40)
- **Advanced Filters** allow filtering by ICP score range, estimated value, decision maker status, and source`,
        contentPt: `A visão Kanban exibe leads organizados por etapa do funil em um quadro de arrastar e soltar.

- **Arrastar cards** entre colunas move os leads pelas etapas
- **Duplo clique** em um card abre a página de detalhes completos do lead
- **Menu de contexto** oferece ações rápidas: Ver Detalhes, Enviar Mensagem, Desqualificar
- **Score ICP** → exibido em cada card  verde (70+), amarelo (40-70), vermelho (abaixo de 40)
- **Filtros Avançados** permitem filtrar por faixa de score ICP, valor estimado, decisor e origem`,
      },
      {
        title: 'Lead Lists',
        titlePt: 'Listas de Leads',
        content: `Lead Lists help you organize leads into groups for targeted campaigns.

**Static Lists:** Manually add or remove leads. Useful for handpicked prospect groups.

**Dynamic Lists:** Automatically include leads matching your criteria:
- Funnel stages (e.g., all leads in MQL or SQL)
- Minimum ICP score
- Source category (inbound, outbound, offline)
- Lead status (active, qualified, etc.)

Dynamic lists update automatically whenever new leads match the criteria.`,
        contentPt: `As Listas de Leads ajudam a organizar leads em grupos para campanhas direcionadas.

**Listas Estáticas:** Adicione ou remova leads manualmente. útil para grupos de prospecção selecionados.

**Listas Dinâmicas:** Incluem automaticamente leads que correspondem aos seus critérios:
- Etapas do funil (ex: todos em MQL ou SQL)
- Score mínimo de ICP
- Categoria de origem (inbound, outbound, offline)
- Status do lead (ativo, qualificado, etc.)

As listas dinâmicas se atualizam automaticamente quando novos leads correspondem aos critérios.`,
      },
    ]
  },
  {
    id: 'workflows',
    icon: GitBranch,
    color: '#38b6ff',
    title: 'Workflows',
    titlePt: 'Fluxos de Automação',
    sections: [
      {
        title: 'Workflow Builder',
        titlePt: 'Construtor de Fluxos',
        content: `The visual workflow builder lets you create automated outreach sequences.

**Node Types:**
- **Send Message**  Email, WhatsApp, or LinkedIn message
- **Wait**  Pause for a set number of days/hours before the next step
- **Condition**  Branch logic based on lead behavior (opened, replied, clicked, meeting booked)
- **End Success / End Failed**  Terminal nodes marking workflow completion

**Building a Workflow:**
1. Drag nodes from the left panel onto the canvas, or click them to add sequentially
2. Connect nodes by drawing lines between them
3. Click a node to configure it in the Properties panel
4. Use the AI Assistant to generate or optimize your workflow
5. Click Save or Create Workflow when done

**Keyboard Shortcuts:**
- Ctrl+Z: Undo
- Ctrl+Y or Ctrl+Shift+Z: Redo
- Scroll wheel: Zoom in/out
- Right-click drag: Pan the canvas
- Shift+Click: Select multiple nodes`,
        contentPt: `O construtor visual de fluxos permite criar sequências de prospecção automatizadas.

**Tipos de Nós:**
- **Enviar Mensagem**  E-mail, WhatsApp ou LinkedIn
- **Aguardar**  Pausa por dias/horas antes da próxima etapa
- **Condição**  Lógica de ramificação baseada no comportamento do lead (abriu, respondeu, clicou, reunião agendada)
- **Fim com Sucesso / Fim com Falha**  Nós terminais indicando a conclusão do fluxo

**Construindo um Fluxo:**
1. Arraste nós do painel esquerdo para o canvas, ou clique para adicionar sequencialmente
2. Conecte os nós desenhando linhas entre eles
3. Clique em um nó para configurá-lo no painel de Propriedades
4. Use o Assistente de IA para gerar ou otimizar o fluxo
5. Clique em Salvar ou Criar Fluxo quando terminar

**Atalhos de Teclado:**
- Ctrl+Z: Desfazer
- Ctrl+Y ou Ctrl+Shift+Z: Refazer
- Roda do mouse: Zoom in/out
- Arrastar com botão direito: Mover canvas
- Shift+Clique: Selecionar múltiplos nós`,
      },
    ]
  },
  {
    id: 'ai-chat',
    icon: Bot,
    color: '#cb6ce6',
    title: 'AI Chat',
    titlePt: 'Chat com IA',
    sections: [
      {
        title: 'AI Sales Agent',
        titlePt: 'Agente de Vendas IA',
        content: `The BMAPZ AI Sales Agent is your intelligent assistant for sales and marketing tasks.

**What the AI can do:**
- Research leads and analyze their digital presence
- Generate personalized outreach messages (email, WhatsApp, LinkedIn)
- Create sales strategies and playbooks
- Build complete prospect lists
- Generate blog posts and social media content
- Analyze workflow performance and suggest optimizations
- Answer questions about your pipeline and metrics

**Voice Input:** Click the microphone button to record your message. The platform transcribes your speech in real time and places it in the text input.

**File Uploads:** Attach files, images, or documents to provide additional context for the AI.`,
        contentPt: `O Agente de Vendas IA do BMAPZ → seu assistente inteligente para tarefas de vendas e marketing.

**O que a IA pode fazer:**
- Pesquisar leads e analisar sua presença digital
- Gerar mensagens de prospecção personalizadas (e-mail, WhatsApp, LinkedIn)
- Criar estratégias de vendas e playbooks
- Construir listas de prospectos completas
- Gerar artigos de blog e conteúdo para redes sociais
- Analisar desempenho de fluxos e sugerir otimizações
- Responder perguntas sobre seu pipeline e métricas

**Entrada de Voz:** Clique no botão de microfone para gravar sua mensagem. A plataforma transcreve sua fala em tempo real e coloca no campo de texto.

**Upload de Arquivos:** Anexe arquivos, imagens ou documentos para fornecer contexto adicional → IA.`,
      },
    ]
  },
  {
    id: 'social-media',
    icon: Globe,
    color: '#00e7ff',
    title: 'Social Media',
    titlePt: 'Redes Sociais',
    sections: [
      {
        title: 'Content Planning',
        titlePt: 'Planejamento de Conteúdo',
        content: `The Social Media section helps you plan, create, and schedule posts across multiple platforms.

**Tabs:**
- **Planning**  Visual calendar with week, month, and year views. Click a day to see day view. Double-click a scheduled post to edit it.
- **Content**  Grid view of all posts with status filters. Create and edit posts here.
- **Analytics**  Performance metrics for published posts.
- **Posts**  View previously published posts and their performance. Includes boosting suggestions.

**AI Content Generation:**
1. In the Content tab, click "New Post"
2. Select platforms, content type, and optionally add context
3. Click "Generate with AI"  the AI creates platform-specific content, hashtags, and scheduling recommendations based on your company briefing and ICP

**Scheduling:** Set a date and time for posts. Scheduled posts appear in the Planning calendar.`,
        contentPt: `A seção de Redes Sociais ajuda a planejar, criar e agendar posts em múltiplas plataformas.

**Abas:**
- **Planejamento**  Calendário visual com visualizações de semana, mês e ano. Clique em um dia para ver a visão diária. Dê duplo clique em um post agendado para editá-lo.
- **Conteúdo**  Grade de todos os posts com filtros de status. Crie e edite posts aqui.
- **Análise**  Métricas de desempenho dos posts publicados.
- **Posts**  Veja posts já publicados e seu desempenho. Inclui sugestões de impulsionamento.

**Geração de Conteúdo com IA:**
1. Na aba Conteúdo, clique em "Novo Post"
2. Selecione plataformas, tipo de conteúdo e opcionalmente adicione contexto
3. Clique em "Gerar com IA"  a IA cria conteúdo específico por plataforma, hashtags e recomendações de agendamento com base no briefing e ICP da empresa

**Agendamento:** Defina uma data e hora para os posts. Posts agendados aparecem no calendário de Planejamento.`,
      },
    ]
  },
  {
    id: 'blog',
    icon: FileText,
    color: '#10b981',
    title: 'Blog',
    titlePt: 'Blog',
    sections: [
      {
        title: 'Creating Blog Posts',
        titlePt: 'Criando Artigos de Blog',
        content: `The Blog section helps you create SEO-optimized articles and publish them to your website.

**SEO Score:** Each post displays a color-coded SEO score:
- = Green (80%+): Excellent  ready to publish
- = Yellow (50-79%): Average  needs improvement
- = Red (below 50%): Low  missing key SEO elements

**AI Generation:** Add a title and at least one keyword, then click "AI Generate" to automatically create a complete SEO-optimized article.

**Publishing Options:**
- WordPress: Connect via Settings → API Keys. Publishes directly to your WordPress site.
- Custom API: Configure a webhook to publish to any CMS.
- HTML Export: Download the post as an HTML file.`,
        contentPt: `A seção de Blog ajuda a criar artigos otimizados para SEO e publicá-los no seu site.

**Score SEO:** Cada artigo exibe um score SEO com código de cor:
- = Verde (80%+): Excelente  pronto para publicar
- = Amarelo (50-79%): Médio  precisa de melhoria
- = Vermelho (abaixo de 50%): Baixo  faltam elementos essenciais de SEO

**Geração com IA:** Adicione um título e pelo menos uma palavra-chave, depois clique em "Gerar com IA" para criar automaticamente um artigo completo otimizado para SEO.

**Opções de Publicação:**
- WordPress: Conecte em Configurações → Chaves de API. Publica diretamente no seu site WordPress.
- API Personalizada: Configure um webhook para publicar em qualquer CMS.
- Exportar HTML: Baixe o artigo como arquivo HTML.`,
      },
    ]
  },
  {
    id: 'brand-scan',
    icon: Search,
    color: '#f59e0b',
    title: 'Brand Scan',
    titlePt: 'Brand Scan',
    sections: [
      {
        title: 'What is Brand Scan?',
        titlePt: 'O que é o Brand Scan?',
        content: `Brand Scan is BMAPZ's deep AI analysis of your brand and digital presence.

**What it analyzes:**
- Social media metrics (Instagram, LinkedIn, YouTube)
- SEO keyword opportunities
- Color psychology and visual identity
- Buyer personas
- Tone of voice
- Market segments
- Brand attributes and pillars
- Ideal Customer Profile (ICP)
- Go-to-market strategy
- Competitor analysis

**How to generate:**
1. Go to Brand Scan → New Scan
2. Fill in your company name, website, social media profiles, industry, target audience and competitors
3. Click "Generate Brand Scan"  the AI researches current market conditions and generates a complete report

**Important:** We recommend updating your Brand Scan every 30 days to keep strategies aligned with market changes.`,
        contentPt: `O Brand Scan → a análise profunda de IA da BMAPZ sobre sua marca e presença digital.

**O que analisa:**
- Métricas de redes sociais (Instagram, LinkedIn, YouTube)
- Oportunidades de palavras-chave SEO
- Psicologia das cores e identidade visual
- Buyer personas
- Tom de voz
- Segmentos de mercado
- Atributos e pilares da marca
- Perfil de Cliente Ideal (ICP)
- Estratégia go-to-market
- Análise de concorrentes

**Como gerar:**
1. Vê em Brand Scan → Novo Scan
2. Preencha nome da empresa, site, redes sociais, setor, público-alvo e concorrentes
3. Clique em "Gerar Brand Scan"  a IA pesquisa as condições atuais do mercado e gera um relatório completo

**Importante:** Recomendamos atualizar o Brand Scan a cada 30 dias para manter as estratégias alinhadas com as mudanças do mercado.`,
      },
    ]
  },
  {
    id: 'integrations',
    icon: Zap,
    color: '#3572b9',
    title: 'Integrations',
    titlePt: 'Integrações',
    sections: [
      {
        title: 'Connecting Integrations',
        titlePt: 'Conectando Integrações',
        content: `BMAPZ supports 50+ integrations across ad platforms, social media, email marketing, CRM, and more.

**To connect an integration:**
1. Go to Integrations
2. Search or browse by category
3. Click an integration card
4. Follow the setup instructions  each integration shows exactly where to get your API key or token

**Integration Status:**
-  Green "Connected": Verified active connection
- = "Configured": API key entered but not yet verified
- Empty: Not yet set up

**Key Integrations:**
- **Meta Ads / Google Ads / TikTok Ads**: Ad performance data
- **WhatsApp Business**: Send messages via API
- **Gmail**: Email outreach
- **WordPress**: Direct blog publishing
- **Zapier / Make / n8n**: Connect to 1000s of other apps via webhooks`,
        contentPt: `O BMAPZ suporta mais de 50 integrações em plataformas de anúncios, redes sociais, e-mail marketing, CRM e muito mais.

**Para conectar uma integração:**
1. Vê em Integrações
2. Pesquise ou navegue por categoria
3. Clique em um card de integração
4. Siga as instruções de configuração  cada integração mostra exatamente onde obter a chave de API ou token

**Status da Integração:**
-  Verde "Conectado": Conexão ativa verificada
- = "Configurado": Chave de API inserida, mas ainda não verificada
- Vazio: Ainda não configurado

**Integrações Principais:**
- **Meta Ads / Google Ads / TikTok Ads**: Dados de performance de anúncios
- **WhatsApp Business**: Enviar mensagens via API
- **Gmail**: Prospecção por e-mail
- **WordPress**: Publicação direta de blog
- **Zapier / Make / n8n**: Conecte a milhares de outros aplicativos via webhooks`,
      },
    ]
  },
  {
    id: 'settings',
    icon: Settings,
    color: '#9ca3af',
    title: 'Settings',
    titlePt: 'Configurações',
    sections: [
      {
        title: 'Settings Overview',
        titlePt: 'Visão Geral das Configurações',
        content: `Settings is the foundation of your BMAPZ experience. The AI uses your settings data for all personalized outputs.

**Tabs:**
- **General**  Language (English / PT-BR) and theme (dark / light mode)
- **Company Profile**  Basic company info, services, value propositions
- **Briefing**  Marketing strategy, objectives, channels, budget, tone of voice, content preferences
- **ICP**  Ideal Customer Profile criteria for lead scoring
- **API Keys**  Connect third-party services (WhatsApp, Gmail, WordPress, Meta, Google Ads, etc.)
- **Subscription**  View and manage your plan

**Pro Tip:** The more complete your Briefing and ICP settings are, the more accurate and personalized the AI outputs will be.`,
        contentPt: `As Configurações são a base da sua experiência com o BMAPZ. A IA usa seus dados de configuração para todos os outputs personalizados.

**Abas:**
- **Geral**  Idioma (Inglês / PT-BR) e tema (modo escuro / claro)
- **Perfil da Empresa**  Informações básicas, serviços, propostas de valor
- **Briefing**  Estratégia de marketing, objetivos, canais, orçamento, tom de voz, preferências de conteúdo
- **ICP**  Critérios do Perfil de Cliente Ideal para pontuação de leads
- **Chaves de API**  Conectar serviços de terceiros (WhatsApp, Gmail, WordPress, Meta, Google Ads, etc.)
- **Assinatura**  Visualizar e gerenciar seu plano

**Dica:** Quanto mais completos forem seus dados de Briefing e ICP, mais precisos e personalizados serão os outputs da IA.`,
      },
    ]
  },
];

export default function Documentation() {
  const { language } = useLanguage();
  const isPt = language === 'pt-BR';
  const [activeDoc, setActiveDoc] = useState(null);
  const [search, setSearch] = useState('');

  const filteredDocs = DOCS.filter(doc => {
    if (!search) return true;
    const q = search.toLowerCase();
    const title = isPt ? doc.titlePt : doc.title;
    const sectionMatch = doc.sections.some(s => {
      const st = isPt ? s.titlePt : s.title;
      const sc = isPt ? s.contentPt : s.content;
      return st.toLowerCase().includes(q) || sc.toLowerCase().includes(q);
    });
    return title.toLowerCase().includes(q) || sectionMatch;
  });

  const activeData = activeDoc ? DOCS.find(d => d.id === activeDoc) : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/Help">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white gap-2">
              <ArrowLeft size={16} /> {isPt ? 'Voltar' : 'Back'}
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
              {isPt ? 'Documentação' : 'Documentation'}
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {isPt ? 'Guia completo de funcionalidades da plataforma BMAPZ' : 'Complete BMAPZ platform features guide'}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-8 max-w-lg">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isPt ? 'Buscar na documentação...' : 'Search documentation...'}
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
          />
        </div>

        {!activeData ? (
          /* Index */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDocs.map(doc => {
              const Icon = doc.icon;
              return (
                <button
                  key={doc.id}
                  onClick={() => setActiveDoc(doc.id)}
                  className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/8 text-left transition-all group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${doc.color}20` }}>
                      <Icon size={20} style={{ color: doc.color }} />
                    </div>
                    <h2 className="text-white font-semibold">{isPt ? doc.titlePt : doc.title}</h2>
                    <ChevronRight size={16} className="text-gray-600 group-hover:text-white ml-auto transition-colors" />
                  </div>
                  <div className="space-y-1">
                    {doc.sections.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                        <Hash size={10} />
                        {isPt ? s.titlePt : s.title}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Article View */
          <div>
            <button
              onClick={() => setActiveDoc(null)}
              className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
            >
              <ArrowLeft size={14} /> {isPt ? 'Voltar → documentação' : 'Back to docs'}
            </button>

            {(() => {
              const Icon = activeData.icon;
              return (
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${activeData.color}20` }}>
                    <Icon size={24} style={{ color: activeData.color }} />
                  </div>
                  <h1 className="text-2xl font-bold text-white">{isPt ? activeData.titlePt : activeData.title}</h1>
                </div>
              );
            })()}

            <div className="space-y-8">
              {activeData.sections.map((section, i) => (
                <div key={i} className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10" style={{ borderLeft: `4px solid ${activeData.color}` }}>
                    <h2 className="text-white font-bold text-lg">{isPt ? section.titlePt : section.title}</h2>
                  </div>
                  <div className="p-6">
                    <div className="text-gray-300 text-sm leading-relaxed space-y-3">
                      {(isPt ? section.contentPt : section.content).split('\n').map((line, li) => {
                        if (line.startsWith('**') && line.endsWith('**')) {
                          return <p key={li} className="text-white font-semibold mt-4 mb-1">{line.replace(/\*\*/g, '')}</p>;
                        }
                        if (line.startsWith('- ')) {
                          const parts = line.slice(2).split('**');
                          return (
                            <div key={li} className="flex items-start gap-2">
                              <CheckCircle size={14} className="text-[#38b6ff] mt-0.5 flex-shrink-0" />
                              <span>
                                {parts.map((p, pi) => pi % 2 === 1 ? <strong key={pi} className="text-white">{p}</strong> : p)}
                              </span>
                            </div>
                          );
                        }
                        if (line.match(/^\d+\./)) {
                          const parts = line.replace(/^\d+\./, '').trim().split('**');
                          const num = line.match(/^\d+/)[0];
                          return (
                            <div key={li} className="flex items-start gap-3">
                              <span className="w-5 h-5 rounded-full bg-[#38b6ff]/20 text-[#38b6ff] text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">{num}</span>
                              <span>
                                {parts.map((p, pi) => pi % 2 === 1 ? <strong key={pi} className="text-white">{p}</strong> : p)}
                              </span>
                            </div>
                          );
                        }
                        if (!line.trim()) return null;
                        const parts = line.split('**');
                        return (
                          <p key={li}>
                            {parts.map((p, pi) => pi % 2 === 1 ? <strong key={pi} className="text-white">{p}</strong> : p)}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}