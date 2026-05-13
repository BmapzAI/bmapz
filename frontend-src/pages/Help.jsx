import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from 'react-router-dom';
import {
  Search, HelpCircle, Book, MessageCircle, Mail,
  Play, FileText, Zap, Users, GitBranch, Bot,
  Send, Loader2, Crown, ExternalLink, X, Shield, ScrollText
} from 'lucide-react';

import ReactMarkdown from 'react-markdown';

const faqCategories = [
  {
    title: 'Getting Started / Primeiros Passos',
    icon: Zap,
    faqs: [
      { question: 'How do I set up my first sales workflow? / Como configuro meu primeiro fluxo de vendas?', answer: 'Navigate to the Workflows section from the sidebar, click "New Workflow", and follow the step-by-step builder. You can add email, WhatsApp, LinkedIn steps, and set delays.\n\nAcesse Fluxos no menu lateral, clique em "Novo Fluxo" e siga o construtor. Você pode adicionar etapas de e-mail, WhatsApp, LinkedIn e definir intervalos.' },
      { question: 'How do I import leads? / Como importo leads?', answer: 'Go to Sales → Add New Lead → choose manual entry or CSV/XLS import from the Integrations page.\n\nVá em Vendas → Novo Lead → escolha entrada manual ou importe CSV/XLS pela página de Integrações.' },
      { question: 'What is ICP? / O que é ICP?', answer: 'The Ideal Customer Profile defines your perfect customer characteristics: industries, company sizes, locations, job titles. This helps the AI qualify and prioritize leads.\n\nO Perfil de Cliente Ideal define as características do seu cliente perfeito: setores, tamanho da empresa, localizações, cargos. Isso ajuda a IA a qualificar leads.' }
    ]
  },
  {
    title: 'AI Sales Agent / Agente de Vendas IA',
    icon: MessageCircle,
    faqs: [
      { question: 'How does the AI analyze leads? / Como a IA analisa os leads?', answer: 'The BMAPZ AI analyzes websites, social media profiles, and ad libraries to identify opportunities and create personalized outreach messages.\n\nA IA do BMAPZ analisa sites, perfis em redes sociais e bibliotecas de anúncios para identificar oportunidades e criar mensagens personalizadas.' },
      { question: 'Can I customize the message tone? / Posso personalizar o tom das mensagens?', answer: 'Yes! Choose from: Professional, Friendly, Consultative, Direct, Strategic, or Performance. The AI adapts accordingly.\n\nSim! Escolha entre: Profissional, Amigável, Consultivo, Direto, Estratégico ou Performance. A IA se adapta.' },
      { question: 'How do I use voice input? / Como usar entrada de voz?', answer: 'Click the microphone button in AI Chat. The platform requests microphone access, then transcribes your speech in real time into the text input.\n\nClique no botão de microfone no Chat IA. A plataforma solicita acesso ao microfone e transcreve sua fala em tempo real no campo de texto.' }
    ]
  },
  {
    title: 'Lead Management / Gestão de Leads',
    icon: Users,
    faqs: [
      { question: 'What is Qualification Review? / O que é a Revisão de Qualificação?', answer: 'Shows leads as cards with AI analysis. Double-click a Kanban card to open the full lead details page.\n\nExibe leads como cards com análise de IA. Clique duas vezes em um card Kanban para abrir a página de detalhes completos do lead.' },
      { question: 'What are Dynamic Lead Lists? / O que são Listas Dinâmicas de Leads?', answer: 'Dynamic lists automatically include leads matching your criteria (funnel stage, ICP score, source, status) and update in real time.\n\nListas dinâmicas incluem automaticamente leads que correspondem aos seus critérios (etapa do funil, score ICP, origem, status) e se atualizam em tempo real.' }
    ]
  },
  {
    title: 'Workflows',
    icon: GitBranch,
    faqs: [
      { question: 'What workflow steps are available? / Quais etapas estão disponíveis?', answer: 'Available steps: Send Email, Send WhatsApp, Send LinkedIn, Wait Period, Condition branches. Use Shift+Click to select multiple nodes, scroll to zoom, right-click drag to pan.\n\nEtapas disponíveis: Enviar E-mail, WhatsApp, LinkedIn, Aguardar, Condição. Use Shift+Clique para selecionar múltiplos nós, scroll para zoom, arrastar com botão direito para mover o canvas.' },
      { question: 'Can workflows send messages automatically? / Os fluxos enviam mensagens automaticamente?', answer: 'Yes! Enable "Auto-send" on any message step. Messages will be sent at the scheduled time without manual approval.\n\nSim! Ative "Auto-envio" em qualquer etapa de mensagem. As mensagens serão enviadas no horário agendado sem aprovação manual.' }
    ]
  }
];

const resources = [
  { title: 'Video Tutorials / Tutoriais', icon: Play, description: 'Watch step-by-step guides / Guias em vídeo', link: '/VideoTutorials' },
  { title: 'Documentation / Documentação', icon: Book, description: 'Detailed feature guides / Guia completo de funcionalidades', link: '/Documentation' },
  { title: 'API Reference', icon: FileText, description: 'For developers', link: '#' },
];

// Build FAQ context string for the AI
const faqContext = faqCategories.flatMap(c =>
  c.faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`)
).join('\n\n');

function AIChatPanel({ query, onClose, t }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(query || '');
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      // Start help conversation (inline AI)
      const conv = { id: crypto.randomUUID(), messages: [] };
      setConversation(conv);
      setMessages(conv.messages || []);
      if (query) sendMessage(query, conv);
    };
    init();
  }, []);

  useEffect(() => {
    if (conversation?.id) {
      const unsub = () => {};
      return unsub;
    }
  }, [conversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text, conv) => {
    const activeConv = conv || conversation;
    if (!activeConv || !text.trim()) return;
    setLoading(true);
    setInput('');
    // Send help message via AI chat
    const res = await api.post('/api/ai/chat', {
      messages: [...(activeConv.messages || []), { role: 'user', content: text }],
      system: 'You are the Bmapz AI support assistant. Help users with questions about using the Bmapz platform.',
    });
    setMessages(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: res.content }]);
    setLoading(false);
  };

  const handleSend = () => sendMessage(input);

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[520px] bg-[#111] border border-white/10 rounded-2xl shadow-2xl flex flex-col z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3572b9] to-[#38b6ff] flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{t ? t('aiAssistant') : 'AI Assistant'}</p>
            <p className="text-green-400 text-xs">Online</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="text-center text-gray-500 text-sm mt-8">
            <Bot className="w-10 h-10 mx-auto mb-3 text-gray-600" />
            <p>{t ? (t('askMeAnything') || 'Ask me anything about BMAPZ!') : 'Ask me anything about BMAPZ!'}</p>
            <p className="text-xs mt-1">Pergunte-me qualquer coisa / Ask me anything!</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-[#3572b9] text-white'
                : 'bg-white/5 border border-white/10 text-gray-200'
            }`}>
              {msg.role === 'user' ? (
                <p>{msg.content}</p>
              ) : (
                <ReactMarkdown className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  {msg.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-3 py-2">
              <Loader2 className="w-4 h-4 text-[#38b6ff] animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-white/10 flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={t ? (t('searchHelp') || 'Type your question...') : 'Type your question...'}
          className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-sm h-9"
        />
        <Button size="sm" onClick={handleSend} disabled={loading || !input.trim()}
          className="bg-[#38b6ff] hover:bg-[#38b6ff]/80 text-white border-0 h-9 px-3">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default function Help() {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    // user loaded from useAuth()
  }, []);

  const isEnterprise = user?.role === 'admin' || user?.subscription_tier === 'enterprise';

  const filteredCategories = faqCategories.map(category => ({
    ...category,
    faqs: category.faqs.filter(faq =>
      !searchQuery ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.faqs.length > 0);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setPendingQuery(searchQuery);
      setAiOpen(true);
    }
  };

  const handleAskAI = () => {
    setPendingQuery(searchQuery);
    setAiOpen(true);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white tracking-tight"
          style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
          {t('helpCenter')}
        </h1>
        <p className="text-gray-400 mt-2">{t('helpDesc')}</p>
      </div>

      {/* Search + AI */}
      <div className="max-w-xl mx-auto space-y-2">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder={t('searchHelp')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-32 h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-base"
          />
          <Button
            type="button"
            onClick={handleAskAI}
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] text-white border-0 h-8 text-xs gap-1"
          >
            <Bot className="w-3.5 h-3.5" /> {t('askAI')}
          </Button>
        </form>
        <p className="text-gray-500 text-xs text-center">Press Enter to search FAQs or click "{t('askAI')}" for a personalized answer</p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {resources.map((resource, index) => {
          const Icon = resource.icon;
          const isInternal = resource.link.startsWith('/');
          const Wrapper = isInternal ? Link : 'a';
          const linkProps = isInternal ? { to: resource.link } : { href: resource.link };
          return (
            <Wrapper key={index} {...linkProps}
              className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-[#38b6ff]/30 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3572b9]/20 to-[#cb6ce6]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Icon size={24} className="text-[#38b6ff]" />
              </div>
              <h3 className="font-semibold text-white mb-1">{resource.title}</h3>
              <p className="text-gray-400 text-sm">{resource.description}</p>
            </Wrapper>
          );
        })}
      </div>

      {/* FAQs */}
      <div className="space-y-6">
        {filteredCategories.map((category, index) => {
          const Icon = category.icon;
          return (
            <div key={index} className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#38b6ff]/20 flex items-center justify-center">
                  <Icon size={20} className="text-[#38b6ff]" />
                </div>
                <h2 className="text-lg font-semibold text-white">{category.title}</h2>
              </div>
              <Accordion type="single" collapsible className="px-4">
                {category.faqs.map((faq, faqIndex) => (
                  <AccordionItem key={faqIndex} value={`${index}-${faqIndex}`} className="border-white/10">
                    <AccordionTrigger className="text-white hover:text-[#38b6ff] text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-400">
                      {faq.answer}
                      <button
                        onClick={() => { setPendingQuery(faq.question); setAiOpen(true); }}
                        className="mt-2 flex items-center gap-1 text-[#38b6ff] text-xs hover:underline"
                      >
                        <Bot className="w-3 h-3" /> Ask AI for more details
                      </button>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          );
        })}

        {filteredCategories.length === 0 && searchQuery && (
          <div className="text-center py-10 bg-white/5 border border-white/10 rounded-2xl">
            <HelpCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-3">No FAQ found for "{searchQuery}"</p>
            <Button onClick={handleAskAI} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] text-white border-0 gap-2">
              <Bot className="w-4 h-4" /> Ask AI Assistant
            </Button>
          </div>
        )}
      </div>

      {/* Legal Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#38b6ff]/20 flex items-center justify-center flex-shrink-0">
              <Shield size={20} className="text-[#38b6ff]" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{t('privacyPolicy')}</p>
              <p className="text-gray-400 text-xs">{t('privacyPolicyDesc')}</p>
            </div>
          </div>
          <Link to="/PrivacyPolicy">
            <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-2 text-sm">
              <ExternalLink size={14} />
              {t('viewPolicy')}
            </Button>
          </Link>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#cb6ce6]/20 flex items-center justify-center flex-shrink-0">
              <ScrollText size={20} className="text-[#cb6ce6]" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Terms of Service / Termos de Uso</p>
              <p className="text-gray-400 text-xs">Legal agreement for platform use / Acordo legal para uso da plataforma</p>
            </div>
          </div>
          <Link to="/TermsOfService">
            <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-2 text-sm">
              <ExternalLink size={14} />
              View Terms
            </Button>
          </Link>
        </div>
      </div>

      {/* Contact Support */}
      <div className="rounded-2xl bg-gradient-to-r from-[#3572b9]/20 to-[#cb6ce6]/20 border border-white/10 p-6 sm:p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3572b9] to-[#cb6ce6] flex items-center justify-center mx-auto mb-4">
          <HelpCircle size={32} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{t('stillNeedHelp')}</h2>
        <p className="text-gray-400 mb-6">{t('supportReady')}</p>
        <div className="flex justify-center gap-3 flex-wrap">
          {/* Live Chat — Enterprise only */}
          {isEnterprise ? (
            <a
              href="https://wa.me/5511921353202"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-[#25d366] hover:bg-[#25d366]/80 text-white border-0 gap-2">
                <MessageCircle size={18} />
                {t('liveChat')}
                <ExternalLink size={14} />
              </Button>
            </a>
          ) : (
            <div className="relative">
              <Button disabled className="bg-[#25d366]/40 text-white/60 border-0 gap-2 cursor-not-allowed">
                <MessageCircle size={18} />
                {t('liveChat')}
                <Crown size={14} className="text-yellow-400" />
              </Button>
              <Badge className="absolute -top-2 -right-2 bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] px-1.5">
                Enterprise
              </Badge>
            </div>
          )}

          {/* Email Support */}
          <a href="mailto:contato@bmapz.com?subject=Support Request — BMAPZ">
            <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-2">
              <Mail size={18} />
              {t('emailSupport')}
            </Button>
          </a>

          {/* AI Assistant */}
          <Button
            onClick={() => { setPendingQuery(''); setAiOpen(true); }}
            variant="outline"
            className="border-[#38b6ff]/30 text-[#38b6ff] hover:bg-[#38b6ff]/10 gap-2"
          >
            <Bot size={18} />
            {t('aiAssistant')}
          </Button>
        </div>

        {!isEnterprise && (
          <p className="text-gray-500 text-xs mt-4">
            <Crown className="inline w-3 h-3 text-yellow-400 mr-1" />
            {t('enterpriseOnly')}. <a href="mailto:contato@bmapz.com?subject=Upgrade to Enterprise" className="text-[#38b6ff] hover:underline">contato@bmapz.com</a>.
          </p>
        )}
      </div>

      {/* AI Chat Panel */}
      {aiOpen && (
        <AIChatPanel
          query={pendingQuery}
          onClose={() => { setAiOpen(false); setPendingQuery(''); }}
          t={t}
        />
      )}
    </div>
  );
}                                                                                                                                                                                                                                                                                                                                                          