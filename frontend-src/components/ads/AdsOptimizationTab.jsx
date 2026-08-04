import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Zap, Loader2, Target, Wallet, Image as ImageIcon, PenLine, Gauge,
  LayoutGrid, MousePointerClick, BarChart3, CalendarClock, Users2, AlertCircle, FlaskConical,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdsManager } from '@/api/entities';

/**
 * Optimisation review.
 *
 * The previous version only ever produced budget reallocations, and called an
 * endpoint contract that did not exist (`recommendations` / `auto_apply` were
 * never implemented server-side), so it could not work at all.
 *
 * It now asks the backend for a full-funnel audit — targeting, creative, copy,
 * bidding, structure, landing page, measurement, scheduling and audience
 * expansion — grounded in the actual campaign and, when connected, live data.
 */

const CATEGORY = {
  budget:             { label: 'Budget',        Icon: Wallet,             tone: 'text-green-400 bg-green-500/10 border-green-500/20' },
  targeting:          { label: 'Targeting',     Icon: Target,             tone: 'text-[#38b6ff] bg-[#38b6ff]/10 border-[#38b6ff]/20' },
  creative:           { label: 'Creative',      Icon: ImageIcon,          tone: 'text-[#cb6ce6] bg-[#cb6ce6]/10 border-[#cb6ce6]/20' },
  copy:               { label: 'Copy',          Icon: PenLine,            tone: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  bidding:            { label: 'Bidding',       Icon: Gauge,              tone: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  structure:          { label: 'Structure',     Icon: LayoutGrid,         tone: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  landing_page:       { label: 'Landing page',  Icon: MousePointerClick,  tone: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  measurement:        { label: 'Measurement',   Icon: BarChart3,          tone: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  schedule:           { label: 'Scheduling',    Icon: CalendarClock,      tone: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  audience_expansion: { label: 'Audience',      Icon: Users2,             tone: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
};

const IMPACT = {
  high:   'text-green-400 bg-green-500/10 border-green-500/20',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  low:    'text-gray-400 bg-white/5 border-white/10',
};

export default function AdsOptimizationTab({ realAdData }) {
  const [campaignId, setCampaignId] = useState('');
  const [review, setReview] = useState(null);

  const { data: campaigns = [] } = useQuery({
    queryKey: ['adCampaignTree'],
    queryFn: () => AdsManager.listCampaigns(),
    retry: false,
  });

  const run = useMutation({
    mutationFn: () => AdsManager.optimize({
      campaign_id: campaignId || undefined,
      performance: realAdData || undefined,
    }),
    onSuccess: (r) => {
      setReview(r);
      toast.success(`${r.recommendations?.length || 0} recommendation(s) ready`);
    },
    onError: (e) => toast.error(`Could not run the review: ${e.message}`),
  });

  const recs = review?.recommendations || [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Zap size={17} className="text-[#cb6ce6]" /> Optimisation review
            </h3>
            <p className="text-gray-400 text-sm mt-1 max-w-xl">
              A full-funnel audit — targeting, creative, copy, bidding, structure, landing page,
              measurement and scheduling — not just where to move budget.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="text-gray-400 text-xs block mb-1">Campaign</label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger className="w-56 h-9 bg-black/30 border-white/10 text-white text-xs">
                  <SelectValue placeholder="Whole account" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => run.mutate()} disabled={run.isPending}
              className="bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2 h-9">
              {run.isPending ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
              Review
            </Button>
          </div>
        </div>

        {!realAdData && (
          <div className="mt-3 flex items-start gap-2 p-2.5 rounded-xl bg-black/20 border border-white/10">
            <AlertCircle size={14} className="text-gray-500 flex-shrink-0 mt-0.5" />
            <p className="text-gray-400 text-xs">
              No live performance data is connected, so the review covers structure and best practice.
              Connect an ad account to have it judged against real numbers.
            </p>
          </div>
        )}
      </div>

      {review && (
        <>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="flex items-start gap-3">
              {typeof review.health_score === 'number' && (
                <div className="text-center flex-shrink-0">
                  <div className="text-2xl font-bold text-white">{Math.round(review.health_score)}</div>
                  <div className="text-gray-500 text-[10px]">health</div>
                </div>
              )}
              <p className="text-gray-300 text-sm">{review.summary}</p>
            </div>
          </div>

          <div className="space-y-2">
            {recs.map((r, i) => {
              const cat = CATEGORY[r.category] || CATEGORY.structure;
              const { Icon } = cat;
              return (
                <div key={i} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${cat.tone}`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white text-sm font-medium">{r.title}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${cat.tone}`}>{cat.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${IMPACT[r.impact] || IMPACT.low}`}>
                          {r.impact} impact
                        </span>
                        <span className="text-[10px] text-gray-500">{r.effort} effort</span>
                        {r.target && <span className="text-[10px] text-gray-500 truncate">· {r.target}</span>}
                      </div>
                      <p className="text-gray-400 text-xs mt-1.5"><span className="text-gray-500">Why: </span>{r.why}</p>
                      <p className="text-gray-300 text-xs mt-1"><span className="text-gray-500">Do this: </span>{r.how}</p>
                      {r.expected_effect && (
                        <p className="text-green-400/80 text-[11px] mt-1">Expected: {r.expected_effect}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {review.tests_to_run?.length > 0 && (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="text-white text-sm font-medium flex items-center gap-2 mb-2">
                <FlaskConical size={15} className="text-[#38b6ff]" /> Worth testing next
              </p>
              <ul className="space-y-1">
                {review.tests_to_run.map((t, i) => <li key={i} className="text-gray-400 text-xs">• {t}</li>)}
              </ul>
            </div>
          )}

          {review.risks?.length > 0 && (
            <div className="rounded-2xl bg-yellow-500/5 border border-yellow-500/20 p-4">
              <p className="text-yellow-400 text-sm font-medium flex items-center gap-2 mb-2">
                <AlertCircle size={15} /> Watch out for
              </p>
              <ul className="space-y-1">
                {review.risks.map((t, i) => <li key={i} className="text-gray-400 text-xs">• {t}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
