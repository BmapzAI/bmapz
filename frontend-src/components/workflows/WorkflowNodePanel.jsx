import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Trash2, Info, Mic, MicOff, Loader2 } from 'lucide-react';

import { toast } from 'sonner';
import { NODE_TYPES, CONDITION_OPTIONS, TRIGGER_TYPES } from './WorkflowCanvas';
import ScheduleMeetingPanel from './ScheduleMeetingPanel';
import { InvokeLLM, TranscribeAudio } from '@/api/integrations';

// ─── Social platforms and their actions ───────────────────────────────────────
const SOCIAL_PLATFORMS = [
  { value: 'linkedin',  label: '💼 LinkedIn'  },
  { value: 'instagram', label: '📸 Instagram' },
  { value: 'twitter',   label: '🐦 X / Twitter' },
  { value: 'facebook',  label: '📘 Facebook'  },
  { value: 'tiktok',    label: '🎵 TikTok'    },
];

// Only actions explicitly permitted by each platform's API & developer policies.
// Actions that require human-initiated sessions, are automation-banned, or risk
// app suspension/blacklisting are intentionally omitted.
const SOCIAL_ACTIONS = {
  // LinkedIn: connection requests & messaging via official API are permitted.
  // Automated follows, skill endorsements, and company follows violate
  // LinkedIn's User Agreement §8.2 (no scraping/automation of social gestures).
  linkedin: [
    { value: 'connect',      label: 'Send Connection Request' },
    { value: 'send_message', label: 'Send LinkedIn DM (InMail)' },
    { value: 'like_post',    label: 'Like a Post' },
    { value: 'comment_post', label: 'Comment on a Post' },
  ],

  // Instagram (Meta Graph API — Business accounts only):
  // Only messaging is permitted. Automated follows, likes, comments, and
  // story reactions are forbidden by Meta Platform Policy §4.4 and will
  // result in immediate app suspension.
  // DMs can only be sent as replies when the user messaged first (24-hr window).
  instagram: [
    { value: 'send_message', label: 'Reply to DM (must have messaged you first)' },
  ],

  // X / Twitter: only replies to existing tweets are permitted under the
  // Basic tier API. Automated follows, likes, and retweets violate the
  // Twitter Automation Rules and will trigger account/app suspension.
  twitter: [
    { value: 'reply_tweet',  label: 'Reply to Tweet' },
  ],

  // Facebook (Meta Graph API — Pages API):
  // Pages can reply to comments and send messages to users who initiated
  // contact. Automated friend requests, follows, and unsolicited likes
  // violate Meta Platform Policy §4.4.
  facebook: [
    { value: 'send_message', label: 'Reply to Message (user must have messaged first)' },
    { value: 'comment_reply', label: 'Reply to Comment on Your Post' },
  ],

  // TikTok: only comment replies on your own videos are supported via the
  // Display API. Automated follows, likes, and comments on others' content
  // violate TikTok's Developer Terms of Service §5 and risk app ban.
  tiktok: [
    { value: 'comment_reply', label: 'Reply to Comment on Your Video' },
  ],
};

// Post selection options (which post to target)
const POST_TARGET_OPTIONS = [
  { value: 'most_recent',        label: 'Most recent post' },
  { value: 'last_7_days_1',      label: '1 post from last 7 days' },
  { value: 'last_7_days_2',      label: '2 posts from last 7 days' },
  { value: 'last_30_days_1',     label: '1 post from last 30 days' },
  { value: 'last_30_days_3',     label: '3 posts from last 30 days' },
  { value: 'all_from_today',     label: 'Every post from today onward' },
  { value: 'specific_date',      label: 'Post from a specific date' },
  { value: 'any_recent',         label: 'Any recent post (AI picks best)' },
];

// Timing mode for when the action should execute
const TIMING_MODES = [
  { value: 'immediate',    label: 'Execute immediately (after wait)' },
  { value: 'specific_time',label: 'At a specific time of day' },
  { value: 'specific_date',label: 'On a specific date & time' },
  { value: 'business_hours',label: 'Business hours only' },
];

// Lead enrichment providers
const ENRICH_PROVIDERS = [
  { value: 'apollo',       label: '🚀 Apollo.io' },
  { value: 'lusha',        label: '🔍 Lusha' },
  { value: 'hunter',       label: '🎯 Hunter.io' },
  { value: 'clearbit',     label: '🌐 Clearbit' },
  { value: 'zoominfo',     label: '📊 ZoomInfo' },
  { value: 'linkedin_scrape', label: '💼 LinkedIn (public data)' },
  { value: 'instagram_scrape', label: '📸 Instagram (public data)' },
  { value: 'facebook_scrape',  label: '📘 Facebook (public data)' },
  { value: 'website_scrape',   label: '🌍 Company website' },
];

const ENRICH_FIELDS = [
  { value: 'email',             label: 'Email address' },
  { value: 'phone',             label: 'Phone number' },
  { value: 'linkedin_profile',  label: 'LinkedIn profile URL' },
  { value: 'company_size',      label: 'Company size' },
  { value: 'industry',          label: 'Industry' },
  { value: 'revenue',           label: 'Annual revenue' },
  { value: 'technologies',      label: 'Technologies used' },
  { value: 'social_profiles',   label: 'All social profiles' },
  { value: 'decision_maker',    label: 'Is decision maker' },
  { value: 'seniority',         label: 'Seniority / Title' },
  { value: 'recent_activity',   label: 'Recent social activity' },
];

// ─── Sub-panels ───────────────────────────────────────────────────────────────

// Per-platform policy notes shown to the user
const PLATFORM_POLICY_NOTES = {
  linkedin: {
    color: '#0077b5',
    note: 'Only API-permitted actions are shown. Automated follows and skill endorsements violate LinkedIn\'s User Agreement and are not available.',
  },
  instagram: {
    color: '#e1306c',
    note: 'Meta Graph API only allows replying to DMs within 24 hours of the lead messaging you first. Automated follows, likes, and comments on others\' content are forbidden by Meta Platform Policy and are not available.',
  },
  twitter: {
    color: '#1da1f2',
    note: 'X/Twitter Basic API only permits automated replies. Automated follows, likes, and retweets violate Twitter Automation Rules and are not available.',
  },
  facebook: {
    color: '#1877f2',
    note: 'Only replies to messages/comments initiated by the user are permitted. Automated friend requests, follows, and unsolicited interactions violate Meta Platform Policy.',
  },
  tiktok: {
    color: '#ff0050',
    note: 'TikTok Developer Terms only allow replying to comments on your own videos. Automated follows and likes on others\' content are not permitted.',
  },
};

function SocialActionPanel({ node, onUpdate }) {
  const platform = node.social_platform || 'linkedin';
  const actions = SOCIAL_ACTIONS[platform] || [];
  const isPostAction = ['like_post', 'comment_post', 'like_company_post', 'reply_tweet', 'comment_reply'].includes(node.social_action_type);
  const needsComment = ['comment_post', 'reply_tweet', 'send_message', 'comment_reply'].includes(node.social_action_type);
  const isInstagramDM = platform === 'instagram' && node.social_action_type === 'send_message';
  const policyNote = PLATFORM_POLICY_NOTES[platform];

  return (
    <div className="space-y-4">
      {/* Policy compliance banner */}
      <div className="flex items-start gap-2 p-3 rounded-lg border text-xs" style={{ backgroundColor: `${policyNote?.color}15`, borderColor: `${policyNote?.color}30`, color: policyNote?.color }}>
        <Info size={12} className="flex-shrink-0 mt-0.5" />
        <span>{policyNote?.note}</span>
      </div>

      {/* Platform */}
      <div>
        <Label className="text-gray-400 text-xs">Platform</Label>
        <Select value={platform} onValueChange={(v) => onUpdate(node.id, { social_platform: v, social_action_type: null, post_target: null })}>
          <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            {SOCIAL_PLATFORMS.map(p => (
              <SelectItem key={p.value} value={p.value} className="text-white">{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Action type */}
      <div>
        <Label className="text-gray-400 text-xs">Action</Label>
        <Select value={node.social_action_type || ''} onValueChange={(v) => onUpdate(node.id, { social_action_type: v })}>
          <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white text-sm">
            <SelectValue placeholder="Select action..." />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            {actions.map(a => (
              <SelectItem key={a.value} value={a.value} className="text-white">{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Post target (only for post-interaction actions) */}
      {isPostAction && (
        <div>
          <Label className="text-gray-400 text-xs">Which post to interact with</Label>
          <Select value={node.post_target || 'most_recent'} onValueChange={(v) => onUpdate(node.id, { post_target: v })}>
            <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-white/10">
              {POST_TARGET_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-white">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {node.post_target === 'specific_date' && (
            <div className="mt-2">
              <Label className="text-gray-400 text-xs">Post date</Label>
              <Input type="date" value={node.post_target_date || ''}
                onChange={(e) => onUpdate(node.id, { post_target_date: e.target.value })}
                className="mt-1 bg-black/30 border-white/10 text-white text-sm" />
            </div>
          )}
        </div>
      )}

      {/* Comment / DM text */}
      {needsComment && (
        <div>
          <Label className="text-gray-400 text-xs">{isInstagramDM ? 'DM Message' : 'Comment text'}</Label>
          <Textarea value={node.social_comment || ''} onChange={(e) => onUpdate(node.id, { social_comment: e.target.value })}
            placeholder={isInstagramDM ? 'Write your Instagram DM... Use {{lead_name}} for personalization' : 'Write your comment... Use {{lead_name}} for personalization'}
            className="mt-1 min-h-[80px] bg-black/30 border-white/10 text-white text-sm" />
          <p className="text-gray-500 text-[10px] mt-1">Variables: {'{{lead_name}}'}, {'{{lead_company}}'}</p>
          {(platform === 'instagram' || platform === 'facebook') && node.social_action_type === 'send_message' && (
            <p className="text-[#e1306c] text-[10px] mt-1">⚠️ Meta policy: the lead must have messaged your account first. Unsolicited DMs are blocked and may result in app suspension.</p>
          )}
        </div>
      )}

      {/* Connection note for connect request */}
      {node.social_action_type === 'connect' && (
        <div>
          <Label className="text-gray-400 text-xs">Connection note (optional)</Label>
          <Textarea value={node.connect_note || ''} onChange={(e) => onUpdate(node.id, { connect_note: e.target.value })}
            placeholder="Hi {{lead_name}}, I came across your profile and..."
            className="mt-1 min-h-[80px] bg-black/30 border-white/10 text-white text-sm" />
          <p className="text-gray-500 text-[10px] mt-1">Max 300 chars for LinkedIn. Variables: {'{{lead_name}}'}, {'{{lead_company}}'}</p>
        </div>
      )}

      {/* Timing mode */}
      <div>
        <Label className="text-gray-400 text-xs">Execution timing</Label>
        <Select value={node.timing_mode || 'immediate'} onValueChange={(v) => onUpdate(node.id, { timing_mode: v })}>
          <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            {TIMING_MODES.map(t => (
              <SelectItem key={t.value} value={t.value} className="text-white">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {node.timing_mode === 'specific_time' && (
          <div className="mt-2">
            <Label className="text-gray-400 text-xs">Time of day</Label>
            <Input type="time" value={node.timing_time || '09:00'}
              onChange={(e) => onUpdate(node.id, { timing_time: e.target.value })}
              className="mt-1 bg-black/30 border-white/10 text-white text-sm" />
          </div>
        )}

        {node.timing_mode === 'specific_date' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <Label className="text-gray-400 text-xs">Date</Label>
              <Input type="date" value={node.timing_date || ''}
                onChange={(e) => onUpdate(node.id, { timing_date: e.target.value })}
                className="mt-1 bg-black/30 border-white/10 text-white text-sm" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Time</Label>
              <Input type="time" value={node.timing_time || '09:00'}
                onChange={(e) => onUpdate(node.id, { timing_time: e.target.value })}
                className="mt-1 bg-black/30 border-white/10 text-white text-sm" />
            </div>
          </div>
        )}

        {node.timing_mode === 'business_hours' && (
          <p className="text-gray-500 text-[10px] mt-1">Will execute during 9am–6pm on weekdays only.</p>
        )}
      </div>

      {/* Retry on failure */}
      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 border border-white/10">
        <div>
          <p className="text-white text-xs font-medium">Retry on failure</p>
          <p className="text-gray-500 text-[10px]">Retry up to 3x if action fails</p>
        </div>
        <input type="checkbox" checked={node.retry_on_failure !== false}
          onChange={(e) => onUpdate(node.id, { retry_on_failure: e.target.checked })}
          className="w-4 h-4 rounded border-white/20 bg-black/30 accent-[#38b6ff]" />
      </div>

      {/* Skip if already done */}
      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 border border-white/10">
        <div>
          <p className="text-white text-xs font-medium">Skip if already done</p>
          <p className="text-gray-500 text-[10px]">Skip if lead is already connected/followed</p>
        </div>
        <input type="checkbox" checked={node.skip_if_done !== false}
          onChange={(e) => onUpdate(node.id, { skip_if_done: e.target.checked })}
          className="w-4 h-4 rounded border-white/20 bg-black/30 accent-[#38b6ff]" />
      </div>
    </div>
  );
}

function EnrichLeadPanel({ node, onUpdate }) {
  const selectedFields = node.enrich_fields || [];

  const toggleField = (field) => {
    const current = node.enrich_fields || [];
    const updated = current.includes(field) ? current.filter(f => f !== field) : [...current, field];
    onUpdate(node.id, { enrich_fields: updated });
  };

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-xs text-[#f59e0b]">
        <Info size={12} className="flex-shrink-0 mt-0.5" />
        <span>Enriched data is automatically saved to the lead profile. Configure API keys in <strong>Integrations → API Keys</strong>.</span>
      </div>

      {/* Provider */}
      <div>
        <Label className="text-gray-400 text-xs">Data source / Provider</Label>
        <Select value={node.enrich_provider || ''} onValueChange={(v) => onUpdate(node.id, { enrich_provider: v })}>
          <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white text-sm">
            <SelectValue placeholder="Select provider..." />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            {ENRICH_PROVIDERS.map(p => (
              <SelectItem key={p.value} value={p.value} className="text-white">{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Fields to enrich */}
      <div>
        <Label className="text-gray-400 text-xs mb-2 block">Fields to enrich</Label>
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {ENRICH_FIELDS.map(f => (
            <label key={f.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-xs
              ${selectedFields.includes(f.value)
                ? 'border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#f59e0b]'
                : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'}`}>
              <input type="checkbox" checked={selectedFields.includes(f.value)} onChange={() => toggleField(f.value)}
                className="w-3 h-3 accent-[#f59e0b]" />
              {f.label}
            </label>
          ))}
        </div>
        {selectedFields.length === 0 && (
          <p className="text-gray-500 text-[10px] mt-1">Select at least one field to enrich.</p>
        )}
      </div>

      {/* Fallback */}
      <div>
        <Label className="text-gray-400 text-xs">If enrichment fails</Label>
        <Select value={node.enrich_fallback || 'continue'} onValueChange={(v) => onUpdate(node.id, { enrich_fallback: v })}>
          <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            <SelectItem value="continue" className="text-white">Continue workflow anyway</SelectItem>
            <SelectItem value="pause"    className="text-white">Pause and notify me</SelectItem>
            <SelectItem value="skip"     className="text-white">Skip lead from workflow</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overwrite existing data */}
      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 border border-white/10">
        <div>
          <p className="text-white text-xs font-medium">Overwrite existing data</p>
          <p className="text-gray-500 text-[10px]">Replace fields even if already populated</p>
        </div>
        <input type="checkbox" checked={node.enrich_overwrite || false}
          onChange={(e) => onUpdate(node.id, { enrich_overwrite: e.target.checked })}
          className="w-4 h-4 rounded border-white/20 bg-black/30 accent-[#f59e0b]" />
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function WorkflowNodePanel({ node, onUpdate, onDelete, company, integrationStatus }) {
  const [generatingContent, setGeneratingContent] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/ogg';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setIsTranscribing(true);
        try {
          const arr = await blob.arrayBuffer();
          const bytes = new Uint8Array(arr);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const audio_base64 = btoa(binary);
          const transcript = await TranscribeAudio({ audio_base64, filename: 'recording.webm' });
          if (transcript) {
            onUpdate(node.id, { content: (node.content || '') + (node.content ? ' ' : '') + transcript });
            toast.success('Transcribed!');
          } else {
            toast.error('Transcription returned empty result');
          }
        } catch { toast.error('Transcription failed'); }
        finally { setIsTranscribing(false); }
      };
      mediaRecorder.start();
      setIsRecording(true);
      toast.success('Recording... click mic again to stop');
    } catch (e) {
      toast.error(e.name === 'NotAllowedError' ? 'Mic access denied' : 'Could not start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  if (!node) return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
        <span className="text-2xl">👆</span>
      </div>
      <p className="text-gray-400 text-sm">Click a node to edit its properties</p>
      <p className="text-gray-600 text-xs mt-1">Or click a port dot to connect nodes</p>
    </div>
  );

  const generateContent = async () => {
    const channel = node.channel || 'email';
    setGeneratingContent(true);
    try {
      const icp = company?.icp || {};
      const response = await InvokeLLM({
        prompt: `Generate a high-converting ${channel} outreach message for a ${node.name || 'sales'} step.
Company: ${company?.name || ''}
Product/Service: ${company?.services_description || ''}
Audience: ${icp.primary_audience || icp.job_titles?.join(', ') || 'decision makers'}
Tone: ${company?.briefing?.tone_of_voice?.join(', ') || 'professional'}
Value Props: ${company?.value_propositions?.join(', ') || ''}
${channel === 'email' ? 'Return JSON with "subject" (max 60 chars) and "content" (150-200 words) fields.' : 'Return JSON with "content" field (WhatsApp/LinkedIn: 80-120 words, conversational).'}`,
        response_json_schema: { type: 'object', properties: { subject: { type: 'string' }, content: { type: 'string' } } }
      });
      if (response) {
        onUpdate(node.id, { subject: response.subject || node.subject, content: response.content || '' });
        toast.success('AI content generated!');
      }
    } catch {
      toast.error('Failed to generate content');
    } finally {
      setGeneratingContent(false);
    }
  };

  const config = NODE_TYPES[node.type];

  return (
    <div className="space-y-4 p-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {config && (
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: `${config.color}25` }}>
              <config.icon size={12} style={{ color: config.color }} />
            </div>
          )}
          <h3 className="text-white font-semibold text-sm">{config?.name || 'Node'} Properties</h3>
        </div>
        {node.type !== 'trigger' && (
          <button onClick={() => onDelete(node.id)} className="text-gray-500 hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Label */}
      <div>
        <Label className="text-gray-400 text-xs">Label</Label>
        <Input value={node.name || ''} onChange={(e) => onUpdate(node.id, { name: e.target.value })}
          className="mt-1 bg-black/30 border-white/10 text-white text-sm" placeholder="Step name..." />
      </div>

      {/* ── Wait node ── */}
      {node.type === 'wait' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-gray-400 text-xs">Days</Label>
              <Input type="number" min="0" value={node.delay_days || 0}
                onChange={(e) => onUpdate(node.id, { delay_days: parseInt(e.target.value) || 0 })}
                className="mt-1 bg-black/30 border-white/10 text-white text-sm" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Hours</Label>
              <Input type="number" min="0" max="23" value={node.delay_hours || 0}
                onChange={(e) => onUpdate(node.id, { delay_hours: parseInt(e.target.value) || 0 })}
                className="mt-1 bg-black/30 border-white/10 text-white text-sm" />
            </div>
          </div>

          <div>
            <Label className="text-gray-400 text-xs">Wait until specific date (optional)</Label>
            <Input type="datetime-local" value={node.wait_until || ''}
              onChange={(e) => onUpdate(node.id, { wait_until: e.target.value })}
              className="mt-1 bg-black/30 border-white/10 text-white text-sm" />
            <p className="text-gray-500 text-[10px] mt-1">If set, wait until this date/time instead of duration above.</p>
          </div>

          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 border border-white/10">
            <div>
              <p className="text-white text-xs font-medium">Business days only</p>
              <p className="text-gray-500 text-[10px]">Skip weekends & holidays</p>
            </div>
            <input type="checkbox" checked={node.business_days_only || false}
              onChange={(e) => onUpdate(node.id, { business_days_only: e.target.checked })}
              className="w-4 h-4 rounded border-white/20 bg-black/30 accent-[#cb6ce6]" />
          </div>
        </div>
      )}

      {/* ── Condition node ── */}
      {node.type === 'condition' && (
        <div>
          <Label className="text-gray-400 text-xs">Condition</Label>
          <Select value={node.condition || ''} onValueChange={(v) => onUpdate(node.id, { condition: v })}>
            <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white text-sm">
              <SelectValue placeholder="Select condition..." />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-white/10">
              {CONDITION_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-white">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-2 flex gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-green-500/20 text-green-400">Yes → left port</span>
            <span className="px-2 py-1 rounded bg-red-500/20 text-red-400">No → right port</span>
          </div>
        </div>
      )}

      {/* ── Send Message node ── */}
      {node.type === 'send_message' && (
        <>
          <div>
            <Label className="text-gray-400 text-xs">Channel</Label>
            <Select value={node.channel || 'email'} onValueChange={(v) => onUpdate(node.id, { channel: v })}>
              <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                <SelectItem value="email"     className="text-white">📧 Email</SelectItem>
                <SelectItem value="whatsapp"  className="text-white">💬 WhatsApp</SelectItem>
                <SelectItem value="linkedin"  className="text-white">💼 LinkedIn DM</SelectItem>
                <SelectItem value="instagram" className="text-white">📸 Instagram DM</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {node.channel === 'email' && (
            <div>
              <Label className="text-gray-400 text-xs">Subject Line</Label>
              <Input value={node.subject || ''} onChange={(e) => onUpdate(node.id, { subject: e.target.value })}
                className="mt-1 bg-black/30 border-white/10 text-white text-sm" placeholder="Email subject..." />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-gray-400 text-xs">Message Content</Label>
              <div className="flex items-center gap-1">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isTranscribing}
                  title={isRecording ? 'Stop recording' : 'Record audio'}
                  className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${isRecording ? 'text-red-400 animate-pulse' : 'text-gray-400 hover:text-white'}`}>
                  {isTranscribing ? <Loader2 size={12} className="animate-spin" /> : isRecording ? <MicOff size={12} /> : <Mic size={12} />}
                </button>
                <Button size="sm" onClick={generateContent} disabled={generatingContent}
                  className="h-6 px-2 text-[10px] bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-1">
                  {generatingContent ? <div className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" /> : <Sparkles size={10} />}
                  AI Write
                </Button>
              </div>
            </div>
            <Textarea value={node.content || ''} onChange={(e) => onUpdate(node.id, { content: e.target.value })}
              placeholder="Message content..." className="min-h-[120px] bg-black/30 border-white/10 text-white text-sm" />
          </div>

          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 border border-white/10">
            <div>
              <p className="text-white text-xs font-medium">Auto-send</p>
              <p className="text-gray-500 text-[10px]">Send automatically without review</p>
            </div>
            <input type="checkbox" checked={node.auto_send || false}
              onChange={(e) => onUpdate(node.id, { auto_send: e.target.checked })}
              className="w-4 h-4 rounded border-white/20 bg-black/30 accent-[#38b6ff]" />
          </div>
        </>
      )}

      {/* ── Trigger node — entry point / auto-enrollment reason ── */}
      {node.type === 'trigger' && (
        <div className="space-y-3">
          <div>
            <Label className="text-gray-400 text-xs">Entry point (when do leads enter this workflow?)</Label>
            <Select value={node.trigger_type || 'manual'} onValueChange={(v) => onUpdate(node.id, { trigger_type: v })}>
              <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                {TRIGGER_TYPES.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-white">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {node.trigger_type && node.trigger_type !== 'manual' && (
            <div className="p-2.5 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20">
              <p className="text-[#22c55e] text-[11px]">
                ⚡ Auto-enrollment: leads are enrolled automatically when this event happens
                (workflow must be Active). Manual enrollment still works too.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── SDR node — AI sales rep takes over the conversation ── */}
      {node.type === 'sdr' && (
        <div className="space-y-3">
          <div className="p-2.5 rounded-lg bg-[#38b6ff]/10 border border-[#38b6ff]/20">
            <p className="text-[#38b6ff] text-[11px]">
              🤖 The SDR bot opens a conversation with the lead, replies to their messages,
              asks your qualifying questions and applies its outcomes (qualify, hand-over,
              offer product). Configure the SDR in the <b>SDR</b> section.
            </p>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">Channel to reach the lead</Label>
            <Select value={node.channel || 'email'} onValueChange={(v) => onUpdate(node.id, { channel: v })}>
              <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                <SelectItem value="email" className="text-white">📧 Email</SelectItem>
                <SelectItem value="whatsapp" className="text-white">💬 WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">Custom opener (optional — otherwise the SDR greeting is used)</Label>
            <Textarea value={node.content || ''} onChange={(e) => onUpdate(node.id, { content: e.target.value })}
              placeholder="Hi {{first_name}}! ..." className="min-h-[80px] mt-1 bg-black/30 border-white/10 text-white text-sm" />
          </div>
        </div>
      )}

      {/* ── Hand-over to sales node ── */}
      {node.type === 'handover' && (
        <div className="space-y-3">
          <div>
            <Label className="text-gray-400 text-xs">Inform the team via</Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {[['notification', '🔔 Notification'], ['email', '📧 Email'], ['sms', '📱 SMS'], ['whatsapp', '💬 WhatsApp']].map(([ch, label]) => (
                <label key={ch} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer text-xs text-gray-300">
                  <input type="checkbox"
                    checked={!!(node.handover_channels || { notification: true })[ch]}
                    onChange={(e) => onUpdate(node.id, { handover_channels: { ...(node.handover_channels || { notification: true }), [ch]: e.target.checked } })}
                    className="w-4 h-4 accent-[#22c55e]" />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">Recipients (emails / phone numbers, comma-separated)</Label>
            <Input value={node.handover_recipients || ''} onChange={(e) => onUpdate(node.id, { handover_recipients: e.target.value })}
              placeholder="sales@company.com, +55 11 9..." className="mt-1 bg-black/30 border-white/10 text-white text-sm" />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">Message to the team (optional)</Label>
            <Textarea value={node.content || ''} onChange={(e) => onUpdate(node.id, { content: e.target.value })}
              placeholder="{{lead_name}} is ready — qualified via workflow." className="min-h-[70px] mt-1 bg-black/30 border-white/10 text-white text-sm" />
          </div>
          <label className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer">
            <div>
              <p className="text-white text-xs font-medium">Move lead to SQL on hand-over</p>
              <p className="text-gray-500 text-[10px]">Marks the lead sales-qualified automatically</p>
            </div>
            <input type="checkbox" checked={node.set_stage_on_handover !== false}
              onChange={(e) => onUpdate(node.id, { set_stage_on_handover: e.target.checked })}
              className="w-4 h-4 accent-[#22c55e]" />
          </label>
        </div>
      )}

      {/* ── Lead qualification node ── */}
      {node.type === 'qualify' && (
        <div className="space-y-3">
          <div>
            <Label className="text-gray-400 text-xs">Action</Label>
            <Select value={node.qualify_action || 'next'} onValueChange={(v) => onUpdate(node.id, { qualify_action: v })}>
              <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                <SelectItem value="next" className="text-white">⬆️ Move to next stage</SelectItem>
                <SelectItem value="previous" className="text-white">⬇️ Move to previous stage</SelectItem>
                <SelectItem value="set" className="text-white">🎯 Set a specific stage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(node.qualify_action || 'next') === 'set' && (
            <div>
              <Label className="text-gray-400 text-xs">Set stage to</Label>
              <Select value={node.qualify_stage || 'mql'} onValueChange={(v) => onUpdate(node.id, { qualify_stage: v })}>
                <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white text-sm"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  {[['prospect', 'Prospect'], ['awareness', 'Awareness'], ['consideration', 'Consideration (Lead)'], ['mql', 'MQL'], ['sql', 'SQL'], ['opportunity', 'Opportunity'], ['customer', 'Customer'], ['retention', 'Retention'], ['advocacy', 'Advocacy']].map(([v, l]) => (
                    <SelectItem key={v} value={v} className="text-white">{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <p className="text-gray-500 text-[10px]">The stage change is logged in the lead's timeline and raises a notification.</p>
        </div>
      )}

      {/* ── Social Action node ── */}
      {node.type === 'social_action' && (
        <SocialActionPanel node={node} onUpdate={onUpdate} />
      )}

      {/* ── Enrich Lead node ── */}
      {node.type === 'enrich_lead' && (
        <EnrichLeadPanel node={node} onUpdate={onUpdate} />
      )}

      {/* ── Schedule Meeting node ── */}
      {node.type === 'schedule_meeting' && (
        <ScheduleMeetingPanel node={node} onUpdate={onUpdate} integrationStatus={integrationStatus} />
      )}
    </div>
  );
}