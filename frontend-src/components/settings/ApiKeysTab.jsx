import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
        {onTest && (
          <Button size="sm" variant="outline" onClick={onTest} disabled={isTesting}
            className="border-white/10 text-gray-300 hover:bg-white/10 gap-1.5 text-xs">
            {isTesting ? <Loader2 size={12} className="animate-spin" /> : <TestTube size={12} />}
            {testLabel || 'Test'}
          </Button>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

const OPENAI_MODELS = [
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini — Fast & affordable (recommended)' },
  { value: 'gpt-4o', label: 'gpt-4o — Most capable' },
  { value: 'gpt-4.1', label: 'gpt-4.1 — Latest generation' },
  { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini — Latest, fast & affordable' },
  { value: 'gpt-4.1-nano', label: 'gpt-4.1-nano — Fastest & cheapest' },
  { value: 'o3-mini', label: 'o3-mini — Advanced reasoning, efficient' },
  { value: 'o1-mini', label: 'o1-mini — Reasoning model' },
  { value: 'gpt-4-turbo', label: 'gpt-4-turbo' },
  { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo — Budget' },
];

const ANTHROPIC_MODELS = [
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 — Best balance (recommended)' },
  { value: 'claude-opus-4-5', label: 'Claude Opus 4.5 — Most capable' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — Fast & affordable' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku — Fast' },
  { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
];

const IMAGE_PROVIDERS = [
  { value: 'openai', label: 'OpenAI DALL-E (uses OpenAI key)' },
  { value: 'stability', label: 'Stability AI (Stable Diffusion)' },
];

const IMAGE_MODELS_OPENAI = [
  { value: 'dall-e-3', label: 'DALL-E 3 — Best quality (recommended)' },
  { value: 'dall-e-2', label: 'DALL-E 2 — Faster, cheaper' },
];

function DiagnoseAI() {
  const [diag, setDiag] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const result = await api.get('/api/ai/diagnose');
      setDiag(result);
    } catch (e) {
      setDiag({ error: e?.message || 'Diagnose failed' });
    } finally {
      setLoading(false);
    }
  };
  const renderTest = (t) => {
    if (!t) return <span className="text-gray-500">not tested (no key)</span>;
    if (t.ok) return <span className="text-green-400">✓ working ({t.model_used})</span>;
    return <span className="text-red-400">✗ {t.kind}: {t.msg}</span>;
  };
  return (
    <div className="border-t border-white/10 pt-4 mt-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-white text-sm font-medium">AI Diagnose</p>
          <p className="text-gray-500 text-xs">Live-test both providers — shows the real backend status (not just "key shape is OK").</p>
        </div>
        <Button onClick={run} disabled={loading} variant="outline" className="border-white/10 text-white hover:bg-white/5 shrink-0">
          {loading ? 'Testing…' : 'Run diagnose'}
        </Button>
      </div>
      {diag && !diag.error && (
        <div className="mt-3 p-3 rounded-xl bg-black/30 border border-white/10 text-xs space-y-2 font-mono">
          <div><span className="text-gray-400">Active provider:</span> <span className="text-white">{diag.active_provider}</span></div>
          <div className="space-y-1">
            <div className="text-[#38b6ff]">OpenAI</div>
            <div className="pl-3"><span className="text-gray-400">key:</span> {diag.openai.has_key ? `${diag.openai.key_prefix || '(platform)'} (${diag.openai.key_source})` : <span className="text-gray-500">none</span>}</div>
            <div className="pl-3"><span className="text-gray-400">model:</span> {diag.openai.model}</div>
            <div className="pl-3"><span className="text-gray-400">test:</span> {renderTest(diag.openai.test_result)}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[#cb6ce6]">Anthropic</div>
            <div className="pl-3"><span className="text-gray-400">key:</span> {diag.anthropic.has_key ? `${diag.anthropic.key_prefix || '(platform)'} (${diag.anthropic.key_source})` : <span className="text-gray-500">none</span>}</div>
            <div className="pl-3"><span className="text-gray-400">model requested:</span> {diag.anthropic.model_requested || <span className="text-gray-500">(default)</span>}</div>
            <div className="pl-3"><span className="text-gray-400">model resolved:</span> {diag.anthropic.model_resolved}</div>
            <div className="pl-3"><span className="text-gray-400">test:</span> {renderTest(diag.anthropic.test_result)}</div>
          </div>
        </div>
      )}
      {diag?.error && <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">{diag.error}</div>}
    </div>
  );
}

export default function ApiKeysTab({ company, user, onSave }) {
  // BYOK is restricted to owner + system_admin. Everyone else uses platform keys.
  const canUseBYOK = user?.role === 'owner' || user?.role === 'system_admin';
  const queryClient = useQueryClient();
  const [keys, setKeys] = useState(() => ({
    ai_provider: company?.ai_provider || 'openai',
    openai_api_key: company?.openai_api_key || '',
    openai_model: company?.openai_model || 'gpt-4o-mini',
    anthropic_api_key: company?.anthropic_api_key || '',
    anthropic_model: company?.anthropic_model || 'claude-sonnet-4-5',
    ai_image_provider: company?.ai_image_provider || 'openai',
    ai_image_model: company?.ai_image_model || 'dall-e-3',
    stability_api_key: company?.stability_api_key || '',
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
  }));
  const [statuses, setStatuses] = useState(company?.integration_status || {});
  const [testing, setTesting] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company) return;
    setKeys({
      ai_provider: company.ai_provider || 'openai',
      openai_api_key: company.openai_api_key || '',
      openai_model: company.openai_model || 'gpt-4o-mini',
      anthropic_api_key: company.anthropic_api_key || '',
      anthropic_model: company.anthropic_model || 'claude-sonnet-4-5',
      ai_image_provider: company.ai_image_provider || 'openai',
      ai_image_model: company.ai_image_model || 'dall-e-3',
      stability_api_key: company.stability_api_key || '',
      google_ads_developer_token: company.google_ads_developer_token || '',
      google_ads_client_id: company.google_ads_client_id || '',
      google_ads_client_secret: company.google_ads_client_secret || '',
      google_ads_refresh_token: company.google_ads_refresh_token || '',
      google_ads_customer_id: company.google_ads_customer_id || '',
      tiktok_access_token: company.tiktok_access_token || '',
      tiktok_advertiser_id: company.tiktok_advertiser_id || '',
      linkedin_ads_access_token: company.linkedin_ads_access_token || '',
      linkedin_ads_account_id: company.linkedin_ads_account_id || '',
      whatsapp_api_token: company.whatsapp_api_token || '',
      whatsapp_phone_id: company.whatsapp_phone_id || '',
      whatsapp_verify_token: company.whatsapp_verify_token || '',
      gmail_sender_email: company.gmail_sender_email || '',
      gmail_client_id: company.gmail_client_id || '',
      gmail_client_secret: company.gmail_client_secret || '',
      gmail_refresh_token: company.gmail_refresh_token || '',
      wordpress_url: company.wordpress_url || '',
      wordpress_user: company.wordpress_user || '',
      wordpress_app_password: company.wordpress_app_password || '',
      zapier_webhook_url: company.zapier_webhook_url || '',
      make_webhook_url: company.make_webhook_url || '',
      n8n_webhook_url: company.n8n_webhook_url || '',
      custom_api_url: company.custom_api_url || '',
      custom_api_key: company.custom_api_key || '',
      custom_api_headers: company.custom_api_headers || '',
      apollo_api_key: company.apollo_api_key || '',
      hunter_api_key: company.hunter_api_key || '',
    });
    setStatuses(company.integration_status || {});
  }, [company]);

  const set = (field, val) => setKeys(prev => ({ ...prev, [field]: val }));

  const connectMetaOAuth = async (integrationType) => {
    setTesting(prev => ({ ...prev, [`oauth_${integrationType}`]: true }));

    let popup;
    let handledByMessage = false;

    const onMessage = (event) => {
      if (event.data?.type === 'oauth_success') {
        handledByMessage = true;
        window.removeEventListener('message', onMessage);
        setTesting(prev => ({ ...prev, [`oauth_${integrationType}`]: false }));
        setStatuses(prev => ({ ...prev, [integrationType]: true }));
        queryClient.invalidateQueries({ queryKey: ['companies'] });
        toast.success('Meta connected!');
      } else if (event.data?.type === 'oauth_error') {
        handledByMessage = true;
        window.removeEventListener('message', onMessage);
        setTesting(prev => ({ ...prev, [`oauth_${integrationType}`]: false }));
        toast.error(`OAuth failed: ${event.data.error || 'Unknown error'}`);
      }
    };
    try {
      const { authUrl } = await api.get('/api/oauth/meta/initiate-url', {
        type: integrationType,
        origin: window.location.origin,
      });

      popup = window.open(authUrl, 'oauth_popup', 'width=620,height=720,left=200,top=80');

      if (!popup) {
        setTesting(prev => ({ ...prev, [`oauth_${integrationType}`]: false }));
        toast.error('Popup blocked. Please allow popups for Bmapz AI and try again.');
        return;
      }

      window.addEventListener('message', onMessage);

      const pollTimer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(pollTimer);
          window.removeEventListener('message', onMessage);
          if (!handledByMessage) {
            setTesting(prev => ({ ...prev, [`oauth_${integrationType}`]: false }));
            toast.error('Meta connection was not completed. Please finish the login popup and approve access.');
          }
        }
      }, 1000);

      setTimeout(() => {
        clearInterval(pollTimer);
        window.removeEventListener('message', onMessage);
        if (!handledByMessage) {
          setTesting(prev => ({ ...prev, [`oauth_${integrationType}`]: false }));
        }
      }, 120000);
    } catch (e) {
      window.removeEventListener('message', onMessage);
      setTesting(prev => ({ ...prev, [`oauth_${integrationType}`]: false }));
      toast.error(`OAuth failed: ${e?.message || 'Could not start Meta login'}`);
    }
  };

  const testIntegration = async (type) => {
    setTesting(prev => ({ ...prev, [type]: true }));
    try {
      // Clean keys before saving — strip whitespace, quotes, newlines that
      // can sneak in from copy-paste and cause "invalid key" errors.
      const cleanedKeys = Object.fromEntries(
        Object.entries(keys).map(([k, v]) => [
          k,
          typeof v === 'string' && k.includes('_key') ? v.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '') : v,
        ])
      );
      await Company.update(company.id, cleanedKeys);
      setKeys(cleanedKeys);
      // Call the dedicated test endpoint for this integration type
      const result = await api.post(`/api/integrations/test/${type}`);
      const success = result?.success === true;
      const message = result?.message || (success ? `${type} connected` : `${type} connection failed`);
      setStatuses(prev => ({ ...prev, [type]: success }));
      if (success) {
        toast.success(message);
      } else {
        toast.error(message);
      }
    } catch (e) {
      const errMsg = e?.response?.data?.error || e?.message || 'Test failed';
      setStatuses(prev => ({ ...prev, [type]: false }));
      toast.error(`Test failed: ${errMsg}`);
    } finally {
      setTesting(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Clean keys before saving — strip whitespace, surrounding quotes, newlines
      // that can sneak in from copy-paste and cause "invalid key" errors at runtime.
      const cleanedKeys = Object.fromEntries(
        Object.entries(keys).map(([k, v]) => [
          k,
          typeof v === 'string' && k.includes('_key') ? v.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '') : v,
        ])
      );
      setKeys(cleanedKeys);
      await onSave({ ...cleanedKeys, integration_status: statuses });
      toast.success('API keys saved');
    } catch (e) {
      toast.error('Failed to save: ' + (e?.response?.data?.error || e.message));
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

      <div className="pt-1 pb-0">
        <h3 className="text-white font-semibold text-base flex items-center gap-2">🧠 General AI Provider</h3>
        <p className="text-gray-500 text-xs mt-0.5">Choose which AI model powers all text generation, analysis, and content creation features.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div>
          <Label className="text-gray-400 text-xs">Active AI Provider</Label>
          <div className="flex gap-2 mt-2">
            {[
              { value: 'openai', label: '🤖 OpenAI' },
              { value: 'anthropic', label: '🟣 Anthropic Claude' },
            ].map(opt => (
              <button key={opt.value} type="button" onClick={() => set('ai_provider', opt.value)}
                className={`flex-1 py-2.5 px-4 rounded-xl border text-sm font-medium transition-all ${
                  keys.ai_provider === opt.value
                    ? 'border-[#38b6ff]/60 bg-[#38b6ff]/10 text-white'
                    : 'border-white/10 text-gray-400 hover:border-white/30 hover:text-gray-300'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-gray-600 text-xs mt-2">
            {keys.ai_provider === 'anthropic'
              ? 'All AI features will use Anthropic Claude. Add your Anthropic API key below.'
              : 'All AI features will use OpenAI. Add your OpenAI API key below.'}
          </p>
        </div>
        <DiagnoseAI />
      </div>

      {/* BYOK fields — only visible to owner + system_admin. Other users
          consume platform credits and don't need to see/manage keys. */}
      {canUseBYOK ? (
        <>
          <IntegrationSection title="OpenAI" color="#10A37F" icon="🤖"
            status={statuses.openai} onTest={() => testIntegration('openai')} isTesting={testing.openai} testLabel="Test Key">
            <div className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2 mb-2">
              BYOK (Bring Your Own Key) is restricted to Owner and System Admin. Any key you set here BYPASSES Bmapz credit deduction — usage is billed directly to your OpenAI account.
            </div>
            <SecretInput label="OpenAI API Key" value={keys.openai_api_key} onChange={(v) => set('openai_api_key', v)}
              placeholder="sk-..." hint="Get yours at platform.openai.com/api-keys" />
            <div>
              <Label className="text-gray-400 text-xs">Default Model</Label>
              <select value={keys.openai_model || 'gpt-4o-mini'} onChange={(e) => set('openai_model', e.target.value)}
                className="w-full mt-1 bg-black/30 border border-white/10 text-white rounded-md px-3 py-2 text-sm">
                {OPENAI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <p className="text-gray-600 text-xs mt-1">Used when OpenAI is the active provider. If no key is set, platform credits are used.</p>
            </div>
          </IntegrationSection>

          <IntegrationSection title="Anthropic Claude" color="#7C3AED" icon="🟣"
            status={statuses.anthropic} onTest={() => testIntegration('anthropic')} isTesting={testing.anthropic} testLabel="Test Key">
            <div className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2 mb-2">
              BYOK key — usage is billed directly to your Anthropic workspace. No Bmapz credit deduction.
            </div>
            <SecretInput label="Anthropic API Key" value={keys.anthropic_api_key} onChange={(v) => set('anthropic_api_key', v)}
              placeholder="sk-ant-..." hint="Get yours at console.anthropic.com/settings/keys" />
            <div>
              <Label className="text-gray-400 text-xs">Default Model</Label>
              <select value={keys.anthropic_model || 'claude-sonnet-4-5'} onChange={(e) => set('anthropic_model', e.target.value)}
                className="w-full mt-1 bg-black/30 border border-white/10 text-white rounded-md px-3 py-2 text-sm">
                {ANTHROPIC_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <p className="text-gray-600 text-xs mt-1">Used when Anthropic is the active provider.</p>
            </div>
          </IntegrationSection>
        </>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h4 className="text-white font-medium mb-1.5">🔒 AI Keys managed by Bmapz</h4>
          <p className="text-gray-400 text-sm">
            AI requests on this account use platform-provided OpenAI and Anthropic keys, billed in Bmapz credits per your subscription plan.
            See your usage in the <span className="text-[#38b6ff]">Usage</span> tab.
          </p>
          <p className="text-gray-600 text-xs mt-2">
            BYOK (Bring Your Own Key) is restricted to Owners and System Admins.
          </p>
        </div>
      )}

      <div className="pt-2 pb-0">
        <h3 className="text-white font-semibold text-base flex items-center gap-2">🎨 Image Generation</h3>
        <p className="text-gray-500 text-xs mt-0.5">Choose which provider generates images (ads, blog images, social content).</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div>
          <Label className="text-gray-400 text-xs">Image Provider</Label>
          <select value={keys.ai_image_provider || 'openai'} onChange={(e) => set('ai_image_provider', e.target.value)}
            className="w-full mt-1 bg-black/30 border border-white/10 text-white rounded-md px-3 py-2 text-sm">
            {IMAGE_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        {keys.ai_image_provider === 'openai' && (
          <div>
            <Label className="text-gray-400 text-xs">Image Model</Label>
            <select value={keys.ai_image_model || 'dall-e-3'} onChange={(e) => set('ai_image_model', e.target.value)}
              className="w-full mt-1 bg-black/30 border border-white/10 text-white rounded-md px-3 py-2 text-sm">
              {IMAGE_MODELS_OPENAI.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <p className="text-gray-600 text-xs mt-1">Uses your OpenAI API key above.</p>
          </div>
        )}
        {keys.ai_image_provider === 'stability' && (
          <SecretInput label="Stability AI API Key" value={keys.stability_api_key} onChange={(v) => set('stability_api_key', v)}
            placeholder="sk-..." hint="Get yours at platform.stability.ai/account/keys" />
        )}
      </div>

      <div className="pt-2 pb-1">
        <h3 className="text-white font-semibold text-base flex items-center gap-2">📊 Ad Accounts</h3>
        <p className="text-gray-500 text-xs mt-0.5">Connect your ad platforms to pull real campaign data for AI-powered optimization.</p>
      </div>

      <IntegrationSection title="Meta Ads (Facebook / Instagram)" color="#1877F2" icon="📣"
        status={statuses.meta_ads} onTest={() => testIntegration('meta_ads')} isTesting={testing.meta_ads} testLabel="Test Connection">
        <Button onClick={() => connectMetaOAuth('meta_ads')} disabled={testing.oauth_meta_ads}
          className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90 text-white gap-2 justify-center">
          {testing.oauth_meta_ads ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
          Connect with Meta OAuth
        </Button>
        {statuses.meta_ads && <p className="text-green-400 text-xs text-center">✓ Connected via OAuth.</p>}
      </IntegrationSection>

      <IntegrationSection title="Google Ads" color="#4285F4" icon="🔍"
        status={statuses.google_ads} onTest={() => testIntegration('google_ads')} isTesting={testing.google_ads} testLabel="Test Connection">
        <SecretInput label="Developer Token" value={keys.google_ads_developer_token} onChange={(v) => set('google_ads_developer_token', v)} placeholder="xxxx" hint="Google Ads → Tools → API Center → Developer Token" />
        <SecretInput label="OAuth Client ID" value={keys.google_ads_client_id} onChange={(v) => set('google_ads_client_id', v)} placeholder="xxxx.apps.googleusercontent.com" />
        <SecretInput label="OAuth Client Secret" value={keys.google_ads_client_secret} onChange={(v) => set('google_ads_client_secret', v)} placeholder="GOCSPX-..." />
        <SecretInput label="OAuth Refresh Token" value={keys.google_ads_refresh_token} onChange={(v) => set('google_ads_refresh_token', v)} placeholder="1//0g..." hint="Generate via OAuth Playground with adwords scope" />
        <div>
          <Label className="text-gray-400 text-xs">Customer ID</Label>
          <Input value={keys.google_ads_customer_id || ''} onChange={(e) => set('google_ads_customer_id', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm" placeholder="123-456-7890" />
        </div>
      </IntegrationSection>

      <IntegrationSection title="TikTok Ads" color="#010101" icon="🎵"
        status={statuses.tiktok_ads} onTest={() => testIntegration('tiktok_ads')} isTesting={testing.tiktok_ads} testLabel="Test Connection">
        <SecretInput label="Access Token" value={keys.tiktok_access_token} onChange={(v) => set('tiktok_access_token', v)} placeholder="xxxx" hint="TikTok for Business → My Apps → Access Token" />
        <div>
          <Label className="text-gray-400 text-xs">Advertiser ID</Label>
          <Input value={keys.tiktok_advertiser_id || ''} onChange={(e) => set('tiktok_advertiser_id', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm" placeholder="7xxxxxxxxx" />
        </div>
      </IntegrationSection>

      <IntegrationSection title="LinkedIn Ads" color="#0077b5" icon="💼"
        status={statuses.linkedin_ads} onTest={() => testIntegration('linkedin_ads')} isTesting={testing.linkedin_ads} testLabel="Test Connection">
        <SecretInput label="Access Token" value={keys.linkedin_ads_access_token} onChange={(v) => set('linkedin_ads_access_token', v)} placeholder="AQV..." hint="LinkedIn Developer Portal → OAuth tokens with r_ads scope" />
        <div>
          <Label className="text-gray-400 text-xs">Ad Account ID</Label>
          <Input value={keys.linkedin_ads_account_id || ''} onChange={(e) => set('linkedin_ads_account_id', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm" placeholder="123456789" />
        </div>
      </IntegrationSection>

      <div className="border-t border-white/10 pt-4">
        <h3 className="text-white font-semibold text-base flex items-center gap-2">📬 Messaging & Communication</h3>
      </div>

      <IntegrationSection title="WhatsApp Business API" color="#25D366" icon="💬"
        status={statuses.whatsapp} onTest={() => testIntegration('whatsapp')} isTesting={testing.whatsapp} testLabel="Test Connection">
        <SecretInput label="Access Token" value={keys.whatsapp_api_token} onChange={(v) => set('whatsapp_api_token', v)} placeholder="EAAxxxxxxx" hint="Meta for Developers → WhatsApp → API Setup" />
        <SecretInput label="Phone Number ID" value={keys.whatsapp_phone_id} onChange={(v) => set('whatsapp_phone_id', v)} placeholder="1234567890" />
        <SecretInput label="Webhook Verify Token (optional)" value={keys.whatsapp_verify_token} onChange={(v) => set('whatsapp_verify_token', v)} placeholder="Your custom verify token" />
      </IntegrationSection>

      <IntegrationSection title="Gmail (Email Sending)" color="#EA4335" icon="📧"
        status={statuses.gmail} onTest={() => testIntegration('gmail')} isTesting={testing.gmail} testLabel="Test OAuth">
        <SecretInput label="Gmail Sender Email" value={keys.gmail_sender_email} onChange={(v) => set('gmail_sender_email', v)} placeholder="you@gmail.com" hint="The Gmail account that sends emails" />
        <SecretInput label="OAuth Client ID" value={keys.gmail_client_id} onChange={(v) => set('gmail_client_id', v)} placeholder="xxxx.apps.googleusercontent.com" />
        <SecretInput label="OAuth Client Secret" value={keys.gmail_client_secret} onChange={(v) => set('gmail_client_secret', v)} placeholder="GOCSPX-..." />
        <SecretInput label="Refresh Token" value={keys.gmail_refresh_token} onChange={(v) => set('gmail_refresh_token', v)} placeholder="1//0g..." hint="Get via OAuth Playground (oauth2.googleapis.com)" />
      </IntegrationSection>

      <IntegrationSection title="WordPress (Blog Publishing)" color="#21759B" icon="📝"
        status={statuses.wordpress} onTest={() => testIntegration('wordpress')} isTesting={testing.wordpress} testLabel="Test Connection">
        <div>
          <Label className="text-gray-400 text-xs">WordPress Site URL</Label>
          <Input value={keys.wordpress_url || ''} onChange={(e) => set('wordpress_url', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm" placeholder="https://yourblog.com" />
        </div>
        <SecretInput label="WordPress Username" value={keys.wordpress_user} onChange={(v) => set('wordpress_user', v)} placeholder="your_username" />
        <SecretInput label="Application Password" value={keys.wordpress_app_password} onChange={(v) => set('wordpress_app_password', v)} placeholder="xxxx xxxx xxxx xxxx" hint="WordPress Admin → Users → Profile → Application Passwords" />
      </IntegrationSection>

      <div className="border-t border-white/10 pt-4">
        <h3 className="text-white font-semibold text-base flex items-center gap-2">🔍 Prospecting & Data</h3>
      </div>

      <IntegrationSection title="Apollo.io" color="#FF6B35" icon="🚀" status={statuses.apollo} onTest={() => testIntegration('apollo')} isTesting={testing.apollo} testLabel="Test Key">
        <SecretInput label="Apollo API Key" value={keys.apollo_api_key} onChange={(v) => set('apollo_api_key', v)} placeholder="xxxx" hint="app.apollo.io → Settings → Integrations → API Keys" />
      </IntegrationSection>

      <IntegrationSection title="Hunter.io (Email Finder)" color="#F87900" icon="🎯" status={statuses.hunter} onTest={() => testIntegration('hunter')} isTesting={testing.hunter} testLabel="Test Key">
        <SecretInput label="Hunter API Key" value={keys.hunter_api_key} onChange={(v) => set('hunter_api_key', v)} placeholder="xxxx" hint="hunter.io → Dashboard → API" />
      </IntegrationSection>

      <div className="border-t border-white/10 pt-4">
        <h3 className="text-white font-semibold text-base flex items-center gap-2">⚡ Automation Webhooks</h3>
      </div>

      <IntegrationSection title="Zapier Webhook" color="#FF4A00" icon="⚡" status={statuses.zapier} onTest={() => testIntegration('zapier')} isTesting={testing.zapier} testLabel="Send Test">
        <div>
          <Label className="text-gray-400 text-xs">Zapier Webhook URL</Label>
          <Input value={keys.zapier_webhook_url || ''} onChange={(e) => set('zapier_webhook_url', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm font-mono" placeholder="https://hooks.zapier.com/hooks/catch/..." />
        </div>
      </IntegrationSection>

      <IntegrationSection title="Make (formerly Integromat)" color="#6D00CC" icon="🔧" status={statuses.make} onTest={() => testIntegration('make')} isTesting={testing.make} testLabel="Send Test">
        <div>
          <Label className="text-gray-400 text-xs">Make Webhook URL</Label>
          <Input value={keys.make_webhook_url || ''} onChange={(e) => set('make_webhook_url', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm font-mono" placeholder="https://hook.eu1.make.com/..." />
        </div>
      </IntegrationSection>

      <IntegrationSection title="n8n Webhook" color="#EA4B71" icon="🔁" status={statuses.n8n} onTest={() => testIntegration('n8n')} isTesting={testing.n8n} testLabel="Send Test">
        <div>
          <Label className="text-gray-400 text-xs">n8n Webhook URL</Label>
          <Input value={keys.n8n_webhook_url || ''} onChange={(e) => set('n8n_webhook_url', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm font-mono" placeholder="https://your-n8n.app/webhook/..." />
        </div>
      </IntegrationSection>

      <IntegrationSection title="Custom API / Webhook" color="#38b6ff" icon="🌐" status={statuses.custom} onTest={() => testIntegration('custom')} isTesting={testing.custom} testLabel="Send Test">
        <div>
          <Label className="text-gray-400 text-xs">Endpoint URL</Label>
          <Input value={keys.custom_api_url || ''} onChange={(e) => set('custom_api_url', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm font-mono" placeholder="https://api.yourservice.com/webhook" />
        </div>
        <SecretInput label="API Key / Bearer Token (optional)" value={keys.custom_api_key} onChange={(v) => set('custom_api_key', v)} placeholder="Bearer token or API key" />
        <div>
          <Label className="text-gray-400 text-xs">Extra Headers (JSON, optional)</Label>
          <Input value={keys.custom_api_headers || ''} onChange={(e) => set('custom_api_headers', e.target.value)} className="bg-black/30 border-white/10 text-white mt-1 text-sm font-mono" placeholder='{"X-Custom-Header": "value"}' />
        </div>
      </IntegrationSection>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2 py-3">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Save All API Keys
      </Button>
    </div>
  );
}
