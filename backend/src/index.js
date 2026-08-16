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
import dataDeletionRoutes from './routes/dataDeletion.js';
import stripeWebhookRoutes from './routes/stripeWebhook.js';
import whatsappWebhookRoutes from './routes/whatsappWebhook.js';
import uploadsRoutes from './routes/uploads.js';
import addonsRoutes from './routes/addons.js';
import automationsRoutes from './routes/automations.js';
import designTemplatesRoutes from './routes/designTemplates.js';
import notificationsRoutes from './routes/notifications.js';
import tasksRoutes from './routes/tasks.js';
import sdrRoutes from './routes/sdr.js';
import helpRoutes from './routes/help.js';
import adsManagerRoutes from './routes/adsManager.js';
import searchRoutes from './routes/search.js';
import internalChatRoutes from './routes/internalChat.js';
import metricsRoutes from './routes/metrics.js';
import canvaRoutes from './routes/canva.js';
import { runAIChat } from './routes/ai.js';
import { refreshGlobalLearnings } from './lib/companyBrain.js';
import { startAutomationScheduler } from './lib/automationScheduler.js';
import { startModelRegistryRefresh } from './lib/modelRegistry.js';
import { startWorkflowEngine } from './lib/workflowEngine.js';

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
//
// Railway terminates TLS at an edge proxy, so without this every request arrives
// carrying the PROXY's address. req.ip was therefore identical for the entire
// platform and the limiter degenerated into a single shared bucket: one abusive
// client could 429 every tenant, while a real attacker was never isolated. The
// earlier "200 was too low, raise it to 1000" note was this bug being mistaken for
// a limit that needed loosening.
//
// `1` (not `true`) trusts exactly one hop — Railway's proxy. Trusting everything
// would let a client spoof X-Forwarded-For and mint a fresh bucket per request.
app.set('trust proxy', 1);

/**
 * Per-user when we know who is calling, per-IP otherwise.
 *
 * `req.ip` is the v7 default and is only trustworthy because of the `trust proxy`
 * setting above — before it, this was the proxy's address for every caller.
 */
const rateKey = (req) => req.dbUser?.id || req.user?.id || req.ip;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // An abuse backstop, not a usage quota — AI spend is governed by credits.
  max: 1000,
  keyGenerator: rateKey,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// The expensive surface gets its own, much tighter budget. These endpoints call
// image/audio/model providers and cost real money per request, so the generic
// backstop is far too loose to be meaningful for them.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: rateKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests — slow down for a moment.' },
});
app.use('/api/ai', aiLimiter);
app.use('/api/brand-scans', aiLimiter);

// ─── Body parsing ─────────────────────────────────────────────────────────────
// Stripe webhooks need raw body — mount BEFORE json middleware
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(stripeWebhookRoutes);

// Keep the raw bytes so webhook handlers can verify HMAC signatures (Meta's
// X-Hub-Signature-256 is computed over the exact payload, so a re-serialised
// req.body will not match).
app.use(express.json({
  limit: '10mb',
  // Only the routes that verify an HMAC need the raw bytes. Retaining a copy of
  // every body platform-wide doubled the memory held per request for no reason —
  // at the 10MB ceiling that is 10MB of avoidable garbage per concurrent upload.
  verify: (req, _res, buf) => {
    if (/\/webhook/i.test(req.originalUrl || req.url || '')) req.rawBody = buf;
  },
}));
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
app.use('/api/data-deletion', dataDeletionRoutes);
app.use('/api/whatsapp', whatsappWebhookRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/addons', addonsRoutes);
app.use('/api/automations', automationsRoutes);
app.use('/api/design-templates', designTemplatesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/sdr', sdrRoutes);
app.use('/api/help', helpRoutes);
app.use('/api/ads-manager', adsManagerRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/team-chat', internalChatRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/canva', canvaRoutes);

// ─── Global error handler ─────────────────────────────────────────────────────
//
// The full error always goes to the logs; what reaches the CLIENT depends on
// whether we meant to say it.
//
// This used to return `err.message` verbatim for everything, including 500s. An
// unexpected failure is usually a database error, and Postgres messages name
// tables, columns and constraints — so a crash handed an attacker a free map of
// the schema. 4xx messages are ones we wrote deliberately and stay; 5xx becomes a
// generic sentence.
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  console.error('[Error]', status, err.message, err.stack ? `\n${err.stack}` : '');

  if (status >= 500) {
    return res.status(status).json({ error: 'Something went wrong on our side. Please try again.' });
  }

  // Even a 4xx should not carry raw SQL if one slipped through.
  const msg = String(err.message || 'Request could not be completed.');
  const looksLikeSql = /relation "|column "|constraint|violates|pg_|SQLSTATE/i.test(msg);
  res.status(status).json({ error: looksLikeSql ? 'That request could not be completed.' : msg });
});

app.listen(PORT, () => {
  console.log(`✅ Bmapz API running on port ${PORT}`);
  // Background services: AI Automations cron engine + live model registry +
  // workflow execution engine (advances scheduled workflow steps)
  startAutomationScheduler(runAIChat);
  startModelRegistryRefresh();
  startWorkflowEngine();
  // Platform-wide brain aggregates (counts only, no tenant content). Refreshed
  // hourly; unref'd so it never holds the process open during a deploy.
  refreshGlobalLearnings();
  setInterval(refreshGlobalLearnings, 60 * 60 * 1000).unref();
});

export default app;
