import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, XCircle, Loader2, Rocket, Info, ExternalLink } from 'lucide-react';
import { AdsManager } from '@/api/entities';
import { getPlatform, levelLabel } from '@shared/adPlatforms';

/**
 * Publish dialog.
 *
 * The user ticks which LEVELS to send — campaign, ad groups, ads — and the
 * dialog validates first, shows exactly what is wrong in plain language, and
 * only then publishes. Success is reported per item from the platform's real
 * response; nothing is ever announced as live without an id coming back.
 *
 * `allowedLevels` limits the tick boxes to what the current tab may publish:
 *   Campaign tab → campaign + ad groups + ads
 *   Ad Groups tab → ad groups + ads
 *   Ads tab → ads only
 */
export default function AdsPublishDialog({ open, onClose, campaign, allowedLevels = ['campaign', 'ad_groups', 'ads'], onPublished }) {
  const spec = getPlatform(campaign?.platform);
  const [levels, setLevels] = useState({});
  const [check, setCheck] = useState(null);
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (!open) { setCheck(null); setResults(null); return; }
    setLevels(Object.fromEntries(allowedLevels.map(l => [l, true])));
  }, [open, campaign?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const groupCount = campaign?.ad_groups?.length || 0;
  const adCount = (campaign?.ad_groups || []).reduce((n, g) => n + (g.ads?.length || 0), 0);

  const validateMut = useMutation({
    mutationFn: () => AdsManager.validate(campaign.id, levels),
    onSuccess: setCheck,
    onError: (e) => setCheck({ ok: false, problems: [{ level: 'campaign', name: '', message: e.message }] }),
  });

  const publishMut = useMutation({
    mutationFn: () => AdsManager.publish(campaign.id, levels),
    onSuccess: (out) => { setResults(out); onPublished?.(out); },
    onError: (e) => setResults({ results: [], published: 0, failed: 1, fatal: e.message }),
  });

  // Re-validate whenever the chosen levels change.
  useEffect(() => {
    if (open && campaign?.id && Object.values(levels).some(Boolean)) validateMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaign?.id, levels.campaign, levels.ad_groups, levels.ads]);

  if (!campaign || !spec) return null;

  const LEVEL_META = {
    campaign: { label: levelLabel(spec.key, 'campaign'), count: 1, hint: 'Objective, budget and schedule' },
    ad_groups: { label: `${levelLabel(spec.key, 'ad_group')}s`, count: groupCount, hint: 'Audience targeting and bidding' },
    ads: { label: `${levelLabel(spec.key, 'ad')}s`, count: adCount, hint: 'Creative and copy' },
  };

  const nothingChosen = !Object.values(levels).some(Boolean);
  const blocked = check && !check.ok;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg bg-[#111] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket size={18} className="text-[#38b6ff]" />
            Publish to {spec.label}
          </DialogTitle>
        </DialogHeader>

        {!results ? (
          <div className="space-y-4 py-1">
            <div>
              <p className="text-gray-400 text-xs mb-2">What should be sent?</p>
              <div className="space-y-1.5">
                {allowedLevels.map(key => {
                  const m = LEVEL_META[key];
                  const disabled = m.count === 0;
                  return (
                    <label key={key}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border ${disabled
                        ? 'bg-black/10 border-white/5 opacity-50 cursor-not-allowed'
                        : 'bg-black/20 border-white/10 cursor-pointer hover:border-white/25'}`}>
                      <input type="checkbox" disabled={disabled}
                        checked={!!levels[key] && !disabled}
                        onChange={(e) => setLevels(l => ({ ...l, [key]: e.target.checked }))}
                        className="w-4 h-4 accent-[#38b6ff] mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-white text-sm">{m.label} <span className="text-gray-500">({m.count})</span></span>
                        <p className="text-gray-500 text-xs">{disabled ? 'Nothing to publish at this level yet.' : m.hint}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Currency: the number is applied as-is by the platform. */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle size={15} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-gray-300 text-xs">
                Budgets are sent as a plain number. They are charged in the currency your
                {' '}{spec.short} ad account is set to — Bmapz does not convert it. Check your account before publishing.
              </p>
            </div>

            {validateMut.isPending && (
              <p className="text-gray-400 text-xs flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Checking…</p>
            )}

            {check && !check.connected && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <XCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 text-xs font-medium">Not connected</p>
                  <p className="text-gray-300 text-xs mt-0.5">{check.connectionMessage}</p>
                  <a href="/Integrations" className="text-[#38b6ff] text-xs inline-flex items-center gap-1 mt-1 hover:underline">
                    Open Integrations <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            )}

            {check?.problems?.length > 0 && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 max-h-40 overflow-y-auto">
                <p className="text-red-300 text-xs font-medium mb-1.5">Fix these before publishing:</p>
                <ul className="space-y-1">
                  {check.problems.map((p, i) => (
                    <li key={i} className="text-gray-300 text-xs">
                      <span className="text-gray-500 capitalize">{p.level.replace('_', ' ')}{p.name ? ` · ${p.name}` : ''}: </span>
                      {p.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {check?.ok && (
              <p className="text-green-400 text-xs flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Everything checks out — ready to publish.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose} className="border-white/10 text-white">Cancel</Button>
              <Button
                onClick={() => publishMut.mutate()}
                disabled={nothingChosen || blocked || publishMut.isPending || validateMut.isPending}
                className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2"
              >
                {publishMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
                Publish
              </Button>
            </div>
          </div>
        ) : (
          /* ── Real, per-item outcome ── */
          <div className="space-y-3 py-1">
            <div className={`flex items-start gap-2 p-3 rounded-xl border ${results.failed
              ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
              <Info size={15} className={results.failed ? 'text-yellow-400 mt-0.5' : 'text-green-400 mt-0.5'} />
              <p className="text-gray-200 text-xs">
                {results.fatal
                  ? results.fatal
                  : `${results.published} item(s) published${results.failed ? `, ${results.failed} failed` : ''}.`}
              </p>
            </div>

            {results.results?.length > 0 && (
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {results.results.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-black/20 border border-white/5">
                    {r.ok
                      ? <CheckCircle2 size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                      : <XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <p className="text-white text-xs truncate">
                        <span className="text-gray-500 capitalize">{r.level.replace('_', ' ')}: </span>{r.name}
                      </p>
                      {r.ok
                        ? <p className="text-gray-500 text-[10px]">Live · id {r.external_id}</p>
                        : <p className="text-red-300 text-[10px]">{r.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              {results.failed > 0 && (
                <Button variant="outline" onClick={() => { setResults(null); validateMut.mutate(); }}
                  className="border-white/10 text-white">Try again</Button>
              )}
              <Button onClick={onClose} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
