import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Bot, Sparkles, Plus, Trash2, Save, Loader2, Send, MessageSquare,
  CheckCircle2, XCircle, AlertTriangle, Users, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { SDR, Company } from '@/api/entities';
import CreateTaskButton from '@/components/tasks/CreateTaskButton';
import SalesStatusSwitcher from '@/components/sales/SalesStatusSwitcher';

const STATUS_STYLE = {
  active: { label: 'Active', pt: 'Ativa', color: 'text-[#38b6ff] bg-[#38b6ff]/10 border-[#38b6ff]/20' },
  qualified: { label: 'Qualified', pt: 'Qualificado', color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  not_qualified: { label: 'Not qualified', pt: 'Não qualificado', color: 'text-gray-400 bg-white/5 border-white/10' },
  handed_over: { label: 'Handed to sales', pt: 'Enviado a vendas', color: 'text-[#cb6ce6] bg-[#cb6ce6]/10 border-[#cb6ce6]/20' },
  support: { label: 'Support', pt: 'Suporte', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  closed: { label: 'Closed', pt: 'Fechada', color: 'text-gray-500 bg-white/5 border-white/10' },
};

const CHANNELS = ['whatsapp', 'email', 'instagram', 'web'];

const FUNNEL_STAGES = ['prospect', 'awareness', 'consideration', 'mql', 'sql', 'opportunity', 'customer', 'retention', 'advocacy'];

// Built-in outcomes the SDR can be allowed to choose from (mirror of the backend).
const PREDEFINED_OUTCOMES = [
  { key: 'qualified',     en: 'Mark lead as qualified',    pt: 'Marcar lead como qualificado', enD: 'The prospect clearly fits and is interested — mark qualified and advance the funnel.', ptD: 'O prospecto se encaixa e tem interesse — marca como qualificado e avança no funil.' },
  { key: 'handover',      en: 'Hand over to sales',        pt: 'Encaminhar para vendas',       enD: 'Hot/ready lead — move to SQL and notify the human sales team.', ptD: 'Lead quente/pronto — move para SQL e avisa o time de vendas.' },
  { key: 'offer_product', en: 'Offer a product/service',   pt: 'Oferecer produto/serviço',     enD: 'Recommend a specific product or service that fits the prospect.', ptD: 'Recomendar um produto ou serviço específico que se encaixe.' },
  { key: 'not_qualified', en: 'Mark as not qualified',     pt: 'Marcar como não qualificado',  enD: 'The prospect is clearly out of scope / not a fit.', ptD: 'O prospecto está claramente fora do escopo / sem fit.' },
  { key: 'support',       en: 'Route to support',          pt: 'Encaminhar para suporte',      enD: 'A support or help request, not a sales conversation.', ptD: 'Um pedido de suporte/ajuda, não de vendas.' },
];
const DEFAULT_ALLOWED_OUTCOMES = PREDEFINED_OUTCOMES.map(o => o.key);
const outcomeSlug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

export default function SDRPage() {
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('chats');

  const { data: company } = useQuery({ queryKey: ['companies'], queryFn: () => Company.list().then(c => c[0]) });
  const { data: agent, isLoading: agentLoading } = useQuery({ queryKey: ['sdrAgent'], queryFn: () => SDR.getAgent() });

  const sdrName = agent?.name || company?.personal_agent_name || 'SDR';

  // Enable/disable the agent straight from the header.
  const toggleAgent = useMutation({
    mutationFn: (enabled) => SDR.saveAgent({ enabled }),
    onSuccess: (_d, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['sdrAgent'] });
      toast.success(enabled
        ? (isPt ? 'Agente SDR ligado' : 'SDR agent turned on')
        : (isPt ? 'Agente SDR desligado' : 'SDR agent turned off'));
    },
    onError: (e) => toast.error((isPt ? 'Falha ao alterar o agente: ' : 'Could not change the agent: ') + e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            <Bot size={26} className="text-[#38b6ff]" /> {sdrName} — SDR
          </h1>
          <p className="text-gray-400 mt-1">
            {isPt
              ? 'Seu representante de desenvolvimento de vendas com IA — atende, qualifica e encaminha leads automaticamente.'
              : 'Your AI Sales Development Rep — greets, qualifies and routes leads automatically.'}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <CreateTaskButton section="sdr" />
          {/* Shortcut so a rep can change their own availability without
              leaving the SDR section. Hidden for non-sales-team users. */}
          <SalesStatusSwitcher />

          {/* Labelled ON/OFF switch for the agent itself. It used to be an
              unlabelled pill that only displayed state — people could not tell
              what it referred to, and it could not be clicked to change it. */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs whitespace-nowrap">{isPt ? 'Agente SDR' : 'SDR agent'}</span>
            <button
              type="button"
              onClick={() => toggleAgent.mutate(!agent?.enabled)}
              disabled={toggleAgent.isPending || agentLoading}
              title={isPt
                ? (agent?.enabled ? 'Desligar o agente SDR' : 'Ligar o agente SDR')
                : (agent?.enabled ? 'Turn the SDR agent off' : 'Turn the SDR agent on')}
              className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full text-sm border transition-colors disabled:opacity-60 ${
                agent?.enabled
                  ? 'text-green-400 bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
                  : 'text-gray-400 bg-white/5 border-white/10 hover:bg-white/10'}`}
            >
              <span className={`relative w-8 h-4 rounded-full transition-colors ${agent?.enabled ? 'bg-green-500/70' : 'bg-white/20'}`}>
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${agent?.enabled ? 'left-4' : 'left-0.5'}`} />
              </span>
              {toggleAgent.isPending
                ? (isPt ? 'Salvando…' : 'Saving…')
                : agent?.enabled ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="chats" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff] gap-2">
            <MessageSquare size={15} /> {isPt ? 'Conversas' : 'Chats'}
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-[#cb6ce6]/20 data-[state=active]:text-[#cb6ce6] gap-2">
            <Zap size={15} /> {isPt ? 'Configurações' : 'Settings'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chats"><ChatsTab isPt={isPt} /></TabsContent>
        <TabsContent value="settings">
          {agentLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#38b6ff]" /></div>
          ) : (
            <SettingsTab isPt={isPt} agent={agent} company={company} onSaved={() => queryClient.invalidateQueries({ queryKey: ['sdrAgent'] })} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── CHATS TAB ────────────────────────────────────────────────────────────────
function ChatsTab({ isPt }) {
  const [selected, setSelected] = useState(null);
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['sdrConversations'],
    queryFn: () => SDR.conversations({ limit: 100 }),
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#38b6ff]" /></div>;

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-white/10 mt-4">
        <Users size={40} className="text-gray-600 mb-3" />
        <p className="text-white font-medium">{isPt ? 'Nenhuma conversa ainda' : 'No conversations yet'}</p>
        <p className="text-gray-500 text-sm max-w-md">
          {isPt
            ? 'Quando o SDR atender um lead (por inbound, fluxo ou teste), a conversa e todo o trabalho dele aparecem aqui.'
            : 'When the SDR handles a lead (via inbound, a workflow, or a test), the conversation and everything it did shows up here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 mt-4">
      {/* List */}
      <div className="space-y-2 lg:max-h-[70vh] lg:overflow-y-auto">
        {conversations.map(c => {
          const st = STATUS_STYLE[c.status] || STATUS_STYLE.active;
          return (
            <button key={c.id} onClick={() => setSelected(c)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${selected?.id === c.id ? 'bg-[#38b6ff]/10 border-[#38b6ff]/40' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-white text-sm font-medium truncate">{c.contact_name || c.contact_handle || (isPt ? 'Prospect' : 'Prospect')}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${st.color}`}>{isPt ? st.pt : st.label}</span>
              </div>
              <p className="text-gray-500 text-xs truncate mt-0.5">
                {(c.messages?.[c.messages.length - 1]?.content) || '—'}
              </p>
              <p className="text-gray-600 text-[10px] mt-0.5">{c.channel} · {new Date(c.last_message_at).toLocaleDateString()}</p>
            </button>
          );
        })}
      </div>

      {/* Detail */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 min-h-[300px]">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm py-16">
            {isPt ? 'Selecione uma conversa' : 'Select a conversation'}
          </div>
        ) : <ConversationDetail c={selected} isPt={isPt} />}
      </div>
    </div>
  );
}

function ConversationDetail({ c, isPt }) {
  const st = STATUS_STYLE[c.status] || STATUS_STYLE.active;
  const qual = c.qualification || {};
  const notes = c.notes || [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-white font-semibold">{c.contact_name || c.contact_handle || 'Prospect'}</p>
          <p className="text-gray-500 text-xs">{c.channel} · {c.contact_handle || ''}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full border ${st.color}`}>{isPt ? st.pt : st.label}{c.outcome && c.outcome !== 'none' ? ` · ${c.outcome}` : ''}</span>
      </div>

      {/* Transcript */}
      <div className="space-y-2 max-h-[45vh] overflow-y-auto">
        {(c.messages || []).map((m, i) => (
          <div key={i} className={`flex ${m.role === 'client' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${m.role === 'client' ? 'bg-white/8 text-white rounded-tl-sm' : 'bg-[#3572b9] text-white rounded-tr-sm'}`}>
              {m.content}
              <div className="text-[9px] opacity-60 mt-0.5">{m.role === 'client' ? (isPt ? 'Cliente' : 'Client') : 'SDR'}{m.at ? ` · ${new Date(m.at).toLocaleTimeString()}` : ''}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Internal-only intelligence */}
      {(Object.keys(qual).length > 0 || notes.length > 0) && (
        <div className="p-3 rounded-xl bg-[#cb6ce6]/5 border border-[#cb6ce6]/20 space-y-2">
          <p className="text-[#cb6ce6] text-xs font-semibold flex items-center gap-1.5">
            <AlertTriangle size={12} /> {isPt ? 'Visível só internamente' : 'Internal-only'}
          </p>
          {Object.keys(qual).length > 0 && (
            <div>
              <p className="text-gray-400 text-xs mb-1">{isPt ? 'Respostas de qualificação:' : 'Qualification answers:'}</p>
              <div className="space-y-0.5">
                {Object.entries(qual).map(([k, v]) => (
                  <p key={k} className="text-xs text-gray-300"><span className="text-gray-500">{k}:</span> {String(v)}</p>
                ))}
              </div>
            </div>
          )}
          {notes.length > 0 && (
            <div>
              <p className="text-gray-400 text-xs mb-1">{isPt ? 'Raciocínio do SDR / condições seguidas:' : 'SDR reasoning / conditions followed:'}</p>
              <div className="space-y-0.5">
                {notes.slice(-6).map((n, i) => (
                  <p key={i} className="text-xs text-gray-400">• {n.note}{n.outcome && n.outcome !== 'none' ? ` (${n.outcome})` : ''}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS TAB ─────────────────────────────────────────────────────────────
const EMPTY_PRODUCT = { name: '', description: '', price: '', how_to_pitch: '', conditions: '' };

function SettingsTab({ isPt, agent, company, onSaved }) {
  const [form, setForm] = useState(() => normalize(agent, company));
  const [showBrainConfirm, setShowBrainConfirm] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [tester, setTester] = useState({ messages: [], input: '', busy: false });

  useEffect(() => { setForm(normalize(agent, company)); }, [agent, company]);

  const F = (k) => (v) => setForm(p => ({ ...p, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: (data) => SDR.saveAgent(data),
    onSuccess: () => { toast.success(isPt ? 'SDR salvo!' : 'SDR saved!'); onSaved?.(); },
    onError: (e) => toast.error((isPt ? 'Falha ao salvar: ' : 'Save failed: ') + e.message),
  });

  const runAutofill = async () => {
    setShowBrainConfirm(false);
    setAutofilling(true);
    try {
      const res = await SDR.autofill();
      setForm(normalize(res.agent, company));
      onSaved?.();
      toast.success(isPt
        ? `SDR configurado pelo Company Brain (${res.tokens_used} tokens).`
        : `SDR configured by the Company Brain (${res.tokens_used} tokens).`);
    } catch (e) {
      toast.error((isPt ? 'Falha na configuração automática: ' : 'Autofill failed: ') + e.message);
    } finally { setAutofilling(false); }
  };

  const sendTest = async () => {
    if (!tester.input.trim()) return;
    const clientMsg = { role: 'client', content: tester.input };
    const history = [...tester.messages, clientMsg];
    setTester(t => ({ ...t, messages: history, input: '', busy: true }));
    try {
      const decision = await SDR.test({ messages: history });
      setTester(t => ({
        ...t,
        messages: [...history, { role: 'sdr', content: decision.reply || '(no reply)', _meta: decision }],
        busy: false,
      }));
    } catch (e) {
      toast.error((isPt ? 'Teste falhou: ' : 'Test failed: ') + e.message);
      setTester(t => ({ ...t, busy: false }));
    }
  };

  const updateProduct = (i, k, v) => setForm(p => ({ ...p, products: p.products.map((pr, j) => j === i ? { ...pr, [k]: v } : pr) }));
  const updateQuestion = (i, v) => setForm(p => ({ ...p, qualifying_questions: p.qualifying_questions.map((q, j) => j === i ? { ...q, question: v } : q) }));
  const updateOutcome = (i, k, v) => setForm(p => ({ ...p, custom_outcomes: p.custom_outcomes.map((o, j) => j === i ? { ...o, [k]: v } : o) }));
  const updateOutcomeEffect = (i, k, v) => setForm(p => ({ ...p, custom_outcomes: p.custom_outcomes.map((o, j) => j === i ? { ...o, effects: { ...o.effects, [k]: v } } : o) }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 mt-4">
      {/* Config form */}
      <div className="space-y-5">
        {/* Autofill + enable */}
        <div className="rounded-2xl bg-gradient-to-r from-[#cb6ce6]/10 to-[#38b6ff]/10 border border-[#cb6ce6]/20 p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-white font-semibold text-sm flex items-center gap-2"><Sparkles size={15} className="text-[#cb6ce6]" /> {isPt ? 'Configurar com o Company Brain' : 'Configure with the Company Brain'}</p>
            <p className="text-gray-400 text-xs mt-0.5 max-w-md">
              {isPt ? 'A IA preenche tudo abaixo com alta precisão, seguindo as melhores práticas e o contexto da sua empresa.' : 'AI fills everything below with high precision, following best practices and your company context.'}
            </p>
          </div>
          <Button onClick={() => setShowBrainConfirm(true)} disabled={autofilling}
            className="bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2">
            {autofilling ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {isPt ? 'Preencher com IA' : 'Fill with AI'}
          </Button>
        </div>

        <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
          <input type="checkbox" checked={form.enabled} onChange={e => F('enabled')(e.target.checked)} className="w-4 h-4 accent-[#38b6ff]" />
          <div>
            <span className="text-white text-sm font-medium">{isPt ? 'SDR ativado' : 'SDR enabled'}</span>
            <p className="text-gray-500 text-xs">{isPt ? 'Quando ligado, o SDR atende leads que chegam pelos canais selecionados.' : 'When on, the SDR answers leads arriving on the selected channels.'}</p>
          </div>
        </label>

        <Section title={isPt ? 'Identidade' : 'Identity'}>
          <Field label={isPt ? 'Nome do SDR' : 'SDR name'}><Input value={form.name} onChange={e => F('name')(e.target.value)} className="in" placeholder={company?.personal_agent_name || 'e.g. Alex'} /></Field>
          <Field label={isPt ? 'Saudação inicial' : 'Opening greeting'}><Textarea value={form.greeting} onChange={e => F('greeting')(e.target.value)} className="in min-h-[60px]" /></Field>
          <Field label={isPt ? 'Objetivo' : 'Goal'}><Input value={form.goal} onChange={e => F('goal')(e.target.value)} className="in" /></Field>
          <Field label="Persona"><Textarea value={form.persona} onChange={e => F('persona')(e.target.value)} className="in min-h-[60px]" /></Field>
          <Field label={isPt ? 'Regras / o que nunca fazer' : 'Guardrails / what to never do'}><Textarea value={form.guardrails} onChange={e => F('guardrails')(e.target.value)} className="in min-h-[60px]" /></Field>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={form.show_prices} onChange={e => F('show_prices')(e.target.checked)} className="w-4 h-4 accent-[#38b6ff]" />
            {isPt ? 'Pode mostrar preços' : 'May show prices'}
          </label>
        </Section>

        <Section title={isPt ? 'Produtos & serviços que pode oferecer' : 'Products & services it can offer'}>
          {form.products.map((p, i) => (
            <div key={i} className="p-3 rounded-xl bg-black/20 border border-white/10 space-y-2 relative">
              <button onClick={() => setForm(f => ({ ...f, products: f.products.filter((_, j) => j !== i) }))} className="absolute top-2 right-2 text-red-400/70 hover:text-red-400"><Trash2 size={13} /></button>
              <div className="grid grid-cols-2 gap-2">
                <Input value={p.name} onChange={e => updateProduct(i, 'name', e.target.value)} placeholder={isPt ? 'Nome' : 'Name'} className="in text-xs" />
                <Input value={p.price} onChange={e => updateProduct(i, 'price', e.target.value)} placeholder={isPt ? 'Preço (opcional)' : 'Price (optional)'} className="in text-xs" />
              </div>
              <Input value={p.description} onChange={e => updateProduct(i, 'description', e.target.value)} placeholder={isPt ? 'Descrição' : 'Description'} className="in text-xs" />
              <Input value={p.how_to_pitch} onChange={e => updateProduct(i, 'how_to_pitch', e.target.value)} placeholder={isPt ? 'Como apresentar' : 'How to pitch it'} className="in text-xs" />
              <Input value={p.conditions} onChange={e => updateProduct(i, 'conditions', e.target.value)} placeholder={isPt ? 'Oferecer quando... (ex.: veio do canal X, interessado em Y)' : 'Offer when... (e.g. came from channel X, interested in Y)'} className="in text-xs" />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, products: [...f.products, { ...EMPTY_PRODUCT }] }))} className="border-white/10 text-white gap-1"><Plus size={13} /> {isPt ? 'Produto' : 'Product'}</Button>
        </Section>

        <Section title={isPt ? 'Perguntas de qualificação' : 'Qualifying questions'}>
          {form.qualifying_questions.map((q, i) => (
            <div key={i} className="flex gap-2">
              <Input value={q.question || ''} onChange={e => updateQuestion(i, e.target.value)} placeholder={isPt ? 'ex.: Qual seu orçamento?' : 'e.g. What is your budget?'} className="in text-sm" />
              <button onClick={() => setForm(f => ({ ...f, qualifying_questions: f.qualifying_questions.filter((_, j) => j !== i) }))} className="text-red-400/70 hover:text-red-400 px-1"><Trash2 size={14} /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, qualifying_questions: [...f.qualifying_questions, { question: '' }] }))} className="border-white/10 text-white gap-1"><Plus size={13} /> {isPt ? 'Pergunta' : 'Question'}</Button>
        </Section>

        <Section title={isPt ? 'Fluxo da conversa' : 'Conversation flow'}>
          <p className="text-gray-500 text-xs mb-1">{isPt ? 'Um passo por linha, na ordem.' : 'One step per line, in order.'}</p>
          <Textarea value={(form.conversation_flow || []).map(s => (typeof s === 'string' ? s : s.step)).join('\n')}
            onChange={e => F('conversation_flow')(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
            className="in min-h-[90px]" placeholder={"greeting\nask reason for contact\nask qualifying questions\nhand over to sales"} />
        </Section>

        <Section title={isPt ? 'Resultados aceitáveis (o que o SDR pode decidir)' : 'Acceptable outcomes (what the SDR may decide)'}>
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-[#38b6ff]/10 border border-[#38b6ff]/20">
            <AlertTriangle size={14} className="text-[#38b6ff] flex-shrink-0 mt-0.5" />
            <p className="text-gray-300 text-xs">
              {isPt
                ? 'O SDR só pode escolher entre os resultados ativados aqui. Ele nunca inventa resultados próprios — cada resultado precisa estar definido para que o agente possa sugeri-lo ou agir sobre ele.'
                : 'The SDR can ONLY choose from the outcomes enabled here. It never invents its own — each outcome must be defined for the agent to be able to suggest or act on it.'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-400 text-xs">{isPt ? 'Resultados prontos' : 'Built-in outcomes'}</Label>
            {PREDEFINED_OUTCOMES.map(o => {
              const on = (form.allowed_outcomes || []).includes(o.key);
              return (
                <label key={o.key} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/20 border border-white/10 cursor-pointer hover:border-white/20">
                  <input type="checkbox" checked={on} onChange={e => {
                    const set = new Set(form.allowed_outcomes || []);
                    if (e.target.checked) set.add(o.key); else set.delete(o.key);
                    F('allowed_outcomes')([...set]);
                  }} className="w-4 h-4 accent-[#38b6ff] mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-white text-sm">{isPt ? o.pt : o.en}</span>
                    <p className="text-gray-500 text-xs">{isPt ? o.ptD : o.enD}</p>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="space-y-2 pt-1">
            <div>
              <Label className="text-gray-400 text-xs">{isPt ? 'Resultados personalizados' : 'Custom outcomes'}</Label>
              <p className="text-gray-600 text-[11px]">{isPt ? 'Ex.: "Redirecionar para a página de preços" ou "Marcar qualificado + avançar etapa + encaminhar".' : 'e.g. "Redirect to the pricing page" or "Mark qualified + advance stage + hand over".'}</p>
            </div>
            {(form.custom_outcomes || []).map((o, i) => (
              <div key={i} className="p-3 rounded-xl bg-black/20 border border-white/10 space-y-2 relative">
                <button onClick={() => setForm(f => ({ ...f, custom_outcomes: f.custom_outcomes.filter((_, j) => j !== i) }))} className="absolute top-2 right-2 text-red-400/70 hover:text-red-400"><Trash2 size={13} /></button>
                <Input value={o.label} onChange={e => updateOutcome(i, 'label', e.target.value)} placeholder={isPt ? 'Nome do resultado (ex.: Redirecionar para preços)' : 'Outcome name (e.g. Redirect to pricing)'} className="in text-sm pr-7" />
                <Textarea value={o.description} onChange={e => updateOutcome(i, 'description', e.target.value)} placeholder={isPt ? 'Quando o SDR deve escolher este resultado?' : 'When should the SDR choose this outcome?'} className="in text-xs min-h-[46px]" />
                <p className="text-gray-500 text-[10px]">{isPt ? 'O que acontece quando o SDR escolhe isto:' : 'What happens when the SDR picks this:'}</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={!!o.effects?.mark_qualified} onChange={e => updateOutcomeEffect(i, 'mark_qualified', e.target.checked)} className="w-4 h-4 accent-[#38b6ff]" />
                    {isPt ? 'Marcar qualificado' : 'Mark qualified'}
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={!!o.effects?.handover} onChange={e => updateOutcomeEffect(i, 'handover', e.target.checked)} className="w-4 h-4 accent-[#38b6ff]" />
                    {isPt ? 'Encaminhar p/ vendas' : 'Hand to sales'}
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-gray-500 text-[10px]">{isPt ? 'Mover para etapa' : 'Move to stage'}</Label>
                    <select value={o.effects?.set_stage || ''} onChange={e => updateOutcomeEffect(i, 'set_stage', e.target.value)}
                      className="in w-full text-xs rounded-md h-8 px-2 mt-0.5 border">
                      <option value="">{isPt ? '— não mover —' : "— don't move —"}</option>
                      <option value="next">{isPt ? 'Próxima etapa' : 'Next stage'}</option>
                      {FUNNEL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-gray-500 text-[10px]">{isPt ? 'Link para compartilhar' : 'Link to share'}</Label>
                    <Input value={o.effects?.redirect_url || ''} onChange={e => updateOutcomeEffect(i, 'redirect_url', e.target.value)} placeholder="https://…" className="in text-xs mt-0.5" />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, custom_outcomes: [...(f.custom_outcomes || []), { label: '', description: '', effects: { mark_qualified: false, set_stage: '', handover: false, redirect_url: '' } }] }))} className="border-white/10 text-white gap-1"><Plus size={13} /> {isPt ? 'Resultado personalizado' : 'Custom outcome'}</Button>
          </div>
        </Section>

        <Section title={isPt ? 'Hand-over para vendas' : 'Hand-over to sales'}>
          <Field label={isPt ? 'Quando encaminhar' : 'When to hand over'}><Input value={form.handoff_conditions} onChange={e => F('handoff_conditions')(e.target.value)} className="in" placeholder={isPt ? 'ex.: lead qualificado e pronto para comprar' : 'e.g. qualified lead ready to buy'} /></Field>
          <div>
            <Label className="text-gray-400 text-xs">{isPt ? 'Avisar por' : 'Notify via'}</Label>
            <div className="flex gap-3 mt-1.5 flex-wrap">
              {['notification', 'email', 'sms', 'whatsapp'].map(ch => (
                <label key={ch} className="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={!!form.handoff_channels?.[ch]} onChange={e => F('handoff_channels')({ ...form.handoff_channels, [ch]: e.target.checked })} className="w-4 h-4 accent-[#38b6ff]" />
                  {ch === 'notification' ? (isPt ? 'Notificação' : 'Notification') : ch.toUpperCase()}
                </label>
              ))}
            </div>
          </div>
          <Field label={isPt ? 'Destinatários (e-mails / números, separados por vírgula)' : 'Recipients (emails / numbers, comma-separated)'}><Input value={form.handoff_recipients} onChange={e => F('handoff_recipients')(e.target.value)} className="in" /></Field>
        </Section>

        <Section title={isPt ? 'Canais onde o SDR atua' : 'Channels the SDR works on'}>
          <div className="flex gap-3 flex-wrap">
            {CHANNELS.map(ch => (
              <label key={ch} className="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" checked={form.channels?.includes(ch)} onChange={e => {
                  const set = new Set(form.channels || []);
                  e.target.checked ? set.add(ch) : set.delete(ch);
                  F('channels')([...set]);
                }} className="w-4 h-4 accent-[#38b6ff]" />
                {ch}
              </label>
            ))}
          </div>
        </Section>

        <div className="sticky bottom-0 py-3 bg-[#0a0a0a]/80 backdrop-blur">
          <Button onClick={() => saveMutation.mutate(cleanForm(form))} disabled={saveMutation.isPending}
            className="w-full bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
            {saveMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {isPt ? 'Salvar SDR' : 'Save SDR'}
          </Button>
        </div>
      </div>

      {/* Tester */}
      <div className="space-y-3">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <p className="text-white font-semibold text-sm mb-1 flex items-center gap-2"><MessageSquare size={15} className="text-[#38b6ff]" /> {isPt ? 'Testar o SDR' : 'Test the SDR'}</p>
          <p className="text-gray-500 text-xs mb-3">{isPt ? 'Converse como se fosse um cliente. Salve antes para testar a config atual.' : 'Chat as if you were a client. Save first to test the current config.'}</p>
          <div className="space-y-2 max-h-[45vh] overflow-y-auto mb-3">
            {tester.messages.length === 0 && <p className="text-gray-600 text-xs text-center py-6">{isPt ? 'Envie uma mensagem para começar.' : 'Send a message to start.'}</p>}
            {tester.messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'client' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${m.role === 'client' ? 'bg-[#3572b9] text-white' : 'bg-white/8 text-white'}`}>
                  {m.content}
                  {m._meta && m._meta.outcome && m._meta.outcome !== 'none' && (
                    <div className="text-[10px] mt-1 text-[#cb6ce6]">→ {m._meta.outcome}{m._meta.recommended_product ? `: ${m._meta.recommended_product}` : ''}</div>
                  )}
                </div>
              </div>
            ))}
            {tester.busy && <div className="flex justify-start"><div className="px-3 py-2 rounded-2xl bg-white/8"><Loader2 size={14} className="animate-spin text-[#38b6ff]" /></div></div>}
          </div>
          <div className="flex gap-2">
            <Input value={tester.input} onChange={e => setTester(t => ({ ...t, input: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && sendTest()} placeholder={isPt ? 'Mensagem do cliente...' : 'Client message...'} className="in text-sm" />
            <Button size="sm" onClick={sendTest} disabled={tester.busy || !tester.input.trim()} className="bg-[#3572b9]"><Send size={14} /></Button>
          </div>
          {tester.messages.length > 0 && (
            <button onClick={() => setTester({ messages: [], input: '', busy: false })} className="text-gray-500 text-xs mt-2 hover:text-gray-300">{isPt ? 'Limpar' : 'Clear'}</button>
          )}
        </div>
      </div>

      {/* Brain confirm popup (token cost warning) */}
      <Dialog open={showBrainConfirm} onOpenChange={setShowBrainConfirm}>
        <DialogContent className="max-w-md bg-[#111] border-white/10 text-white">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles size={18} className="text-[#cb6ce6]" /> {isPt ? 'Preencher com o Company Brain' : 'Fill with the Company Brain'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-gray-300 text-sm">
                {isPt
                  ? 'Isto usa o Company Brain (todo o contexto da empresa) em uma geração de alta precisão. É um recurso de maior consumo de tokens/créditos de IA. Deseja continuar?'
                  : 'This runs the Company Brain (your full company context) in one high-precision generation. It is a higher AI-token/credit-consumption feature. Continue?'}
              </p>
            </div>
            <p className="text-gray-500 text-xs">{isPt ? 'Suas configurações atuais serão substituídas pelo resultado.' : 'Your current settings will be replaced by the result.'}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBrainConfirm(false)} className="border-white/10 text-white">{isPt ? 'Cancelar' : 'Cancel'}</Button>
              <Button onClick={runAutofill} className="bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2"><Sparkles size={15} /> {isPt ? 'Continuar' : 'Continue'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`.in{background:rgba(0,0,0,0.3);border-color:rgba(255,255,255,0.1);color:#fff}`}</style>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
      <p className="text-white text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <Label className="text-gray-400 text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function normalize(agent, company) {
  const a = agent || {};
  return {
    enabled: !!a.enabled,
    name: a.name || company?.personal_agent_name || '',
    greeting: a.greeting || '',
    goal: a.goal || '',
    persona: a.persona || '',
    guardrails: a.guardrails || '',
    show_prices: !!a.show_prices,
    products: Array.isArray(a.products) && a.products.length ? a.products.map(p => ({ ...EMPTY_PRODUCT, ...p })) : [],
    qualifying_questions: Array.isArray(a.qualifying_questions)
      ? a.qualifying_questions.map(q => (typeof q === 'string' ? { question: q } : q))
      : [],
    conversation_flow: Array.isArray(a.conversation_flow) ? a.conversation_flow : [],
    handoff_conditions: a.handoff_conditions || '',
    handoff_channels: a.handoff_channels || { notification: true },
    handoff_recipients: a.handoff_recipients || '',
    channels: Array.isArray(a.channels) ? a.channels : ['whatsapp', 'email', 'instagram'],
    allowed_outcomes: Array.isArray(a.allowed_outcomes) ? a.allowed_outcomes : [...DEFAULT_ALLOWED_OUTCOMES],
    custom_outcomes: Array.isArray(a.custom_outcomes)
      ? a.custom_outcomes.map(o => ({
        label: o.label || '',
        description: o.description || '',
        effects: {
          mark_qualified: !!o.effects?.mark_qualified,
          set_stage: o.effects?.set_stage || '',
          handover: !!o.effects?.handover,
          redirect_url: o.effects?.redirect_url || '',
        },
      }))
      : [],
  };
}
function cleanForm(f) {
  return {
    ...f,
    products: f.products.filter(p => p.name?.trim()),
    qualifying_questions: f.qualifying_questions.filter(q => q.question?.trim()),
    allowed_outcomes: Array.isArray(f.allowed_outcomes) ? f.allowed_outcomes : [],
    custom_outcomes: (f.custom_outcomes || [])
      .filter(o => o.label?.trim())
      .map(o => ({
        key: outcomeSlug(o.label),
        label: o.label.trim(),
        description: (o.description || '').trim(),
        effects: {
          mark_qualified: !!o.effects?.mark_qualified,
          set_stage: o.effects?.set_stage || null,
          handover: !!o.effects?.handover,
          redirect_url: (o.effects?.redirect_url || '').trim() || null,
        },
      })),
  };
}
