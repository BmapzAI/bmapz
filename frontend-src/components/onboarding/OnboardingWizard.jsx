import React, { useState, useEffect } from 'react';

import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Building2, Target, GitBranch, Zap, ChevronRight, ChevronLeft,
  Check, Sparkles, X, ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';

const STEPS = [
  {
    id: 'welcome',
    icon: Sparkles,
    title: 'Welcome to BMAPZ!',
    subtitle: "Let's get you set up in just a few minutes.",
    color: 'from-[#3572b9] to-[#38b6ff]',
  },
  {
    id: 'company',
    icon: Building2,
    title: 'Tell us about your company',
    subtitle: 'This helps the AI personalize all outputs for your brand.',
    color: 'from-[#38b6ff] to-[#00e7ff]',
  },
  {
    id: 'icp',
    icon: Target,
    title: 'Define your ideal customer',
    subtitle: 'Help the AI qualify and score your leads automatically.',
    color: 'from-[#cb6ce6] to-[#38b6ff]',
  },
  {
    id: 'done',
    icon: Check,
    title: "You're all set!",
    subtitle: 'Your workspace is ready. Explore the platform.',
    color: 'from-[#22c55e] to-[#38b6ff]',
  },
];

const STORAGE_KEY = 'bmapz_onboarding_complete';

export default function OnboardingWizard() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [companyForm, setCompanyForm] = useState({ name: '', website: '', industry: '', services_description: '' });
  const [icpForm, setIcpForm] = useState({ primary_audience: '', pain_points_text: '', budget_range: '' });
  const { company, refreshCompany } = useAuth();

  useEffect(() => {
    // Show only if not completed before and no company set up yet
    const done = localStorage.getItem(STORAGE_KEY);
    if (done) return;
    if (company && company.name) {
      // Company exists — skip onboarding
      localStorage.setItem(STORAGE_KEY, '1');
      return;
    }
    // No company yet — show wizard after short delay
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, [company]);

  const saveMutation = useMutation({
    mutationFn: (data) => api.post('/api/companies', data),
    onSuccess: () => refreshCompany(),
  });

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  const handleNext = async () => {
    if (step === 2) {
      // Save company + ICP
      await saveMutation.mutateAsync({
        name: companyForm.name || 'My Company',
        website: companyForm.website,
        industry: companyForm.industry,
        services_description: companyForm.services_description,
        icp: {
          primary_audience: icpForm.primary_audience,
          pain_points: icpForm.pain_points_text ? icpForm.pain_points_text.split(',').map(s => s.trim()) : [],
          budget_range: icpForm.budget_range,
        }
      });
      toast.success('Company profile saved!');
    }
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  if (!visible) return null;

  const currentStep = STEPS[step];
  const Icon = currentStep.icon;
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-[#111] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-[#3572b9] to-[#38b6ff] transition-all duration-500"
            style={{ width: `${((step) / (STEPS.length - 1)) * 100}%` }}
          />
        </div>

        {/* Close button */}
        {!isLast && (
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors z-10"
          >
            <X size={16} />
          </button>
        )}

        <div className="p-8">
          {/* Step icon */}
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${currentStep.color} flex items-center justify-center mb-6 shadow-lg`}>
            <Icon size={28} className="text-white" />
          </div>

          {/* Step indicator */}
          <div className="flex gap-1.5 mb-4">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'bg-[#38b6ff] w-6' : i < step ? 'bg-[#38b6ff]/50 w-3' : 'bg-white/10 w-3'}`} />
            ))}
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">{currentStep.title}</h2>
          <p className="text-gray-400 text-sm mb-8">{currentStep.subtitle}</p>

          {/* Step content */}
          {step === 0 && (
            <div className="space-y-3">
              {[
                { icon: Building2, text: 'Set up your company profile & brand voice' },
                { icon: Target, text: 'Define your Ideal Customer Profile (ICP)' },
                { icon: GitBranch, text: 'Launch your first AI-powered workflow' },
                { icon: Zap, text: 'Connect your channels (WhatsApp, Email, LinkedIn)' },
              ].map(({ icon: I, text }, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-[#38b6ff]/15 flex items-center justify-center flex-shrink-0">
                    <I size={15} className="text-[#38b6ff]" />
                  </div>
                  <span className="text-sm text-gray-300">{text}</span>
                </div>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-gray-400 text-sm">Company Name *</Label>
                <Input
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm(p => ({ ...p, name: e.target.value }))}
                  className="mt-1.5 bg-black/30 border-white/10 text-white"
                  placeholder="e.g., Acme Corp"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Website</Label>
                <Input
                  value={companyForm.website}
                  onChange={(e) => setCompanyForm(p => ({ ...p, website: e.target.value }))}
                  className="mt-1.5 bg-black/30 border-white/10 text-white"
                  placeholder="https://yourcompany.com"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Industry / Niche</Label>
                <Input
                  value={companyForm.industry}
                  onChange={(e) => setCompanyForm(p => ({ ...p, industry: e.target.value }))}
                  className="mt-1.5 bg-black/30 border-white/10 text-white"
                  placeholder="e.g., SaaS, Marketing Agency, E-commerce"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">What do you sell?</Label>
                <Textarea
                  value={companyForm.services_description}
                  onChange={(e) => setCompanyForm(p => ({ ...p, services_description: e.target.value }))}
                  className="mt-1.5 bg-black/30 border-white/10 text-white min-h-[80px]"
                  placeholder="Briefly describe your main product or service..."
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label className="text-gray-400 text-sm">Describe your ideal customer</Label>
                <Textarea
                  value={icpForm.primary_audience}
                  onChange={(e) => setIcpForm(p => ({ ...p, primary_audience: e.target.value }))}
                  className="mt-1.5 bg-black/30 border-white/10 text-white min-h-[80px]"
                  placeholder="e.g., B2B SaaS founders with 10-50 employees, focused on growth..."
                />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Main pain points (comma-separated)</Label>
                <Input
                  value={icpForm.pain_points_text}
                  onChange={(e) => setIcpForm(p => ({ ...p, pain_points_text: e.target.value }))}
                  className="mt-1.5 bg-black/30 border-white/10 text-white"
                  placeholder="e.g., Low lead quality, no time for outreach, poor conversion"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Typical budget range</Label>
                <Input
                  value={icpForm.budget_range}
                  onChange={(e) => setIcpForm(p => ({ ...p, budget_range: e.target.value }))}
                  className="mt-1.5 bg-black/30 border-white/10 text-white"
                  placeholder="e.g., $5,000 – $50,000 / year"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              {[
                { label: 'Add your first lead', path: 'Sales', desc: 'Import or create leads manually' },
                { label: 'Build a workflow', path: 'Workflows', desc: 'Automate your outreach sequences' },
                { label: 'Connect integrations', path: 'Integrations', desc: 'Link WhatsApp, Email, LinkedIn' },
                { label: 'Chat with AI Agent', path: 'AIChat', desc: 'Generate messages, strategies & more' },
              ].map(({ label, path, desc }) => (
                <Link key={path} to={createPageUrl(path)} onClick={dismiss}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-[#38b6ff]/30 hover:bg-[#38b6ff]/5 transition-all group">
                  <div>
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                  <ArrowRight size={16} className="text-gray-500 group-hover:text-[#38b6ff] group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-between mt-8">
            {!isFirst && !isLast ? (
              <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
                <ChevronLeft size={16} /> Back
              </button>
            ) : <div />}

            {isLast ? (
              <Button onClick={dismiss} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
                Go to Dashboard <ArrowRight size={16} />
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={saveMutation.isPending}
                className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2"
              >
                {saveMutation.isPending ? 'Saving...' : step === 0 ? "Let's go" : 'Continue'}
                <ChevronRight size={16} />
              </Button>
            )}
          </div>

          {!isLast && (
            <button onClick={dismiss} className="w-full text-center mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors">
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}