import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Target, Users, GitBranch, Bot, LayoutTemplate, Share2, Link2, Trophy, ChevronRight, Star } from 'lucide-react';

export default function GettingStarted({ company, leadsCount, workflowsCount }) {
  const { t } = useLanguage();

  const steps = [
    { number: 1, icon: Target, xp: 100, title: t('defineYourICP'), description: t('setUpICP'), completed: company?.icp && Object.keys(company.icp).length > 0, link: 'Settings', color: 'from-[#3572b9] to-[#38b6ff]' },
    { number: 2, icon: Bot, xp: 150, title: t('chatWithAI'), description: t('chatWithAIDesc'), completed: false, link: 'AIChat', color: 'from-[#38b6ff] to-[#cb6ce6]', highlight: true },
    { number: 3, icon: Users, xp: 100, title: t('importLeads'), description: t('addLeadsManually'), completed: leadsCount > 0, link: 'Sales', color: 'from-[#38b6ff] to-[#00e7ff]' },
    { number: 4, icon: GitBranch, xp: 150, title: t('createWorkflows'), description: t('buildAutomated'), completed: workflowsCount > 0, link: 'Workflows', color: 'from-[#00e7ff] to-[#cb6ce6]' },
    { number: 5, icon: LayoutTemplate, xp: 100, title: t('createMsgTemplate'), description: t('createMsgTemplateDesc'), completed: false, link: 'TextTemplates', color: 'from-[#cb6ce6] to-[#38b6ff]' },
    { number: 6, icon: Share2, xp: 150, title: t('scheduleSocial'), description: t('scheduleSocialDesc'), completed: false, link: 'SocialMedia', color: 'from-[#E1306C] to-[#cb6ce6]' },
    { number: 7, icon: Link2, xp: 200, title: t('connectIntegration'), description: t('connectIntegrationDesc'), completed: false, link: 'Integrations', color: 'from-[#38b6ff] to-[#00e7ff]' },
    { number: 8, icon: Users, xp: 200, title: t('contact10Leads'), description: t('contact10LeadsDesc'), completed: leadsCount >= 10, link: 'Sales', color: 'from-[#22c55e] to-[#38b6ff]' },
  ];

  const completedSteps = steps.filter(s => s.completed).length;
  const totalXP = steps.filter(s => s.completed).reduce((sum, s) => sum + s.xp, 0);
  const maxXP = steps.reduce((sum, s) => sum + s.xp, 0);
  const progressPercent = Math.round((completedSteps / steps.length) * 100);

  const getLevelInfo = (xp) => {
    if (xp >= 800) return { level: 5, title: t('growthExpert'), color: 'text-yellow-400' };
    if (xp >= 500) return { level: 4, title: t('salesPro'), color: 'text-[#cb6ce6]' };
    if (xp >= 300) return { level: 3, title: t('pipelineBuilder'), color: 'text-[#38b6ff]' };
    if (xp >= 150) return { level: 2, title: t('prospector'), color: 'text-green-400' };
    return { level: 1, title: t('beginner'), color: 'text-gray-400' };
  };

  const levelInfo = getLevelInfo(totalXP);

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 p-4 rounded-2xl border
        bg-gradient-to-r from-[#3572b9]/10 to-[#cb6ce6]/10 border-[#38b6ff]/20">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3572b9] to-[#cb6ce6] flex items-center justify-center flex-shrink-0">
            <Trophy size={28} className="text-white" />
          </div>
          <div>
            <div className={`text-lg font-bold ${levelInfo.color}`}>{t('levelLabel')} {levelInfo.level}: {levelInfo.title}</div>
            <div className="text-sm text-gray-400">{totalXP} / {maxXP} XP</div>
          </div>
        </div>
        <div className="flex-1 w-full">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">{completedSteps}/{steps.length} {t('stepsCompleted')}</span>
            <span className="font-medium text-white">{progressPercent}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden bg-white/10">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-[#3572b9] to-[#38b6ff] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        {completedSteps === steps.length && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400/20 text-yellow-400 font-semibold flex-shrink-0">
            <Star size={18} fill="currentColor" />
            {t('allComplete')}
          </div>
        )}
      </div>

      {/* Steps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Link
              key={step.number}
              to={createPageUrl(step.link)}
              className={`relative overflow-hidden rounded-2xl p-5 transition-all duration-300 
                hover:scale-[1.02] hover:shadow-xl group border
                ${step.completed 
                  ? 'bg-green-500/10 border-green-500/20'
                  : step.highlight
                    ? 'bg-[#38b6ff]/5 border-[#38b6ff]/30 hover:border-[#38b6ff]/60'
                    : 'bg-white/5 border-white/10 hover:border-[#38b6ff]/30'
                }`}
            >
              <div className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                ${step.completed 
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-white/10 text-gray-400'}`}>
                {step.completed ? '✓' : `+${step.xp} XP`}
              </div>

              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${step.color} 
                flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                <Icon size={22} className="text-white" />
              </div>

              <div className="text-xs mb-1 text-gray-500">{t('stepLabel')} {step.number}</div>
              <h3 className="font-semibold text-sm mb-1 text-white">{step.title}</h3>
              <p className="text-xs text-gray-400">{step.description}</p>

              <div className="flex items-center gap-1 mt-3 text-[#38b6ff] text-xs font-medium 
                opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span>{step.completed ? t('viewBtn') : t('getStartedBtn')}</span>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}