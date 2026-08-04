import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus, ChevronRight, ChevronDown, Rocket, Trash2, Pencil, Layers, Target, BookOpen,
  Megaphone, Loader2, Sparkles, CircleDot, AlertCircle, Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdsManager } from '@/api/entities';
import { getPlatform, levelLabel, TARGETING_FIELDS, validateLevel } from '@shared/adPlatforms';
import AdsPublishDialog from './AdsPublishDialog';

const STATE_STYLE = {
  local: { label: 'Draft', cls: 'text-gray-400 bg-white/5 border-white/10' },
  publishing: { label: 'Publishing…', cls: 'text-[#38b6ff] bg-[#38b6ff]/10 border-[#38b6ff]/20' },
  published: { label: 'Live', cls: 'text-green-400 bg-green-500/10 border-green-500/20' },
  failed: { label: 'Failed', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
  out_of_sync: { label: 'Changed', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
};

const StateChip = ({ state, error }) => {
  const s = STATE_STYLE[state] || STATE_STYLE.local;
  return (
    <span title={error || undefined}
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${s.cls}`}>
      <CircleDot size={8} /> {s.label}
    </span>
  );
};

/** Comma-separated text ↔ array, used for every tag-style targeting field. */
const tagsToText = (v) => (Array.isArray(v) ? v.join(', ') : (v || ''));
const textToTags = (t) => String(t || '').split(',').map(s => s.trim()).filter(Boolean);

/**
 * The Ads Manager: campaign → ad group → ad.
 *
 * `scope` decides which levels this tab may create and publish, so each tab does
 * exactly what its name says:
 *   'campaign'  → campaigns, ad groups and ads (publish all three)
 *   'ad_group'  → ad groups and ads
 *   'ad'        → ads only
 */
export default function AdsManagerTab({ scope = 'campaign' }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState({});
  const [editor, setEditor] = useState(null);   // { level, mode, parentId, entity, platform }
  const [publishFor, setPublishFor] = useState(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [copyFor, setCopyFor] = useState(null);      // { ad, group, campaign }
  const [strategyFor, setStrategyFor] = useState(null); // campaign

  const { data: platforms = [] } = useQuery({ queryKey: ['adPlatforms'], queryFn: () => AdsManager.platforms() });
  // Strategies available to build a campaign from (the level above the campaign).
  const { data: strategies = [] } = useQuery({
    queryKey: ['adStrategies'],
    queryFn: () => AdsManager.listStrategies(),
    retry: false,
  });
  const { data: campaigns = [], isLoading, error } = useQuery({
    queryKey: ['adCampaignTree'],
    queryFn: () => AdsManager.listCampaigns(),
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['adCampaignTree'] });
  const fail = (verb) => (e) => toast.error(`Could not ${verb}: ${e.message}`);

  const saveCampaign = useMutation({
    mutationFn: ({ id, data }) => (id ? AdsManager.updateCampaign(id, data) : AdsManager.createCampaign(data)),
    onSuccess: () => { toast.success('Campaign saved'); setEditor(null); refresh(); },
    onError: fail('save the campaign'),
  });
  const saveGroup = useMutation({
    mutationFn: ({ id, data }) => (id ? AdsManager.updateAdGroup(id, data) : AdsManager.createAdGroup(data)),
    onSuccess: () => { toast.success('Saved'); setEditor(null); refresh(); },
    onError: fail('save it'),
  });
  const saveAd = useMutation({
    mutationFn: ({ id, data }) => (id ? AdsManager.updateAd(id, data) : AdsManager.createAd(data)),
    onSuccess: () => { toast.success('Ad saved'); setEditor(null); refresh(); },
    onError: fail('save the ad'),
  });
  const removeIt = useMutation({
    mutationFn: ({ level, id }) => (level === 'campaign' ? AdsManager.deleteCampaign(id)
      : level === 'ad_group' ? AdsManager.deleteAdGroup(id) : AdsManager.deleteAd(id)),
    onSuccess: () => { toast.success('Deleted'); refresh(); },
    onError: fail('delete it'),
  });

  // Each level can be built from the one above it.
  const buildGroups = useMutation({
    mutationFn: (campaignId) => AdsManager.generateAdGroups(campaignId, { count: 3 }),
    onSuccess: (r, id) => { setExpanded(e => ({ ...e, [id]: true })); toast.success(`${r.ad_groups?.length || 0} ad group(s) created from this campaign`); refresh(); },
    onError: fail('build the ad groups'),
  });
  const buildAds = useMutation({
    mutationFn: (groupId) => AdsManager.generateAds(groupId, { count: 2 }),
    onSuccess: (r) => { toast.success(`${r.ads?.length || 0} ad(s) created from this ad group`); refresh(); },
    onError: fail('build the ads'),
  });

  if (error) {
    const pending = error.message?.includes('migration 015') || error.code === 'MIGRATION_PENDING';
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
        <AlertCircle size={28} className="text-yellow-400 mx-auto mb-3" />
        <p className="text-white font-medium">{pending ? 'Almost ready' : 'Could not load campaigns'}</p>
        <p className="text-gray-400 text-sm mt-1 max-w-md mx-auto">
          {pending
            ? 'The Ads tables still need to be created. Run migration 015 in Supabase and this section switches on.'
            : error.message}
        </p>
      </div>
    );
  }

  const scopedCampaigns = campaigns;

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            {scope === 'campaign' ? <Layers size={17} className="text-[#38b6ff]" />
              : scope === 'ad_group' ? <Target size={17} className="text-[#cb6ce6]" />
                : <Megaphone size={17} className="text-[#38b6ff]" />}
            {scope === 'campaign' ? 'Campaigns' : scope === 'ad_group' ? 'Ad Groups' : 'Ads'}
          </h3>
          <p className="text-gray-500 text-xs mt-0.5">
            {scope === 'campaign' && 'Everything lives here — publish campaigns, ad groups and ads together.'}
            {scope === 'ad_group' && 'Audience and bidding. Publishing here sends ad groups and their ads.'}
            {scope === 'ad' && 'The creative and copy. Publishing here sends the ads only.'}
          </p>
        </div>
        {scope === 'campaign' && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowGenerate(true)}
              className="border-[#cb6ce6]/40 bg-[#cb6ce6]/10 text-[#cb6ce6] hover:bg-[#cb6ce6]/20 gap-1.5">
              <Sparkles size={14} /> Build with AI
            </Button>
            <Button size="sm" onClick={() => setEditor({ level: 'campaign', mode: 'create', entity: {} })}
              className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1.5">
              <Plus size={14} /> New campaign
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#38b6ff]" /></div>
      ) : scopedCampaigns.length === 0 ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-10 text-center">
          <Layers size={30} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-300 text-sm">No campaigns yet.</p>
          <p className="text-gray-500 text-xs mt-1">
            Start from scratch, or let the AI build a full campaign from your Company Brain in one step.
          </p>
          {scope === 'campaign' && (
            <div className="flex gap-2 justify-center mt-4">
              <Button size="sm" variant="outline" onClick={() => setShowGenerate(true)}
                className="border-[#cb6ce6]/40 bg-[#cb6ce6]/10 text-[#cb6ce6] gap-1.5">
                <Sparkles size={14} /> Build with AI
              </Button>
              <Button size="sm" onClick={() => setEditor({ level: 'campaign', mode: 'create', entity: {} })}
                className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1.5">
                <Plus size={14} /> New campaign
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {scopedCampaigns.map(c => {
            const spec = getPlatform(c.platform);
            const open = expanded[c.id];
            return (
              <div key={c.id} className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                {/* Campaign row */}
                <div className="flex items-center gap-2 p-3">
                  <button onClick={() => setExpanded(e => ({ ...e, [c.id]: !e[c.id] }))}
                    className="text-gray-400 hover:text-white flex-shrink-0">
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: spec?.color || '#888' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">{c.name}</p>
                    <p className="text-gray-500 text-xs truncate">
                      {spec?.short} · {spec?.objectives.find(o => o.key === c.objective)?.label || c.objective || 'no objective'}
                      {c.budget ? ` · ${c.budget} ${c.budget_type}` : ''}
                      {` · ${c.ad_groups?.length || 0} ${levelLabel(c.platform, 'ad_group').toLowerCase()}s`}
                    </p>
                  </div>
                  <StateChip state={c.publish_state} error={c.last_publish_error} />
                  {scope === 'campaign' && (
                    <button
                      title={c.strategy && Object.keys(c.strategy).length ? 'Strategy attached — regenerate' : 'Write the strategy for this campaign'}
                      onClick={() => setStrategyFor(c)}
                      className={`p-1 ${c.strategy && Object.keys(c.strategy).length ? 'text-[#cb6ce6]' : 'text-gray-500 hover:text-[#cb6ce6]'}`}>
                      <BookOpen size={13} />
                    </button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setPublishFor(c)}
                    className="border-white/10 text-white hover:bg-white/5 gap-1 h-7 px-2 text-xs">
                    <Rocket size={12} /> Publish
                  </Button>
                  {scope === 'campaign' && (
                    <>
                      <button title="Edit" onClick={() => setEditor({ level: 'campaign', mode: 'edit', entity: c })}
                        className="text-gray-500 hover:text-white p-1"><Pencil size={13} /></button>
                      <button title="Delete" onClick={() => { if (window.confirm(`Delete "${c.name}" and everything inside it?`)) removeIt.mutate({ level: 'campaign', id: c.id }); }}
                        className="text-gray-600 hover:text-red-400 p-1"><Trash2 size={13} /></button>
                    </>
                  )}
                </div>

                {open && (
                  <div className="border-t border-white/5 bg-black/20 p-3 space-y-2">
                    {(c.ad_groups || []).map(g => (
                      <div key={g.id} className="rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-2 p-2.5">
                          <Target size={13} className="text-[#cb6ce6] flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-xs font-medium truncate">{g.name}</p>
                            <p className="text-gray-500 text-[11px] truncate">
                              {(g.targeting?.locations || []).slice(0, 3).join(', ') || 'no locations set'}
                              {` · ${g.ads?.length || 0} ${levelLabel(c.platform, 'ad').toLowerCase()}s`}
                            </p>
                          </div>
                          <StateChip state={g.publish_state} error={g.last_publish_error} />
                          <button title="Edit" onClick={() => setEditor({ level: 'ad_group', mode: 'edit', entity: g, platform: c.platform })}
                            className="text-gray-500 hover:text-white p-1"><Pencil size={12} /></button>
                          {/* Ads are built FROM this ad group's audience. */}
                          <button title={`Build ${levelLabel(c.platform, 'ad').toLowerCase()}s from this audience`}
                            disabled={buildAds.isPending}
                            onClick={() => buildAds.mutate(g.id)}
                            className="text-gray-500 hover:text-[#cb6ce6] p-1 disabled:opacity-50">
                            {buildAds.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          </button>
                          <button title="Add ad" onClick={() => setEditor({ level: 'ad', mode: 'create', parentId: g.id, entity: {}, platform: c.platform })}
                            className="text-gray-500 hover:text-[#38b6ff] p-1"><Plus size={13} /></button>
                          <button title="Delete" onClick={() => { if (window.confirm(`Delete "${g.name}"?`)) removeIt.mutate({ level: 'ad_group', id: g.id }); }}
                            className="text-gray-600 hover:text-red-400 p-1"><Trash2 size={12} /></button>
                        </div>

                        {(g.ads || []).length > 0 && (
                          <div className="border-t border-white/5 px-2.5 py-2 space-y-1">
                            {g.ads.map(a => (
                              <div key={a.id} className="flex items-center gap-2 py-1">
                                <Megaphone size={11} className="text-gray-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-gray-200 text-[11px] truncate">{a.name}</p>
                                  <p className="text-gray-600 text-[10px] truncate">{a.headline || a.primary_text || 'no copy yet'}</p>
                                </div>
                                <StateChip state={a.publish_state} error={a.last_publish_error} />
                                {/* Copy is the bottom of the hierarchy: it
                                    inherits this campaign's strategy and this
                                    ad group's audience. */}
                                <button title="Write copy with AI" onClick={() => setCopyFor({ ad: a, group: g, campaign: c })}
                                  className="text-gray-500 hover:text-[#cb6ce6] p-1"><Sparkles size={11} /></button>
                                <button title="Edit" onClick={() => setEditor({ level: 'ad', mode: 'edit', entity: a, platform: c.platform })}
                                  className="text-gray-500 hover:text-white p-1"><Pencil size={11} /></button>
                                <button title="Duplicate" onClick={() => saveAd.mutate({ data: { ...a, id: undefined, name: `${a.name} (copy)`, external_id: null, publish_state: 'local' } })}
                                  className="text-gray-500 hover:text-white p-1"><Copy size={11} /></button>
                                <button title="Delete" onClick={() => removeIt.mutate({ level: 'ad', id: a.id })}
                                  className="text-gray-600 hover:text-red-400 p-1"><Trash2 size={11} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline"
                        onClick={() => setEditor({ level: 'ad_group', mode: 'create', parentId: c.id, entity: {}, platform: c.platform })}
                        className="border-white/10 text-gray-300 hover:bg-white/5 gap-1.5 h-7 text-xs">
                        <Plus size={12} /> Add {levelLabel(c.platform, 'ad_group').toLowerCase()}
                      </Button>
                      {/* Ad groups are built FROM the campaign and its strategy. */}
                      <Button size="sm" variant="outline" disabled={buildGroups.isPending}
                        onClick={() => buildGroups.mutate(c.id)}
                        title={`Create ${levelLabel(c.platform, 'ad_group').toLowerCase()}s from this campaign's strategy and objective`}
                        className="border-[#cb6ce6]/40 bg-[#cb6ce6]/10 text-[#cb6ce6] hover:bg-[#cb6ce6]/20 gap-1.5 h-7 text-xs">
                        {buildGroups.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        Build from campaign
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editor && (
        <EntityEditor
          editor={editor}
          platforms={platforms}
          strategies={strategies}
          onClose={() => setEditor(null)}
          onSave={(data) => {
            if (editor.level === 'campaign') saveCampaign.mutate({ id: editor.entity?.id, data });
            else if (editor.level === 'ad_group') saveGroup.mutate({ id: editor.entity?.id, data: { ...data, campaign_id: editor.parentId || editor.entity?.campaign_id } });
            else saveAd.mutate({ id: editor.entity?.id, data: { ...data, ad_group_id: editor.parentId || editor.entity?.ad_group_id } });
          }}
          saving={saveCampaign.isPending || saveGroup.isPending || saveAd.isPending}
        />
      )}

      <AdsPublishDialog
        open={!!publishFor}
        campaign={publishFor}
        allowedLevels={scope === 'campaign' ? ['campaign', 'ad_groups', 'ads'] : scope === 'ad_group' ? ['ad_groups', 'ads'] : ['ads']}
        onClose={() => setPublishFor(null)}
        onPublished={refresh}
      />

      <GenerateDialog open={showGenerate} platforms={platforms} onClose={() => setShowGenerate(false)} onDone={refresh} />

      <StrategyDialog campaign={strategyFor} onClose={() => setStrategyFor(null)} onDone={refresh} />
      <CopyDialog ctx={copyFor} onClose={() => setCopyFor(null)} onDone={refresh} />
    </div>
  );
}

/* ───────────────── Editor: one dialog, platform-aware fields ───────────────── */

function EntityEditor({ editor, platforms, strategies = [], onClose, onSave, saving }) {
  const { level, mode, entity } = editor;
  const [form, setForm] = useState(() => ({
    status: 'draft',
    budget_type: 'daily',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...entity,
    targeting: entity?.targeting || {},
  }));
  const platformKey = level === 'campaign' ? form.platform : editor.platform;
  const spec = getPlatform(platformKey);
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));
  const setTarget = (k, v) => setForm(f => ({ ...f, targeting: { ...f.targeting, [k]: v } }));

  const problems = spec ? validateLevel(level, { ...form, platform: platformKey }, platformKey) : [];
  const title = `${mode === 'create' ? 'New' : 'Edit'} ${spec ? levelLabel(spec.key, level) : level.replace('_', ' ')}`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg bg-[#111] border-white/10 text-white">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">

          {level === 'campaign' && mode === 'create' && (
            <>
              <Field label="Ad platform">
                <Select value={form.platform || ''} onValueChange={set('platform')}>
                  <SelectTrigger className="in"><SelectValue placeholder="Choose a platform" /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {platforms.map(p => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.label}{!p.connected ? ' — not connected' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* Strategy sits ABOVE the campaign: pick one and the campaign
                  inherits it, with its audience segments becoming ad groups. */}
              {strategies.length > 0 && (
                <Field label="Build from a strategy (optional)">
                  <Select value={form.strategy_id || '__none__'}
                    onValueChange={(v) => {
                      const chosen = strategies.find(s => s.id === v);
                      setForm(f => ({
                        ...f,
                        strategy_id: v === '__none__' ? undefined : v,
                        objective: chosen?.objective || f.objective,
                        platform: f.platform || chosen?.platform,
                      }));
                    }}>
                    <SelectTrigger className="in"><SelectValue placeholder="Start from scratch" /></SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-white/10">
                      <SelectItem value="__none__">Start from scratch</SelectItem>
                      {strategies.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {form.strategy_id && (
                    <p className="text-gray-500 text-[11px] mt-1">
                      The campaign will follow this strategy, and each of its audience segments
                      becomes an ad group ready for you to target.
                    </p>
                  )}
                </Field>
              )}
            </>
          )}

          <Field label="Name">
            <Input value={form.name || ''} onChange={e => set('name')(e.target.value)} className="in"
              placeholder={level === 'ad' ? 'e.g. Spring offer — video' : 'e.g. Q3 lead generation'} />
          </Field>

          {level === 'campaign' && spec && (
            <>
              <Field label="What should this achieve?">
                <Select value={form.objective || ''} onValueChange={set('objective')}>
                  <SelectTrigger className="in"><SelectValue placeholder="Choose an objective" /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {spec.objectives.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}{o.help ? ` — ${o.help}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Budget">
                  <Input type="number" value={form.budget ?? ''} onChange={e => set('budget')(e.target.value)} className="in" placeholder="100" />
                </Field>
                <Field label="Budget type">
                  <Select value={form.budget_type || 'daily'} onValueChange={set('budget_type')}>
                    <SelectTrigger className="in"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-white/10">
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="lifetime">Lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <p className="text-gray-500 text-[11px] -mt-1">
                Charged in your {spec.short} ad account&apos;s own currency — Bmapz does not convert it.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Starts"><Input type="datetime-local" value={form.starts_at?.slice(0, 16) || ''} onChange={e => set('starts_at')(e.target.value)} className="in" /></Field>
                <Field label="Ends"><Input type="datetime-local" value={form.ends_at?.slice(0, 16) || ''} onChange={e => set('ends_at')(e.target.value)} className="in" /></Field>
              </div>
            </>
          )}

          {level === 'ad_group' && spec && (
            <>
              <Field label="Optimise for">
                <Select value={form.optimization_goal || ''} onValueChange={set('optimization_goal')}>
                  <SelectTrigger className="in"><SelectValue placeholder="Choose a goal" /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {spec.optimizationGoals.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              {spec.budgetLevels.includes('ad_group') && (
                <Field label="Budget (optional — overrides the campaign)">
                  <Input type="number" value={form.budget ?? ''} onChange={e => set('budget')(e.target.value)} className="in" />
                </Field>
              )}
              <p className="text-gray-400 text-xs pt-1">Who should see this?</p>
              {spec.targeting.map(key => {
                const f = TARGETING_FIELDS[key];
                if (!f) return null;
                if (f.type === 'range') {
                  const [min, max] = form.targeting.age || [18, 65];
                  return (
                    <Field key={key} label={f.label}>
                      <div className="flex items-center gap-2">
                        <Input type="number" value={min} onChange={e => setTarget('age', [Number(e.target.value), max])} className="in w-20" />
                        <span className="text-gray-600 text-xs">to</span>
                        <Input type="number" value={max} onChange={e => setTarget('age', [min, Number(e.target.value)])} className="in w-20" />
                      </div>
                    </Field>
                  );
                }
                if (f.type === 'multi') {
                  const sel = form.targeting[key] || [];
                  return (
                    <Field key={key} label={f.label}>
                      <div className="flex flex-wrap gap-1.5">
                        {f.options.map(o => {
                          const on = sel.includes(o);
                          return (
                            <button key={o} type="button"
                              onClick={() => setTarget(key, on ? sel.filter(x => x !== o) : [...sel, o])}
                              className={`px-2 py-1 rounded-lg text-[11px] border ${on
                                ? 'bg-[#38b6ff]/15 border-[#38b6ff]/40 text-[#38b6ff]'
                                : 'bg-black/20 border-white/10 text-gray-400'}`}>{o}</button>
                          );
                        })}
                      </div>
                    </Field>
                  );
                }
                return (
                  <Field key={key} label={f.label}>
                    <Input value={tagsToText(form.targeting[key])} onChange={e => setTarget(key, textToTags(e.target.value))}
                      placeholder={f.placeholder} className="in" />
                  </Field>
                );
              })}
            </>
          )}

          {level === 'ad' && spec && (
            <>
              <Field label="Format">
                <Select value={form.format || ''} onValueChange={set('format')}>
                  <SelectTrigger className="in"><SelectValue placeholder="Choose a format" /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {spec.formats.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              {spec.copyFields.map(f => (
                <Field key={f.key} label={`${f.label}${f.max ? ` (${String(form[f.key] || '').length}/${f.max})` : ''}`}>
                  {f.multiline
                    ? <Textarea value={form[f.key] || ''} onChange={e => set(f.key)(e.target.value)} className="in min-h-[64px]" maxLength={f.max} />
                    : <Input value={form[f.key] || ''} onChange={e => set(f.key)(e.target.value)} className="in" maxLength={f.max} />}
                </Field>
              ))}
              <Field label="Button">
                <Select value={form.call_to_action || ''} onValueChange={set('call_to_action')}>
                  <SelectTrigger className="in"><SelectValue placeholder="Choose a call to action" /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {spec.callToActions.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ').toLowerCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Where should the button go?">
                <Input value={form.destination_url || ''} onChange={e => set('destination_url')(e.target.value)}
                  placeholder="https://your-site.com/offer" className="in" />
              </Field>
            </>
          )}

          {problems.length > 0 && (
            <div className="p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-yellow-400 text-[11px] font-medium mb-1">Still needed before this can go live:</p>
              <ul className="space-y-0.5">
                {problems.map((p, i) => <li key={i} className="text-gray-300 text-[11px]">• {p}</li>)}
              </ul>
              <p className="text-gray-500 text-[10px] mt-1">You can still save it as a draft.</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="border-white/10 text-white">Cancel</Button>
            <Button onClick={() => onSave(form)} disabled={saving || !form.name?.trim() || (level === 'campaign' && !form.platform)}
              className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />} Save
            </Button>
          </div>
        </div>
        <style>{`.in{background:rgba(0,0,0,0.3);border-color:rgba(255,255,255,0.1);color:#fff}`}</style>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-gray-400 text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/* ───────────────── Build a whole campaign with the Company Brain ───────────────── */

function GenerateDialog({ open, platforms, onClose, onDone }) {
  const [form, setForm] = useState({ platform: '', objective: '', budget: '', budget_type: 'daily', product: '', audience: '', goal_notes: '' });
  const [plan, setPlan] = useState(null);
  const spec = getPlatform(form.platform);

  const gen = useMutation({
    mutationFn: () => AdsManager.generate(form),
    onSuccess: (r) => setPlan(r.plan),
    onError: (e) => toast.error(`Could not build the campaign: ${e.message}`),
  });
  const apply = useMutation({
    mutationFn: () => AdsManager.applyPlan({ plan, platform: form.platform, budget: form.budget, budget_type: form.budget_type }),
    onSuccess: () => { toast.success('Campaign created as a draft — review it, then publish.'); setPlan(null); onClose(); onDone?.(); },
    onError: (e) => toast.error(`Could not save it: ${e.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (setPlan(null), onClose())}>
      <DialogContent className="max-w-lg bg-[#111] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles size={17} className="text-[#cb6ce6]" /> Build a campaign with AI</DialogTitle>
        </DialogHeader>

        {!plan ? (
          <div className="space-y-3 py-1">
            <p className="text-gray-400 text-xs">
              Uses your Company Brain — what you sell, your ideal customer and your tone — to build a full
              campaign with ad groups and ads, structured for the platform you choose.
            </p>
            <Field label="Platform">
              <Select value={form.platform} onValueChange={(v) => setForm(f => ({ ...f, platform: v, objective: '' }))}>
                <SelectTrigger className="in"><SelectValue placeholder="Choose a platform" /></SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  {platforms.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {spec && (
              <Field label="Objective">
                <Select value={form.objective} onValueChange={(v) => setForm(f => ({ ...f, objective: v }))}>
                  <SelectTrigger className="in"><SelectValue placeholder="What do you want?" /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {spec.objectives.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Budget"><Input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} className="in" placeholder="100" /></Field>
              <Field label="Per">
                <Select value={form.budget_type} onValueChange={(v) => setForm(f => ({ ...f, budget_type: v }))}>
                  <SelectTrigger className="in"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    <SelectItem value="daily">Day</SelectItem>
                    <SelectItem value="lifetime">Whole campaign</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="What are you promoting? (optional)">
              <Input value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))} className="in" placeholder="Leave empty to use your main offer" />
            </Field>
            <Field label="Anything else the AI should know? (optional)">
              <Textarea value={form.goal_notes} onChange={e => setForm(f => ({ ...f, goal_notes: e.target.value }))} className="in min-h-[56px]" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} className="border-white/10 text-white">Cancel</Button>
              <Button onClick={() => gen.mutate()} disabled={!form.platform || gen.isPending}
                className="bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2">
                {gen.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Build it
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            <p className="text-white text-sm font-medium">{plan.name}</p>
            {plan.rationale && <p className="text-gray-400 text-xs">{plan.rationale}</p>}
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {(plan.ad_groups || []).map((g, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-black/20 border border-white/10">
                  <p className="text-white text-xs font-medium">{g.name}</p>
                  <p className="text-gray-500 text-[11px]">{(g.targeting?.locations || []).join(', ') || 'no locations'} · {(g.ads || []).length} ads</p>
                  {(g.ads || []).map((a, j) => (
                    <p key={j} className="text-gray-400 text-[11px] mt-1 truncate">• {a.headline || a.name}</p>
                  ))}
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-[11px]">Saved as a draft first — nothing goes live until you publish it.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPlan(null)} className="border-white/10 text-white">Back</Button>
              <Button onClick={() => apply.mutate()} disabled={apply.isPending}
                className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
                {apply.isPending && <Loader2 size={14} className="animate-spin" />} Create draft
              </Button>
            </div>
          </div>
        )}
        <style>{`.in{background:rgba(0,0,0,0.3);border-color:rgba(255,255,255,0.1);color:#fff}`}</style>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── Strategy: written for a campaign, governs everything below ─────────── */

function StrategyDialog({ campaign, onClose, onDone }) {
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState(null);

  const run = useMutation({
    mutationFn: () => AdsManager.generateStrategy(campaign.id, { notes }),
    onSuccess: (r) => { setResult(r.strategy); onDone?.(); toast.success('Strategy attached to the campaign'); },
    onError: (e) => toast.error(`Could not write the strategy: ${e.message}`),
  });

  if (!campaign) return null;
  const existing = campaign.strategy && Object.keys(campaign.strategy).length ? campaign.strategy : null;
  const shown = result || existing;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) { setResult(null); onClose(); } }}>
      <DialogContent className="max-w-lg bg-[#111] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen size={17} className="text-[#cb6ce6]" /> Strategy — {campaign.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-gray-400 text-xs">
            The strategy sits above this campaign. Its audience segments guide the ad groups,
            and the copy written for each ad inherits it.
          </p>

          {shown && (
            <div className="space-y-2 max-h-64 overflow-y-auto p-3 rounded-xl bg-black/20 border border-white/10">
              {shown.positioning && <p className="text-gray-300 text-xs"><span className="text-gray-500">Positioning: </span>{shown.positioning}</p>}
              {shown.unique_mechanism && <p className="text-gray-300 text-xs"><span className="text-gray-500">What makes it different: </span>{shown.unique_mechanism}</p>}
              {shown.angles?.length > 0 && (
                <p className="text-gray-300 text-xs"><span className="text-gray-500">Angles: </span>{shown.angles.join(' · ')}</p>
              )}
              {shown.audience_segments?.length > 0 && (
                <div>
                  <p className="text-gray-500 text-xs">Audience segments (become ad groups):</p>
                  {shown.audience_segments.map((s, i) => (
                    <p key={i} className="text-gray-300 text-xs ml-2">• <span className="text-white">{s.name}</span> — {s.message || s.who}</p>
                  ))}
                </div>
              )}
              {shown.kpis?.primary && <p className="text-gray-300 text-xs"><span className="text-gray-500">Primary KPI: </span>{shown.kpis.primary}</p>}
            </div>
          )}

          <Field label="Anything specific it should account for? (optional)">
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="in min-h-[56px]"
              placeholder="e.g. we are launching in a new city, a competitor just cut prices" />
          </Field>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} className="border-white/10 text-white">Close</Button>
            <Button onClick={() => run.mutate()} disabled={run.isPending}
              className="bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2">
              {run.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {existing ? 'Rewrite strategy' : 'Write strategy'}
            </Button>
          </div>
        </div>
        <style>{`.in{background:rgba(0,0,0,0.3);border-color:rgba(255,255,255,0.1);color:#fff}`}</style>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── Copy: written for one ad, inheriting everything above it ─────────── */

function CopyDialog({ ctx, onClose, onDone }) {
  const [variants, setVariants] = useState(null);
  const [notes, setNotes] = useState('');
  const spec = getPlatform(ctx?.campaign?.platform);

  const gen = useMutation({
    mutationFn: () => AdsManager.generateCopy(ctx.ad.id, { notes, count: 3 }),
    onSuccess: (r) => setVariants(r.variants),
    onError: (e) => toast.error(`Could not write the copy: ${e.message}`),
  });
  const apply = useMutation({
    mutationFn: (v) => AdsManager.applyCopy(ctx.ad.id, v),
    onSuccess: () => { toast.success('Copy applied to the ad'); setVariants(null); onClose(); onDone?.(); },
    onError: (e) => toast.error(`Could not apply it: ${e.message}`),
  });

  if (!ctx || !spec) return null;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) { setVariants(null); onClose(); } }}>
      <DialogContent className="max-w-lg bg-[#111] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={17} className="text-[#cb6ce6]" /> Copy for &ldquo;{ctx.ad.name}&rdquo;
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          {/* Show the chain this copy inherits, so it is obvious where it comes from. */}
          <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 text-[11px] space-y-0.5">
            <p className="text-gray-500">Inheriting from:</p>
            <p className="text-gray-300">Strategy → <span className="text-white">{ctx.campaign.strategy && Object.keys(ctx.campaign.strategy).length ? 'attached' : 'none yet'}</span></p>
            <p className="text-gray-300">{levelLabel(spec.key, 'campaign')} → <span className="text-white">{ctx.campaign.name}</span></p>
            <p className="text-gray-300">{levelLabel(spec.key, 'ad_group')} → <span className="text-white">{ctx.group.name}</span>
              {(ctx.group.targeting?.locations || []).length > 0 && <span className="text-gray-500"> ({ctx.group.targeting.locations.join(', ')})</span>}
            </p>
          </div>

          {!variants ? (
            <>
              <Field label="Anything to emphasise? (optional)">
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="in min-h-[56px]"
                  placeholder="e.g. lead with the free trial" />
              </Field>
              <p className="text-gray-500 text-[11px]">
                Written to {spec.short}&apos;s real limits: {spec.copyFields.map(f => `${f.label} ${f.max}`).join(', ')} characters.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} className="border-white/10 text-white">Cancel</Button>
                <Button onClick={() => gen.mutate()} disabled={gen.isPending}
                  className="bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2">
                  {gen.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Write copy
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {variants.map((v, i) => (
                  <div key={i} className="p-3 rounded-xl bg-black/20 border border-white/10 space-y-1">
                    {v.angle && <p className="text-[#cb6ce6] text-[10px] uppercase tracking-wide">{v.angle}</p>}
                    {spec.copyFields.map(f => (v[f.key] ? (
                      <p key={f.key} className="text-gray-300 text-xs">
                        <span className="text-gray-500">{f.label}: </span>{v[f.key]}
                        <span className="text-gray-600"> ({v[f.key].length}/{f.max})</span>
                      </p>
                    ) : null))}
                    <Button size="sm" onClick={() => apply.mutate(v)} disabled={apply.isPending}
                      className="mt-1 h-7 text-xs bg-gradient-to-r from-[#3572b9] to-[#38b6ff]">
                      Use this one
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setVariants(null)} className="border-white/10 text-white">Back</Button>
              </div>
            </>
          )}
        </div>
        <style>{`.in{background:rgba(0,0,0,0.3);border-color:rgba(255,255,255,0.1);color:#fff}`}</style>
      </DialogContent>
    </Dialog>
  );
}
