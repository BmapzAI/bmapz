import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, MessageSquare, ExternalLink, Loader2 } from 'lucide-react';

/**
 * DrillDownModal — the pop-up behind every clickable dashboard bar/slice.
 * Shows the actual records that make up the number ("MQL — 1 lead") and links
 * each row to its page. Used by the Dashboards widgets (client-filtered data)
 * and OperationsMetrics (server-fetched data).
 *
 * Props:
 *  - open, onClose
 *  - title: e.g. 'MQL — leads at this stage'
 *  - kind: 'leads' | 'messages'
 *  - items: array of lead or message rows (already filtered to the bar)
 *  - leadsById: optional map for resolving message → lead names
 *  - loading: show spinner while a server fetch is in flight
 */
const STAGE_COLORS = {
  prospect: '#3572b9', awareness: '#38b6ff', consideration: '#8b5cf6', mql: '#38b6ff',
  sql: '#cb6ce6', opportunity: '#f59e0b', customer: '#22c55e', retention: '#14b8a6', advocacy: '#eab308',
};

function LeadRow({ lead, onOpen }) {
  return (
    <button
      onClick={() => onOpen(`/LeadDetails?id=${lead.id}`)}
      className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors"
    >
      <div className="min-w-0">
        <p className="text-white text-sm font-medium truncate">{lead.lead_name || lead.name || lead.email || 'Unnamed lead'}</p>
        <p className="text-gray-500 text-xs truncate">
          {[lead.lead_company_name || lead.company_name, lead.email].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {lead.funnel_stage && (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
            style={{ color: STAGE_COLORS[lead.funnel_stage] || '#999', borderColor: `${STAGE_COLORS[lead.funnel_stage] || '#999'}44`, backgroundColor: `${STAGE_COLORS[lead.funnel_stage] || '#999'}18` }}
          >
            {lead.funnel_stage}
          </span>
        )}
        <ExternalLink size={13} className="text-gray-500" />
      </div>
    </button>
  );
}

function MessageRow({ message, leadsById, onOpen }) {
  const lead = message.lead_id ? leadsById?.[message.lead_id] : null;
  const when = message.created_at || message.sent_at;
  const target = lead ? `/LeadDetails?id=${lead.id}` : '/Inbox';
  return (
    <button
      onClick={() => onOpen(target)}
      className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors"
    >
      <div className="min-w-0">
        <p className="text-white text-sm font-medium truncate">
          {lead ? (lead.lead_name || lead.name || lead.email) : (message.subject || 'Message')}
          <span className={`ml-2 text-[10px] ${message.direction === 'inbound' ? 'text-green-400' : 'text-[#38b6ff]'}`}>
            {message.direction === 'inbound' ? '↓ inbound' : '↑ outbound'}
          </span>
        </p>
        <p className="text-gray-500 text-xs truncate">{(message.content || message.body || '').slice(0, 80) || '—'}</p>
      </div>
      <span className="text-gray-600 text-[10px] flex-shrink-0">
        {when ? new Date(when).toLocaleString() : ''}
      </span>
    </button>
  );
}

function UserRow({ user }) {
  const status = user.sales_status || 'offline';
  const dot = { online: 'text-green-400', standby: 'text-yellow-400', offline: 'text-gray-500' }[status] || 'text-gray-500';
  return (
    <div className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
      <div className="min-w-0">
        <p className="text-white text-sm font-medium truncate">{user.full_name || user.email}</p>
        <p className="text-gray-500 text-xs truncate">{user.email}</p>
      </div>
      <span className={`text-xs flex-shrink-0 capitalize ${dot}`}>● {status}</span>
    </div>
  );
}

export default function DrillDownModal({ open, onClose, title, kind, items = [], leadsById, loading = false }) {
  const navigate = useNavigate();
  const openPage = (path) => { onClose(); navigate(path); };
  const Icon = kind === 'messages' ? MessageSquare : Users;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-[#111] border-white/10 text-white max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon size={16} className="text-[#38b6ff]" />
            {title}
            {!loading && <span className="text-gray-500 text-xs font-normal">({items.length})</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto space-y-2 pr-1 flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-500 text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-10">Nothing here yet.</p>
          ) : kind === 'messages' ? (
            items.slice(0, 100).map((m) => <MessageRow key={m.id} message={m} leadsById={leadsById} onOpen={openPage} />)
          ) : kind === 'users' ? (
            items.map((u) => <UserRow key={u.id} user={u} />)
          ) : (
            items.slice(0, 200).map((l) => <LeadRow key={l.id} lead={l} onOpen={openPage} />)
          )}
          {!loading && items.length > (kind === 'messages' ? 100 : 200) && (
            <p className="text-gray-600 text-xs text-center pt-1">Showing the first {kind === 'messages' ? 100 : 200} of {items.length}.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
