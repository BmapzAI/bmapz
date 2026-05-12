import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

/**
 * Reusable AI Context Field component.
 * Shows a collapsible textarea that passes extra context to AI generation prompts.
 *
 * Props:
 *   value: string
 *   onChange: (value: string) => void
 *   placeholder?: string
 *   label?: string
 *   defaultExpanded?: boolean
 */
export default function AIContextField({
  value,
  onChange,
  placeholder = 'e.g. Focus on our new product launch, target CMOs in SaaS, use a conversational tone, reference competitor X...',
  label = 'Extra context for AI (optional)',
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded || !!value);

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-all"
      >
        <span className="flex items-center gap-1.5">
          <Sparkles size={11} className={value ? 'text-[#38b6ff]' : 'text-gray-500'} />
          <span className={value ? 'text-[#38b6ff]' : ''}>{label}</span>
          {value && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#38b6ff]/20 text-[#38b6ff] text-[10px]">active</span>
          )}
        </span>
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder:text-gray-600 text-xs resize-none focus:outline-none focus:border-[#38b6ff]/50 transition-colors"
          />
          <p className="text-[10px] text-gray-600 mt-1">
            This context is injected into the AI prompt to make outputs more precise and tailored.
          </p>
        </div>
      )}
    </div>
  );
}