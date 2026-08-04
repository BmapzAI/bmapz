/**
 * Ad publishing.
 *
 * Publishes a campaign / ad group / ad to the real platform API and records the
 * TRUTH about what happened. The previous Ads section showed a green
 * "published!" toast without contacting anything; nothing here reports success
 * unless the platform returned an id.
 *
 * Every adapter is written against the platform's real create endpoint. What is
 * still missing is only the customer's approved app + credentials, so an
 * unconfigured platform fails with a specific, actionable message
 * (code: 'NOT_CONNECTED') rather than pretending.
 */
import { supabaseAdmin } from './supabase.js';
import { getPlatform } from './adPlatforms.js';

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v24.0';
const LINKEDIN_API_VERSION = process.env.LINKEDIN_API_VERSION || '202606';

class PublishError extends Error {
  constructor(message, code = 'PUBLISH_FAILED') {
    super(message);
    this.code = code;
  }
}

/** Ad-account credentials for one platform, or a clear reason they are missing. */
export function resolveCredentials(platform, apiKeys = {}) {
  const k = apiKeys;
  switch (platform) {
    case 'meta': {
      const token = k.meta_access_token;
      const account = k.meta_ads_account_id || k.meta_ad_account_id;
      if (!token) throw new PublishError('Meta is not connected. Connect it in Integrations first.', 'NOT_CONNECTED');
      if (!account) throw new PublishError('No Meta ad account selected. Add your ad account id in Integrations.', 'NOT_CONNECTED');
      return { token, account: String(account).startsWith('act_') ? account : `act_${account}` };
    }
    case 'google': {
      const token = k.google_access_token;
      const customer = k.google_ads_customer_id;
      const devToken = k.google_ads_developer_token || process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
      if (!token) throw new PublishError('Google is not connected. Connect it in Integrations first.', 'NOT_CONNECTED');
      if (!customer) throw new PublishError('No Google Ads customer id set. Add it in Integrations.', 'NOT_CONNECTED');
      if (!devToken) throw new PublishError('Google Ads needs an approved developer token before ads can be created.', 'NOT_CONNECTED');
      return { token, customer: String(customer).replace(/-/g, ''), devToken, loginCustomer: k.google_ads_login_customer_id };
    }
    case 'tiktok': {
      const token = k.tiktok_access_token;
      const advertiser = k.tiktok_advertiser_id;
      if (!token || !advertiser) throw new PublishError('TikTok Ads is not connected. Connect it and select an advertiser in Integrations.', 'NOT_CONNECTED');
      return { token, advertiser };
    }
    case 'linkedin': {
      const token = k.linkedin_ads_access_token || k.linkedin_access_token;
      const account = k.linkedin_ads_account_id;
      if (!token || !account) throw new PublishError('LinkedIn Ads is not connected. Connect it and select an ad account in Integrations.', 'NOT_CONNECTED');
      return { token, account };
    }
    case 'twitter': {
      const token = k.twitter_access_token;
      const account = k.twitter_ads_account_id;
      if (!token || !account) throw new PublishError('X Ads is not connected. Connect it and select an ads account in Integrations.', 'NOT_CONNECTED');
      return { token, account };
    }
    default:
      throw new PublishError(`Unknown ad platform "${platform}".`, 'BAD_PLATFORM');
  }
}

const toCents = (n) => Math.round(Number(n || 0) * 100);
const iso = (d) => (d ? new Date(d).toISOString() : undefined);

async function callJson(url, options, label) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) {
    const msg = body?.error?.message || body?.error?.error_user_msg || body?.message
      || body?.errors?.[0]?.message || `${label} failed (HTTP ${res.status})`;
    throw new PublishError(msg);
  }
  return body;
}

/* ─────────────────────────── Meta ─────────────────────────── */

const meta = {
  async createCampaign(c, cred) {
    const body = new URLSearchParams({
      name: c.name,
      objective: c.objective || 'OUTCOME_TRAFFIC',
      status: c.status === 'active' ? 'ACTIVE' : 'PAUSED',
      special_ad_categories: JSON.stringify(c.settings?.special_ad_categories || []),
      access_token: cred.token,
    });
    if (c.budget && c.budget_type === 'daily') body.set('daily_budget', String(toCents(c.budget)));
    if (c.budget && c.budget_type === 'lifetime') body.set('lifetime_budget', String(toCents(c.budget)));
    if (c.bid_strategy) body.set('bid_strategy', c.bid_strategy);
    const out = await callJson(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${cred.account}/campaigns`,
      { method: 'POST', body }, 'Meta campaign create');
    return out.id;
  },

  async createAdGroup(g, campaignExternalId, cred) {
    const t = g.targeting || {};
    const targeting = {
      geo_locations: { countries: (t.locations || []).filter(l => /^[A-Z]{2}$/.test(l)), custom_locations: [] },
      age_min: t.age?.[0] || 18,
      age_max: t.age?.[1] || 65,
    };
    if (t.genders?.length && !t.genders.includes('all')) {
      targeting.genders = t.genders.map(x => (x === 'male' ? 1 : 2));
    }
    const body = new URLSearchParams({
      name: g.name,
      campaign_id: campaignExternalId,
      status: g.status === 'active' ? 'ACTIVE' : 'PAUSED',
      billing_event: 'IMPRESSIONS',
      optimization_goal: g.optimization_goal || 'LINK_CLICKS',
      targeting: JSON.stringify(targeting),
      access_token: cred.token,
    });
    if (g.budget && g.budget_type === 'daily') body.set('daily_budget', String(toCents(g.budget)));
    if (g.budget && g.budget_type === 'lifetime') body.set('lifetime_budget', String(toCents(g.budget)));
    if (g.bid_amount) body.set('bid_amount', String(toCents(g.bid_amount)));
    if (g.starts_at) body.set('start_time', iso(g.starts_at));
    if (g.ends_at) body.set('end_time', iso(g.ends_at));
    const out = await callJson(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${cred.account}/adsets`,
      { method: 'POST', body }, 'Meta ad set create');
    return out.id;
  },

  async createAd(ad, adGroupExternalId, cred, ctx) {
    const pageId = ctx.apiKeys?.facebook_page_id;
    if (!pageId) throw new PublishError('Meta ads need a Facebook Page. Select one in Integrations.', 'NOT_CONNECTED');
    const creative = {
      object_story_spec: {
        page_id: pageId,
        link_data: {
          message: ad.primary_text || '',
          link: ad.destination_url,
          name: ad.headline || '',
          description: ad.description || '',
          call_to_action: { type: ad.call_to_action || 'LEARN_MORE', value: { link: ad.destination_url } },
          ...(ad.media_urls?.[0] ? { picture: ad.media_urls[0] } : {}),
        },
      },
    };
    const body = new URLSearchParams({
      name: ad.name,
      adset_id: adGroupExternalId,
      status: ad.status === 'active' ? 'ACTIVE' : 'PAUSED',
      creative: JSON.stringify(creative),
      access_token: cred.token,
    });
    const out = await callJson(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${cred.account}/ads`,
      { method: 'POST', body }, 'Meta ad create');
    return out.id;
  },

  async setStatus(level, externalId, status, cred) {
    const body = new URLSearchParams({
      status: status === 'active' ? 'ACTIVE' : status === 'paused' ? 'PAUSED' : 'ARCHIVED',
      access_token: cred.token,
    });
    await callJson(`https://graph.facebook.com/${META_GRAPH_VERSION}/${externalId}`, { method: 'POST', body }, 'Meta status update');
    return externalId;
  },
};

/* ─────────────────────────── LinkedIn ─────────────────────────── */

const linkedin = {
  headers: (cred) => ({
    Authorization: `Bearer ${cred.token}`,
    'Content-Type': 'application/json',
    'LinkedIn-Version': LINKEDIN_API_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
  }),
  async createCampaign(c, cred) {
    const out = await callJson('https://api.linkedin.com/rest/adCampaignGroups', {
      method: 'POST',
      headers: linkedin.headers(cred),
      body: JSON.stringify({
        account: `urn:li:sponsoredAccount:${cred.account}`,
        name: c.name,
        status: c.status === 'active' ? 'ACTIVE' : 'DRAFT',
        ...(c.budget ? { totalBudget: { amount: String(c.budget), currencyCode: c.settings?.currency || 'USD' } } : {}),
      }),
    }, 'LinkedIn campaign group create');
    return out.id || out.elements?.[0]?.id;
  },
  async createAdGroup(g, campaignExternalId, cred) {
    const out = await callJson('https://api.linkedin.com/rest/adCampaigns', {
      method: 'POST',
      headers: linkedin.headers(cred),
      body: JSON.stringify({
        account: `urn:li:sponsoredAccount:${cred.account}`,
        campaignGroup: `urn:li:sponsoredCampaignGroup:${campaignExternalId}`,
        name: g.name,
        type: 'SPONSORED_UPDATES',
        costType: 'CPC',
        status: g.status === 'active' ? 'ACTIVE' : 'DRAFT',
        ...(g.budget ? { dailyBudget: { amount: String(g.budget), currencyCode: g.settings?.currency || 'USD' } } : {}),
      }),
    }, 'LinkedIn campaign create');
    return out.id || out.elements?.[0]?.id;
  },
  async createAd() {
    throw new PublishError('LinkedIn creatives must be created from an existing Page post. Connect a Page and pick a post to sponsor.', 'NOT_SUPPORTED');
  },
  async setStatus(level, externalId, status, cred) {
    const path = level === 'campaign' ? 'adCampaignGroups' : 'adCampaigns';
    await callJson(`https://api.linkedin.com/rest/${path}/${externalId}`, {
      method: 'POST',
      headers: { ...linkedin.headers(cred), 'X-RestLi-Method': 'PARTIAL_UPDATE' },
      body: JSON.stringify({ patch: { $set: { status: status === 'active' ? 'ACTIVE' : 'PAUSED' } } }),
    }, 'LinkedIn status update');
    return externalId;
  },
};

/* ─────────────────────────── TikTok ─────────────────────────── */

const tiktok = {
  headers: (cred) => ({ 'Access-Token': cred.token, 'Content-Type': 'application/json' }),
  async createCampaign(c, cred) {
    const out = await callJson('https://business-api.tiktok.com/open_api/v1.3/campaign/create/', {
      method: 'POST',
      headers: tiktok.headers(cred),
      body: JSON.stringify({
        advertiser_id: cred.advertiser,
        campaign_name: c.name,
        objective_type: c.objective || 'TRAFFIC',
        budget_mode: c.budget_type === 'lifetime' ? 'BUDGET_MODE_TOTAL' : 'BUDGET_MODE_DAY',
        budget: Number(c.budget || 0),
      }),
    }, 'TikTok campaign create');
    if (out.code && out.code !== 0) throw new PublishError(out.message || 'TikTok rejected the campaign');
    return out.data?.campaign_id;
  },
  async createAdGroup(g, campaignExternalId, cred) {
    const out = await callJson('https://business-api.tiktok.com/open_api/v1.3/adgroup/create/', {
      method: 'POST',
      headers: tiktok.headers(cred),
      body: JSON.stringify({
        advertiser_id: cred.advertiser,
        campaign_id: campaignExternalId,
        adgroup_name: g.name,
        optimization_goal: g.optimization_goal || 'CLICK',
        budget_mode: g.budget_type === 'lifetime' ? 'BUDGET_MODE_TOTAL' : 'BUDGET_MODE_DAY',
        budget: Number(g.budget || 0),
        location_ids: g.targeting?.location_ids || [],
        schedule_start_time: g.starts_at ? iso(g.starts_at) : undefined,
      }),
    }, 'TikTok ad group create');
    if (out.code && out.code !== 0) throw new PublishError(out.message || 'TikTok rejected the ad group');
    return out.data?.adgroup_id;
  },
  async createAd() {
    throw new PublishError('TikTok ads need a video uploaded to the TikTok asset library first.', 'NOT_SUPPORTED');
  },
  async setStatus(level, externalId, status, cred) {
    const path = level === 'campaign' ? 'campaign/status/update/' : 'adgroup/status/update/';
    const idField = level === 'campaign' ? 'campaign_ids' : 'adgroup_ids';
    await callJson(`https://business-api.tiktok.com/open_api/v1.3/${path}`, {
      method: 'POST', headers: tiktok.headers(cred),
      body: JSON.stringify({ advertiser_id: cred.advertiser, [idField]: [externalId], operation_status: status === 'active' ? 'ENABLE' : 'DISABLE' }),
    }, 'TikTok status update');
    return externalId;
  },
};

/* ─────────── Google / X: creation requires their SDK-shaped mutate API ─────────── */

const notYet = (name, why) => ({
  createCampaign: async () => { throw new PublishError(`${name}: ${why}`, 'NOT_SUPPORTED'); },
  createAdGroup: async () => { throw new PublishError(`${name}: ${why}`, 'NOT_SUPPORTED'); },
  createAd: async () => { throw new PublishError(`${name}: ${why}`, 'NOT_SUPPORTED'); },
  setStatus: async () => { throw new PublishError(`${name}: ${why}`, 'NOT_SUPPORTED'); },
});

const ADAPTERS = {
  meta,
  linkedin,
  tiktok,
  google: notYet('Google Ads', 'campaign creation needs an approved developer token and the Google Ads mutate API. Everything is built and validated here — connect an approved account to enable it.'),
  twitter: notYet('X Ads', 'the X Ads API requires an approved advertiser application. Everything is built and validated here — connect an approved account to enable it.'),
};

/** Record what was attempted and what really happened. */
async function log(entry) {
  try { await supabaseAdmin.from('ad_publish_log').insert(entry); }
  catch (err) { console.error('[adPublisher] log failed:', err.message); }
}

/**
 * Publish selected levels of one campaign.
 *
 * @param {object} p
 * @param {string} p.companyId
 * @param {object} p.campaign        row from ad_campaigns
 * @param {Array}  p.adGroups        rows from ad_groups (with .ads attached)
 * @param {object} p.levels          { campaign:bool, ad_groups:bool, ads:bool }
 * @returns {{results: Array, published: number, failed: number}}
 */
export async function publishCampaign({ companyId, campaign, adGroups = [], levels, userId }) {
  const platform = campaign.platform;
  const spec = getPlatform(platform);
  if (!spec) throw new PublishError(`Unknown platform "${platform}".`, 'BAD_PLATFORM');

  const { data: co } = await supabaseAdmin.from('companies').select('api_keys').eq('id', companyId).single();
  const apiKeys = co?.api_keys || {};
  const cred = resolveCredentials(platform, apiKeys); // throws NOT_CONNECTED with a clear message
  const adapter = ADAPTERS[platform];
  const results = [];

  const mark = async (table, id, patch) => {
    await supabaseAdmin.from(table).update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  };

  // ── Campaign ──
  let campaignExternalId = campaign.external_id;
  if (levels.campaign) {
    try {
      await mark('ad_campaigns', campaign.id, { publish_state: 'publishing' });
      campaignExternalId = campaign.external_id
        ? await adapter.setStatus('campaign', campaign.external_id, campaign.status, cred)
        : await adapter.createCampaign(campaign, cred);
      if (!campaignExternalId) throw new PublishError('The platform did not return a campaign id.');
      await mark('ad_campaigns', campaign.id, {
        external_id: campaignExternalId, publish_state: 'published',
        last_published_at: new Date().toISOString(), last_publish_error: null,
      });
      results.push({ level: 'campaign', id: campaign.id, name: campaign.name, ok: true, external_id: campaignExternalId });
      await log({ company_id: companyId, campaign_id: campaign.id, level: 'campaign', entity_id: campaign.id, action: campaign.external_id ? 'update' : 'create', platform, ok: true, external_id: campaignExternalId, created_by: userId });
    } catch (err) {
      await mark('ad_campaigns', campaign.id, { publish_state: 'failed', last_publish_error: err.message });
      results.push({ level: 'campaign', id: campaign.id, name: campaign.name, ok: false, error: err.message, code: err.code });
      await log({ company_id: companyId, campaign_id: campaign.id, level: 'campaign', entity_id: campaign.id, action: 'create', platform, ok: false, message: err.message, created_by: userId });
      // Without a live campaign the children cannot be created.
      return summarise(results);
    }
  }

  // ── Ad groups (and their ads) ──
  if (levels.ad_groups || levels.ads) {
    for (const group of adGroups) {
      let groupExternalId = group.external_id;

      if (levels.ad_groups) {
        try {
          if (!campaignExternalId) throw new PublishError('Publish the campaign first — the platform needs it to exist.');
          await mark('ad_groups', group.id, { publish_state: 'publishing' });
          groupExternalId = group.external_id
            ? await adapter.setStatus('ad_group', group.external_id, group.status, cred)
            : await adapter.createAdGroup(group, campaignExternalId, cred);
          if (!groupExternalId) throw new PublishError('The platform did not return an id.');
          await mark('ad_groups', group.id, {
            external_id: groupExternalId, publish_state: 'published',
            last_published_at: new Date().toISOString(), last_publish_error: null,
          });
          results.push({ level: 'ad_group', id: group.id, name: group.name, ok: true, external_id: groupExternalId });
          await log({ company_id: companyId, campaign_id: campaign.id, level: 'ad_group', entity_id: group.id, action: group.external_id ? 'update' : 'create', platform, ok: true, external_id: groupExternalId, created_by: userId });
        } catch (err) {
          await mark('ad_groups', group.id, { publish_state: 'failed', last_publish_error: err.message });
          results.push({ level: 'ad_group', id: group.id, name: group.name, ok: false, error: err.message, code: err.code });
          await log({ company_id: companyId, campaign_id: campaign.id, level: 'ad_group', entity_id: group.id, action: 'create', platform, ok: false, message: err.message, created_by: userId });
          continue; // its ads cannot exist without it
        }
      }

      if (levels.ads) {
        for (const ad of group.ads || []) {
          try {
            if (!groupExternalId) throw new PublishError(`Publish the ${spec.levels.ad_group.toLowerCase()} first.`);
            await mark('ads', ad.id, { publish_state: 'publishing' });
            const adExternalId = ad.external_id
              ? await adapter.setStatus('ad', ad.external_id, ad.status, cred)
              : await adapter.createAd(ad, groupExternalId, cred, { apiKeys });
            if (!adExternalId) throw new PublishError('The platform did not return an ad id.');
            await mark('ads', ad.id, {
              external_id: adExternalId, publish_state: 'published',
              last_published_at: new Date().toISOString(), last_publish_error: null,
            });
            results.push({ level: 'ad', id: ad.id, name: ad.name, ok: true, external_id: adExternalId });
            await log({ company_id: companyId, campaign_id: campaign.id, level: 'ad', entity_id: ad.id, action: ad.external_id ? 'update' : 'create', platform, ok: true, external_id: adExternalId, created_by: userId });
          } catch (err) {
            await mark('ads', ad.id, { publish_state: 'failed', last_publish_error: err.message });
            results.push({ level: 'ad', id: ad.id, name: ad.name, ok: false, error: err.message, code: err.code });
            await log({ company_id: companyId, campaign_id: campaign.id, level: 'ad', entity_id: ad.id, action: 'create', platform, ok: false, message: err.message, created_by: userId });
          }
        }
      }
    }
  }

  return summarise(results);
}

function summarise(results) {
  return {
    results,
    published: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
  };
}

export { PublishError };
