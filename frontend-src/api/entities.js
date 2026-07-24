/**
 * Entity API helpers — replaces base44.entities.*
 * Each entity maps to REST endpoints on our Express backend.
 */
import { api } from '@/api/apiClient';

// ─── Generic entity factory ──────────────────────────────────────────────────

function createEntity(basePath) {
  return {
    list: (params) => api.get(basePath, params),
    filter: (params) => api.get(basePath, params),
    get: (id) => api.get(`${basePath}/${id}`),
    create: (data) => api.post(basePath, data),
    update: (id, data) => api.patch(`${basePath}/${id}`, data),
    delete: (id) => api.delete(`${basePath}/${id}`),
  };
}

// ─── Company ─────────────────────────────────────────────────────────────────

export const Company = {
  list: () => api.get('/api/companies/current').then(c => [c]),
  filter: () => api.get('/api/companies/current').then(c => [c]),
  get: () => api.get('/api/companies/current'),
  create: (data) => api.post('/api/companies', data),
  update: (_id, data) => api.patch('/api/companies/current', data),
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const User = {
  ...createEntity('/api/users'),
  me: () => api.get('/api/users/me'),
};

// ─── Leads ────────────────────────────────────────────────────────────────────

export const Lead = {
  list: (params) => api.get('/api/leads', params).then(r => r.data ?? r),
  filter: (params) => api.get('/api/leads', params).then(r => r.data ?? r),
  get: (id) => api.get(`/api/leads/${id}`),
  create: (data) => api.post('/api/leads', data),
  update: (id, data) => api.patch(`/api/leads/${id}`, data),
  delete: (id) => api.delete(`/api/leads/${id}`),
  score: (id) => api.post(`/api/leads/${id}/score`),
  bulkCreate: (leads) => api.post('/api/leads/bulk', { leads }),
};

export const LeadList = createEntity('/api/leads/lists');

// ─── Messaging ────────────────────────────────────────────────────────────────

export const Message = {
  list: (params) => api.get('/api/messaging', params).then(r => r.data ?? r),
  filter: (params) => api.get('/api/messaging', params).then(r => r.data ?? r),
  get: (id) => api.get(`/api/messaging/${id}`),
  create: (data) => api.post('/api/messaging', data),
  update: (id, data) => api.patch(`/api/messaging/${id}`, data),
};

export const MessageTemplate = {
  list: () => api.get('/api/messaging/templates'),
  filter: () => api.get('/api/messaging/templates'),
  get: (id) => api.get(`/api/messaging/templates/${id}`),
  create: (data) => api.post('/api/messaging/templates', data),
  update: (id, data) => api.patch(`/api/messaging/templates/${id}`, data),
  delete: (id) => api.delete(`/api/messaging/templates/${id}`),
};

export const Activity = {
  list: (params) => api.get('/api/messaging/activities', params).then(r => r.data ?? r),
  filter: (params) => api.get('/api/messaging/activities', params).then(r => r.data ?? r),
  create: (data) => api.post('/api/messaging/activities', data),
};

// ─── Workflows ────────────────────────────────────────────────────────────────

export const Workflow = {
  list: (params) => api.get('/api/workflows', params).then(r => r.data ?? r),
  filter: (params) => api.get('/api/workflows', params).then(r => r.data ?? r),
  get: (id) => api.get(`/api/workflows/${id}`),
  create: (data) => api.post('/api/workflows', data),
  update: (id, data) => api.patch(`/api/workflows/${id}`, data),
  delete: (id) => api.delete(`/api/workflows/${id}`),
  run: (id, data) => api.post(`/api/workflows/${id}/run`, data),
  getRuns: (id) => api.get(`/api/workflows/${id}/runs`),
};

// ─── Social ───────────────────────────────────────────────────────────────────

export const SocialPost = {
  list: (params) => api.get('/api/social/posts', params).then(r => r.data ?? r),
  filter: (params) => api.get('/api/social/posts', params).then(r => r.data ?? r),
  get: (id) => api.get(`/api/social/posts/${id}`),
  create: (data) => api.post('/api/social/posts', data),
  update: (id, data) => api.patch(`/api/social/posts/${id}`, data),
  delete: (id) => api.delete(`/api/social/posts/${id}`),
  publish: (id) => api.post(`/api/social/posts/${id}/publish`),
  getFeed: (params) => api.get('/api/social/feed', params),
  getAnalytics: (params) => api.get('/api/social/analytics', params),
};

// ─── Ads ─────────────────────────────────────────────────────────────────────

export const AdRecord = {
  list: (params) => api.get('/api/ads/records', params).then(r => r.data ?? r),
  filter: (params) => api.get('/api/ads/records', params).then(r => r.data ?? r),
  get: (id) => api.get(`/api/ads/records/${id}`),
  create: (data) => api.post('/api/ads/records', data),
  update: (id, data) => api.patch(`/api/ads/records/${id}`, data),
  delete: (id) => api.delete(`/api/ads/records/${id}`),
  getCampaigns: (params) => api.get('/api/ads/campaigns', params),
  getPlatformLeads: (params) => api.get('/api/ads/platform-leads', params),
};

// ─── SEO ─────────────────────────────────────────────────────────────────────

export const SEOAnalysis = {
  list: () => api.get('/api/seo'),
  filter: () => api.get('/api/seo'),
  get: (id) => api.get(`/api/seo/${id}`),
  create: (data) => api.post('/api/seo', data),
  update: (id, data) => api.patch(`/api/seo/${id}`, data),
  delete: (id) => api.delete(`/api/seo/${id}`),
  getSearchConsole: (params) => api.get('/api/seo/search-console', params),
};

// ─── Blog ─────────────────────────────────────────────────────────────────────

export const BlogPost = {
  list: (params) => api.get('/api/blog', params).then(r => r.data ?? r),
  filter: (params) => api.get('/api/blog', params).then(r => r.data ?? r),
  get: (id) => api.get(`/api/blog/${id}`),
  create: (data) => api.post('/api/blog', data),
  update: (id, data) => api.patch(`/api/blog/${id}`, data),
  delete: (id) => api.delete(`/api/blog/${id}`),
};

// ─── AI Outputs ───────────────────────────────────────────────────────────────

export const AIOutput = {
  list: (params) => api.get('/api/ai/outputs', params).then(r => r.data ?? r),
  filter: (params) => api.get('/api/ai/outputs', params).then(r => r.data ?? r),
  get: (id) => api.get(`/api/ai/outputs/${id}`),
  create: (data) => api.post('/api/ai/outputs', data),
  update: (id, data) => api.patch(`/api/ai/outputs/${id}`, data),
  delete: (id) => api.delete(`/api/ai/outputs/${id}`),
};

// ─── Billing ─────────────────────────────────────────────────────────────────

export const Subscription = {
  list: () => api.get('/api/billing/subscription').then(s => (s ? [s] : [])),
  filter: () => api.get('/api/billing/subscription').then(s => (s ? [s] : [])),
  get: () => api.get('/api/billing/subscription'),
};

export const BillingPurchase = {
  list: () => api.get('/api/billing/purchases'),
  filter: () => api.get('/api/billing/purchases'),
};

export const CreditTransaction = {
  list: () => api.get('/api/billing/transactions'),
  filter: () => api.get('/api/billing/transactions'),
};

// ─── Data Deletion Requests (GDPR) ───────────────────────────────────────────

export const DataDeletionRequest = {
  create: (data) => api.post('/api/data-deletion', data),
};

// ─── Funnels ─────────────────────────────────────────────────────────────────

export const Funnel = createEntity('/api/funnels');

// ─── AI Automations (scheduled tasks / cron jobs) ────────────────────────────

export const AIAutomation = {
  ...createEntity('/api/automations'),
  runNow: (id) => api.post(`/api/automations/${id}/run`),
};

// ─── Design Studio templates ──────────────────────────────────────────────────

export const DesignTemplate = createEntity('/api/design-templates');

// ─── Notifications ────────────────────────────────────────────────────────────

export const Notification = {
  list: (params) => api.get('/api/notifications', params),
  unreadCount: () => api.get('/api/notifications/unread-count'),
  markRead: (id, read = true) => api.patch(`/api/notifications/${id}`, { read }),
  readAll: () => api.post('/api/notifications/read-all'),
  delete: (id) => api.delete(`/api/notifications/${id}`),
};

// ─── SDR (client-facing sales-development bot) ────────────────────────────────

export const SDR = {
  getAgent: () => api.get('/api/sdr/agent'),
  saveAgent: (data) => api.patch('/api/sdr/agent', data),
  autofill: () => api.post('/api/sdr/autofill'),
  conversations: (params) => api.get('/api/sdr/conversations', params),
  conversation: (id) => api.get(`/api/sdr/conversations/${id}`),
  test: (data) => api.post('/api/sdr/test', data),
  inbound: (data) => api.post('/api/sdr/inbound', data),
};

// ─── Canva integration ────────────────────────────────────────────────────────

export const Canva = {
  status: () => api.get('/api/canva/status'),
  designs: () => api.get('/api/canva/designs'),
  export: (design_id) => api.post('/api/canva/export', { design_id }),
  import: (image_url, title) => api.post('/api/canva/import', { image_url, title }),
};

// ─── Dashboard Configs ────────────────────────────────────────────────────────

export const DashboardConfig = {
  list: (params) => api.get('/api/dashboard-configs', params),
  filter: (params) => api.get('/api/dashboard-configs', params),
  get: (id) => api.get(`/api/dashboard-configs/${id}`),
  create: (data) => api.post('/api/dashboard-configs', data),
  update: (id, data) => api.patch(`/api/dashboard-configs/${id}`, data),
  delete: (id) => api.delete(`/api/dashboard-configs/${id}`),
};

// ─── Brand Scans ─────────────────────────────────────────────────────────────

export const BrandScanData = {
  list: (params) => api.get('/api/brand-scans', params),
  filter: (params) => api.get('/api/brand-scans', params),
  get: (id) => api.get(`/api/brand-scans/${id}`),
  create: (data) => api.post('/api/brand-scans', data),
  update: (id, data) => api.patch(`/api/brand-scans/${id}`, data),
  delete: (id) => api.delete(`/api/brand-scans/${id}`),
};

// ─── Node Templates ───────────────────────────────────────────────────────────

export const NodeTemplate = {
  list: (params) => api.get('/api/node-templates', params),
  filter: (params) => api.get('/api/node-templates', params),
  get: (id) => api.get(`/api/node-templates/${id}`),
  create: (data) => api.post('/api/node-templates', data),
  update: (id, data) => api.patch(`/api/node-templates/${id}`, data),
  delete: (id) => api.delete(`/api/node-templates/${id}`),
};

// ─── Workflow Runs ─────────────────────────────────────────────────────────────

export const WorkflowRun = {
  list: (params) => api.get('/api/workflow-runs', params).then(r => r.data ?? r),
  filter: (params) => api.get('/api/workflow-runs', params).then(r => r.data ?? r),
  get: (id) => api.get(`/api/workflow-runs/${id}`),
  create: (data) => api.post('/api/workflow-runs', data),
  update: (id, data) => api.patch(`/api/workflow-runs/${id}`, data),
};