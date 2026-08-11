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
  // Sales team membership is admin-controlled; availability is self-controlled.
  setSalesTeam: (id, isMember) => api.patch(`/api/users/${id}/sales-team`, { is_sales_team: !!isMember }),
  setSalesStatus: (status) => api.patch('/api/users/me/sales-status', { sales_status: status }),
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
  // Ownership: a lead belongs to exactly one teammate. Pass null to unassign.
  assign: (id, ownerId) => api.patch(`/api/leads/${id}/owner`, { owner_id: ownerId || null }),
  // History: the full handling timeline, visible to the whole company.
  activities: (id, params) => api.get(`/api/leads/${id}/activities`, params),
  addNote: (id, summary, details) => api.post(`/api/leads/${id}/activities`, { summary, details }),
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

/**
 * Ads Manager — the real campaign → ad group → ad hierarchy.
 * (AdRecord above remains for the legacy saved strategies/copies.)
 */
export const AdsManager = {
  platforms: () => api.get('/api/ads-manager/platforms'),

  listCampaigns: (params) => api.get('/api/ads-manager/campaigns', params),
  createCampaign: (data) => api.post('/api/ads-manager/campaigns', data),
  // Saved strategies/copies now live in the AI Outputs archive; these endpoints
  // read BOTH it and the legacy ad_records table so the list is correct before
  // and after migration 025.
  savedList: () => api.get('/api/ads-manager/saved').then(r => r?.data ?? r ?? []),
  saveWork: (data) => api.post('/api/ads-manager/saved', data),
  deleteSaved: (id) => api.delete(`/api/ads-manager/saved/${id}`),
  updateCampaign: (id, data) => api.patch(`/api/ads-manager/campaigns/${id}`, data),
  deleteCampaign: (id) => api.delete(`/api/ads-manager/campaigns/${id}`),

  createAdGroup: (data) => api.post('/api/ads-manager/ad-groups', data),
  updateAdGroup: (id, data) => api.patch(`/api/ads-manager/ad-groups/${id}`, data),
  deleteAdGroup: (id) => api.delete(`/api/ads-manager/ad-groups/${id}`),

  createAd: (data) => api.post('/api/ads-manager/ads', data),
  updateAd: (id, data) => api.patch(`/api/ads-manager/ads/${id}`, data),
  deleteAd: (id) => api.delete(`/api/ads-manager/ads/${id}`),

  // levels = { campaign, ad_groups, ads }
  validate: (id, levels) => api.post(`/api/ads-manager/campaigns/${id}/validate`, { levels }),
  publish: (id, levels) => api.post(`/api/ads-manager/campaigns/${id}/publish`, { levels }),

  generate: (brief) => api.post('/api/ads-manager/generate', brief),
  applyPlan: (data) => api.post('/api/ads-manager/generate/apply', data),
  optimize: (data) => api.post('/api/ads-manager/optimize', data),
  handoverLeads: (data) => api.post('/api/ads-manager/leads/handover', data),

  // Hierarchy: strategy sits above the campaign, copy below the ad.
  listStrategies: () => api.get('/api/ads-manager/strategies'),
  generateStrategy: (campaignId, data) => api.post(`/api/ads-manager/campaigns/${campaignId}/strategy`, data),
  // Each level builds the one below it.
  generateAdGroups: (campaignId, data) => api.post(`/api/ads-manager/campaigns/${campaignId}/ad-groups/generate`, data),
  generateAds: (adGroupId, data) => api.post(`/api/ads-manager/ad-groups/${adGroupId}/ads/generate`, data),
  generateCopy: (adId, data) => api.post(`/api/ads-manager/ads/${adId}/copy`, data),
  applyCopy: (adId, variant) => api.post(`/api/ads-manager/ads/${adId}/copy/apply`, { variant }),
  saveCopyDrafts: (adId, drafts) => api.put(`/api/ads-manager/ads/${adId}/copy/drafts`, { drafts }),

  getSettings: () => api.get('/api/ads-manager/settings'),
  saveSettings: (data) => api.patch('/api/ads-manager/settings', data),
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

// NOTE: the NodeTemplate entity and the /api/node-templates routes were removed.
// They were the third, obsolete workflow-template system: nothing in the UI ever
// imported the entity and no code called the endpoints. The two systems actually
// used by the builder are the built-in library in
// components/workflows/workflowTemplates.js and saved templates stored as
// workflows with is_template = true.

// ─── Workflow Runs ─────────────────────────────────────────────────────────────

export const WorkflowRun = {
  list: (params) => api.get('/api/workflow-runs', params).then(r => r.data ?? r),
  filter: (params) => api.get('/api/workflow-runs', params).then(r => r.data ?? r),
  get: (id) => api.get(`/api/workflow-runs/${id}`),
  create: (data) => api.post('/api/workflow-runs', data),
  update: (id, data) => api.patch(`/api/workflow-runs/${id}`, data),
};