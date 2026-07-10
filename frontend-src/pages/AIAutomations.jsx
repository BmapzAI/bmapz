import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Clock, Plus, Play, Pause, Trash2, Edit3, Zap, AlertTriangle, CheckCircle2, Loader2, Bot,
} from 'lucide-react';
import { toast } from 'sonner';
import { AIAutomation } from '@/api/entities';

const CATEGORY_OPTIONS = [
  { value: 'strategies', en: 'Strategy / Analysis', pt: 'Estratégia / Análise' },
  { value: 'message_templates', en: 'Message Templates', pt: 'Modelos de Mensagem' },
  { value: 'email_templates', en: 'Email Templates', pt: 'Modelos de E-mail' },
  { value: 'social_media', en: 'Social Media Posts', pt: 'Posts de Redes Sociais' },
  { value: 'ad_copy', en: 'Ad Copy', pt: 'Copy de Anúncios' },
  { value: 'blogposts', en: 'Blog Posts', pt: 'Posts de Blog' },
];

const EMPTY_FORM = {
  name: '', description: '', prompt: '', output_category: 'strategies',
  schedule_type: 'daily', interval_minutes: 60, run_minute: 0, run_hour: 9,
  run_day_of_week: 1, run_day_of_month: 1, enabled: true,
};

const EXAMPLE_PROMPTS = (isPt) => [
  {
    label: isPt ? '📊 Relatório semanal de vendas' : '📊 Weekly sales report',
    prompt: isPt
      ? 'Analise o desempenho de vendas e marketing da empresa desta semana com base nos dados do CRM, mensagens e campanhas. Liste destaques, problemas e 3 ações recomendadas para a próxima semana.'
      : 'Analyze this company\'s sales and marketing performance for the week based on CRM data, messages and campaigns. List highlights, problems and 3 recommended actions for next week.',
  },
  {
    label: isPt ? '✍️ Ideias de posts diárias' : '✍️ Daily post ideas',
    prompt: isPt
      ? 'Gere 3 ideias de posts para redes sociais alinhadas ao ICP e ao tom de voz da empresa, com hook, corpo e CTA para cada uma.'
      : 'Generate 3 social media post ideas aligned with the company ICP and tone of voice, with hook, body and CTA for each.',
  },
  {
    label: isPt ? '📧 Sequência de follow-up' : '📧 Follow-up sequence',
    prompt: isPt
      ? 'Escreva um e-mail de follow-up para leads que estão no estágio MQL há mais de 7 dias, usando o contexto e diferenciais da empresa.'
      : 'Write a follow-up email for leads sitting in the MQL stage for more than 7 days, using the company context and differentiators.',
  },
];

function scheduleLabel(a, isPt) {
  const hh = String(a.run_hour ?? 9).padStart(2, '0');
  const mm = String(a.run_minute ?? 0).padStart(2, '0');
  const days = isPt
    ? ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  switch (a.schedule_type) {
    case 'every_minutes': return isPt ? `A cada ${a.interval_minutes} min` : `Every ${a.interval_minutes} min`;
    case 'hourly': return isPt ? `Toda hora aos ${mm} min` : `Hourly at :${mm}`;
    case 'daily': return isPt ? `Diariamente às ${hh}:${mm}` : `Daily at ${hh}:${mm}`;
    case 'weekly': return isPt ? `${days[a.run_day_of_week ?? 1]} às ${hh}:${mm}` : `${days[a.run_day_of_week ?? 1]}s at ${hh}:${mm}`;
    case 'monthly': return isPt ? `Dia ${a.run_day_of_month} às ${hh}:${mm}` : `Day ${a.run_day_of_month} at ${hh}:${mm}`;
    default: return a.schedule_type;
  }
}

export default function AIAutomations() {
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [runningId, setRunningId] = useState(null);

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['aiAutomations'],
    queryFn: () => AIAutomation.list(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['aiAutomations'] });

  const saveMutation = useMutation({
    mutationFn: (data) => editingId ? AIAutomation.update(editingId, data) : AIAutomation.create(data),
    onSuccess: () => {
      invalidate();
      setShowEditor(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      toast.success(isPt ? 'Automação salva!' : 'Automation saved!');
    },
    onError: (e) => toast.error((isPt ? 'Falha ao salvar: ' : 'Failed to save: ') + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => AIAutomation.delete(id),
    onSuccess: () => { invalidate(); toast.success(isPt ? 'Automação excluída' : 'Automation deleted'); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }) => AIAutomation.update(id, { enabled }),
    onSuccess: invalidate,
  });

  const runNow = async (a) => {
    setRunningId(a.id);
    try {
      await AIAutomation.runNow(a.id);
      invalidate();
      toast.success(isPt
        ? `"${a.name}" executada! Veja o resultado em Saídas de IA.`
        : `"${a.name}" executed! Check the result in AI Outputs.`);
    } catch (e) {
      toast.error((isPt ? 'Falha na execução: ' : 'Run failed: ') + e.message);
    } finally {
      setRunningId(null);
    }
  };

  const openNew = () => { setEditingId(null); setForm(EMPTY_FORM); setShowEditor(true); };
  const openEdit = (a) => {
    setEditingId(a.id);
    setForm({
      name: a.name || '', description: a.description || '', prompt: a.prompt || '',
      output_category: a.output_category || 'strategies',
      schedule_type: a.schedule_type || 'daily',
      interval_minutes: a.interval_minutes || 60,
      run_minute: a.run_minute ?? 0, run_hour: a.run_hour ?? 9,
      run_day_of_week: a.run_day_of_week ?? 1, run_day_of_month: a.run_day_of_month ?? 1,
      enabled: a.enabled !== false,
    });
    setShowEditor(true);
  };

  const save = () => {
    if (!form.name.trim()) { toast.error(isPt ? 'Dê um nome à automação' : 'Give the automation a name'); return; }
    if (!form.prompt.trim()) { toast.error(isPt ? 'Escreva o prompt da tarefa' : 'Write the task prompt'); return; }
    saveMutation.mutate(form);
  };

  const F = (k) => (v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            {isPt ? 'Automações de IA' : 'AI Automations'}
          </h1>
          <p className="text-gray-400 mt-1">
            {isPt
              ? 'Agende tarefas e prompts que o Agente de IA executa automaticamente — resultados vão para Saídas de IA para revisão.'
              : 'Schedule tasks and prompts the AI Agent runs automatically — results land in AI Outputs for review.'}
          </p>
        </div>
        <Button onClick={openNew} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
          <Plus size={18} /> {isPt ? 'Nova Automação' : 'New Automation'}
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-[#38b6ff] border-t-transparent animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && automations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-white/10">
          <div className="w-14 h-14 rounded-2xl bg-[#38b6ff]/10 flex items-center justify-center mb-4">
            <Clock size={26} className="text-[#38b6ff]" />
          </div>
          <h3 className="text-white font-semibold mb-1">{isPt ? 'Nenhuma automação ainda' : 'No automations yet'}</h3>
          <p className="text-gray-500 text-sm mb-5 max-w-md">
            {isPt
              ? 'Qualquer coisa que o Agente de IA faz manualmente pode ser agendada: relatórios, posts, e-mails, análises…'
              : 'Anything the AI Agent does manually can be scheduled: reports, posts, emails, analyses…'}
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            {EXAMPLE_PROMPTS(isPt).map((ex) => (
              <button key={ex.label}
                onClick={() => { setForm({ ...EMPTY_FORM, name: ex.label.replace(/^\S+\s/, ''), prompt: ex.prompt }); setEditingId(null); setShowEditor(true); }}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-[#38b6ff]/40 text-gray-300 text-sm transition-all">
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Automations list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {automations.map((a) => (
          <div key={a.id}
            className={`rounded-2xl border p-5 transition-all ${a.enabled ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-white/5 opacity-70'}`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.enabled ? 'bg-[#38b6ff]/15' : 'bg-white/5'}`}>
                  <Bot size={18} className={a.enabled ? 'text-[#38b6ff]' : 'text-gray-500'} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-white font-semibold truncate">{a.name}</h3>
                  <p className="text-gray-500 text-xs flex items-center gap-1.5">
                    <Clock size={11} /> {scheduleLabel(a, isPt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button size="sm" variant="outline" title={isPt ? 'Executar agora' : 'Run now'}
                  onClick={() => runNow(a)} disabled={runningId === a.id}
                  className="border-white/10 text-white hover:bg-white/5 h-8 w-8 p-0">
                  {runningId === a.id ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                </Button>
                <Button size="sm" variant="outline" title={a.enabled ? (isPt ? 'Pausar' : 'Pause') : (isPt ? 'Ativar' : 'Enable')}
                  onClick={() => toggleMutation.mutate({ id: a.id, enabled: !a.enabled })}
                  className="border-white/10 text-white hover:bg-white/5 h-8 w-8 p-0">
                  {a.enabled ? <Pause size={13} /> : <Play size={13} />}
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(a)}
                  className="border-white/10 text-white hover:bg-white/5 h-8 w-8 p-0">
                  <Edit3 size={13} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(a.id)}
                  className="border-red-500/20 text-red-400 hover:bg-red-500/10 h-8 w-8 p-0">
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>

            {a.description && <p className="text-gray-400 text-sm mb-2 line-clamp-2">{a.description}</p>}
            <p className="text-gray-500 text-xs line-clamp-2 mb-3 font-mono bg-black/20 rounded-lg px-2.5 py-1.5">{a.prompt}</p>

            <div className="flex items-center gap-3 text-xs flex-wrap">
              {a.enabled && a.next_run_at && (
                <span className="text-gray-400">
                  {isPt ? 'Próxima: ' : 'Next: '}{new Date(a.next_run_at).toLocaleString()}
                </span>
              )}
              {a.last_run_at && (
                <span className={`flex items-center gap-1 ${a.last_status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {a.last_status === 'success' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                  {isPt ? 'Última: ' : 'Last: '}{new Date(a.last_run_at).toLocaleString()}
                </span>
              )}
              <span className="text-gray-600">{a.run_count || 0} {isPt ? 'execuções' : 'runs'}</span>
            </div>
            {a.last_status === 'error' && a.last_result?.error && (
              <p className="text-red-400/80 text-xs mt-2 bg-red-500/5 border border-red-500/15 rounded-lg px-2.5 py-1.5">
                {a.last_result.error}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Editor dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-xl bg-[#111] border-white/10 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? (isPt ? 'Editar Automação' : 'Edit Automation') : (isPt ? 'Nova Automação' : 'New Automation')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-gray-400">{isPt ? 'Nome' : 'Name'}</Label>
              <Input value={form.name} onChange={(e) => F('name')(e.target.value)}
                placeholder={isPt ? 'ex.: Relatório semanal de desempenho' : 'e.g., Weekly performance report'}
                className="bg-black/30 border-white/10 text-white mt-1.5" />
            </div>
            <div>
              <Label className="text-gray-400">{isPt ? 'Descrição (opcional)' : 'Description (optional)'}</Label>
              <Input value={form.description} onChange={(e) => F('description')(e.target.value)}
                className="bg-black/30 border-white/10 text-white mt-1.5" />
            </div>
            <div>
              <Label className="text-gray-400">{isPt ? 'Prompt / tarefa para a IA' : 'Prompt / task for the AI'}</Label>
              <Textarea value={form.prompt} onChange={(e) => F('prompt')(e.target.value)}
                placeholder={isPt
                  ? 'Descreva a tarefa como você pediria no Chat IA. A IA já conhece todo o contexto da empresa.'
                  : 'Describe the task as you would ask in AI Chat. The AI already knows the full company context.'}
                className="bg-black/30 border-white/10 text-white mt-1.5 min-h-[110px]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">{isPt ? 'Categoria do resultado' : 'Result category'}</Label>
                <Select value={form.output_category} onValueChange={F('output_category')}>
                  <SelectTrigger className="bg-black/30 border-white/10 text-white mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{isPt ? o.pt : o.en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-400">{isPt ? 'Frequência' : 'Frequency'}</Label>
                <Select value={form.schedule_type} onValueChange={F('schedule_type')}>
                  <SelectTrigger className="bg-black/30 border-white/10 text-white mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="every_minutes">{isPt ? 'A cada X minutos' : 'Every X minutes'}</SelectItem>
                    <SelectItem value="hourly">{isPt ? 'A cada hora' : 'Hourly'}</SelectItem>
                    <SelectItem value="daily">{isPt ? 'Diariamente' : 'Daily'}</SelectItem>
                    <SelectItem value="weekly">{isPt ? 'Semanalmente' : 'Weekly'}</SelectItem>
                    <SelectItem value="monthly">{isPt ? 'Mensalmente' : 'Monthly'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Schedule detail fields */}
            <div className="grid grid-cols-2 gap-4">
              {form.schedule_type === 'every_minutes' && (
                <div>
                  <Label className="text-gray-400">{isPt ? 'Intervalo (minutos, mín. 5)' : 'Interval (minutes, min 5)'}</Label>
                  <Input type="number" min={5} value={form.interval_minutes}
                    onChange={(e) => F('interval_minutes')(e.target.value)}
                    className="bg-black/30 border-white/10 text-white mt-1.5" />
                </div>
              )}
              {form.schedule_type === 'weekly' && (
                <div>
                  <Label className="text-gray-400">{isPt ? 'Dia da semana' : 'Day of week'}</Label>
                  <Select value={String(form.run_day_of_week)} onValueChange={(v) => F('run_day_of_week')(Number(v))}>
                    <SelectTrigger className="bg-black/30 border-white/10 text-white mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(isPt
                        ? ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
                        : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                      ).map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.schedule_type === 'monthly' && (
                <div>
                  <Label className="text-gray-400">{isPt ? 'Dia do mês (1–28)' : 'Day of month (1–28)'}</Label>
                  <Input type="number" min={1} max={28} value={form.run_day_of_month}
                    onChange={(e) => F('run_day_of_month')(e.target.value)}
                    className="bg-black/30 border-white/10 text-white mt-1.5" />
                </div>
              )}
              {['daily', 'weekly', 'monthly'].includes(form.schedule_type) && (
                <div>
                  <Label className="text-gray-400">{isPt ? 'Hora (0–23)' : 'Hour (0–23)'}</Label>
                  <Input type="number" min={0} max={23} value={form.run_hour}
                    onChange={(e) => F('run_hour')(e.target.value)}
                    className="bg-black/30 border-white/10 text-white mt-1.5" />
                </div>
              )}
              {form.schedule_type !== 'every_minutes' && (
                <div>
                  <Label className="text-gray-400">{isPt ? 'Minuto (0–59)' : 'Minute (0–59)'}</Label>
                  <Input type="number" min={0} max={59} value={form.run_minute}
                    onChange={(e) => F('run_minute')(e.target.value)}
                    className="bg-black/30 border-white/10 text-white mt-1.5" />
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-[#38b6ff]/5 border border-[#38b6ff]/15 text-xs text-gray-400">
              {isPt
                ? '💡 Cada execução usa créditos de IA do plano, com todo o contexto da empresa (Company Brain). Os resultados aparecem em Saídas de IA como pendentes para você aprovar.'
                : '💡 Each run uses plan AI credits with full company context (Company Brain). Results appear in AI Outputs as pending for your approval.'}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowEditor(false)} className="border-white/10 text-white hover:bg-white/5">
                {isPt ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button onClick={save} disabled={saveMutation.isPending} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
                {saveMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {isPt ? 'Salvar Automação' : 'Save Automation'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
