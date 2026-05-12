import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Check, Save, BookOpen, Loader2 } from 'lucide-react';
import { PLATFORM_GUIDES } from './AdsGuideModal';
import AIContextField from '@/components/ui/AIContextField';

const PLATFORMS = ['Meta (Facebook/Instagram)', 'TikTok', 'X (Twitter)', 'LinkedIn', 'Google Ads'];

export default function AdsStrategyForm({ form, setForm, company, isGenerating, onGenerate, onSave, isSaving, onOpenGuide, hasStrategy }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Sparkles size={18} className="text-[#38b6ff]" /> Strategy Builder
        </h3>
        {company && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 flex items-center gap-1">
            <Check size={10} /> Auto-filled
          </span>
        )}
      </div>
      <div>
        <label className="text-gray-400 text-sm">Campaign Objective *</label>
        <Select value={form.objective} onValueChange={(v) => setForm(p => ({ ...p, objective: v }))}>
          <SelectTrigger className="mt-1.5 bg-black/30 border-white/10 text-white"><SelectValue placeholder="Select objective" /></SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            {['Lead Generation', 'Direct Sales', 'Brand Awareness', 'App Installs', 'Retargeting', 'Scaling'].map(o => (
              <SelectItem key={o} value={o.toLowerCase()} className="text-white">{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
        <label className="text-gray-400 text-sm">Monthly Budget</label>
        <Input value={form.budget} onChange={(e) => setForm(p => ({ ...p, budget: e.target.value }))}
          placeholder="e.g., $5,000" className="mt-1.5 bg-black/30 border-white/10 text-white" />
      </div>
      <div>
        <label className="text-gray-400 text-sm">Product / Service</label>
        <Textarea value={form.product} onChange={(e) => setForm(p => ({ ...p, product: e.target.value }))}
          placeholder="Describe your product..." className="mt-1.5 bg-black/30 border-white/10 text-white min-h-[70px]" />
      </div>
      <div>
        <label className="text-gray-400 text-sm">Target Audience</label>
        <Input value={form.audience} onChange={(e) => setForm(p => ({ ...p, audience: e.target.value }))}
          placeholder="e.g., Marketing directors at B2B SaaS..." className="mt-1.5 bg-black/30 border-white/10 text-white" />
      </div>
      <div>
        <label className="text-gray-400 text-sm">Main Differentiator</label>
        <Input value={form.differentiator} onChange={(e) => setForm(p => ({ ...p, differentiator: e.target.value }))}
          placeholder="What makes you different?" className="mt-1.5 bg-black/30 border-white/10 text-white" />
      </div>
      <div>
        <AIContextField
          value={form.extra_context || ''}
          onChange={(val) => setForm(p => ({ ...p, extra_context: val }))}
          placeholder="e.g., Launching a new product, seasonal promotion, target a new market, competitor insights, upcoming events..."
        />
      </div>
      <Button onClick={onGenerate} disabled={isGenerating} className="w-full bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        Generate Strategy
      </Button>
      {hasStrategy && (
        <div className="flex gap-2">
          <Button onClick={onSave} disabled={isSaving} variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/5 gap-2 text-xs">
            <Save size={14} /> Save
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