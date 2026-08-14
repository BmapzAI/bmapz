import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Send, Loader2, ExternalLink, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/ui/LanguageContext';
import { api } from '@/api/apiClient';

/**
 * "Put this output where it belongs."
 *
 * Approving an output recorded a decision but produced nothing anywhere else, so
 * an approved SEO plan or ad strategy stayed in the archive and never showed up in
 * its section — the single most confusing part of the flow. This is the bridge.
 *
 * The destination defaults to the output's own category, since the agent already
 * decided what kind of thing it was, but stays overridable because that guess can
 * be wrong.
 */
// SEO is deliberately absent. It is not an editable section — an analysis is a
// scored report, not a draft — and "sending" one there only filed it in the
// archive as a strategy, which is where it already was.
const SECTIONS = [
  { value: 'ads', en: 'Ads', pt: 'Anúncios' },
  { value: 'social', en: 'Social Media', pt: 'Redes sociais' },
  { value: 'blog', en: 'Blog', pt: 'Blog' },
  { value: 'sales', en: 'Sales', pt: 'Vendas' },
  { value: 'workflow', en: 'Workflows', pt: 'Automações' },
  { value: 'inbox', en: 'Inbox', pt: 'Caixa de entrada' },
  { value: 'sdr', en: 'SDR', pt: 'SDR' },
];

/**
 * The agent's own category is the best default destination.
 *
 * `strategies` has no entry: it used to default to SEO, which is not a
 * destination you can send anything to. It falls through to the first option so
 * the user picks deliberately.
 */
const SECTION_FOR_CATEGORY = {
  social_media: 'social',
  blogposts: 'blog',
  ad_copy: 'ads',
  message_templates: 'inbox',
  email_templates: 'inbox',
  workflows: 'workflow',
  prospect_list: 'sales',
};

export default function SendOutputToSection({ output }) {
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();

  const sentTo = output?.sent_to || output?.metadata?.sent_to || null;
  const [section, setSection] = useState(
    () => SECTION_FOR_CATEGORY[output?.category || output?.metadata?.category] || SECTIONS[0].value,
  );

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/api/ai/outputs/${output.id}/send-to-section`, { section }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['aiOutputs'] });
      for (const k of ['socialPosts', 'blogPosts', 'adCampaigns']) {
        queryClient.invalidateQueries({ queryKey: [k] });
      }
      toast.success(res?.summary || (isPt ? 'Enviado para a seção' : 'Sent to the section'));
    },
    onError: (e) => toast.error((isPt ? 'Falha ao enviar: ' : 'Could not send: ') + (e?.message || '')),
  });

  // Already sent: show where it went instead of offering to send it again.
  if (sentTo?.section) {
    return (
      <div className="mt-2 flex items-center gap-2 text-[11px] text-green-400">
        <Check size={12} />
        {isPt ? 'Enviado para' : 'Sent to'}{' '}
        {(SECTIONS.find(s => s.value === sentTo.section) || {})[isPt ? 'pt' : 'en'] || sentTo.section}
        <Link
          to={`/${sentTo.section === 'social' ? 'SocialMedia' : sentTo.section === 'ads' ? 'Ads' : sentTo.section === 'blog' ? 'Blog' : 'AIOutputs'}`}
          className="inline-flex items-center gap-0.5 text-[#38b6ff] hover:underline"
        >
          {isPt ? 'ver' : 'view'} <ExternalLink size={10} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select
        value={section}
        onChange={(e) => setSection(e.target.value)}
        className="h-8 rounded-md bg-black/30 border border-white/10 text-white text-xs px-2"
      >
        {SECTIONS.map(s => (
          <option key={s.value} value={s.value} className="bg-[#1a1a1a]">
            {isPt ? s.pt : s.en}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        onClick={() => sendMutation.mutate()}
        disabled={sendMutation.isPending}
        className="h-8 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1.5 text-xs"
      >
        {sendMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        {isPt ? 'Enviar para a seção' : 'Send to section'}
      </Button>
    </div>
  );
}
