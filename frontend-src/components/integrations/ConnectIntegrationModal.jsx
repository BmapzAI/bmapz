import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, Loader2, X, ExternalLink, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Company } from '@/api/entities';
import { api } from '@/api/apiClient';
import { useLanguage } from '@/components/ui/LanguageContext';

// All integrations that use BMAPZ's own internalized OAuth flow (server-side)
// These use the `initiateOAuth` backend function to generate the OAuth URL
// and open it in a popup — fully internalized within the BMAPZ app
const INTERNALIZED_OAUTH_MAP = {
  meta_ads: true,
  instagram: true,
  facebook: true,
  linkedin_social: true,
  linkedin_ads: true,
  google_ads: true,
  google_analytics: true,
  google_search_console: true,
  google_calendar: true,
  google_meet: true,
  gmail: true,
  tiktok_ads: true,
  tiktok_social: true,
  canva: true,
};

// OAuth-capable but NOT in Base44 connectors — need user's own client credentials
// These show a "Login" button that opens the provider's login page in-app
const EXTERNAL_OAUTH_MAP = {
  meta_ads: { authUrl: 'https://www.facebook.com/login', name: 'Meta / Facebook', color: '#1877F2', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/2021_Facebook_icon.svg/512px-2021_Facebook_icon.svg.png' },
  instagram: { authUrl: 'https://www.instagram.com/accounts/login/', name: 'Instagram', color: '#E1306C', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Instagram_logo_2016.svg/512px-Instagram_logo_2016.svg.png' },
  facebook: { authUrl: 'https://www.facebook.com/login', name: 'Facebook', color: '#1877F2', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/2021_Facebook_icon.svg/512px-2021_Facebook_icon.svg.png' },
  twitter: { authUrl: 'https://twitter.com/login', name: 'X (Twitter)', color: '#000000', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/X_icon_2.svg/512px-X_icon_2.svg.png' },
  tiktok_ads: { authUrl: 'https://ads.tiktok.com/i18n/login', name: 'TikTok Ads', color: '#010101', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a9/TikTok_logo.svg/512px-TikTok_logo.svg.png' },
  tiktok_social: { authUrl: 'https://www.tiktok.com/login', name: 'TikTok', color: '#010101', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a9/TikTok_logo.svg/512px-TikTok_logo.svg.png' },
  pinterest: { authUrl: 'https://www.pinterest.com/login/', name: 'Pinterest', color: '#E60023', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Pinterest_Logo.png/512px-Pinterest_Logo.png' },
  snapchat: { authUrl: 'https://business.snapchat.com/login', name: 'Snapchat Business', color: '#FFFC00', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/ad/Snapchat_logo.svg/512px-Snapchat_logo.svg.png' },
  zoom: { authUrl: 'https://zoom.us/signin', name: 'Zoom', color: '#2D8CFF', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Zoom_Communications_Logo.svg/512px-Zoom_Communications_Logo.svg.png' },
  shopify: { authUrl: 'https://accounts.shopify.com/store-login', name: 'Shopify', color: '#96BF48', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Shopify_logo_2018.svg/512px-Shopify_logo_2018.svg.png' },
  webflow: { authUrl: 'https://webflow.com/dashboard/login', name: 'Webflow', color: '#4353FF', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Webflow_logo_%282023%29.svg/512px-Webflow_logo_%282023%29.svg.png' },
  mailchimp: { authUrl: 'https://login.mailchimp.com/', name: 'Mailchimp', color: '#FFE01B', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Mailchimp-freddie-wink.svg/512px-Mailchimp-freddie-wink.svg.png' },
  klaviyo: { authUrl: 'https://www.klaviyo.com/login', name: 'Klaviyo', color: '#1A1A1A', logo: 'https://www.klaviyo.com/favicon.ico' },
  activecampaign: { authUrl: 'https://www.activecampaign.com/login/', name: 'ActiveCampaign', color: '#356AE6', logo: 'https://www.activecampaign.com/favicon.ico' },
  brevo: { authUrl: 'https://app.brevo.com/account/login', name: 'Brevo', color: '#044A75', logo: 'https://www.brevo.com/favicon.ico' },
  convertkit: { authUrl: 'https://app.kit.com/users/login', name: 'ConvertKit', color: '#FB6970', logo: 'https://convertkit.com/favicon.ico' },
  mailerlite: { authUrl: 'https://dashboard.mailerlite.com/login', name: 'MailerLite', color: '#09C269', logo: 'https://www.mailerlite.com/favicon.ico' },
  intercom: { authUrl: 'https://app.intercom.com/admins/sign_in', name: 'Intercom', color: '#1F8DED', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Intercom_logo.png/512px-Intercom_logo.png' },
  apollo: { authUrl: 'https://app.apollo.io/#/login', name: 'Apollo.io', color: '#2563EB', logo: 'https://www.apollo.io/favicon.ico' },
  lemlist: { authUrl: 'https://app.lemlist.com/login', name: 'Lemlist', color: '#FF4C36', logo: 'https://lemlist.com/favicon.ico' },
  loom: { authUrl: 'https://www.loom.com/login', name: 'Loom', color: '#625DF5', logo: 'https://www.loom.com/favicon.ico' },
  demio: { authUrl: 'https://my.demio.com/login', name: 'Demio', color: '#FF5E5B', logo: 'https://demio.com/favicon.ico' },
  hotjar: { authUrl: 'https://insights.hotjar.com/login', name: 'Hotjar', color: '#FF3C00', logo: 'https://www.hotjar.com/favicon.ico' },
  mixpanel: { authUrl: 'https://mixpanel.com/login/', name: 'Mixpanel', color: '#7856FF', logo: 'https://mixpanel.com/favicon.ico' },
  segment: { authUrl: 'https://app.segment.com/login', name: 'Segment', color: '#52BD95', logo: 'https://segment.com/favicon.ico' },
  anthropic: { authUrl: 'https://console.anthropic.com/login', name: 'Anthropic', color: '#1A1A1A', logo: 'https://www.anthropic.com/favicon.ico' },
  perplexity: { authUrl: 'https://www.perplexity.ai/', name: 'Perplexity', color: '#1FB8CD', logo: 'https://www.perplexity.ai/favicon.ico' },
  jasper: { authUrl: 'https://app.jasper.ai/login', name: 'Jasper', color: '#6C48D5', logo: 'https://www.jasper.ai/favicon.ico' },
};

// Deep-links to the EXACT page on each platform where the user generates the
// connection token. Used by the "Open <Platform> →" button in the modal so
// users get to the right screen in one click instead of hunting through menus.
// These URLs open in a new tab; the user copies the token, pastes into Bmapz.
const PLATFORM_KEY_URLS = {
  whatsapp:        'https://developers.facebook.com/apps',
  wordpress:       null, // user-hosted, no canonical URL
  calendly:        'https://calendly.com/integrations/api_webhooks',
  zapier:          'https://zapier.com/app/zaps',
  make:            'https://www.make.com/en/help/tools/webhooks',
  n8n:             null,
  twilio:          'https://console.twilio.com/',
  openai:          'https://platform.openai.com/api-keys',
  hunter:          'https://hunter.io/api-keys',
  lusha:           'https://www.lusha.com/business/settings/api',
  clay:            'https://app.clay.com/workspaces/integrations',
  cal_com:         'https://app.cal.com/settings/developer/api-keys',
  chilipiper:      'https://app.chilipiper.com/admin/api',
  apollo:          'https://developer.apollo.io/keys#/oauth-registration', // OAuth preferred; API key being deprecated
  lemlist:         'https://app.lemlist.com/settings/integrations',
  mailchimp:       'https://us1.admin.mailchimp.com/account/api/',
  klaviyo:         'https://www.klaviyo.com/account#api-keys-tab',
  activecampaign:  'https://www.activecampaign.com/login/?next=/account/extend/',
  brevo:           'https://app.brevo.com/settings/keys/api',
  convertkit:      'https://app.kit.com/account_settings/developer_settings',
  mailerlite:      'https://dashboard.mailerlite.com/integrations/api',
  intercom:        'https://app.intercom.com/a/apps/_/developer-hub',
  mixpanel:        'https://mixpanel.com/settings/project',
  segment:         'https://app.segment.com/sources',
  hotjar:          'https://insights.hotjar.com/account/api',
  perplexity:      'https://www.perplexity.ai/settings/api',
  jasper:          'https://app.jasper.ai/settings/api',
  loom:            'https://www.loom.com/looms/settings/personal/api',
  demio:           'https://my.demio.com/settings/api',
  shopify:         'https://shopify.dev/docs/apps/auth/admin-app-access-tokens',
  webflow:         'https://webflow.com/dashboard/account/integrations',
  zoom:            'https://marketplace.zoom.us/develop/create',
};

// Step-by-step instructions per platform so non-technical users get to the
// token in <60 seconds. Each step is short and actionable.
const PLATFORM_STEPS = {
  apollo:          ['Go to developer.apollo.io/keys → OAuth Registration (preferred — API keys are being deprecated)', 'Register your app to get Client ID & Secret, OR use Settings → Integrations → API for a temporary API key', 'For OAuth: contact BMAPZ admin to configure Apollo OAuth credentials in the platform', 'For API key (temporary): copy the key and paste below'],
  mailchimp:       ['Sign in to Mailchimp', 'Click your avatar → Account → Extras → API Keys', 'Click "Create A Key"', 'Copy the key — note the suffix (e.g. -us19) — that\'s your server prefix'],
  klaviyo:         ['Sign in to Klaviyo', 'Account → Settings → API Keys', 'Click "Create Private API Key" → name it "Bmapz"', 'Copy and paste below'],
  activecampaign:  ['Sign in to ActiveCampaign', 'Settings → Developer', 'Copy your URL and API Key', 'Paste both below'],
  brevo:           ['Sign in to Brevo', 'Profile menu → SMTP & API → API Keys', 'Click "Generate a new API key" → name it "Bmapz"', 'Copy and paste below'],
  convertkit:      ['Sign in to ConvertKit', 'Settings → Advanced → API', 'Copy both API Key AND API Secret', 'Paste both below'],
  mailerlite:      ['Sign in to MailerLite', 'Integrations → API → Generate new token', 'Name it "Bmapz" → Generate', 'Copy and paste below'],
  intercom:        ['Sign in to Intercom', 'Developer Hub → New app → name it "Bmapz"', 'Authentication tab → Access Token', 'Copy and paste below'],
  calendly:        ['Sign in to Calendly', 'Integrations & apps → API & Webhooks', 'Click "Generate New Token"', 'Copy and paste below'],
  hunter:          ['Sign in to Hunter.io', 'Account → API → Generate a new key', 'Copy and paste below'],
  lusha:           ['Sign in to Lusha', 'Settings → API → Generate API Key', 'Copy and paste below'],
  clay:            ['Sign in to Clay', 'Workspace settings → Integrations → API keys', 'Generate new key', 'Copy and paste below'],
  cal_com:         ['Sign in to Cal.com', 'Settings → Developer → API Keys', 'Generate new API key', 'Copy and paste below'],
  lemlist:         ['Sign in to Lemlist', 'Settings → Integrations → API Keys', 'Create new key', 'Copy and paste below'],
  twilio:          ['Sign in to Twilio Console', 'Account → API keys & tokens', 'Copy Account SID and Auth Token (visible on dashboard)', 'Paste both + your Twilio number below'],
  mixpanel:        ['Sign in to Mixpanel', 'Project Settings → Access Keys', 'Copy "Project Token"', 'Paste below'],
  segment:         ['Sign in to Segment', 'Sources → your source → API Keys', 'Copy Write Key', 'Paste below'],
  hotjar:          ['Sign in to Hotjar', 'Sites & Organizations → copy Site ID', 'Account → API → Generate API Token', 'Paste both below'],
  perplexity:      ['Sign in to Perplexity', 'Settings → API → Generate API key', 'Copy and paste below'],
  jasper:          ['Sign in to Jasper', 'Settings → API Access → Create new', 'Copy and paste below'],
  loom:            ['Sign in to Loom', 'Settings → Integrations → API → Create key', 'Copy and paste below'],
  demio:           ['Sign in to Demio', 'Settings → API & Webhooks → Create new', 'Copy and paste below'],
  shopify:         ['Sign in to Shopify Admin', 'Apps → Develop apps → Create app → install', 'Admin API access tokens → Reveal token once', 'Copy token + your store URL below'],
  webflow:         ['Sign in to Webflow', 'Site Settings → Integrations → API Access', 'Generate API Token', 'Copy and paste below'],
  zoom:            ['Sign in to Zoom Marketplace', 'Develop → Build → Server-to-Server OAuth → Create', 'Copy Account ID, Client ID and Client Secret', 'Paste all three below'],
  wordpress:       ['In WordPress admin → Users → Your profile', 'Scroll to "Application Passwords"', 'Type "Bmapz" → Add new', 'Copy and paste below + your site URL'],
};

// Simple API key / credential fields for integrations that don't support OAuth
const CREDENTIAL_FIELDS = {
  whatsapp: [
    { key: 'whatsapp_api_token', label: 'API Token', placeholder: 'Paste your WhatsApp API token here', secret: true },
    { key: 'whatsapp_phone_id', label: 'Phone Number ID', placeholder: 'Your WhatsApp phone number ID', secret: false },
  ],
  wordpress: [
    { key: 'wordpress_url', label: 'Your WordPress Website URL', placeholder: 'https://yoursite.com', secret: false },
    { key: 'wordpress_user', label: 'Username', placeholder: 'Your WordPress username', secret: false },
    { key: 'wordpress_app_password', label: 'Application Password', placeholder: 'Generate in WordPress → Users → Profile', secret: true },
  ],
  calendly: [
    { key: 'calendly_api_key', label: 'Personal Access Token', placeholder: 'Generate in Calendly → Integrations → API', secret: true },
  ],
  zapier: [
    { key: 'zapier_webhook_url', label: 'Zapier Webhook URL', placeholder: 'https://hooks.zapier.com/hooks/catch/...', secret: false },
  ],
  make: [
    { key: 'make_webhook_url', label: 'Make Webhook URL', placeholder: 'https://hook.make.com/...', secret: false },
  ],
  n8n: [
    { key: 'n8n_webhook_url', label: 'n8n Webhook URL', placeholder: 'https://your-n8n.com/webhook/...', secret: false },
  ],
  twilio: [
    { key: 'twilio_account_sid', label: 'Account SID', placeholder: 'Find in Twilio Console dashboard', secret: false },
    { key: 'twilio_auth_token', label: 'Auth Token', placeholder: 'Find in Twilio Console dashboard', secret: true },
    { key: 'twilio_phone_number', label: 'Twilio Phone Number', placeholder: '+1 (555) 000-0000', secret: false },
  ],
  openai: [
    { key: 'openai_api_key', label: 'API Key', placeholder: 'sk-...  (from platform.openai.com/api-keys)', secret: true },
  ],
  hunter: [
    { key: 'hunter_api_key', label: 'API Key', placeholder: 'Find in Hunter.io → Settings → API', secret: true },
  ],
  lusha: [
    { key: 'lusha_api_key', label: 'API Key', placeholder: 'Find in Lusha → Settings → API', secret: true },
  ],
  clay: [
    { key: 'clay_api_key', label: 'API Key', placeholder: 'Find in Clay → Settings → API', secret: true },
  ],
  cal_com: [
    { key: 'cal_com_api_key', label: 'API Key', placeholder: 'Generate in Cal.com → Settings → Security', secret: true },
  ],
  chilipiper: [
    { key: 'chilipiper_api_key', label: 'API Key', placeholder: 'Find in Chili Piper → Admin → API Access', secret: true },
    { key: 'chilipiper_tenant', label: 'Account Name', placeholder: 'your-company', secret: false },
  ],
  custom: [
    { key: 'custom_api_url', label: 'API Endpoint URL', placeholder: 'https://api.yourservice.com/webhook', secret: false },
    { key: 'custom_api_key', label: 'API Key (optional)', placeholder: 'Bearer token or API key', secret: true },
  ],
  // ── Sales / Lead enrichment ─────────────────────────────────
  apollo: [
    { key: 'apollo_api_key', label: 'Apollo API Key', placeholder: 'Find in Apollo → Settings → Integrations → API', secret: true },
  ],
  lemlist: [
    { key: 'lemlist_api_key', label: 'Lemlist API Key', placeholder: 'In Lemlist → Settings → Integrations → API Keys', secret: true },
  ],
  // ── Email marketing platforms ───────────────────────────────
  mailchimp: [
    { key: 'mailchimp_api_key', label: 'API Key', placeholder: 'In Mailchimp → Account → Extras → API Keys', secret: true },
    { key: 'mailchimp_server_prefix', label: 'Server Prefix', placeholder: 'us19 (last part after the dash in your key)', secret: false },
  ],
  klaviyo: [
    { key: 'klaviyo_api_key', label: 'Private API Key', placeholder: 'Klaviyo → Account → Settings → API Keys', secret: true },
  ],
  activecampaign: [
    { key: 'activecampaign_api_url', label: 'API URL', placeholder: 'https://youraccount.api-us1.com', secret: false },
    { key: 'activecampaign_api_key', label: 'API Key', placeholder: 'In ActiveCampaign → Settings → Developer', secret: true },
  ],
  brevo: [
    { key: 'brevo_api_key', label: 'API Key (v3)', placeholder: 'In Brevo → Profile → SMTP & API → API Keys', secret: true },
  ],
  convertkit: [
    { key: 'convertkit_api_key', label: 'API Key', placeholder: 'ConvertKit → Settings → Advanced → API', secret: true },
    { key: 'convertkit_api_secret', label: 'API Secret', placeholder: 'Same page as API Key', secret: true },
  ],
  mailerlite: [
    { key: 'mailerlite_api_key', label: 'API Token', placeholder: 'MailerLite → Integrations → API → Generate new token', secret: true },
  ],
  intercom: [
    { key: 'intercom_access_token', label: 'Access Token', placeholder: 'Intercom → Developer Hub → Create app → API Keys', secret: true },
  ],
  // ── Analytics ────────────────────────────────────────────────
  mixpanel: [
    { key: 'mixpanel_project_token', label: 'Project Token', placeholder: 'Mixpanel → Project Settings → Access Keys', secret: true },
    { key: 'mixpanel_service_secret', label: 'Service Account Secret (optional)', placeholder: 'For read API access', secret: true },
  ],
  segment: [
    { key: 'segment_write_key', label: 'Write Key', placeholder: 'Segment → Sources → your-source → API Keys', secret: true },
  ],
  hotjar: [
    { key: 'hotjar_site_id', label: 'Site ID', placeholder: 'Hotjar → Sites & Organizations', secret: false },
    { key: 'hotjar_api_token', label: 'API Token (for data export)', placeholder: 'Generate in Hotjar → Account → API', secret: true },
  ],
  // ── Tools that work primarily via API key (no real OAuth flow) ──
  perplexity: [
    { key: 'perplexity_api_key', label: 'API Key', placeholder: 'perplexity.ai/settings/api', secret: true },
  ],
  jasper: [
    { key: 'jasper_api_key', label: 'API Key', placeholder: 'Jasper → Settings → API Access', secret: true },
  ],
  loom: [
    { key: 'loom_api_key', label: 'API Key', placeholder: 'Loom → Settings → Integrations → API', secret: true },
  ],
  demio: [
    { key: 'demio_api_key', label: 'API Key', placeholder: 'Demio → Settings → API & Webhooks', secret: true },
  ],
  // ── eCommerce + Site builders (private app token) ───────────
  shopify: [
    { key: 'shopify_store_url', label: 'Store URL', placeholder: 'your-store.myshopify.com', secret: false },
    { key: 'shopify_admin_token', label: 'Admin API Access Token', placeholder: 'Shopify → Apps → Develop apps → Create private app', secret: true },
  ],
  webflow: [
    { key: 'webflow_api_token', label: 'Site API Token', placeholder: 'Webflow → Site Settings → Integrations → API Access', secret: true },
  ],
  zoom: [
    { key: 'zoom_account_id', label: 'Account ID', placeholder: 'Zoom Marketplace → Build → Server-to-Server OAuth', secret: false },
    { key: 'zoom_client_id', label: 'Client ID', placeholder: 'Same page', secret: false },
    { key: 'zoom_client_secret', label: 'Client Secret', placeholder: 'Same page', secret: true },
  ],
};

// REMOVED: manual OAuth credential fallback. Per Bmapz UX rules, users
// only ever provide email/password through the provider's own OAuth login
// flow. If platform OAuth isn't configured, we show a clear admin notice
// instead of falling back to manual access-token entry.

const STATUS_KEY_MAP = {
  whatsapp: 'whatsapp', wordpress: 'wordpress', calendly: 'google_calendar',
  zapier: 'zapier', make: 'zapier', n8n: 'zapier', twilio: 'twilio',
  openai: 'openai', hunter: 'hunter', lusha: 'lusha', clay: 'clay',
  cal_com: 'google_calendar', chilipiper: 'google_calendar', custom: 'custom',
  meta_ads: 'meta_ads', instagram: 'meta', facebook: 'meta',
  google_ads: 'google_ads', gmail: 'gmail',
  linkedin_ads: 'linkedin_ads', linkedin_social: 'linkedin',
  tiktok_ads: 'tiktok_ads', tiktok_social: 'tiktok_social',
  apollo: 'apollo', lemlist: 'lemlist',
  mailchimp: 'mailchimp', klaviyo: 'klaviyo', activecampaign: 'activecampaign',
  brevo: 'brevo', convertkit: 'convertkit', mailerlite: 'mailerlite',
  intercom: 'intercom',
  mixpanel: 'mixpanel', segment: 'segment', hotjar: 'hotjar',
  perplexity: 'perplexity', jasper: 'jasper', loom: 'loom', demio: 'demio',
  shopify: 'shopify', webflow: 'webflow', zoom: 'zoom', canva: 'canva',
};

// Step indicators
function StepDot({ active, done, number }) {
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
      ${done ? 'bg-green-500 text-white' : active ? 'bg-[#38b6ff] text-black' : 'bg-white/10 text-gray-500'}`}>
      {done ? <CheckCircle size={14} /> : number}
    </div>
  );
}

export default function ConnectIntegrationModal({ integration, company, user, isConnected, onSuccess, onClose }) {
  const { t, isPt } = useLanguage();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1); // 1=info, 2=connect, 3=success
  const [connecting, setConnecting] = useState(false);
  const [credValues, setCredValues] = useState({});
  const [showSecret, setShowSecret] = useState({});
  const [saving, setSaving] = useState(false);
  // True when backend reports platform OAuth credentials aren't configured (admin must fix)
  const [oauthNotConfigured, setOauthNotConfigured] = useState(false);

  if (!integration) return null;

  // Per Bmapz product spec (Session 8):
  // - Integrations with external platforms work at the USER ACCOUNT level —
  //   any user can connect their own Apollo / Mailchimp / Klaviyo / etc. account.
  // - Only ONE-TIME platform-level app registration (e.g. creating the Bmapz
  //   Meta App, Google OAuth client) is reserved for owner/system_admin and
  //   will be implemented in the "Create App Integrations" phase.
  // So the credential modal is open to ALL users.
  void user; // kept for future phase-2 app-registration gating

  const isInternalizedOAuth = !!INTERNALIZED_OAUTH_MAP[integration.type];
  const credFields = CREDENTIAL_FIELDS[integration.type] || [];
  const isManualCreds = !isInternalizedOAuth && credFields.length > 0;

  const handleInternalizedOAuth = async () => {
    setConnecting(true);

    let oauthPath = '/api/oauth/google/initiate';
    if (integration.type === 'meta_ads' || integration.type === 'instagram' || integration.type === 'facebook') {
      oauthPath = '/api/oauth/meta/initiate';
    } else if (integration.type === 'linkedin' || integration.type === 'linkedin_social' || integration.type === 'linkedin_ads') {
      oauthPath = '/api/oauth/linkedin/initiate';
    } else if (integration.type === 'twitter') {
      oauthPath = '/api/oauth/twitter/initiate';
    } else if (integration.type === 'tiktok_social' || integration.type === 'tiktok_ads' || integration.type === 'tiktok') {
      oauthPath = '/api/oauth/tiktok/initiate';
    } else if (integration.type === 'canva') {
      oauthPath = '/api/oauth/canva/initiate';
    }

    let handledByMessage = false;
    let pollTimer;

    const onMessage = (event) => {
      if (event.data?.type === 'oauth_success') {
        handledByMessage = true;
        clearInterval(pollTimer);
        window.removeEventListener('message', onMessage);
        setConnecting(false);
        queryClient.invalidateQueries({ queryKey: ['companies'] });
        setStep(3);
        onSuccess?.();
      } else if (event.data?.type === 'oauth_error') {
        handledByMessage = true;
        clearInterval(pollTimer);
        window.removeEventListener('message', onMessage);
        setConnecting(false);
        toast.error(`Connection failed: ${event.data.error || 'Unknown error'}`);
      }
    };
    try {
      const { authUrl } = await api.get(`${oauthPath}-url`, {
        type: integration.type,
        origin: window.location.origin,
      });

      const popup = window.open(
        authUrl,
        'oauth_popup',
        'width=620,height=720,left=200,top=80'
      );

      if (!popup) {
        setConnecting(false);
        toast.error(t('popupBlockedMsg'));
        return;
      }

      pollTimer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(pollTimer);
          window.removeEventListener('message', onMessage);
          if (!handledByMessage) {
            setConnecting(false);
            toast.error(t('connectionNotCompletedMsg'));
          }
        }
      }, 800);

      window.addEventListener('message', onMessage);
    } catch (e) {
      setConnecting(false);
      const msg = e?.message || '';
      // Platform OAuth not configured: show a clear admin-action message. No more
      // manual-token-fallback (that was leaking tokens through the chat UI).
      if (msg.toLowerCase().includes('not configured') || msg.toLowerCase().includes('client id') || msg.toLowerCase().includes('app id')) {
        setOauthNotConfigured(true);
        toast.error(`${integration.name} OAuth isn't set up on this platform yet. Your administrator needs to add the OAuth credentials in Railway settings.`);
      } else {
        toast.error(`Connection failed: ${msg || 'Could not start OAuth login'}`);
      }
    }
  };

  // Save manual credentials AND verify them. Only marks integration_status as
  // 'connected' if a real API test passes. Admins only.
  const handleSaveCreds = async () => {
    if (!company) return;
    setSaving(true);
    try {
      // Step 1: save the credentials
      await Company.update(company.id, { ...credValues });

      // Step 2: actively test the connection
      let testResult;
      try {
        testResult = await api.post(`/api/integrations/test/${integration.type}`);
      } catch (testErr) {
        toast.error(`${t('savedButTestFailedMsg')}: ${testErr?.message || 'Could not verify connection'}`);
        // Don't mark as connected — user must fix and retry
        setSaving(false);
        return;
      }

      if (testResult?.success !== true) {
        toast.error(`${t('connectionTestFailedMsg')}: ${testResult?.message || 'Provider rejected the credentials'}`);
        setSaving(false);
        return;
      }

      // Step 3: only NOW set integration_status to true
      const statusKey = STATUS_KEY_MAP[integration.type];
      if (statusKey) {
        await Company.update(company.id, {
          integration_status: { ...(company.integration_status || {}), [statusKey]: true },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success(`${integration.name} ${t('connectedAndVerifiedMsg')}`);
      setStep(3);
    } catch (e) {
      toast.error(`${t('failedToSaveMsg')}: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!company || !integration.statusKey) return;
    await Company.update(company.id, {
      integration_status: { ...(company.integration_status || {}), [integration.statusKey]: false }
    });
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    toast.success(t('disconnectedMsg'));
    onClose();
  };

  const handleDone = () => {
    onSuccess?.();
    onClose();
  };

  const providerName = integration.name;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#111] border-white/10 text-white max-w-md p-0 overflow-hidden">
        {/* Header with logo */}
        <div className="relative p-6 pb-4 border-b border-white/10"
          style={{ background: 'linear-gradient(135deg, rgba(56,182,255,0.08), rgba(0,0,0,0))' }}>
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
          <div className="flex items-center gap-4">
            {integration.logo ? (
              <img src={integration.logo} alt={integration.name}
                className="w-12 h-12 rounded-xl object-contain bg-white p-1.5 flex-shrink-0"
                onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#38b6ff]/20 flex items-center justify-center">
                <span className="text-2xl">🔗</span>
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">{integration.name}</h2>
              <p className="text-gray-400 text-sm">{integration.description}</p>
            </div>
          </div>

          {/* Step indicators */}
          {step < 3 && (
            <div className="flex items-center gap-2 mt-5">
              <StepDot number={1} active={step === 1} done={step > 1} />
              <div className={`flex-1 h-0.5 ${step > 1 ? 'bg-green-500' : 'bg-white/10'}`} />
              <StepDot number={2} active={step === 2} done={step > 2} />
              <div className={`flex-1 h-0.5 ${step > 2 ? 'bg-green-500' : 'bg-white/10'}`} />
              <StepDot number={3} active={step === 3} done={false} />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* ── STEP 1: Info ── */}
          {step === 1 && (
            <>
              <div className="space-y-3">
                <p className="text-white font-medium">{t('whatBmapzAccesses')}</p>
                <ul className="space-y-2">
                  {[
                    t('integrationAccessPerf'),
                    t('integrationAccessAccount'),
                    t('integrationAccessContent'),
                    t('integrationAccessCampaign'),
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-gray-300 text-sm">
                      <CheckCircle size={14} className="text-[#38b6ff] flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start gap-2">
                <Lock size={14} className="text-[#38b6ff] flex-shrink-0 mt-0.5" />
                <p className="text-gray-400 text-xs leading-relaxed">
                  {t('integrationSecurityNote')}
                </p>
              </div>

              {isConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                    <CheckCircle size={16} className="text-green-400" />
                    <span className="text-green-400 text-sm font-medium">{t('connectedActive')}</span>
                  </div>
                  <Button variant="outline" onClick={handleDisconnect}
                    className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm">
                    {t('disconnect')} {integration.name}
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setStep(2)}
                  className="w-full gap-2 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] text-white font-semibold h-11">
                  {t('connectIntegration')} {integration.name} <ArrowRight size={16} />
                </Button>
              )}
            </>
          )}

          {/* ── STEP 2: Connect ── */}
          {step === 2 && (
            <>
              {/* Internalized OAuth — BMAPZ's own real OAuth flow */}
              {isInternalizedOAuth && !oauthNotConfigured && (
                <div className="space-y-4">
                  <p className="text-gray-300 text-sm text-center">
                    {isPt
                      ? `Clique abaixo para entrar na sua conta ${integration.name} com seu e-mail e senha habituais. Um popup será aberto para você autorizar o BMAPZ a ler seus dados.`
                      : `Click below to sign in to your ${integration.name} account with your usual email and password. A popup will open where you authorize BMAPZ to read your data.`}
                  </p>
                  <Button onClick={handleInternalizedOAuth} disabled={connecting}
                    className="w-full h-12 gap-3 font-semibold text-base"
                    style={{
                      backgroundColor: 
                        (integration.type === 'meta_ads' || integration.type === 'instagram' || integration.type === 'facebook') ? '#1877F2' :
                        (integration.type === 'linkedin_social' || integration.type === 'linkedin_ads') ? '#0077b5' :
                        (integration.type.startsWith('google') || integration.type === 'gmail') ? '#4285F4' :
                        (integration.type.startsWith('tiktok')) ? '#010101' : '#38b6ff',
                      color: '#fff'
                    }}>
                    {connecting
                      ? <Loader2 size={18} className="animate-spin" />
                      : integration.logo && <img src={integration.logo} alt="" className="w-5 h-5 object-contain bg-white rounded p-0.5" onError={(e) => { e.target.style.display = 'none'; }} />
                    }
                    {connecting ? t('waitingForAuth') : `${t('connectIntegration')} ${integration.name}`}
                  </Button>
                  {connecting && (
                    <div className="p-3 rounded-xl bg-[#38b6ff]/10 border border-[#38b6ff]/20 text-center">
                      <p className="text-[#38b6ff] text-xs">{t('completeLoginInPopup')}</p>
                    </div>
                  )}
                  <p className="text-gray-500 text-xs text-center">
                    {t('tokenStoredSecurely')}
                  </p>
                </div>
              )}

              {/* Platform OAuth not configured — admin action required */}
              {isInternalizedOAuth && oauthNotConfigured && (
                <div className="space-y-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center mx-auto">
                    <Lock size={28} className="text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-white text-base font-semibold mb-1">{t('awaitingPlatformSetup')}</h3>
                    <p className="text-gray-400 text-sm">
                      {isPt
                        ? `O login com ${integration.name} ainda não está habilitado no Bmapz. Seu administrador precisa adicionar as credenciais OAuth nas variáveis de ambiente do Railway.`
                        : `${integration.name} sign-in isn't enabled on Bmapz yet. Your administrator needs to add OAuth credentials in Railway env vars.`}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setStep(1)} className="border-white/10 text-white hover:bg-white/5">
                    ← {t('back')}
                  </Button>
                </div>
              )}

              {/* Manual credentials — any user can connect their own account.
                  After saving, Bmapz runs a real connection test before marking
                  the integration as Connected (no more false positives). */}
              {isManualCreds && (
                <div className="space-y-4">
                  {/* Step-by-step walkthrough */}
                  {PLATFORM_STEPS[integration.type] && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-white text-xs font-semibold mb-2">{t('howToGetToken')}</p>
                      <ol className="space-y-1.5 text-gray-300 text-xs">
                        {PLATFORM_STEPS[integration.type].map((step, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-[#38b6ff] font-bold flex-shrink-0">{i + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Deep-link to the platform's key-generation page */}
                  {PLATFORM_KEY_URLS[integration.type] && (
                    <a
                      href={PLATFORM_KEY_URLS[integration.type]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#38b6ff]/30 bg-[#38b6ff]/10 hover:bg-[#38b6ff]/20 text-[#38b6ff] text-sm font-medium transition-colors"
                    >
                      <ExternalLink size={14} /> {t('openPlatform')} {integration.name} → {t('generateYourToken')}
                    </a>
                  )}

                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
                    <strong>{t('whyTokenTitle')}</strong>{' '}
                    {isPt
                      ? `O ${integration.name} não oferece "Entrar com X" — ele autentica apps de terceiros apenas via tokens. O Bmapz nunca vê sua senha do ${integration.name}.`
                      : `${integration.name} doesn't offer "Sign in with X" — they only authenticate third-party apps via tokens. Bmapz never sees your ${integration.name} password.`}
                  </div>

                  {credFields.map(field => (
                    <div key={field.key}>
                      <label className="text-gray-400 text-xs mb-1 block">{field.label}</label>
                      <div className="relative">
                        <Input
                          type={field.secret && !showSecret[field.key] ? 'password' : 'text'}
                          value={credValues[field.key] || ''}
                          onChange={(e) => setCredValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                          className="bg-black/30 border-white/10 text-white text-sm pr-10"
                        />
                        {field.secret && (
                          <button type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                            onClick={() => setShowSecret(prev => ({ ...prev, [field.key]: !prev[field.key] }))}>
                            {showSecret[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button onClick={handleSaveCreds} disabled={saving}
                    className="w-full h-11 gap-2 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] font-semibold">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    {saving ? t('savingAndTesting') : t('saveAndTestConnection')}
                  </Button>
                </div>
              )}

              {/* Truly unsupported (no OAuth, no creds) */}
              {!isInternalizedOAuth && !isManualCreds && (
                <div className="text-center space-y-3 py-4">
                  <p className="text-gray-400 text-sm">
                    {isPt
                      ? `Esta integração requer configuração através da plataforma ${integration.name}.`
                      : `This integration requires setup through the ${integration.name} platform.`}
                  </p>
                  {integration.setupUrl && (
                    <a href={integration.setupUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="gap-2 border-white/10 text-white hover:bg-white/5">
                        <ExternalLink size={14} /> {t('openPlatform')} {integration.name}
                      </Button>
                    </a>
                  )}
                </div>
              )}

              <button onClick={() => setStep(1)} className="text-gray-500 text-xs hover:text-gray-300 transition-colors w-full text-center">
                ← {t('back')}
              </button>
            </>
          )}

          {/* ── STEP 3: Success ── */}
          {step === 3 && (
            <div className="text-center space-y-5 py-4">
              <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-green-400" />
              </div>
              <div>
                <h3 className="text-white text-xl font-bold mb-1">{t('integrationConnectedTitle')}</h3>
                <p className="text-gray-400 text-sm">
                  {integration.name} {t('integrationSuccessDesc')}
                </p>
              </div>
              <Button onClick={handleDone} className="w-full bg-gradient-to-r from-[#3572b9] to-[#38b6ff] font-semibold h-11">
                {t('integrationDone')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
