import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { 
  Building2, User, Mail, Phone, Globe, Linkedin, 
  ChevronRight, ChevronLeft, Check, X, ChevronDown,
  MessageSquare, TrendingUp, ExternalLink, Crown
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LeadQualification({ leads, stages, onAdvance, onDisqualify }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [exitX, setExitX] = useState(0);
  const constraintsRef = useRef(null);

  const currentLead = leads[currentIndex];

  // Swipe motion values
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  const leftIndicatorOpacity = useTransform(x, [-100, 0], [1, 0]);
  const rightIndicatorOpacity = useTransform(x, [0, 100], [0, 1]);

  const handleDragEnd = (event, info) => {
    if (info.offset.x > 100) {
      // Swiped right - advance
      setExitX(300);
      handleSwipe('right');
    } else if (info.offset.x < -100) {
      // Swiped left - disqualify
      setExitX(-300);
      handleSwipe('left');
    }
  };

  const handleSwipe = (dir) => {
    if (!currentLead) return;
    
    if (dir === 'right') {
      // Move to next stage
      const currentStageIndex = stages.findIndex(s => s.id === currentLead.funnel_stage);
      const nextStage = stages[currentStageIndex + 1];
      if (nextStage) {
        onAdvance(currentLead.id, nextStage.id);
      }
    } else if (dir === 'left') {
      // Disqualify
      onDisqualify(currentLead.id);
    }
    
    setDirection(dir === 'right' ? 1 : -1);
    setTimeout(() => {
      if (currentIndex < leads.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setExitX(0);
      }
    }, 300);
  };

  const handleNext = () => {
    if (currentIndex < leads.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (!currentLead) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#3572b9]/20 to-[#cb6ce6]/20 
          flex items-center justify-center mb-4">
          <Check size={40} className="text-green-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">All caught up!</h3>
        <p className="text-gray-400">No more leads to review</p>
      </div>
    );
  }

  const currentStage = stages.find(s => s.id === currentLead.funnel_stage);
  const currentStageIndex = stages.findIndex(s => s.id === currentLead.funnel_stage);
  const nextStage = stages[currentStageIndex + 1];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-between mb-6 text-sm text-gray-400">
        <span>{currentIndex + 1} of {leads.length} leads</span>
        <div className="flex items-center gap-2">
          <span>Current Stage:</span>
          <span className="px-3 py-1 rounded-full text-white" 
            style={{ backgroundColor: currentStage?.color }}>
            {currentStage?.name}
          </span>
        </div>
      </div>

      {/* Swipe Indicators */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-8 pointer-events-none z-10">
        <motion.div 
          style={{ opacity: leftIndicatorOpacity }}
          className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center"
        >
          <X size={40} className="text-red-500" />
        </motion.div>
        <motion.div 
          style={{ opacity: rightIndicatorOpacity }}
          className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center"
        >
          <Check size={40} className="text-green-500" />
        </motion.div>
      </div>

      {/* Card */}
      <div ref={constraintsRef} className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentLead.id}
            drag="x"
            dragConstraints={constraintsRef}
            onDragEnd={handleDragEnd}
            initial={{ opacity: 0, x: direction * 100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, x: exitX, scale: 0.95, rotate: exitX > 0 ? 10 : -10 }}
            transition={{ duration: 0.3 }}
            style={{ x, rotate, opacity }}
            whileDrag={{ cursor: 'grabbing' }}
            className="relative rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#111111] 
              border border-white/10 overflow-hidden cursor-grab touch-none select-none"
          >
          {/* Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3572b9] to-[#cb6ce6] 
                flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                {currentLead.lead_company_name?.[0]?.toUpperCase() || 'L'}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white">{currentLead.lead_company_name}</h2>
                {currentLead.lead_name && (
                  <p className="text-gray-400 flex items-center gap-2 mt-1">
                    <User size={16} />
                    {currentLead.lead_name}
                    {currentLead.role && <span className="text-gray-500">• {currentLead.role}</span>}
                    {currentLead.is_decision_maker && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">
                        <Crown size={12} />
                        Decision Maker
                      </span>
                    )}
                  </p>
                )}
              </div>
              
              {currentLead.icp_score && (
                <div className="text-right">
                  <div className="text-sm text-gray-400">ICP Score</div>
                  <div className={`text-2xl font-bold ${
                    currentLead.icp_score >= 70 ? 'text-green-400' :
                    currentLead.icp_score >= 40 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {currentLead.icp_score}%
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contact Info */}
          <div className="p-6 grid grid-cols-2 gap-4 border-b border-white/10">
            {currentLead.email && (
              <a href={`mailto:${currentLead.email}`} 
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <Mail size={18} className="text-[#38b6ff]" />
                <span className="text-white truncate">{currentLead.email}</span>
              </a>
            )}
            {currentLead.phone && (
              <a href={`tel:${currentLead.phone}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <Phone size={18} className="text-green-400" />
                <span className="text-white">{currentLead.phone}</span>
              </a>
            )}
            {currentLead.company_website && (
              <a href={currentLead.company_website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <Globe size={18} className="text-[#00e7ff]" />
                <span className="text-white truncate">{currentLead.company_website}</span>
                <ExternalLink size={14} className="text-gray-400" />
              </a>
            )}
            {currentLead.linkedin_profile && (
              <a href={currentLead.linkedin_profile} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <Linkedin size={18} className="text-[#0077b5]" />
                <span className="text-white truncate">LinkedIn Profile</span>
                <ExternalLink size={14} className="text-gray-400" />
              </a>
            )}
          </div>

          {/* AI Analysis */}
          {currentLead.digital_presence_analysis && (
            <div className="p-6 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-[#cb6ce6]" />
                AI Analysis
              </h3>
              <p className="text-gray-300 mb-4">{currentLead.digital_presence_analysis.summary}</p>
              
              <div className="grid grid-cols-2 gap-4">
                {currentLead.digital_presence_analysis.opportunities?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-green-400 mb-2">Opportunities</h4>
                    <ul className="space-y-1">
                      {currentLead.digital_presence_analysis.opportunities.slice(0, 3).map((opp, i) => (
                        <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                          <span className="text-green-400">•</span>
                          {opp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {currentLead.digital_presence_analysis.gaps?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-yellow-400 mb-2">Gaps Identified</h4>
                    <ul className="space-y-1">
                      {currentLead.digital_presence_analysis.gaps.slice(0, 3).map((gap, i) => (
                        <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                          <span className="text-yellow-400">•</span>
                          {gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {currentLead.notes && (
            <div className="p-6 border-b border-white/10">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Notes</h3>
              <p className="text-white">{currentLead.notes}</p>
            </div>
          )}

          {/* Estimated Value */}
          {currentLead.estimated_value && (
            <div className="p-6 bg-gradient-to-r from-[#cb6ce6]/10 to-transparent">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Estimated Deal Value</span>
                <span className="text-2xl font-bold text-[#cb6ce6]">
                  ${currentLead.estimated_value.toLocaleString()}
                </span>
              </div>
            </div>
          )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Swipe Instructions */}
      <div className="text-center mt-4 text-sm text-gray-500">
        Swipe right to advance • Swipe left to disqualify
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-6 mt-8">
        <Button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          variant="outline"
          size="icon"
          className="w-12 h-12 rounded-full border-white/20 text-white hover:bg-white/10 disabled:opacity-30"
        >
          <ChevronLeft size={24} />
        </Button>

        <Button
          onClick={() => handleSwipe('left')}
          className="w-16 h-16 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 
            hover:text-red-300 transition-all duration-300 hover:scale-110"
        >
          <X size={28} />
        </Button>

        <Button
          onClick={() => setCurrentIndex(prev => Math.min(prev + 1, leads.length - 1))}
          className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 text-white 
            transition-all duration-300"
        >
          <ChevronDown size={24} />
        </Button>

        <Button
          onClick={() => handleSwipe('right')}
          disabled={!nextStage}
          className="w-16 h-16 rounded-full bg-green-500/20 hover:bg-green-500/40 text-green-400 
            hover:text-green-300 transition-all duration-300 hover:scale-110 disabled:opacity-30"
        >
          <Check size={28} />
        </Button>

        <Button
          onClick={handleNext}
          disabled={currentIndex >= leads.length - 1}
          variant="outline"
          size="icon"
          className="w-12 h-12 rounded-full border-white/20 text-white hover:bg-white/10 disabled:opacity-30"
        >
          <ChevronRight size={24} />
        </Button>
      </div>

      {/* Action Labels */}
      <div className="flex items-center justify-center gap-20 mt-4 text-sm text-gray-400">
        <span>Disqualify</span>
        <span>Skip</span>
        <span>{nextStage ? `Move to ${nextStage.name}` : 'Final Stage'}</span>
      </div>
    </div>
  );
}