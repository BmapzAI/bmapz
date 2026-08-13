import React from 'react';
import { Bot, Clock, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  PRIORITY_CLASS, priorityLabel, sectionLabel, assigneeLabel, formatDue, isOverdue,
} from './taskMeta';

/**
 * One task, as a clickable card.
 *
 * Shows who it is for and — once done — WHO DID IT, which is the point of the
 * `done_by_label` the backend computes ("Bmapz AI", "@someone"). Everything
 * rendered here is a string or number: rendering a raw object into JSX is a bug
 * this codebase has hit before, so `assignee` / `creator` are only ever read
 * through the helpers.
 */
export default function TaskCard({ task, isPt, isFollowing = false, onClick }) {
  const overdue = isOverdue(task);
  const due = formatDue(task.due_at, isPt);

  // NOT a <button>, deliberately.
  //
  // @hello-pangea/dnd refuses to start a drag when the pointer goes down on an
  // interactive element — button, a, input, select, textarea — because dragging
  // those would fight the browser's own behaviour. This card WAS a <button>, so
  // every drag attempt on the kanban was swallowed before it began, even though
  // the Draggable and its handle props were wired correctly.
  //
  // A div with an explicit role, tabIndex and key handler keeps the card
  // clickable and reachable by keyboard while leaving the drag sensor free.
  const activate = () => onClick?.(task);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();   // stop Space scrolling the board
          activate();
        }
      }}
      className="w-full text-left p-3 rounded-xl bg-black/30 border border-white/10 hover:border-[#38b6ff]/40 hover:bg-black/40 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#38b6ff]/60"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-white text-sm font-medium line-clamp-2">{task.title}</span>
        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_CLASS[task.priority] || PRIORITY_CLASS.medium}`}>
          {priorityLabel(task.priority, isPt)}
        </span>
      </div>

      {task.description ? (
        <p className="text-gray-500 text-xs line-clamp-2 mb-2">{task.description}</p>
      ) : null}

      <div className="flex items-center flex-wrap gap-2 text-[11px] text-gray-400">
        <span className="inline-flex items-center gap-1">
          {task.assignee_type === 'ai' ? <Bot size={11} className="text-[#38b6ff]" /> : null}
          {assigneeLabel(task, isPt)}
        </span>

        {task.section && task.section !== 'general' ? (
          <span className="px-1.5 py-0.5 rounded bg-white/5">{sectionLabel(task.section, isPt)}</span>
        ) : null}

        {due ? (
          <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-400' : ''}`}>
            <Clock size={11} /> {due}
          </span>
        ) : null}

        {task.visibility === 'private' ? (
          <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300">
            {isPt ? 'Privada' : 'Private'}
          </span>
        ) : null}

        {isFollowing ? <Eye size={11} className="text-[#38b6ff]" /> : null}
      </div>

      {/* Who actually did it — a person or the agent. */}
      {task.status === 'done' && task.done_by_label ? (
        <div className="mt-2 pt-2 border-t border-white/5 text-[11px] text-green-400 inline-flex items-center gap-1">
          <CheckCircle2 size={11} />
          {isPt ? 'Feito por' : 'Done by'} {task.done_by_label}
        </div>
      ) : null}

      {task.ai_error ? (
        <div className="mt-2 pt-2 border-t border-white/5 text-[11px] text-red-400 inline-flex items-start gap-1">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          <span className="line-clamp-2">{task.ai_error}</span>
        </div>
      ) : null}
    </div>
  );
}
