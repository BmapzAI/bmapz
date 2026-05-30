import React, { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Send, Users, MessageSquare, Mail, Linkedin, X } from 'lucide-react';
import { Company, Lead, LeadList, Message } from '@/api/entities';
import { useLanguage } from '@/components/ui/LanguageContext';

const CHANNEL_ICONS = {
  email: { icon: Mail, color: '#38b6ff', label: 'Email' },
  whatsapp: { icon: MessageSquare, color: '#25D366', label: 'WhatsApp' },
  linkedin: { icon: Linkedin, color: '#0077b5', label: 'LinkedIn' },
};

export default function SendMessageModal({ template, onClose }) {
  const { t } = useLanguage();
  const [selectedListId, setSelectedListId] = useState('');
  const [customContent, setCustomContent] = useState(template?.content || '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(0);
  const [total, setTotal] = useState(0);

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => Company.list() });
  const company = companies[0];

  const { data: leadLists = [] } = useQuery({
    queryKey: ['leadLists', company?.id],
    queryFn: () => company?.id ? LeadList.filter({ company_id: company.id }) : [],
    enabled: !!company?.id,
  });

  const { data: allLeads = [] } = useQuery({
    queryKey: ['leads', company?.id],
    queryFn: () => company?.id ? Lead.filter({ company_id: company.id }) : [],
    enabled: !!company?.id,
  });

  const selectedList = leadLists.find(l => l.id === selectedListId);
  const leadsInList = selectedListId
    ? allLeads.filter(lead => (selectedList?.lead_ids || []).includes(lead.id))
    : [];

  const replaceVariables = (content, lead) => {
    return content
      .replace(/\[First Name\]/g, lead.lead_name?.split(' ')[0] || '')
      .replace(/\[Last Name\]/g, lead.lead_name?.split(' ').slice(1).join(' ') || '')
      .replace(/\[Company Name\]/g, lead.lead_company_name || '')
      .replace(/\[Industry\]/g, lead.industry || '')
      .replace(/\[Role\]/g, lead.role || '')
      .replace(/\[Your Name\]/g, company?.name || '')
      .replace(/\[Your Company\]/g, company?.name || '');
  };

  const handleSend = async () => {
    if (!selectedListId) { toast.error(t('selectListError')); return; }
    if (!customContent.trim()) { toast.error(t('msgRequiredError')); return; }
    if (leadsInList.length === 0) { toast.error(t('noLeadsInList')); return; }

    setSending(true);
    setTotal(leadsInList.length);
    setSent(0);

    let successCount = 0;
    for (const lead of leadsInList) {
      const personalizedContent = replaceVariables(customContent, lead);
      try {
        await Message.create({
          lead_id: lead.id,
          company_id: company.id,
          channel: template?.channel || 'email',
          direction: 'outbound',
          content: personalizedContent,
          subject: template?.subject ? replaceVariables(template.subject, lead) : undefined,
          status: 'sent',
          sent_at: new Date().toISOString(),
          template_id: template?.id,
          ai_generated: false,
          tone: template?.tone || 'professional',
        });
        successCount++;
        setSent(successCount);
      } catch {
        // continue to next lead
      }
    }

    setSending(false);
    toast.success(`${t('sentToLeads')} ${successCount}/${leadsInList.length} ${t('leadsLabel')}`);
    onClose();
  };

  const channel = template?.channel || 'email';
  const ChannelIcon = CHANNEL_ICONS[channel]?.icon || Mail;
  const channelColor = CHANNEL_ICONS[channel]?.color || '#38b6ff';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChannelIcon size={18} style={{ color: channelColor }} />
            Send: {template?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Lead List Selector */}
          <div>
            <label className="text-gray-400 text-sm mb-1.5 block flex items-center gap-1">
              <Users size={14} /> {t('selectLeadList')}
            </label>
            <Select value={selectedListId} onValueChange={setSelectedListId}>
              <SelectTrigger className="bg-black/30 border-white/10 text-white">
                <SelectValue placeholder={t('chooseList')} />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                {leadLists.map(list => (
                  <SelectItem key={list.id} value={list.id} className="text-white">
                    {list.name} ({list.lead_count || list.lead_ids?.length || 0} leads)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedListId && (
              <p className="text-gray-500 text-xs mt-1">
                {leadsInList.length} {t('leadsWillReceive')}
              </p>
            )}
          </div>

          {/* Message Preview + Edit */}
          <div>
            <label className="text-gray-400 text-sm mb-1.5 block">{t('messageContent')}</label>
            {template?.subject && (
              <div className="mb-2 p-2 rounded-lg bg-white/5 border border-white/10 text-sm">
                <span className="text-gray-400 text-xs">{t('subjectLabel')} </span>
                <span className="text-white">{template.subject}</span>
              </div>
            )}
            <Textarea
              value={customContent}
              onChange={(e) => setCustomContent(e.target.value)}
              className="min-h-[150px] bg-black/30 border-white/10 text-white text-sm"
              placeholder={t('msgContentPlaceholder')}
            />
            <p className="text-gray-600 text-xs mt-1">{t('variablesHint')}</p>
          </div>

          {/* Send Progress */}
          {sending && (
            <div className="p-3 rounded-xl bg-[#38b6ff]/10 border border-[#38b6ff]/20">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-[#38b6ff]">{t('sendingProgress')}</span>
                <span className="text-white">{sent}/{total}</span>
              </div>
              <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden">
                <div className="h-full bg-[#38b6ff] transition-all duration-300" style={{ width: `${total ? (sent / total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSend} disabled={sending || !selectedListId}
              className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2 flex-1">
              <Send size={16} />
              {sending ? `${t('sendingProgress')} ${sent}/${total}` : `${t('sendTo')} ${leadsInList.length} ${t('leadsLabel')}`}
            </Button>
            <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">
              {t('cancel')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}