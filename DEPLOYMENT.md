# Bmapz Deployment Guide

Stack: **Supabase** (DB + Auth) · **Express.js on Railway** (API) · **Cloudflare Pages** (Frontend)

---

## 1. Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Run the SQL schema in `supabase/schema.sql` via the SQL editor
3. Enable Email and Google providers in **Authentication → Providers**
4. Set the **Site URL** to your production frontend URL (e.g. `https://bmapzai.com`)
5. Add `https://bmapzai.com/auth/callback` to **Redirect URLs**
6. Copy your **Project URL** and **anon key** (for frontend) and **service_role key** (for backend)

---

## 2. Backend — Railway

1. Push the repo to GitHub
2. Create a new Railway project → **Deploy from GitHub repo**
3. Set the **root directory** to `backend/`
4. Railway auto-detects Node.js via `package.json`
5. Add all environment variables from `backend/.env.example` in Railway → **Variables**
   - Set `FRONTEND_URL` to your Cloudflare Pages URL
   - Set all OAuth redirect URIs to `https://your-backend.up.railway.app/api/oauth/*/callback`
6. Note your Railway backend URL (e.g. `https://bmapz-backend.up.railway.app`)

### OAuth Redirect URIs to Register

Update these in each provider's developer console to match your Railway URL:

| Provider | Redirect URI |
|---|---|
| Google Cloud Console | `https://your-backend.up.railway.app/api/oauth/google/callback` |
| Meta for Developers | `https://your-backend.up.railway.app/api/oauth/meta/callback` |
| LinkedIn Developer | `https://your-backend.up.railway.app/api/oauth/linkedin/callback` |
| Twitter Developer Portal | `https://your-backend.up.railway.app/api/oauth/twitter/callback` |
| TikTok for Developers | `https://your-backend.up.railway.app/api/oauth/tiktok/callback` |

---

## 3. Frontend — Cloudflare Pages

1. In Cloudflare dashboard → **Pages → Create a project → Connect to Git**
2. Select your repo
3. Set **Build settings**:
   - Framework preset: `None` (or `Vite`)
   - Build command: `npm run build:frontend`
   - Build output directory: `dist`
   - Root directory: `/` (monorepo root)
4. Add **Environment variables** (Settings → Environment variables → Production):
   ```
   VITE_SUPABASE_URL     = https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJhbGc...
   VITE_API_URL          = https://bmapz-backend.up.railway.app
   ```
5. Deploy — Cloudflare Pages will run `npm run build:frontend` and serve the `dist/` folder
6. The `public/_redirects` file ensures all routes serve `index.html` (SPA routing)

### Custom Domain
- In Cloudflare Pages → **Custom domains** → add `bmapzai.com` and `www.bmapzai.com`
- Update `FRONTEND_URL` in Railway and the Supabase Site URL to match

---

## 4. Local Development

```bash
# 1. Install dependencies
npm run install:all

# 2. Create env files
cp .env.example .env.local          # frontend vars
cp backend/.env.example backend/.env  # backend vars
# → fill in your Supabase keys and OAuth credentials

# 3. Run both servers (concurrently)
npm run dev
# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
```

---

## 5. Stripe Webhook (Production)

After deploying the backend:
```bash
# Install Stripe CLI
stripe listen --forward-to https://your-backend.up.railway.app/api/stripe/webhook
```
Or set up the webhook endpoint in the Stripe dashboard → Developers → Webhooks:
- URL: `https://your-backend.up.railway.app/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
- Copy the **Signing secret** → set as `STRIPE_WEBHOOK_SECRET` in Railway

---

## 6. Checklist

- [ ] Supabase schema applied
- [ ] Supabase auth providers enabled (Email, Google)
- [ ] Supabase redirect URLs configured
- [ ] Railway backend deployed with all env vars
- [ ] OAuth apps updated with production redirect URIs
- [ ] Cloudflare Pages deployed with Vite env vars
- [ ] Custom domain configured
- [ ] Stripe webhook endpoint registered
- [ ] CORS: `FRONTEND_URL` in Railway matches actual frontend URL
