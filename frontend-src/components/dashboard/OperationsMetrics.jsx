import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Timer, Clock, Users2, MessageSquare, TrendingUp, Bot, Zap,
  Loader2, AlertCircle, Circle, ArrowRight,
} from 'lucide-react';
import { api } from '@/api/apiClient';

/**
 * Operational metrics: the numbers a sales manager actually needs, computed from
 * everything the account already holds — response times, first-contact speed
 * (with and without the SDR), team availability, message volume, funnel velocity
 * and touchpoints.
 *
 * Any block the account cannot answer yet renders as "not enough data" rather
 * than a misleading zero.
 */

const Card = ({ title, icon: Icon, tone = 'text-[#38b6ff]', children, hint }) => (
  <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
    <p className="text-white text-sm font-medium flex items-center gap-2 mb-3">
      <Icon size={15} className={tone} /> {title}
    </p>
    {children}
    {hint && <p className="text-gray-600 text-[11px] mt-2">{hint}</p>}
  </div>
);

const Stat = ({ label, value, unit, tone = 'text-white' }) => (
  <div>
    <p className={`text-xl font-bold ${tone}`}>
      {value === null || value === undefined ? '—' : value}
      {value !== null && value !== undefined && unit ? <span className="text-gray-500 text-xs font-normal ml-1">{unit}</span> : null}
    </p>
    <p className="text-gray-400 text-xs">{label}</p>
  </div>
);

const Empty = ({ text }) => <p className="text-gray-500 text-xs py-2">{text}</p>;

/** Simple horizontal bar list for distributions (channels, stages, sources). */
const Bars = ({ data, emptyText }) => {
  const entries = Object.entries(data || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!entries.length) return <Empty text={emptyText} />;
  const max = Math.max(...entries.map(([, v]) => v));
  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k}>
          <div className="flex items-center justify-between text-xs mb-0.5">
            <span className="text-gray-300 capitalize truncate">{String(k).replace(/_/g, ' ')}</span>
            <span className="text-gray-500 flex-shrink-0 ml-2">{v}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#3572b9] to-[#38b6ff]" style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const STATUS_DOT = { online: 'text-green-400', standby: 'text-yellow-400', offline: 'text-gray-500' };

/** Minutes → a human phrase ("18 min", "3.2 h", "2.1 days"). */
const dur = (mins) => {
  if (mins === null || mins === undefined) return null;
  if (mins < 60) return `${mins}`;
  if (mins < 60 * 24) return `${(mins / 60).toFixed(1)}`;
  return `${(mins / 1440).toFixed(1)}`;
};
const durUnit = (mins) => {
  if (mins === null || mins === undefined) return '';
  if (mins < 60) return 'min';
  if (mins < 60 * 24) return 'hours';
  return 'days';
};

export default function OperationsMetrics() {
  const { isPt } = useLanguage();
  const [days, setDays] = useState('30');

  const { data, isLoading, error } = useQuery({
    queryKey: ['metricsOverview', days],
    queryFn: () => api.get('/api/metrics/overview', { days }),
    retry: false,
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#38b6ff]" /></div>;
  }
  if (error) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
        <AlertCircle size={24} className="text-yellow-400 mx-auto mb-2" />
        <p className="text-gray-300 text-sm">{isPt ? 'Não foi possível carregar as métricas.' : 'Could not load the metrics.'}</p>
        <p className="text-gray-500 text-xs mt-1">{error.message}</p>
      </div>
    );
  }

  const m = data || {};
  const rt = m.messaging?.response_time_minutes || {};
  const fc = m.first_contact;
  const av = m.availability;
  const vel = m.velocity;
  const tp = m.touchpoints;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-white font-semibold">{isPt ? 'Operação' : 'Operations'}</h3>
          <p className="text-gray-500 text-xs">
            {isPt
              ? 'Velocidade de resposta, disponibilidade do time e movimento do funil.'
              : 'Response speed, team availability and how leads move through the funnel.'}
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="h-8 w-36 bg-black/30 border-white/10 text-white text-xs"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            <SelectItem value="7">{isPt ? 'Últimos 7 dias' : 'Last 7 days'}</SelectItem>
            <SelectItem value="30">{isPt ? 'Últimos 30 dias' : 'Last 30 days'}</SelectItem>
            <SelectItem value="90">{isPt ? 'Últimos 90 dias' : 'Last 90 days'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* Response time — including the SDR-vs-human comparison */}
        <Card title={isPt ? 'Tempo de resposta' : 'Response time'} icon={Timer}>
          {rt.average === null || rt.average === undefined ? (
            <Empty text={isPt ? 'Sem trocas de mensagens suficientes ainda.' : 'No replies to measure yet.'} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Stat label={isPt ? 'Média' : 'Average'} value={dur(rt.average)} unit={durUnit(rt.average)} />
                <Stat label={isPt ? 'Mediana' : 'Median'} value={dur(rt.median)} unit={durUnit(rt.median)} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/10">
                <Stat label={`SDR (${rt.sdr_replies || 0})`} value={dur(rt.sdr_average)} unit={durUnit(rt.sdr_average)} tone="text-[#cb6ce6]" />
                <Stat label={`${isPt ? 'Pessoas' : 'People'} (${rt.human_replies || 0})`} value={dur(rt.human_average)} unit={durUnit(rt.human_average)} tone="text-[#38b6ff]" />
              </div>
            </>
          )}
        </Card>

        {/* First contact, with and without the SDR */}
        <Card title={isPt ? 'Primeiro contato' : 'Time to first contact'} icon={Clock} tone="text-[#cb6ce6]"
          hint={isPt ? 'Do momento em que o lead entra até a primeira mensagem enviada.' : 'From the lead arriving to the first message we send.'}>
          {!fc ? <Empty text={isPt ? 'Sem dados ainda.' : 'Not enough data yet.'} /> : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Stat label={isPt ? 'Média' : 'Average'} value={dur(fc.average_minutes)} unit={durUnit(fc.average_minutes)} />
                <Stat label={isPt ? 'Nunca contatados' : 'Never contacted'} value={fc.never_contacted} tone={fc.never_contacted > 0 ? 'text-yellow-400' : 'text-white'} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/10">
                <Stat label={isPt ? 'Com SDR' : 'With SDR'} value={dur(fc.with_sdr_minutes)} unit={durUnit(fc.with_sdr_minutes)} tone="text-[#cb6ce6]" />
                <Stat label={isPt ? 'Sem SDR' : 'Without SDR'} value={dur(fc.without_sdr_minutes)} unit={durUnit(fc.without_sdr_minutes)} tone="text-[#38b6ff]" />
              </div>
            </>
          )}
        </Card>

        {/* Who is available right now */}
        <Card title={isPt ? 'Disponibilidade do time' : 'Sales team availability'} icon={Users2} tone="text-green-400">
          {!av || !av.team_size ? (
            <Empty text={isPt ? 'Nenhum membro no time de vendas ainda.' : 'No sales team members yet.'} />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Online" value={av.online} tone="text-green-400" />
                <Stat label={isPt ? 'Em espera' : 'Stand by'} value={av.standby} tone="text-yellow-400" />
                <Stat label="Offline" value={av.offline} tone="text-gray-400" />
              </div>
              <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5 max-h-32 overflow-y-auto">
                {av.members.map(mem => (
                  <div key={mem.id} className="flex items-center gap-2 text-xs">
                    <Circle size={7} className={`${STATUS_DOT[mem.status]} fill-current flex-shrink-0`} />
                    <span className="text-gray-300 truncate flex-1">{mem.name}</span>
                    {mem.held_minutes !== null && (
                      <span className="text-gray-600 flex-shrink-0">{dur(mem.held_minutes)}{durUnit(mem.held_minutes) === 'min' ? 'm' : durUnit(mem.held_minutes) === 'hours' ? 'h' : 'd'}</span>
                    )}
                  </div>
                ))}
              </div>
              <p className={`text-[11px] mt-2 ${av.new_leads_go_to === 'sales_team' ? 'text-green-400' : 'text-[#cb6ce6]'}`}>
                {av.new_leads_go_to === 'sales_team'
                  ? (isPt ? 'Novos leads vão para o time.' : 'New leads go to the team.')
                  : (isPt ? 'Ninguém online — o SDR está cuidando.' : 'Nobody online — the SDR is covering.')}
              </p>
            </>
          )}
        </Card>

        {/* Conversation volume */}
        <Card title={isPt ? 'Mensagens com leads' : 'Messages with leads'} icon={MessageSquare}>
          {!m.messaging?.total ? <Empty text={isPt ? 'Sem mensagens no período.' : 'No messages in this period.'} /> : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Stat label={isPt ? 'Total' : 'Total'} value={m.messaging.total} />
                <Stat label={isPt ? 'Por lead' : 'Per lead'} value={m.messaging.messages_per_lead} />
                <Stat label={isPt ? 'Leads' : 'Leads'} value={m.messaging.leads_messaged} />
              </div>
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-gray-500 text-[11px] mb-1.5">{isPt ? 'Por canal' : 'By channel'}</p>
                <Bars data={m.messaging.channels} emptyText={isPt ? 'Sem canais.' : 'No channels.'} />
              </div>
            </>
          )}
        </Card>

        {/* Funnel velocity */}
        <Card title={isPt ? 'Velocidade do funil' : 'Funnel velocity'} icon={TrendingUp} tone="text-yellow-400"
          hint={isPt ? 'Tempo médio em cada etapa antes de avançar.' : 'Average time spent in each stage before moving on.'}>
          {!vel || !Object.keys(vel.stage_averages || {}).length ? (
            <Empty text={isPt ? 'Ainda não há movimentos de etapa suficientes.' : 'Not enough stage changes recorded yet.'} />
          ) : (
            <>
              <Stat
                label={isPt ? 'Até se tornar cliente' : 'Time to customer'}
                value={vel.time_to_customer_hours !== null ? (vel.time_to_customer_hours / 24).toFixed(1) : null}
                unit={isPt ? 'dias' : 'days'}
              />
              <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
                {Object.entries(vel.stage_averages).map(([stage, v]) => (
                  <div key={stage} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-300 capitalize flex-1 truncate">{stage}</span>
                    <ArrowRight size={10} className="text-gray-600 flex-shrink-0" />
                    <span className="text-white flex-shrink-0">
                      {v.average_hours < 48 ? `${v.average_hours}h` : `${(v.average_hours / 24).toFixed(1)}d`}
                    </span>
                    <span className="text-gray-600 flex-shrink-0">({v.samples})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Touchpoints */}
        <Card title={isPt ? 'Pontos de contato' : 'Touchpoints per lead'} icon={Zap} tone="text-[#cb6ce6]">
          {!tp ? <Empty text={isPt ? 'Sem histórico suficiente.' : 'Not enough history yet.'} /> : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Stat label={isPt ? 'Média por lead' : 'Average per lead'} value={tp.average_per_lead} />
                <Stat label={isPt ? 'Mediana' : 'Median'} value={tp.median_per_lead} />
              </div>
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-gray-500 text-[11px] mb-1.5">{isPt ? 'Quem fez o contato' : 'Who did the touching'}</p>
                <Bars data={tp.by_actor} emptyText="—" />
              </div>
            </>
          )}
        </Card>

        {/* Pipeline */}
        <Card title={isPt ? 'Pipeline' : 'Pipeline'} icon={TrendingUp}>
          {!m.pipeline?.total ? <Empty text={isPt ? 'Sem leads ainda.' : 'No leads yet.'} /> : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Stat label={isPt ? 'Leads' : 'Leads'} value={m.pipeline.total} />
                <Stat label={isPt ? 'Novos' : 'New'} value={m.pipeline.new_in_window} />
                <Stat label={isPt ? 'Sem dono' : 'Unassigned'} value={m.pipeline.unassigned}
                  tone={m.pipeline.unassigned > 0 ? 'text-yellow-400' : 'text-white'} />
              </div>
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-gray-500 text-[11px] mb-1.5">{isPt ? 'Por etapa' : 'By stage'}</p>
                <Bars data={m.pipeline.stages} emptyText="—" />
              </div>
            </>
          )}
        </Card>

        {/* SDR workload */}
        <Card title={isPt ? 'Agente SDR' : 'SDR agent'} icon={Bot} tone="text-[#cb6ce6]">
          {!m.sdr?.conversations ? <Empty text={isPt ? 'Nenhuma conversa do SDR no período.' : 'No SDR conversations in this period.'} /> : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Stat label={isPt ? 'Conversas' : 'Conversations'} value={m.sdr.conversations} />
                <Stat label={isPt ? 'Qualificados' : 'Qualified'} value={m.sdr.qualified} tone="text-green-400" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/10">
                <Stat label={isPt ? 'Encaminhados' : 'Handed over'} value={m.sdr.handed_over} />
                <Stat label={isPt ? 'Assumidos por pessoa' : 'Taken by a person'} value={m.sdr.handed_to_human} />
              </div>
            </>
          )}
        </Card>

        {/* Lead sources */}
        <Card title={isPt ? 'Origem dos leads' : 'Where leads come from'} icon={TrendingUp} tone="text-green-400">
          <Bars data={m.pipeline?.sources} emptyText={isPt ? 'Sem leads ainda.' : 'No leads yet.'} />
        </Card>
      </div>

      <p className="text-gray-600 text-[11px]">
        {isPt ? 'Atualizado em ' : 'Generated '}{new Date(m.generated_at || Date.now()).toLocaleString()}
        {' · '}
        {isPt ? 'Blocos sem dados suficientes mostram um aviso em vez de zero.' : 'Blocks without enough data say so rather than showing a misleading zero.'}
      </p>
    </div>
  );
}
