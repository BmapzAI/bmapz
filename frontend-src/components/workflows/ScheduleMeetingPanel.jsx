import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, Video, Calendar, Link } from 'lucide-react';

const MEETING_TOOLS = [
  { value: 'google_meet', label: '🎥 Google Meet', statusKey: 'google_meet', description: 'Creates real Google Meet link + adds to Google Calendar' },
  { value: 'calendly', label: '📅 Calendly', statusKey: 'calendly', description: 'Sends your Calendly booking link to the lead' },
  { value: 'manual', label: '✉️ Manual (no link)', statusKey: null, description: 'Sends a message asking for availability' },
];

const DURATION_OPTIONS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1.5 hours' },
];

export default function ScheduleMeetingPanel({ node, onUpdate, integrationStatus = {} }) {
  const meetingTool = node.meeting_tool || 'google_meet';
  const selectedTool = MEETING_TOOLS.find(t => t.value === meetingTool);
  const isConnected = selectedTool?.statusKey ? (integrationStatus[selectedTool.statusKey] === true) : true;

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-[#a78bfa]/10 border border-[#a78bfa]/20 text-xs text-[#a78bfa]">
        <Info size={12} className="flex-shrink-0 mt-0.5" />
        <span>Automatically creates a meeting and sends an invitation to the lead. Connect tools in <strong>Integrations</strong> first.</span>
      </div>

      {/* Meeting tool selector */}
      <div>
        <Label className="text-gray-400 text-xs">Meeting Tool</Label>
        <Select value={meetingTool} onValueChange={(v) => onUpdate(node.id, { meeting_tool: v })}>
          <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            {MEETING_TOOLS.map(t => (
              <SelectItem key={t.value} value={t.value} className="text-white">
                <div className="flex items-center justify-between w-full gap-2">
                  <span>{t.label}</span>
                  {t.statusKey && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${integrationStatus[t.statusKey] ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {integrationStatus[t.statusKey] ? 'Connected' : 'Not connected'}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedTool && (
          <p className="text-gray-500 text-[10px] mt-1">{selectedTool.description}</p>
        )}
      </div>

      {/* Not connected warning */}
      {!isConnected && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <Info size={12} className="flex-shrink-0 mt-0.5" />
          <span><strong>{selectedTool?.label}</strong> is not connected. Go to <strong>Integrations</strong> to connect it before using this step.</span>
        </div>
      )}

      {/* Google Meet specific options */}
      {meetingTool === 'google_meet' && (
        <>
          <div>
            <Label className="text-gray-400 text-xs">Meeting Title (optional)</Label>
            <Input
              value={node.meeting_title || ''}
              onChange={(e) => onUpdate(node.id, { meeting_title: e.target.value })}
              placeholder="Meeting with {{lead_name}}"
              className="mt-1 bg-black/30 border-white/10 text-white text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-gray-400 text-xs">Duration</Label>
              <Select value={String(node.meeting_duration || '30')} onValueChange={(v) => onUpdate(node.id, { meeting_duration: parseInt(v) })}>
                <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  {DURATION_OPTIONS.map(d => (
                    <SelectItem key={d.value} value={d.value} className="text-white">{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Preferred date/time</Label>
              <Input
                type="datetime-local"
                value={node.meeting_date || ''}
                onChange={(e) => onUpdate(node.id, { meeting_date: e.target.value })}
                className="mt-1 bg-black/30 border-white/10 text-white text-sm"
              />
            </div>
          </div>
          <p className="text-gray-500 text-[10px] -mt-2">Leave date empty to auto-schedule next business day at 10am.</p>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/5 border border-green-500/10 text-xs text-green-400">
            <Video size={12} />
            <span>Google Meet link will be auto-generated and added to the calendar invite sent to the lead.</span>
          </div>
        </>
      )}

      {/* Calendly specific options */}
      {meetingTool === 'calendly' && (
        <div>
          <Label className="text-gray-400 text-xs">Calendly booking URL (optional override)</Label>
          <Input
            value={node.calendly_url || ''}
            onChange={(e) => onUpdate(node.id, { calendly_url: e.target.value })}
            placeholder="https://calendly.com/your-link (auto-detected if connected)"
            className="mt-1 bg-black/30 border-white/10 text-white text-sm"
          />
          <p className="text-gray-500 text-[10px] mt-1">If your Calendly API key is set in Integrations, the link is fetched automatically.</p>
        </div>
      )}

      {/* Custom invitation message */}
      <div>
        <Label className="text-gray-400 text-xs">Custom Invitation Message (optional)</Label>
        <Textarea
          value={node.message_content || ''}
          onChange={(e) => onUpdate(node.id, { message_content: e.target.value })}
          placeholder="Leave empty to use the auto-generated invitation with meeting link. Use {{lead_name}}, {{meet_link}} as placeholders."
          className="mt-1 min-h-[90px] bg-black/30 border-white/10 text-white text-sm"
        />
        <p className="text-gray-500 text-[10px] mt-1">Variables: {'{{lead_name}}'}, {'{{lead_company}}'}, {'{{meet_link}}'}</p>
      </div>

      {/* Send via */}
      <div>
        <Label className="text-gray-400 text-xs">Send invitation via</Label>
        <Select value={node.invite_channel || 'auto'} onValueChange={(v) => onUpdate(node.id, { invite_channel: v })}>
          <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            <SelectItem value="auto" className="text-white">Auto (email if available, else WhatsApp)</SelectItem>
            <SelectItem value="email" className="text-white">📧 Email only</SelectItem>
            <SelectItem value="whatsapp" className="text-white">💬 WhatsApp only</SelectItem>
            <SelectItem value="both" className="text-white">Both email & WhatsApp</SelectItem>
            <SelectItem value="calendar_only" className="text-white">Calendar invite only (no message)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Auto-send toggle */}
      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 border border-white/10">
        <div>
          <p className="text-white text-xs font-medium">Auto-send invitation</p>
          <p className="text-gray-500 text-[10px]">Send automatically; otherwise creates a draft</p>
        </div>
        <input
          type="checkbox"
          checked={node.auto_send !== false}
          onChange={(e) => onUpdate(node.id, { auto_send: e.target.checked })}
          className="w-4 h-4 rounded border-white/20 bg-black/30 accent-[#a78bfa]"
        />
      </div>
    </div>
  );
}