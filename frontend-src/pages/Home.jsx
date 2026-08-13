import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Users, MessageSquare, TrendingUp, DollarSign, Plus, PenLine, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatsCard from '@/components/dashboard/StatsCard';
import FunnelChart from '@/components/dashboard/FunnelChart';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import GettingStarted from '@/components/dashboard/GettingStarted';
import DrillDownModal from '@/components/dashboard/DrillDownModal';
import QuickStartGuide from '@/components/ui/QuickStartGuide';
import TasksWidget from '@/components/tasks/TasksWidget';
import { Activity, Lead, Message, Workflow, Company, Notification } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';

const NOTIF_ICON = { lead: '🆕', handover: '🤝', sdr: '🤖', qualification: '📈', workflow: '⚙️', system: '🛎️', info: '💬' };

function HomeNotifications({ isPt }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['notifHome'],
    queryFn: () => Notification.list({ limit: 6 }),
  });
  if (isLoading) return <div className="py-6 flex justify-center"><div className="w-6 h-6 rounded-full border-2 border-[#38b6ff] border-t-transparent animate-spin" /></div>;
  if (!items.length) return <p className="text-gray-500 text-sm py-4">{isPt ? 'Nenhuma notificação ainda — novos leads e handovers aparecem aqui.' : 'No notifications yet — new leads and hand-overs show up here.'}</p>;
  return (
    <div className="space-y-2">
      {items.map(n => (
        <Link key={n.id} to={n.link || '/Notifications'}
          className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all hover:border-[#38b6ff]/30 ${n.read ? 'bg-black/20 border-white/5' : 'bg-[#38b6ff]/5 border-[#38b6ff]/20'}`}>
          <span className="text-lg">{n.icon || NOTIF_ICON[n.type] || '💬'}</span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm truncate ${n.read ? 'text-gray-400' : 'text-white'}`}>{n.title}</p>
            <p className="text-gray-600 text-[10px]">{new Date(n.created_at).toLocaleString()}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function WhatsAppAgentButton({ user }) {
  // Read configured WhatsApp agent number from env (set by Derek in Cloudflare Pages).
  // Falls back to a placeholder. The number must match the WhatsApp Business
  // phone tied to the Meta WhatsApp Business API webhook.
  const agentNumber = (import.meta.env.VITE_WHATSAPP_AGENT_NUMBER || '').replace(/\D/g, '');

  // Personalize the intro message so the backend webhook can link this
  // WhatsApp conversation back to the user's Bmapz account via email.
  const intro = user?.email
    ? `Hi! I'm ${user?.full_name || user?.email} from Bmapz (${user.email}). Ready to chat with my AI agent.`
    : 'Hi! I want to chat with my Bmapz AI agent.';

  if (!agentNumber) {
    return (
      <Button
        title="WhatsApp Agent not configured yet — admin needs to set VITE_WHATSAPP_AGENT_NUMBER"
        disabled
        className="bg-green-500/50 text-white font-semibold transition-all gap-2 cursor-not-allowed"
      >
        <span>💬</span>
        <span className="hidden sm:inline">WhatsApp Agent (setup pending)</span>
      </Button>
    );
  }

  return (
    <a href={`https://wa.me/${agentNumber}?text=${encodeURIComponent(intro)}`} target="_blank" rel="noopener noreferrer">
      <Button className="bg-green-500 hover:bg-green-400 text-white font-semibold transition-all gap-2">
        <span>💬</span>
        <span className="hidden sm:inline">WhatsApp Agent</span>
      </Button>
    </a>
  );
}

export default function Home() {
  const { t, isPt } = useLanguage();
  const { dbUser: user } = useAuth();

  const { data: leads = [] }      = useQuery({ queryKey: ['leads'],      queryFn: () => Lead.list() });
  const { data: messages = [] }   = useQuery({ queryKey: ['messages'],   queryFn: () => Message.list() });
  const { data: activities = [] } = useQuery({ queryKey: ['activities'], queryFn: () => Activity.list({ limit: 10 }) });
  const { data: workflows = [] }  = useQuery({ queryKey: ['workflows'],  queryFn: () => Workflow.list() });
  const { data: companies = [] }  = useQuery({ queryKey: ['companies'],  queryFn: () => Company.list() });

  const company = companies[0];
  const messagesSent    = messages.filter(m => m.direction === 'outbound' && m.status !== 'draft').length;
  const convertedLeads  = leads.filter(l => l.status === 'converted').length;
  const conversionRate  = leads.length > 0 ? ((convertedLeads / leads.length) * 100).toFixed(1) : 0;
  const pipelineValue   = leads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);

  // Real month-over-month trend: last 30 days vs the 30 before. undefined when
  // there's no prior period to compare, so the card omits the trend line.
  const trends = React.useMemo(() => {
    const now = Date.now(), d30 = now - 30 * 86400_000, d60 = now - 60 * 86400_000;
    const at = (r) => new Date(r.created_at || r.created_date || r.sent_at || 0).getTime();
    const pct = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : undefined);
    const outbound = messages.filter(m => m.direction === 'outbound');
    return {
      leads: pct(leads.filter(l => at(l) >= d30).length, leads.filter(l => at(l) >= d60 && at(l) < d30).length),
      messages: pct(outbound.filter(m => at(m) >= d30).length, outbound.filter(m => at(m) >= d60 && at(m) < d30).length),
    };
  }, [leads, messages]);

  // Drill-down for every clickable card / funnel stage on this page.
  const [drill, setDrill] = React.useState(null);
  const leadsById = React.useMemo(() => Object.fromEntries(leads.map(l => [l.id, l])), [leads]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            {t('welcomeBack')}
          </h1>
          <p className="mt-1 text-gray-400">{t('hereIsWhatsHappening')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={createPageUrl('Sales')}>
            <Button className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] hover:opacity-90 transition-all gap-2 text-white">
              <Plus size={18} />
              <span className="hidden sm:inline">{t('addNewLead')}</span>
              <span className="sm:hidden">Lead</span>
            </Button>
          </Link>
          <Link to={createPageUrl('AIChat')}>
            <Button className="bg-[#cb6ce6]/20 border border-[#cb6ce6]/50 text-[#cb6ce6] hover:bg-[#cb6ce6]/30 transition-all gap-2">
              <PenLine size={18} />
              <span className="hidden sm:inline">{t('createMessage')}</span>
            </Button>
          </Link>
          <Link to={createPageUrl('Workflows')}>
            <Button className="bg-[#38b6ff]/10 border border-[#38b6ff]/40 text-[#38b6ff] hover:bg-[#38b6ff]/20 transition-all gap-2">
              <GitBranch size={18} />
              <span className="hidden sm:inline">{t('buildWorkflow')}</span>
            </Button>
          </Link>
          <WhatsAppAgentButton user={user} />
        </div>
      </div>

      <QuickStartGuide
        id="home_dashboard"
        title={isPt ? 'Seu Centro de Comando' : 'Your Command Center'}
        steps={[t('homeQs1'), t('homeQs2'), t('homeQs3'), t('homeQs4')]}
      />

      {/* Stats — clickable: each opens the records behind the number. Trends are
          computed from real data (they were hardcoded +12%/+8%/+5%/+15%). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t('totalLeads')}      value={leads.length}                   icon={Users}         trend={trends.leads}    trendLabel={t('fromLastMonth')} color="blue"
          onClick={() => setDrill({ kind: 'leads', title: t('totalLeads'), items: leads })} />
        <StatsCard title={t('messagesSent')}    value={messagesSent}                   icon={MessageSquare} trend={trends.messages} trendLabel={t('fromLastMonth')} color="cyan"
          onClick={() => setDrill({ kind: 'messages', title: t('messagesSent'), items: messages.filter(m => m.direction === 'outbound') })} />
        <StatsCard title={t('conversionRate')}  value={`${conversionRate}%`}           icon={TrendingUp}                                                            color="green"
          onClick={() => setDrill({ kind: 'leads', title: t('conversionRate'), items: leads.filter(l => l.status === 'converted') })} />
        <StatsCard title={t('pipelineValue')}   value={`$${pipelineValue.toLocaleString()}`} icon={DollarSign}                                                      color="magenta"
          onClick={() => setDrill({ kind: 'leads', title: t('pipelineValue'), items: leads.filter(l => (l.estimated_value || 0) > 0) })} />
      </div>

      {/* Funnel + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-white/5 border border-white/10 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">{t('salesFunnel')}</h2>
              <p className="text-sm mt-0.5 text-gray-400">{t('yourLeadProgression')}</p>
            </div>
          </div>
          <FunnelChart
            leads={leads}
            onStageClick={(stageId, stageName) => setDrill({
              kind: 'leads',
              title: `${stageName} — ${isPt ? 'leads nesta etapa' : 'leads at this stage'}`,
              items: leads.filter(l => l.funnel_stage === stageId),
            })}
          />
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white">{t('recentActivity')}</h2>
            <p className="text-sm mt-0.5 text-gray-400">{t('latestInteractions')}</p>
          </div>
          <ActivityFeed activities={activities} />
        </div>
      </div>

      {/* My Tasks + Notifications side by side: what I owe, and what just happened. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TasksWidget />

      {/* Notifications */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">{isPt ? 'Notificações' : 'Notifications'}</h2>
            <p className="text-sm mt-0.5 text-gray-400">
              {isPt ? 'Leads, qualificações e handovers recentes' : 'Recent leads, qualifications and hand-overs'}
            </p>
          </div>
          <Link to="/Notifications" className="text-[#38b6ff] text-sm hover:underline">{isPt ? 'Ver tudo' : 'View all'}</Link>
        </div>
        <HomeNotifications isPt={isPt} />
      </div>
      </div>

      {/* Getting Started */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">{t('gettingStarted')}</h2>
          <p className="text-sm mt-0.5 text-gray-400">{t('completeSteps')}</p>
        </div>
        <GettingStarted
          company={company}
          leadsCount={leads.length}
          workflowsCount={workflows.length}
          messagesCount={messagesSent}
        />
      </div>

      <DrillDownModal
        open={!!drill}
        onClose={() => setDrill(null)}
        title={drill?.title || ''}
        kind={drill?.kind || 'leads'}
        items={drill?.items || []}
        leadsById={leadsById}
      />
    </div>
  );
}
