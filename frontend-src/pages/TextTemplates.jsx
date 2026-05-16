import React, { useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, Send, Mail, MessageSquare, Linkedin, Copy } from 'lucide-react';
import SendMessageModal from '@/components/messaging/SendMessageModal';
import { Company, MessageTemplate } from '@/api/entities';

const CHANNEL_CONFIG = {
  email: { icon: Mail, color: '#38b6ff', label: 'Email' },
  whatsapp: { icon: MessageSquare, color: '#25D366', label: 'WhatsApp' },
  linkedin: { icon: Linkedin, color: '#0077b5', label: 'LinkedIn' },
};

const TONE_OPTIONS = ['professional', 'friendly', 'consultative', 'direct', 'strategic', 'provocative', 'performance'];
const CATEGORY_OPTIONS = ['initial_outreach', 'follow_up', 'pattern_interrupt', 'objection_handling', 'meeting_request', 'custom'];

const EMPTY_TEMPLATE = { name: '', channel: 'email', subject: '', content: '', tone: 'professional', category: 'initial_outreach' };

const STARTER_TEMPLATES = [
  {
    id: 'st1', name: 'Cold Email - ICP Intro', channel: 'email', tone: 'professional', category: 'initial_outreach',
    subject: 'Quick question about {{company_name}}',
    content: `Hi {{first_name}},

I came across {{company_name}} and noticed you might be facing [main pain point].

We help [ICP description] achieve [transformation] — typically within [timeframe].

Would it make sense to connect for a quick 15-min call this week?

Best,
{{sender_name}}`,
  },
  {
    id: 'st2', name: 'WhatsApp - First Touch', channel: 'whatsapp', tone: 'friendly', category: 'initial_outreach',
    content: `Hi {{first_name}}! I found your profile at {{company_name}} and thought you might find this relevant 👋

We help [ICP] with [solution]. Quick question: is [pain point] a challenge for your team right now?

If yes, I'd love to share how we solved this for [similar company]. Worth a 10-min call?`,
  },
  {
    id: 'st3', name: 'LinkedIn - Connection Request', channel: 'linkedin', tone: 'direct', category: 'initial_outreach',
    content: 'Hi {{first_name}}, I work with [ICP role] at [ICP company type] helping them [transformation]. Your background at {{company_name}} caught my attention — would love to connect and share some insights that might be relevant.',
  },
  {
    id: 'st4', name: 'Follow-Up #1 - Added Value', channel: 'email', tone: 'consultative', category: 'follow_up',
    subject: 'Re: Quick question about {{company_name}}',
    content: `Hi {{first_name}},

Following up on my previous message. I wanted to share [specific resource/insight] that I think could be valuable for {{company_name}}.

[Insert case study or insight here]

Would you be open to a 15-minute call to explore if this could work for you?

Best,
{{sender_name}}`,
  },
  {
    id: 'st5', name: 'Pattern Interrupt - Break Through Silence', channel: 'email', tone: 'provocative', category: 'pattern_interrupt',
    subject: 'Should I stop reaching out?',
    content: `Hi {{first_name}},

I've reached out a couple of times without hearing back. I'll take the hint — but before I close your file, I wanted to ask directly:

Is [main pain point] not a priority for {{company_name}} right now? Or is the timing just off?

Either way, a quick "not interested" or "try me in Q3" would really help me understand.

Thanks either way,
{{sender_name}}`,
  },
  {
    id: 'st6', name: 'Meeting Request - Post Conversation', channel: 'email', tone: 'direct', category: 'meeting_request',
    subject: 'Next step: {{date}} call?',
    content: `Hi {{first_name}},

Great talking earlier! As promised, here's the scheduling link: [LINK]

I'll come prepared with:
• A custom analysis of {{company_name}}'s current situation
• 2-3 specific strategies we'd recommend
• ROI estimates based on similar clients

Looking forward to it!

{{sender_name}}`,
  },
];

export default function TextTemplates() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterChannel, setFilterChannel] = useState('all');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [sendModal, setSendModal] = useState(null);
  const [formData, setFormData] = useState(EMPTY_TEMPLATE);
  const [saving, setSaving] = useState(false);

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => Company.list() });
  const company = companies[0];

  const { data: templates = [] } = useQuery({
    queryKey: ['messageTemplates', company?.id],
    queryFn: () => company?.id ? MessageTemplate.filter({ company_id: company.id }) : [],
    enabled: !!company?.id,
  });

  const filtered = templates.filter(t => {
    const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.content.toLowerCase().includes(search.toLowerCase());
    const matchesChannel = filterChannel === 'all' || t.channel === filterChannel;
    return matchesSearch && matchesChannel;
  });

  const openNew = () => {
    setEditingTemplate(null);
    setFormData(EMPTY_TEMPLATE);
    setShowForm(true);
  };

  const openEdit = (t) => {
    setEditingTemplate(t);
    setFormData({ name: t.name, channel: t.channel, subject: t.subject || '', content: t.content, tone: t.tone || 'professional', category: t.category || 'initial_outreach' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.content) { toast.error('Name and content are required'); return; }
    setSaving(true);
    try {
      const payload = { ...formData, company_id: company.id };
      if (editingTemplate) {
        await MessageTemplate.update(editingTemplate.id, payload);
        toast.success('Template updated');
      } else {
        await MessageTemplate.create(payload);
        toast.success('Template created');
      }
      queryClient.invalidateQueries({ queryKey: ['messageTemplates'] });
      setShowForm(false);
    } catch (e) { toast.error('Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (t) => {
    if (!confirm(`Delete "${t.name}"?`)) return;
    await MessageTemplate.delete(t.id);
    queryClient.invalidateQueries({ queryKey: ['messageTemplates'] });
    toast.success('Template deleted');
  };

  const handleDuplicate = async (t) => {
    await MessageTemplate.create({ ...t, id: undefined, name: t.name + ' (Copy)', company_id: company.id });
    queryClient.invalidateQueries({ queryKey: ['messageTemplates'] });
    toast.success('Template duplicated');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            Messaging & Email
          </h1>
          <p className="text-gray-400 mt-1">{templates.length} templates — WhatsApp, Email, LinkedIn</p>
        </div>
        <Button onClick={openNew} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
          <Plus size={16} /> New Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..." className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
        </div>
        <div className="flex gap-2">
          {['all', 'email', 'whatsapp', 'linkedin'].map(ch => (
            <button key={ch} onClick={() => setFilterChannel(ch)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${filterChannel === ch ? 'bg-[#38b6ff] text-black font-medium' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
              {ch === 'all' ? 'All' : CHANNEL_CONFIG[ch]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Template Grid */}
      {templates.length === 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-400 bg-[#38b6ff]/5 border border-[#38b6ff]/20 rounded-xl px-4 py-3">
            No templates yet. Use one of these starters or create your own with the button above.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {STARTER_TEMPLATES.filter(t => filterChannel === 'all' || t.channel === filterChannel).map(t => {
              const cfg = CHANNEL_CONFIG[t.channel];
              const Icon = cfg?.icon;
              return (
                <div key={t.id} className="p-5 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {Icon && <Icon size={14} style={{ color: cfg.color }} />}
                      <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg?.label}</span>
                    </div>
                    <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{t.tone}</span>
                  </div>
                  <p className="font-semibold text-white text-sm mb-2">{t.name}</p>
                  <p className="text-xs text-gray-500 mb-4 line-clamp-3 whitespace-pre-line">{t.content.slice(0, 120)}...</p>
                  <button
                    onClick={() => { setFormData({ name: t.name, channel: t.channel, subject: t.subject || '', content: t.content, tone: t.tone, category: t.category }); setShowForm(true); }}
                    className="w-full py-1.5 rounded-lg text-xs font-medium border border-white/10 text-gray-300 hover:border-[#38b6ff]/40 hover:text-[#38b6ff] transition-colors"
                  >
                    Use as Starting Point
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <MessageSquare size={48} className="mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400 text-lg font-medium">No templates yet</p>
          <p className="text-gray-600 text-sm mt-1">Create your first template to get started</p>
          <Button onClick={openNew} className="mt-4 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
            <Plus size={16} /> Create Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(t => {
            const ch = CHANNEL_CONFIG[t.channel] || CHANNEL_CONFIG.email;
            const ChIcon = ch.icon;
            return (
              <div key={t.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: ch.color + '20' }}>
                      <ChIcon size={16} style={{ color: ch.color }} />
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{t.name}</p>
                      <p className="text-gray-500 text-xs capitalize">{t.category?.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs border-white/10 text-gray-400 capitalize">{t.tone}</Badge>
                </div>
                {t.subject && (
                  <p className="text-gray-400 text-xs mb-1"><span className="text-gray-600">Subject:</span> {t.subject}</p>
                )}
                <p className="text-gray-500 text-xs line-clamp-3 mb-4 leading-relaxed">{t.content}</p>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" onClick={() => setSendModal(t)} className="flex-1 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1 text-xs h-7">
                    <Send size={12} /> Send
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(t)} className="text-gray-400 hover:text-white h-7 px-2">
                    <Edit2 size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDuplicate(t)} className="text-gray-400 hover:text-white h-7 px-2">
                    <Copy size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(t)} className="text-gray-400 hover:text-red-400 h-7 px-2">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-sm mb-1.5 block">Name *</label>
                <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="Template name" className="bg-black/30 border-white/10 text-white" />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1.5 block">Channel</label>
                <Select value={formData.channel} onValueChange={v => setFormData(p => ({ ...p, channel: v }))}>
                  <SelectTrigger className="bg-black/30 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {Object.entries(CHANNEL_CONFIG).map(([v, c]) => (
                      <SelectItem key={v} value={v} className="text-white">{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-sm mb-1.5 block">Category</label>
                <Select value={formData.category} onValueChange={v => setFormData(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="bg-black/30 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {CATEGORY_OPTIONS.map(c => (
                      <SelectItem key={c} value={c} className="text-white capitalize">{c.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1.5 block">Tone</label>
                <Select value={formData.tone} onValueChange={v => setFormData(p => ({ ...p, tone: v }))}>
                  <SelectTrigger className="bg-black/30 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    {TONE_OPTIONS.map(t => (
                      <SelectItem key={t} value={t} className="text-white capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formData.channel === 'email' && (
              <div>
                <label className="text-gray-400 text-sm mb-1.5 block">Subject</label>
                <Input value={formData.subject} onChange={e => setFormData(p => ({ ...p, subject: e.target.value }))}
                  placeholder="Email subject" className="bg-black/30 border-white/10 text-white" />
              </div>
            )}
            <div>
              <label className="text-gray-400 text-sm mb-1.5 block">Content *</label>
              <Textarea value={formData.content} onChange={e => setFormData(p => ({ ...p, content: e.target.value }))}
                placeholder="Use [First Name], [Company Name], [Your Name] as variables..."
                className="min-h-[200px] bg-black/30 border-white/10 text-white text-sm" />
              <p className="text-gray-600 text-xs mt-1">Variables: [First Name] [Last Name] [Company Name] [Role] [Your Name]</p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-gradient-to-r from-[#3572b9] to-[#38b6ff]">
                {saving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Modal */}
      {sendModal && <SendMessageModal template={sendModal} onClose={() => setSendModal(null)} />}
    </div>
  );
}