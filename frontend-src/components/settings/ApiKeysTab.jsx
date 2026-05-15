import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Eye, EyeOff, CheckCircle, XCircle, Loader2, TestTube, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/apiClient';
import { Company } from '@/api/entities';

function SecretInput({ label, value, onChange, placeholder, hint }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label className="text-gray-400 text-xs">{label}</Label>
      {hint && <p className="text-gray-600 text-xs mb-1">{hint}</p>}
      <div className="flex gap-2 mt-1">
        <Input
          type={show ? 'text' : 'password'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="bg-black/30 border-white/10 text-white font-mono text-sm"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

function IntegrationSection({ title, color, icon, status, onTest, isTesting, testLabel, children }) {
  return (
    <div className={`rounded-2xl border p-5 space-y-4 ${status === true ? 'bg-green-500/5 border-green-500/20' : status === false ? 'bg-red-500/5 border-red-500/20' : 'bg-white/5 border-white/10'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: `${color}20` }}>
            {icon}
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">{title}</h3>
            {status === true && <p className="text-green-400 text-xs flex items-center gap-1"><CheckCircle size={11} /> Connected</p>}
            {status === false && <p className="text-red-400 text-xs flex items-center gap-1"><XCircle size={11} /> Not connected</p>}
            {status === undefined && <p className="text-gray-500 text-xs">Not tested</p>}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onTest}
          disabled={isTesting}
          className="border-white/10 text-gray-300 hover:bg-white/10 gap-1.5 text-xs"
        >
          {isTesting ? <Loader2 size={12} className="animate-spin" /> : <TestTube size={12} />}
          {testLabel || 'Test'}
        </Button>
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

export default function ApiKeysTab({ company, onSave }) {
  const [keys, setKeys] = useState(() => ({
    openai_api_key: company?.openai_api_key || '',
    openai_model: company?.openai_model || 'gpt-4o-mini',
    google_ads_developer_token: company?.google_ads_developer_token || '',
    google_ads_client_id: company?.google_ads_client_id || '',
    google_ads_client_secret: company?.google_ads_client_secret || '',
    google_ads_refresh_token: company?.google_ads_refresh_token || '',
    google_ads_customer_id: company?.google_ads_customer_id || '',
    tiktok_access_token: company?.tiktok_access_token || '',
    tiktok_advertiser_id: company?.tiktok_advertiser_id || '',
    linkedin_ads_access_token: company?.linkedin_ads_access_token || '',
    linkedin_ads_account_id: company?.linkedin_ads_account_id || '',
    whatsapp_api_token: company?.whatsapp_api_token || '',
    whatsapp_phone_id: company?.whatsapp_phone_id || '',
    whatsapp_verify_token: company?.whatsapp_verify_token || '',
    gmail_sender_email: company?.gmail_sender_email || '',
    gmail_client_id: company?.gmail_client_id || '',
    gmail_client_secret: company?.gmail_client_secret || '',
    gmail_refresh_token: company?.gmail_refresh_token || '',
    wordpress_url: company?.wordpress_url || '',
    wordpress_user: company?.wordpress_user || '',
    wordpress_app_password: company?.wordpress_app_password || '',
    zapier_webhook_url: company?.zapier_webhook_url || '',
    make_webhook_url: company?.make_webhook_url || '',
    n8n_webhook_url: company?.n8n_webhook_url || '',
    custom_api_url: company?.custom_api_url || '',
    custom_api_key: company?.custom_api_key || '',
    custom_api_headers: company?.custom_api_headers || '',
    apollo_api_key: company?.apollo_api_key || '',
    hunter_api_key: company?.hunter_api_key || '',
    stability_api_key: company?.stability_api_key || '',
  }));
  const [statuses, setStatuses] = useState(company?.integration_status || {});
  const [testing, setTesting] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (field, val) => setKeys(prev => ({ ...prev, [field]: val }));

  const connectMetaOAuth = async (integrationType) => {
    setTesting(prev => ({ ...prev, [`oauth_${integrationType}`]: true }));
    try {
      const res = await window.open(`${import.meta.env.VITE_API_URL}/api/oauth/meta/initiate?type=${integrationType}&origin=${encodeURIComponent(window.location.origin)}`, 'oauth_popup', 'width=620,height=720');
      const { authUrl } = res.data;
      if (authUrl) {
        window.open(authUrl, '_blank', 'width=600,height=700');
        toast.info('Authorize in the popup window. Once done, refresh this page to see your updated token.');
      } else {
        toast.error('Could not get authorization URL');
      }
    } catch (e) {
      toast.error('OAuth failed: ' + (e?.response?.data?.error || e.message));
    } finally {
      setTesting(prev => ({ ...prev, [`oauth_${integrationType}`]: false }));
    }
  };

  const testIntegration = async (type) => {
    setTesting(prev => ({ ...prev, [type]: true }));
    try {
      // Save current keys first
      await Company.update(company.id, { ...keys });
      const res = await api.get('/api/integrations/status');
      const { success, message } = res.data;
      setStatuses(prev => ({ ...prev, [type]: success }));
      success ? toast.success(message) : toast.error(message);
    } catch (e) {
      toast.error('Test failed: ' + (e?.response?.data?.error || e.message));
    } finally {
      setTesting(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...keys, integration_status: statuses });
      toast.success('API keys saved');
    } catch (e) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">API Keys & Integrations</h2>
        <p className="text-gray-400 text-sm mt-1">Connect your own accounts. All keys are stored securely in your company profile and never shared.</p>
      </div>

      {/* OpenAI */}
      <IntegrationSection
        title="OpenAI (AI Engine)"
        color="#10A37F"
        icon="🤖"
        status={statuses.openai}
        onTest={() => testIntegration('openai')}
        isTesting={testing.openai}
        testLabel="Test API Key"
      >
        <SecretInput
          label="OpenAI API Key"
          value={keys.openai_api_key}
          onChange={(v) => set('openai_api_key', v)}
          placeholder="sk-..."
          hint="Get yours at platform.openai.com/api-keys"
        />
        <div>
          <Label className="text-gray-400 text-xs">Default Model</Label>
          <select
            value={keys.openai_model || 'gpt-4o-mini'}
            onChange={(e) => set('openai_model', e.target.value)}
            className="w-full mt-1 bg-black/30 border border-white/10 text-white rounded-md px-3 py-2 text-sm"
          >
            <option value="gpt-4o-mini">gpt-4o-mini (Fast & affordable)</option>
            <option value="gpt-4o">gpt-4o (Most capable)</option>
            <option value="gpt-4-turbo">gpt-4-turbo</option>
            <option value="gpt-3.5-turbo">gpt-3.5-turbo (Budget)</option>
          </select>
          <p className="text-gray-600 text-xs mt-1">If no key is set, BMAPZ`s built-in AI is used (uses platform credits)</p>
        </div>
      </IntegrationSection>

      {/* ── AD ACCOUNTS ── */}
      <div className="pt-2 pb-1">
        <h3 className="text-white font-semibold text-base flex items-center gap-2">📊 Ad Accounts</h3>
        <p className="text-gray-500 text-xs mt-0.5">Connect your ad platforms to pull real campaign data for AI-powered optimization.</p>
      </div>

      {/* Meta Ads */}
      <IntegrationSection
        title="Meta Ads (Facebook / Instagram)"
        color="#1877F2"
        icon="📣"
        status={statuses.meta_ads}
        onTest={() => testIntegration(`meta_ads`)}
        isTesting={testing.meta_ads}
        testLabel="Test Connection"
      >
        <Button
          onClick={() => connectMetaOAuth(`meta_ads`)}
          disabled={testing.oauth_meta_ads}
          className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90 text-white gap-2 justify-center"
        >
          {testing.oauth_meta_ads ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
          Connect with Meta OAuth
        </Button>
        {statuses.meta_ads && (
          <p className="text-green-400 text-xs text-center">✓ Connected via OAuth. Token is managed automatically.</p>
        )}
      </IntegrationSection>

      {/* Google Ads */}
      <IntegrationSection
        title="Google Ads"
        color="#4285F4"
        icon="🔍"
        status={statuses.google_ads}
        onTest={() => testIntegration(`google_ads`)}
        isTesting={testing.google_ads}
        testLabel="Test Connection"
      >
        <SecretInput label="Developer Token" value={keys.google_ads_developer_token} onChange={(v) => set(`google_ads_developer_token`, v)} placeholder="xxxx" hint="Google Ads → Tools → API Center → Developer Token" />
        <SecretInput label="OAuth Client ID" value={keys.google_ads_client_id} onChange={(v) => set(`google_ads_client_id`, v)} placeholder="xxxx.apps.googleusercontent.com" hint="Google Cloud Console → OAuth 2.0 Credentials" />
        <SecretInput label="OAuth Client Secret" value={keys.google_ads_client_secret} onChange={(v) => set(`google_ads_client_secret`, v)} placeholder="GOCSPX-..." />
        <SecretInput label="OAuth Refresh Token" value={keys.google_ads_refresh_token} onChange={(v) => set(`google_ads_refresh_token`, v)} placeholder="1//0g..." hint="Generate via OAuth Playground with scope: https://www.googleapis.com/auth/adwords" />
        <div>
          <Label className="text-gray-400 text-xs">Customer ID</Label>
          <Input value={keys.google_ads_customer_id || `'} onChange={(e) => set('google_ads_customer_id`, e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm" placeholder="123-456-7890" />
          <p className="text-gray-600 text-xs mt-1">Found at top right of your Google Ads account</p>
        </div>
      </IntegrationSection>

      {/* TikTok Ads */}
      <IntegrationSection
        title="TikTok Ads"
        color="#010101"
        icon="🎵"
        status={statuses.tiktok_ads}
        onTest={() => testIntegration(`tiktok_ads`)}
        isTesting={testing.tiktok_ads}
        testLabel="Test Connection"
      >
        <SecretInput label="Access Token" value={keys.tiktok_access_token} onChange={(v) => set(`tiktok_access_token`, v)} placeholder="xxxx" hint="TikTok for Business → My Apps → Access Token" />
        <div>
          <Label className="text-gray-400 text-xs">Advertiser ID</Label>
          <Input value={keys.tiktok_advertiser_id || `'} onChange={(e) => set('tiktok_advertiser_id`, e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm" placeholder="7xxxxxxxxx" />
          <p className="text-gray-600 text-xs mt-1">Found in TikTok Ads Manager → Account → Advertiser ID</p>
        </div>
      </IntegrationSection>

      {/* LinkedIn Ads */}
      <IntegrationSection
        title="LinkedIn Ads (Campaign Manager)"
        color="#0077b5"
        icon="💼"
        status={statuses.linkedin_ads}
        onTest={() => testIntegration(`linkedin_ads`)}
        isTesting={testing.linkedin_ads}
        testLabel="Test Connection"
      >
        <SecretInput label="Access Token" value={keys.linkedin_ads_access_token} onChange={(v) => set(`linkedin_ads_access_token`, v)} placeholder="AQV..." hint="LinkedIn Developer Portal → App → OAuth tokens with r_ads and r_ads_reporting scopes" />
        <div>
          <Label className="text-gray-400 text-xs">Ad Account ID</Label>
          <Input value={keys.linkedin_ads_account_id || `'} onChange={(e) => set('linkedin_ads_account_id`, e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm" placeholder="123456789" />
          <p className="text-gray-600 text-xs mt-1">LinkedIn Campaign Manager → Account Assets → Account ID</p>
        </div>
      </IntegrationSection>

      <div className="border-t border-white/10 pt-4">
        <h3 className="text-white font-semibold text-base flex items-center gap-2">📬 Messaging & Communication</h3>
      </div>

      {/* WhatsApp */}
      <IntegrationSection
        title="WhatsApp Business API"
        color="#25D366"
        icon="💬"
        status={statuses.whatsapp}
        onTest={() => testIntegration(`whatsapp`)}
        isTesting={testing.whatsapp}
        testLabel="Test Connection"
      >
        <SecretInput label="Access Token" value={keys.whatsapp_api_token} onChange={(v) => set(`whatsapp_api_token`, v)} placeholder="EAAxxxxxxx" hint="From Meta for Developers → WhatsApp → API Setup" />
        <SecretInput label="Phone Number ID" value={keys.whatsapp_phone_id} onChange={(v) => set(`whatsapp_phone_id`, v)} placeholder="1234567890" />
        <SecretInput label="Webhook Verify Token (optional)" value={keys.whatsapp_verify_token} onChange={(v) => set(`whatsapp_verify_token`, v)} placeholder="Your custom verify token" />
      </IntegrationSection>

      {/* Gmail / Email */}
      <IntegrationSection
        title="Gmail (Email Sending)"
        color="#EA4335"
        icon="📧"
        status={statuses.gmail}
        onTest={() => testIntegration(`gmail`)}
        isTesting={testing.gmail}
        testLabel="Test OAuth"
      >
        <SecretInput label="Gmail Sender Email" value={keys.gmail_sender_email} onChange={(v) => set(`gmail_sender_email`, v)} placeholder="you@gmail.com" hint="The Gmail account that sends emails" />
        <SecretInput label="OAuth Client ID" value={keys.gmail_client_id} onChange={(v) => set(`gmail_client_id`, v)} placeholder="xxxx.apps.googleusercontent.com" hint="From Google Cloud Console → OAuth 2.0 Client" />
        <SecretInput label="OAuth Client Secret" value={keys.gmail_client_secret} onChange={(v) => set(`gmail_client_secret`, v)} placeholder="GOCSPX-..." />
        <SecretInput label="Refresh Token" value={keys.gmail_refresh_token} onChange={(v) => set(`gmail_refresh_token`, v)} placeholder="1//0g..." hint="Get via OAuth Playground (oauth2.googleapis.com)" />
      </IntegrationSection>

      {/* WordPress */}
      <IntegrationSection
        title="WordPress (Blog Publishing)"
        color="#21759B"
        icon="📝"
        status={statuses.wordpress}
        onTest={() => testIntegration(`wordpress`)}
        isTesting={testing.wordpress}
        testLabel="Test Connection"
      >
        <div>
          <Label className="text-gray-400 text-xs">WordPress Site URL</Label>
          <Input value={keys.wordpress_url || `'} onChange={(e) => set('wordpress_url`, e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm" placeholder="https://yourblog.com" />
        </div>
        <SecretInput label="WordPress Username" value={keys.wordpress_user} onChange={(v) => set(`wordpress_user`, v)} placeholder="your_username" />
        <SecretInput label="Application Password" value={keys.wordpress_app_password} onChange={(v) => set(`wordpress_app_password`, v)} placeholder="xxxx xxxx xxxx xxxx" hint="WordPress Admin → Users → Profile → Application Passwords" />
      </IntegrationSection>

      {/* Zapier */}
      <IntegrationSection
        title="Zapier Webhook"
        color="#FF4A00"
        icon="⚡"
        status={statuses.zapier}
        onTest={() => testIntegration(`zapier`)}
        isTesting={testing.zapier}
        testLabel="Send Test"
      >
        <div>
          <Label className="text-gray-400 text-xs">Zapier Webhook URL</Label>
          <Input value={keys.zapier_webhook_url || `'} onChange={(e) => set('zapier_webhook_url`, e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm font-mono" placeholder="https://hooks.zapier.com/hooks/catch/..." />
          <p className="text-gray-600 text-xs mt-1">Create a Zap → Trigger: Webhooks by Zapier → Catch Hook</p>
        </div>
      </IntegrationSection>

      {/* Make / Integromat */}
      <IntegrationSection
        title="Make (formerly Integromat)"
        color="#6D00CC"
        icon="🔧"
        status={statuses.make}
        onTest={() => testIntegration(`make`)}
        isTesting={testing.make}
        testLabel="Send Test"
      >
        <div>
          <Label className="text-gray-400 text-xs">Make Webhook URL</Label>
          <Input value={keys.make_webhook_url || `'} onChange={(e) => set('make_webhook_url`, e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm font-mono" placeholder="https://hook.eu1.make.com/..." />
          <p className="text-gray-600 text-xs mt-1">Make → Create Scenario → Add Webhooks → Custom webhook</p>
        </div>
      </IntegrationSection>

      {/* n8n */}
      <IntegrationSection
        title="n8n Webhook"
        color="#EA4B71"
        icon="🔁"
        status={statuses.n8n}
        onTest={() => testIntegration(`n8n`)}
        isTesting={testing.n8n}
        testLabel="Send Test"
      >
        <div>
          <Label className="text-gray-400 text-xs">n8n Webhook URL</Label>
          <Input value={keys.n8n_webhook_url || `'} onChange={(e) => set('n8n_webhook_url`, e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm font-mono" placeholder="https://your-n8n.app/webhook/..." />
        </div>
      </IntegrationSection>

      {/* Custom API */}
      <IntegrationSection
        title="Custom API / Webhook"
        color="#38b6ff"
        icon="🌐"
        status={statuses.custom}
        onTest={() => testIntegration(`custom`)}
        isTesting={testing.custom}
        testLabel="Send Test"
      >
        <div>
          <Label className="text-gray-400 text-xs">Endpoint URL</Label>
          <Input value={keys.custom_api_url || `'} onChange={(e) => set('custom_api_url`, e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm font-mono" placeholder="https://api.yourservice.com/webhook" />
        </div>
        <SecretInput label="API Key / Bearer Token (optional)" value={keys.custom_api_key} onChange={(v) => set(`custom_api_key`, v)} placeholder="Bearer token or API key" />
        <div>
          <Label className="text-gray-400 text-xs">Extra Headers (JSON, optional)</Label>
          <Input value={keys.custom_api_headers || `'} onChange={(e) => set('custom_api_headers', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm font-mono" placeholder='{"X-Custom-Header": "value"}' />
        </div>
      </IntegrationSection>

      <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Save All API Keys
      </Button>
    </div>
  );
}