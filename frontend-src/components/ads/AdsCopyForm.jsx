import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Check, Sparkles, Save, BookOpen, Loader2 } from 'lucide-react';
import { PLATFORM_GUIDES } from './AdsGuideModal';
import AIContextField from '@/components/ui/AIContextField';

const PLATFORMS = ['Meta (Facebook/Instagram)', 'TikTok', 'X (Twitter)', 'LinkedIn', 'Google Ads'];

export default function AdsCopyForm({ form, setForm, company, strategy, isGenerating, onGenerate, onSave, isSaving, onOpenGuide, hasCopies }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <FileText size={18} className="text-[#cb6ce6]" /> Copy Generator
        </h3>
        {company && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 flex items-center gap-1">
            <Check size={10} /> Auto-filled
          </span>
        )}
      </div>
      {strategy && (
        <div className="p-3 rounded-xl bg-[#38b6ff]/10 border border-[#38b6ff]/20 text-xs text-[#38b6ff] flex items-start gap-2">
          <Sparkles size={14} className="flex-shrink-0 mt-0.5" />
          Strategy detected — copies will follow your strategy's hooks and angles.
        </div>
      )}
      <div>
        <label className="text-gray-400 text-sm">Platform</label>
        <Select value={form.platform} onValueChange={(v) => setForm(p => ({ ...p, platform: v }))}>
          <SelectTrigger className="mt-1.5 bg-black/30 border-white/10 text-white"><SelectValue placeholder="Select platform" /></SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            {PLATFORMS.map(pl => <SelectItem key={pl} value={pl} className="text-white">{pl}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-gray-400 text-sm">Primary Angle</label>
        <Select value={form.angle} onValueChange={(v) => setForm(p => ({ ...p, angle: v }))}>
          <SelectTrigger className="mt-1.5 bg-black/30 border-white/10 text-white"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            {['curiosity', 'belief_breaking', 'pain_driven', 'authority', 'social_proof', 'bold_claim'].map(a => (
              <SelectItem key={a} value={a} className="text-white capitalize">{a.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-gray-400 text-sm">Product / Service</label>
        <Textarea value={form.product} onChange={(e) => setForm(p => ({ ...p, product: e.target.value }))}
          placeholder="Describe what you're advertising..." className="mt-1.5 bg-black/30 border-white/10 text-white min-h-[80px]" />
      </div>
      <div>
        <label className="text-gray-400 text-sm">Target Audience</label>
        <Input value={form.audience} onChange={(e) => setForm(p => ({ ...p, audience: e.target.value }))}
          placeholder="Who are you targeting?" className="mt-1.5 bg-black/30 border-white/10 text-white" />
      </div>
      <div>
        <AIContextField
          value={form.extra_context || ''}
          onChange={(val) => setForm(p => ({ ...p, extra_context: val }))}
          placeholder="e.g., Emphasize urgency, use social proof, reference a specific pain point, seasonal promo, competitor comparison..."
        />
      </div>
      <Button onClick={onGenerate} disabled={isGenerating} className="w-full bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2">
        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {strategy ? 'Generate from Strategy' : 'Generate Ad Copies'}
      </Button>
      {hasCopies && (
        <div className="flex gap-2">
          <Button onClick={onSave} disabled={isSaving} variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/5 gap-2 text-xs">
            <Save size={14} /> Save Copies
          </Button>
          {form.platform && PLATFORM_GUIDES[form.platform] && (
            <Button onClick={() => onOpenGuide(form.platform)} variant="outline" className="flex-1 border-[#38b6ff]/30 text-[#38b6ff] hover:bg-[#38b6ff]/10 gap-2 text-xs">
              <BookOpen size={14} /> Setup Guide
            </Button>
          )}
        </div>
      )}
    </div>
  );
}