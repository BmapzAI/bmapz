import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Lightbulb } from 'lucide-react';

/**
 * QuickStartGuide — shows a dismissable bubble the first time a user visits a page/feature.
 *
 * Usage:
 *   <QuickStartGuide
 *     id="social_media_planning"     // unique key stored in localStorage
 *     title="Content Planning"
 *     steps={[
 *       "Use the calendar to schedule posts by clicking on any day.",
 *       "Generate AI content by describing your post idea above.",
 *       "Double-click any post to edit it quickly.",
 *     ]}
 *   />
 */
export default function QuickStartGuide({ id, title, steps = [] }) {
  const storageKey = `qsg_dismissed_${id}`;
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(storageKey)) {
      setVisible(true);
    }
  }, [storageKey]);

  const dismiss = () => {
    localStorage.setItem(storageKey, '1');
    setVisible(false);
  };

  if (!visible || steps.length === 0) return null;

  const isLast = step === steps.length - 1;

  return (
    <div className="relative rounded-2xl border border-[#38b6ff]/30 bg-gradient-to-r from-[#3572b9]/10 to-[#38b6ff]/10 p-4 pr-10 mb-4 shadow-lg shadow-[#38b6ff]/10 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Dismiss button */}
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
        title="Dismiss"
      >
        <X size={12} />
      </button>

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-[#38b6ff]/20 flex items-center justify-center flex-shrink-0">
          <Lightbulb size={12} className="text-[#38b6ff]" />
        </div>
        <span className="text-[#38b6ff] text-xs font-semibold uppercase tracking-wide">{title}</span>
        <span className="ml-auto text-gray-500 text-[10px]">{step + 1}/{steps.length}</span>
      </div>

      {/* Step dots */}
      <div className="flex gap-1 mb-2">
        {steps.map((_, i) => (
          <div
            key={i}
            onClick={() => setStep(i)}
            className={`h-1 rounded-full cursor-pointer transition-all ${i === step ? 'bg-[#38b6ff] w-4' : i < step ? 'bg-[#38b6ff]/40 w-2' : 'bg-white/10 w-2'}`}
          />
        ))}
      </div>

      {/* Step content */}
      <p className="text-gray-300 text-sm leading-relaxed">{steps[step]}</p>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-3">
        <button
          onClick={dismiss}
          className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
        >
          Got it, skip
        </button>
        {isLast ? (
          <button
            onClick={dismiss}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#38b6ff] text-black text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            Got it! <X size={10} />
          </button>
        ) : (
          <button
            onClick={() => setStep(s => s + 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#38b6ff]/20 text-[#38b6ff] text-xs font-medium hover:bg-[#38b6ff]/30 transition-colors"
          >
            Next <ChevronRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}