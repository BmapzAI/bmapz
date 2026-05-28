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
import QuickStartGuide from '@/components/ui/QuickStartGuide';
import { Activity, Lead, Message, Workflow, Company } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';

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
  const { t } = useLanguage();
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
        title="Your Command Center"
        steps={[
          "This dashboard shows your key metrics, sales funnel progression, and recent activity at a glance.",
          "Complete the 'Getting Started' steps below to unlock the full power of BMAPZ.",
          "Use the quick-action buttons above to jump right in.",
          "The AI Agent in the sidebar can help you write messages, build strategies, and analyze leads.",
        ]}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t('totalLeads')}      value={leads.length}                   icon={Users}         trend={12} trendLabel={t('fromLastMonth')} color="blue"    />
        <StatsCard title={t('messagesSent')}    value={messagesSent}                   icon={MessageSquare} trend={8}  trendLabel={t('fromLastMonth')} color="cyan"    />
        <StatsCard title={t('conversionRate')}  value={`${conversionRate}%`}           icon={TrendingUp}    trend={5}  trendLabel={t('fromLastMonth')} color="green"   />
        <StatsCard title={t('pipelineValue')}   value={`$${pipelineValue.toLocaleString()}`} icon={DollarSign} trend={15} trendLabel={t('fromLastMonth')} color="magenta" />
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
          <FunnelChart leads={leads} />
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white">{t('recentActivity')}</h2>
            <p className="text-sm mt-0.5 text-gray-400">{t('latestInteractions')}</p>
          </div>
          <ActivityFeed activities={activities} />
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
    </div>
  );
}
