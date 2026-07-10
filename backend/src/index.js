import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Routes
import authRoutes from './routes/auth.js';
import companiesRoutes from './routes/companies.js';
import usersRoutes from './routes/users.js';
import leadsRoutes from './routes/leads.js';
import workflowsRoutes, { workflowRunsRouter } from './routes/workflows.js';
import socialRoutes from './routes/social.js';
import adsRoutes from './routes/ads.js';
import seoRoutes from './routes/seo.js';
import messagingRoutes from './routes/messaging.js';
import aiRoutes from './routes/ai.js';
import integrationsRoutes from './routes/integrations.js';
import oauthRoutes from './routes/oauth.js';
import billingRoutes from './routes/billing.js';
import adminRoutes from './routes/admin.js';
import emailRoutes from './routes/email.js';
import blogRoutes from './routes/blog.js';
import brandScansRoutes from './routes/brandScans.js';
import funnelsRoutes from './routes/funnels.js';
import dashboardConfigsRoutes from './routes/dashboardConfigs.js';
import nodeTemplatesRoutes from './routes/nodeTemplates.js';
import dataDeletionRoutes from './routes/dataDeletion.js';
import stripeWebhookRoutes from './routes/stripeWebhook.js';
import whatsappWebhookRoutes from './routes/whatsappWebhook.js';
import uploadsRoutes from './routes/uploads.js';
import addonsRoutes from './routes/addons.js';
import automationsRoutes from './routes/automations.js';
import designTemplatesRoutes from './routes/designTemplates.js';
import { runAIChat } from './routes/ai.js';
import { startAutomationScheduler } from './lib/automationScheduler.js';
import { startModelRegistryRefresh } from './lib/modelRegistry.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security middleware ─────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://ai.bmapz.com',
  'https://bmapzai.com',
  'https://www.bmapzai.com',
  'https://bmapzai.app',
  'https://www.bmapzai.app',
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// ─── Body parsing ─────────────────────────────────────────────────────────────
// Stripe webhooks need raw body — mount BEFORE json middleware
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(stripeWebhookRoutes);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/workflows', workflowsRoutes);
app.use('/api/workflow-runs', workflowRunsRouter);
app.use('/api/social', socialRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/seo', seoRoutes);
app.use('/api/messaging', messagingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/brand-scans', brandScansRoutes);
app.use('/api/funnels', funnelsRoutes);
app.use('/api/dashboard-configs', dashboardConfigsRoutes);
app.use('/api/node-templates', nodeTemplatesRoutes);
app.use('/api/data-deletion', dataDeletionRoutes);
app.use('/api/whatsapp', whatsappWebhookRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/addons', addonsRoutes);
app.use('/api/automations', automationsRoutes);
app.use('/api/design-templates', designTemplatesRoutes);

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅ Bmapz API running on port ${PORT}`);
  // Background services: AI Automations cron engine + live model registry
  startAutomationScheduler(runAIChat);
  startModelRegistryRefresh();
});

export default app;
