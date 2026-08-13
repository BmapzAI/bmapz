/**
 * Shared task vocabulary: the board columns, priorities, sections and the labels
 * for both languages.
 *
 * Kept in one module so the My Tasks tab, the Home widget and the AI-chat table
 * mode cannot drift apart, and so every status string the UI sends matches the
 * CHECK constraints in migration 031 exactly.
 */

/**
 * The columns the board shows, in order.
 *
 * 'standby' comes first: work that is real and agreed but not yet actionable —
 * waiting on someone else, on a date, or on a decision. Keeping it out of "To do"
 * is what makes "To do" mean "can be started now".
 */
export const BOARD_STATUSES = ['standby', 'todo', 'doing', 'done'];

/** Every legal status, including the two that live off the board. */
export const ALL_STATUSES = ['standby', 'todo', 'doing', 'done', 'blocked', 'cancelled'];

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export const SECTIONS = ['general', 'ads', 'sales', 'workflow', 'inbox', 'blog',
  'sdr', 'seo', 'social', 'dashboard'];

export const statusLabel = (status, isPt) => ({
  standby: isPt ? 'Em espera' : 'Standby',
  todo: isPt ? 'A fazer' : 'To do',
  doing: isPt ? 'Fazendo' : 'Doing',
  done: isPt ? 'Concluído' : 'Done',
  blocked: isPt ? 'Bloqueado' : 'Blocked',
  cancelled: isPt ? 'Cancelado' : 'Cancelled',
}[status] || status);

export const priorityLabel = (p, isPt) => ({
  low: isPt ? 'Baixa' : 'Low',
  medium: isPt ? 'Média' : 'Medium',
  high: isPt ? 'Alta' : 'High',
  urgent: isPt ? 'Urgente' : 'Urgent',
}[p] || p);

export const sectionLabel = (s, isPt) => ({
  general: isPt ? 'Geral' : 'General',
  ads: isPt ? 'Anúncios' : 'Ads',
  sales: isPt ? 'Vendas' : 'Sales',
  workflow: isPt ? 'Automação' : 'Workflow',
  inbox: isPt ? 'Caixa de entrada' : 'Inbox',
  blog: 'Blog',
  sdr: 'SDR',
  seo: 'SEO',
  social: isPt ? 'Redes sociais' : 'Social media',
  dashboard: isPt ? 'Painéis' : 'Dashboards',
}[s] || s);

export const PRIORITY_CLASS = {
  low: 'bg-gray-500/20 text-gray-300',
  medium: 'bg-blue-500/20 text-blue-300',
  high: 'bg-orange-500/20 text-orange-300',
  urgent: 'bg-red-500/20 text-red-300',
};

export const STATUS_CLASS = {
  standby: 'bg-amber-500/20 text-amber-300',
  todo: 'bg-gray-500/20 text-gray-300',
  doing: 'bg-[#38b6ff]/20 text-[#38b6ff]',
  done: 'bg-green-500/20 text-green-400',
  blocked: 'bg-red-500/20 text-red-300',
  cancelled: 'bg-gray-600/20 text-gray-500',
};

/**
 * Who the task is for, as a short label.
 *
 * The backend sends resolved `assignee` / `creator` profiles rather than an embed,
 * so prefer the @username the product uses as its primary identifier.
 */
export function assigneeLabel(task, isPt) {
  if (!task) return '';
  if (task.assignee_type === 'ai') return 'Bmapz AI';
  if (task.assignee_type === 'unassigned' || !task.assignee) {
    return isPt ? 'Sem responsável' : 'Unassigned';
  }
  const a = task.assignee;
  return a.username ? `@${a.username}` : (a.full_name || a.email || (isPt ? 'Alguém' : 'Someone'));
}

/** A date the user can read, in their language, tolerating a null or bad value. */
export function formatDue(value, isPt) {
  if (!value) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString(isPt ? 'pt-BR' : 'en-US', {
    day: '2-digit', month: 'short',
  });
}

/** Overdue = has a deadline in the past and is not finished. */
export const isOverdue = (task) =>
  !!task?.due_at
  && !['done', 'cancelled'].includes(task.status)
  && Date.parse(task.due_at) < Date.now();
