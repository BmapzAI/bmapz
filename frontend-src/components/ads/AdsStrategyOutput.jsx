import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Target, ChevronDown, ChevronUp, Edit3, Check } from 'lucide-react';

export default function AdsStrategyOutput({ strategy, setStrategy, company }) {
  const [expandedSection, setExpandedSection] = useState('business_analysis');
  const [editingSection, setEditingSection] = useState(null);
  const [editedContent, setEditedContent] = useState('');

  const startEditSection = (key, content) => { setEditingSection(key); setEditedContent(content); };

  const saveEditSection = (key) => {
    setStrategy(prev => {
      const updated = { ...prev };
      if (key === 'business_analysis') updated.business_analysis = editedContent;
      else if (key === 'optimization') updated.optimization = editedContent;
      return updated;
    });
    setEditingSection(null);
  };

  const strategySections = [
    { key: 'business_analysis', title: 'Business Context Analysis', content: strategy?.business_analysis || '', editable: true },
    { key: 'strategic_foundation', title: 'Strategic Foundation', content: strategy?.strategic_foundation ? `Unique Mechanism: ${strategy.strategic_foundation.unique_mechanism}\n\nPositioning: ${strategy.strategic_foundation.positioning}\n\nAngles:\n${strategy.strategic_foundation.angles?.map(a => `• ${a}`).join('\n')}` : '' },
    { key: 'funnel', title: 'Funnel Architecture', content: strategy?.funnel_architecture ? `TOF: ${strategy.funnel_architecture.tof}\n\nMOF: ${strategy.funnel_architecture.mof}\n\nBOF: ${strategy.funnel_architecture.bof}\n\nBudget Split: ${strategy.funnel_architecture.budget_split}` : '' },
    { key: 'creative', title: 'Creative Strategy', content: strategy?.creative_strategy ? `Hook Angles:\n${strategy.creative_strategy.hooks?.map(h => `• ${h}`).join('\n')}\n\nEmotional Appeals:\n${strategy.creative_strategy.emotional_appeals?.map(e => `• ${e}`).join('\n')}\n\nVisual Direction: ${strategy.creative_strategy.visual_direction}` : '' },
    { key: 'kpis', title: 'KPIs & Metrics', content: strategy?.kpis ? `Primary KPI: ${strategy.kpis.primary}\nSecondary KPI: ${strategy.kpis.secondary}\nTarget CPA: ${strategy.kpis.target_cpa}\nBreak-even ROAS: ${strategy.kpis.break_even_roas}\nScaling Trigger: ${strategy.kpis.scaling_trigger}` : '' },
    { key: 'optimization', title: 'Optimization Loop', content: strategy?.optimization || '', editable: true },
  ];

  if (!strategy) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-12 flex flex-col items-center justify-center text-center h-full">
        <Target size={48} className="text-gray-600 mb-4" />
        <h3 className="text-white font-semibold mb-2">No Strategy Generated Yet</h3>
        <p className="text-gray-400 text-sm max-w-sm">
          {company ? `✅ Using data from ${company.name}. Just select an objective and click Generate.` : 'Fill in the form and click Generate Strategy to get your AI-powered campaign strategy.'}
        </p>
        {!company && <p className="text-[#38b6ff] text-xs mt-2">💡 Fill in Settings → Company & ICP for one-click generation</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {strategySections.map(section => (
        <div key={section.key} className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          <button onClick={() => setExpandedSection(expandedSection === section.key ? null : section.key)}
            className="w-full flex items-center justify-between p-4 text-left">
            <span className="text-white font-medium">{section.title}</span>
            <div className="flex items-center gap-2">
              {section.editable && (
                <span onClick={(e) => { e.stopPropagation(); startEditSection(section.key, section.content); }}
                  className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white">
                  <Edit3 size={14} />
                </span>
              )}
              {expandedSection === section.key ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </div>
          </button>
          {expandedSection === section.key && (
            <div className="px-4 pb-4">
              {editingSection === section.key ? (
                <div className="space-y-2">
                  <Textarea value={editedContent} onChange={e => setEditedContent(e.target.value)}
                    className="bg-black/30 border-white/10 text-white min-h-[150px] text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEditSection(section.key)} className="bg-green-600 hover:bg-green-700 gap-1 text-xs"><Check size={12} />Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingSection(null)} className="border-white/10 text-white hover:bg-white/5 text-xs">Cancel</Button>
                  </div>
                </div>
              ) : (
                <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans">{section.content}</pre>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}