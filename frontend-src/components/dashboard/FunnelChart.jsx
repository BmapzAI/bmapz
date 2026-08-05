import React from 'react';
import { useLanguage } from '@/components/ui/LanguageContext';

export default function FunnelChart({ stages, leads, onStageClick }) {
  const { t } = useLanguage();

  const defaultStages = [
    { id: 'awareness', name: t('awareness'), color: '#38b6ff' },
    { id: 'lead_capture', name: t('leadCapture'), color: '#3572b9' },
    { id: 'prospect', name: t('prospect'), color: '#00e7ff' },
    { id: 'mql', name: t('mql'), color: '#38b6ff' },
    { id: 'sql', name: t('sql'), color: '#3572b9' },
    { id: 'opportunity', name: t('opportunity'), color: '#cb6ce6' },
    { id: 'customer', name: t('customer'), color: '#38b6ff' },
  ];

  const stageData = stages || defaultStages;

  const getLeadsInStage = (stageId) => {
    return leads?.filter(l => l.funnel_stage === stageId)?.length || 0;
  };

  const maxLeads = Math.max(...stageData.map(s => getLeadsInStage(s.id)), 1);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 mb-1">
        Each bar shows the number of leads currently at that funnel stage. The longest bar is the reference (100%).
        {onStageClick ? ' Click a stage to see its leads.' : ''}
      </p>
      {stageData.map((stage) => {
        const count = getLeadsInStage(stage.id);
        const percentage = maxLeads > 0 ? (count / maxLeads) * 100 : 0;

        return (
          <div key={stage.id} className="group">
            <div
              className={`flex items-center gap-4 rounded-lg ${onStageClick && count > 0 ? 'cursor-pointer hover:bg-white/5 -mx-2 px-2 py-0.5 transition-colors' : ''}`}
              onClick={onStageClick && count > 0 ? () => onStageClick(stage.id, stage.name, count) : undefined}
              role={onStageClick && count > 0 ? 'button' : undefined}
              tabIndex={onStageClick && count > 0 ? 0 : undefined}
              onKeyDown={onStageClick && count > 0 ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStageClick(stage.id, stage.name, count); } } : undefined}
            >
              <span className="text-sm font-medium w-28 truncate text-gray-400">{stage.name}</span>
              <div className="flex-1 h-7 rounded-lg overflow-hidden relative bg-white/5">
                <div 
                  className="h-full rounded-lg transition-all duration-500 ease-out relative overflow-hidden"
                  style={{ 
                    width: `${Math.max(percentage, 5)}%`,
                    background: `linear-gradient(90deg, ${stage.color}cc, ${stage.color}66)`
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 
                    translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                </div>
              </div>
              <span className="font-semibold text-sm w-8 text-right text-white">{count}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}