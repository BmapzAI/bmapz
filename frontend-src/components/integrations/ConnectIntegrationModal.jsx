import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, Loader2, X, ExternalLink, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Company } from '@/api/entities';
import { api } from '@/api/apiClient';

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
};

// Fallback manual credential fields for OAuth integrations when platform credentials aren't configured
Object.assign(CREDENTIAL_FIELDS, {
  meta_ads: [
    { key: 'meta_access_token', label: 'Meta User Access Token', placeholder: 'Get from Meta for Developers → Tools → Graph API Explorer', secret: true },
    { key: 'meta_ad_account_id', label: 'Ad Account ID', placeholder: 'act_1234567890 (from Meta Ads Manager)', secret: false },
    { key: 'meta_page_id', label: 'Page ID (optional)', placeholder: 'Your Facebook Page ID', secret: false },
  ],
  instagram: [
    { key: 'meta_access_token', label: 'Meta User Access Token', placeholder: 'Get from Meta for Developers — includes Instagram permissions', secret: true },
    { key: 'instagram_account_id', label: 'Instagram Business Account ID', placeholder: 'Your Instagram Business Account ID', secret: false },
  ],
  facebook: [
    { key: 'meta_access_token', label: 'Meta User Access Token', placeholder: 'Get from Meta for Developers → Tools → Graph API Explorer', secret: true },
    { key: 'meta_page_id', label: 'Page ID', placeholder: 'Your Facebook Page ID', secret: false },
  ],
  google_ads: [
    { key: 'google_access_token', label: 'Google Ads Access Token', placeholder: 'OAuth access token from Google Cloud Console', secret: true },
    { key: 'google_ads_customer_id', label: 'Customer ID', placeholder: '123-456-7890 (from Google Ads dashboard)', secret: false },
    { key: 'google_developer_token', label: 'Developer Token', placeholder: 'From Google Ads API Center', secret: true },
  ],
  gmail: [
    { key: 'google_access_token', label: 'Gmail OAuth Access Token', placeholder: 'OAuth access token with gmail.send scope', secret: true },
    { key: 'google_refresh_token', label: 'Refresh Token', placeholder: 'OAuth refresh token for auto-renewal', secret: true },
    { key: 'google_connected_email', label: 'Gmail Address', placeholder: 'your@gmail.com', secret: false },
  ],
  linkedin_ads: [
    { key: 'linkedin_ads_access_token', label: 'LinkedIn Access Token', placeholder: 'OAuth token with r_ads scope', secret: true },
    { key: 'linkedin_ads_account_id', label: 'Ad Account ID (urn:li:sponsoredAccount:...)', placeholder: 'urn:li:sponsoredAccount:123456789', secret: false },
  ],
  linkedin_social: [
    { key: 'linkedin_access_token', label: 'LinkedIn Access Token', placeholder: 'OAuth token with w_member_social scope', secret: true },
  ],
  tiktok_ads: [
    { key: 'tiktok_access_token', label: 'TikTok Access Token', placeholder: 'From TikTok for Business → My Apps', secret: true },
    { key: 'tiktok_advertiser_id', label: 'Advertiser ID', placeholder: 'Your TikTok Ads advertiser ID', secret: false },
  ],
  tiktok_social: [
    { key: 'tiktok_access_token', label: 'TikTok Access Token', placeholder: 'From TikTok for Business → My Apps', secret: true },
  ],
});

const STATUS_KEY_MAP = {
  whatsapp: 'whatsapp', wordpress: 'wordpress', calendly: 'google_calendar',
  zapier: 'zapier', make: 'zapier', n8n: 'zapier', twilio: 'twilio',
  openai: 'openai', hunter: 'hunter', lusha: 'lusha', clay: 'clay',
  cal_com: 'google_calendar', chilipiper: 'google_calendar', custom: 'custom',
  meta_ads: 'meta_ads', instagram: 'meta', facebook: 'meta',
  google_ads: 'google_ads', gmail: 'gmail',
  linkedin_ads: 'linkedin_ads', linkedin_social: 'linkedin',
  tiktok_ads: 'tiktok_ads', tiktok_social: 'tiktok_social',
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

export default function ConnectIntegrationModal({ integration, company, isConnected, onSuccess, onClose }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1); // 1=info, 2=connect, 3=success
  const [connecting, setConnecting] = useState(false);
  const [credValues, setCredValues] = useState({});
  const [showSecret, setShowSecret] = useState({});
  const [saving, setSaving] = useState(false);
  // When platform OAuth credentials aren't configured, fall back to manual token entry
  const [oauthFallbackMode, setOauthFallbackMode] = useState(false);

  if (!integration) return null;

  const isInternalizedOAuth = !!INTERNALIZED_OAUTH_MAP[integration.type] && !oauthFallbackMode;
  const externalOAuth = !isInternalizedOAuth ? EXTERNAL_OAUTH_MAP[integration.type] : null;
  const credFields = CREDENTIAL_FIELDS[integration.type] || [];
  const isExternalOAuth = !isInternalizedOAuth && !!externalOAuth && credFields.length === 0;
  const isManualCreds = !isInternalizedOAuth && (!isExternalOAuth || credFields.length > 0) && credFields.length > 0;

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
        toast.error('Popup blocked. Please allow popups for Bmapz AI and try again.');
        return;
      }

      pollTimer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(pollTimer);
          window.removeEventListener('message', onMessage);
          if (!handledByMessage) {
            setConnecting(false);
            toast.error('Connection was not completed. Please finish the provider login and approve access.');
          }
        }
      }, 800);

      window.addEventListener('message', onMessage);
    } catch (e) {
      setConnecting(false);
      const msg = e?.message || '';
      // If platform OAuth credentials aren't configured, fall back to manual token entry
      if (msg.toLowerCase().includes('not configured') || msg.toLowerCase().includes('client id') || msg.toLowerCase().includes('app id')) {
        const hasFallbackFields = CREDENTIAL_FIELDS[integration.type]?.length > 0;
        if (hasFallbackFields) {
          setOauthFallbackMode(true);
          toast.info('Platform OAuth is not set up yet. Enter your access token directly below.');
        } else {
          toast.error(`OAuth is not available for this integration: ${msg}. Contact your administrator to configure platform credentials.`);
        }
      } else {
        toast.error(`Connection failed: ${msg || 'Could not start OAuth login'}`);
      }
    }
  };

  const handleExternalOAuthConnect = () => {
    setConnecting(true);
    const popup = window.open(externalOAuth.authUrl, 'connect_popup', 'width=600,height=700,left=200,top=100');
    const timer = setInterval(async () => {
      if (!popup || popup.closed) {
        clearInterval(timer);
        setConnecting(false);
        setStep(3);
        if (company && integration.statusKey) {
          await Company.update(company.id, {
            integration_status: { ...(company.integration_status || {}), [integration.statusKey]: true }
          });
          queryClient.invalidateQueries({ queryKey: ['companies'] });
        }
      }
    }, 500);
  };

  const handleSaveCreds = async () => {
    if (!company) return;
    setSaving(true);
    try {
      const statusKey = STATUS_KEY_MAP[integration.type];
      // Send flat credential fields — backend PATCH routes them to api_keys JSONB automatically
      await Company.update(company.id, {
        ...credValues,
        ...(statusKey ? { integration_status: { ...(company.integration_status || {}), [statusKey]: true } } : {}),
      });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setStep(3);
    } catch (e) {
      toast.error('Failed to save: ' + e.message);
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
    toast.success('Disconnected');
    onClose();
  };

  const handleDone = () => {
    onSuccess?.();
    onClose();
  };

  const providerName = isInternalizedOAuth
    ? externalOAuth?.name || integration.name
    : isExternalOAuth
    ? externalOAuth.name
    : integration.name;

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
                <p className="text-white font-medium">What BMAPZ will access:</p>
                <ul className="space-y-2">
                  {[
                    'Performance data & analytics',
                    'Account information & settings',
                    'Content publishing permissions',
                    'Campaign & conversion data',
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
                  Your credentials are encrypted and stored securely. BMAPZ will never share your data with third parties.
                </p>
              </div>

              {isConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                    <CheckCircle size={16} className="text-green-400" />
                    <span className="text-green-400 text-sm font-medium">Connected & Active</span>
                  </div>
                  <Button variant="outline" onClick={handleDisconnect}
                    className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm">
                    Disconnect {integration.name}
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setStep(2)}
                  className="w-full gap-2 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] text-white font-semibold h-11">
                  Connect {integration.name} <ArrowRight size={16} />
                </Button>
              )}
            </>
          )}

          {/* ── STEP 2: Connect ── */}
          {step === 2 && (
            <>
              {/* Internalized OAuth — BMAPZ's own real OAuth flow */}
              {isInternalizedOAuth && (
                <div className="space-y-4">
                  <p className="text-gray-300 text-sm text-center">
                    Click below to securely connect your {integration.name} account. A popup will open where you log in and grant BMAPZ the required permissions.
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
                    {connecting ? 'Waiting for authorization...' : `Connect ${integration.name}`}
                  </Button>
                  {connecting && (
                    <div className="p-3 rounded-xl bg-[#38b6ff]/10 border border-[#38b6ff]/20 text-center">
                      <p className="text-[#38b6ff] text-xs">Complete the login in the popup window. This page will update automatically.</p>
                    </div>
                  )}
                  <p className="text-gray-500 text-xs text-center">
                    Your access token is securely stored within BMAPZ. We never share your data.
                  </p>
                </div>
              )}

              {/* External OAuth — open login page in popup */}
              {isExternalOAuth && (
                <div className="space-y-4">
                  <p className="text-gray-300 text-sm text-center">
                    Click below to open {externalOAuth.name}'s login page. Sign in with your usual email and password.
                  </p>
                  <Button onClick={handleExternalOAuthConnect} disabled={connecting}
                    className="w-full h-12 gap-3 text-white font-semibold text-base"
                    style={{ backgroundColor: externalOAuth.color, color: externalOAuth.color === '#FFFC00' ? '#000' : '#fff' }}>
                    {connecting
                      ? <Loader2 size={18} className="animate-spin" />
                      : <img src={externalOAuth.logo} alt="" className="w-5 h-5 object-contain bg-white rounded p-0.5" onError={(e) => { e.target.style.display = 'none'; }} />
                    }
                    {connecting ? 'Waiting for login...' : `Sign in with ${externalOAuth.name}`}
                  </Button>
                  {connecting && (
                    <div className="p-3 rounded-xl bg-[#38b6ff]/10 border border-[#38b6ff]/20 text-center">
                      <p className="text-[#38b6ff] text-xs">Waiting for you to complete login in the popup window...</p>
                    </div>
                  )}
                </div>
              )}

              {/* Manual credentials */}
              {isManualCreds && (
                <div className="space-y-4">
                  {oauthFallbackMode && (
                    <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300">
                      Platform OAuth isn't configured yet. Enter your access token directly — or ask your admin to add OAuth credentials in Railway settings.
                    </div>
                  )}
                  <p className="text-gray-300 text-sm">Enter your {integration.name} credentials below:</p>
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
                    {saving ? 'Connecting...' : 'Connect Account'}
                  </Button>
                </div>
              )}

              {/* Unsupported */}
              {!isInternalizedOAuth && !isExternalOAuth && !isManualCreds && (
                <div className="text-center space-y-3 py-4">
                  <p className="text-gray-400 text-sm">
                    This integration requires setup through the {integration.name} platform.
                  </p>
                  {integration.setupUrl && (
                    <a href={integration.setupUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="gap-2 border-white/10 text-white hover:bg-white/5">
                        <ExternalLink size={14} /> Open {integration.name}
                      </Button>
                    </a>
                  )}
                </div>
              )}

              <button onClick={() => setStep(1)} className="text-gray-500 text-xs hover:text-gray-300 transition-colors w-full text-center">
                ← Back
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
                <h3 className="text-white text-xl font-bold mb-1">Connected!</h3>
                <p className="text-gray-400 text-sm">
                  {integration.name} is now connected to your BMAPZ account. All data and permissions have been granted.
                </p>
              </div>
              <Button onClick={handleDone} className="w-full bg-gradient-to-r from-[#3572b9] to-[#38b6ff] font-semibold h-11">
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
