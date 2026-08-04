/**
 * Per-platform ad structure.
 *
 * Every ad platform uses the same three levels but names them differently and
 * accepts different objectives, budget rules, targeting and creative formats.
 * This file is the single source of truth for BOTH the UI (which fields to show)
 * and the backend (which fields to validate and map when publishing), so the two
 * can never drift apart.
 *
 * It is deliberately data-only and dependency-free: imported by the React app
 * and by the Express server.
 */

/** What each level is called on each platform, for honest labelling in the UI. */
export const AD_PLATFORMS = {
  meta: {
    key: 'meta',
    label: 'Meta (Facebook & Instagram)',
    short: 'Meta',
    color: '#0668E1',
    // Connection is only real when BOTH a token and an ad account exist.
    statusKey: 'meta_ads',
    levels: { campaign: 'Campaign', ad_group: 'Ad Set', ad: 'Ad' },
    // Budget can live on either level; Meta calls this CBO when on the campaign.
    budgetLevels: ['campaign', 'ad_group'],
    objectives: [
      { key: 'OUTCOME_LEADS', label: 'Leads', help: 'Collect leads with forms or on your site' },
      { key: 'OUTCOME_SALES', label: 'Sales', help: 'Purchases and conversions' },
      { key: 'OUTCOME_TRAFFIC', label: 'Traffic', help: 'Send people to a page' },
      { key: 'OUTCOME_AWARENESS', label: 'Awareness', help: 'Reach as many people as possible' },
      { key: 'OUTCOME_ENGAGEMENT', label: 'Engagement', help: 'Messages, likes, video views' },
      { key: 'OUTCOME_APP_PROMOTION', label: 'App promotion', help: 'App installs and events' },
    ],
    optimizationGoals: [
      { key: 'LEAD_GENERATION', label: 'Leads' },
      { key: 'OFFSITE_CONVERSIONS', label: 'Conversions' },
      { key: 'LINK_CLICKS', label: 'Link clicks' },
      { key: 'LANDING_PAGE_VIEWS', label: 'Landing page views' },
      { key: 'REACH', label: 'Reach' },
      { key: 'IMPRESSIONS', label: 'Impressions' },
    ],
    bidStrategies: [
      { key: 'LOWEST_COST_WITHOUT_CAP', label: 'Highest volume (automatic)' },
      { key: 'COST_CAP', label: 'Cost per result goal' },
      { key: 'LOWEST_COST_WITH_BID_CAP', label: 'Bid cap' },
    ],
    targeting: ['locations', 'age', 'genders', 'interests', 'custom_audiences', 'languages', 'placements'],
    formats: [
      { key: 'single_image', label: 'Single image', media: 1 },
      { key: 'video', label: 'Video', media: 1 },
      { key: 'carousel', label: 'Carousel', media: 10 },
    ],
    callToActions: ['LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'CONTACT_US', 'SHOP_NOW', 'BOOK_TRAVEL', 'DOWNLOAD'],
    copyFields: [
      { key: 'primary_text', label: 'Primary text', max: 125, required: true, multiline: true },
      { key: 'headline', label: 'Headline', max: 40, required: true },
      { key: 'description', label: 'Description', max: 30 },
    ],
  },

  google: {
    key: 'google',
    label: 'Google Ads',
    short: 'Google',
    color: '#4285F4',
    statusKey: 'google_ads',
    levels: { campaign: 'Campaign', ad_group: 'Ad Group', ad: 'Ad' },
    budgetLevels: ['campaign'],
    objectives: [
      { key: 'SEARCH', label: 'Search', help: 'Text ads on Google results' },
      { key: 'PERFORMANCE_MAX', label: 'Performance Max', help: 'All Google inventory, automated' },
      { key: 'DISPLAY', label: 'Display', help: 'Banner ads across the web' },
      { key: 'VIDEO', label: 'Video (YouTube)', help: 'Video ads on YouTube' },
      { key: 'SHOPPING', label: 'Shopping', help: 'Product listings' },
    ],
    optimizationGoals: [
      { key: 'MAXIMIZE_CONVERSIONS', label: 'Maximise conversions' },
      { key: 'MAXIMIZE_CONVERSION_VALUE', label: 'Maximise conversion value' },
      { key: 'MAXIMIZE_CLICKS', label: 'Maximise clicks' },
      { key: 'TARGET_IMPRESSION_SHARE', label: 'Impression share' },
    ],
    bidStrategies: [
      { key: 'MAXIMIZE_CONVERSIONS', label: 'Maximise conversions' },
      { key: 'TARGET_CPA', label: 'Target CPA' },
      { key: 'TARGET_ROAS', label: 'Target ROAS' },
      { key: 'MANUAL_CPC', label: 'Manual CPC' },
    ],
    targeting: ['locations', 'languages', 'keywords', 'audiences', 'devices'],
    formats: [
      { key: 'responsive_search', label: 'Responsive search ad', media: 0 },
      { key: 'responsive_display', label: 'Responsive display ad', media: 5 },
      { key: 'video', label: 'Video ad', media: 1 },
    ],
    callToActions: ['LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'CONTACT_US', 'SHOP_NOW'],
    // Google asks for several headlines/descriptions rather than one.
    copyFields: [
      { key: 'headline', label: 'Headline 1', max: 30, required: true },
      { key: 'headline_2', label: 'Headline 2', max: 30 },
      { key: 'headline_3', label: 'Headline 3', max: 30 },
      { key: 'description', label: 'Description 1', max: 90, required: true, multiline: true },
      { key: 'description_2', label: 'Description 2', max: 90, multiline: true },
    ],
    needsKeywords: true,
  },

  tiktok: {
    key: 'tiktok',
    label: 'TikTok Ads',
    short: 'TikTok',
    color: '#FF0050',
    statusKey: 'tiktok_ads',
    levels: { campaign: 'Campaign', ad_group: 'Ad Group', ad: 'Ad' },
    budgetLevels: ['campaign', 'ad_group'],
    objectives: [
      { key: 'LEAD_GENERATION', label: 'Lead generation' },
      { key: 'CONVERSIONS', label: 'Conversions' },
      { key: 'TRAFFIC', label: 'Traffic' },
      { key: 'REACH', label: 'Reach' },
      { key: 'VIDEO_VIEWS', label: 'Video views' },
    ],
    optimizationGoals: [
      { key: 'CONVERT', label: 'Conversions' },
      { key: 'CLICK', label: 'Clicks' },
      { key: 'REACH', label: 'Reach' },
    ],
    bidStrategies: [
      { key: 'BID_TYPE_NO_BID', label: 'Lowest cost' },
      { key: 'BID_TYPE_CUSTOM', label: 'Bid cap' },
    ],
    targeting: ['locations', 'age', 'genders', 'interests', 'languages'],
    formats: [
      { key: 'video', label: 'In-feed video', media: 1 },
      { key: 'spark', label: 'Spark ad (boost a post)', media: 0 },
    ],
    callToActions: ['LEARN_MORE', 'SIGN_UP', 'SHOP_NOW', 'CONTACT_US', 'DOWNLOAD'],
    copyFields: [
      { key: 'primary_text', label: 'Ad text', max: 100, required: true, multiline: true },
    ],
    videoOnly: true,
  },

  linkedin: {
    key: 'linkedin',
    label: 'LinkedIn Ads',
    short: 'LinkedIn',
    color: '#0A66C2',
    statusKey: 'linkedin_ads',
    levels: { campaign: 'Campaign Group', ad_group: 'Campaign', ad: 'Creative' },
    budgetLevels: ['campaign', 'ad_group'],
    objectives: [
      { key: 'LEAD_GENERATION', label: 'Lead generation' },
      { key: 'WEBSITE_CONVERSION', label: 'Website conversions' },
      { key: 'WEBSITE_VISIT', label: 'Website visits' },
      { key: 'BRAND_AWARENESS', label: 'Brand awareness' },
      { key: 'ENGAGEMENT', label: 'Engagement' },
    ],
    optimizationGoals: [
      { key: 'LEAD_GENERATION', label: 'Leads' },
      { key: 'WEBSITE_CONVERSIONS', label: 'Conversions' },
      { key: 'CLICKS', label: 'Clicks' },
      { key: 'IMPRESSIONS', label: 'Impressions' },
    ],
    bidStrategies: [
      { key: 'MAXIMUM_DELIVERY', label: 'Maximum delivery (automatic)' },
      { key: 'TARGET_COST', label: 'Target cost' },
      { key: 'MANUAL', label: 'Manual bidding' },
    ],
    // LinkedIn's differentiator: professional targeting.
    targeting: ['locations', 'job_titles', 'industries', 'company_size', 'seniority', 'skills', 'languages'],
    formats: [
      { key: 'single_image', label: 'Single image', media: 1 },
      { key: 'carousel', label: 'Carousel', media: 10 },
      { key: 'video', label: 'Video', media: 1 },
      { key: 'text_ad', label: 'Text ad', media: 0 },
    ],
    callToActions: ['LEARN_MORE', 'SIGN_UP', 'REGISTER', 'REQUEST_DEMO', 'DOWNLOAD', 'CONTACT_US'],
    copyFields: [
      { key: 'primary_text', label: 'Introductory text', max: 150, required: true, multiline: true },
      { key: 'headline', label: 'Headline', max: 70, required: true },
      { key: 'description', label: 'Description', max: 70 },
    ],
  },

  twitter: {
    key: 'twitter',
    label: 'X Ads',
    short: 'X',
    color: '#FFFFFF',
    statusKey: 'twitter_ads',
    levels: { campaign: 'Campaign', ad_group: 'Ad Group', ad: 'Ad' },
    budgetLevels: ['campaign', 'ad_group'],
    objectives: [
      { key: 'WEBSITE_CLICKS', label: 'Website traffic' },
      { key: 'ENGAGEMENTS', label: 'Engagement' },
      { key: 'FOLLOWERS', label: 'Followers' },
      { key: 'REACH', label: 'Reach' },
      { key: 'VIDEO_VIEWS', label: 'Video views' },
    ],
    optimizationGoals: [
      { key: 'CLICKS', label: 'Clicks' },
      { key: 'ENGAGEMENT', label: 'Engagement' },
      { key: 'REACH', label: 'Reach' },
    ],
    bidStrategies: [
      { key: 'AUTO', label: 'Automatic bid' },
      { key: 'MAX', label: 'Maximum bid' },
    ],
    targeting: ['locations', 'age', 'genders', 'interests', 'keywords', 'languages'],
    formats: [
      { key: 'single_image', label: 'Image ad', media: 1 },
      { key: 'video', label: 'Video ad', media: 1 },
      { key: 'text_ad', label: 'Text ad', media: 0 },
    ],
    callToActions: ['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'CONTACT_US'],
    copyFields: [
      { key: 'primary_text', label: 'Ad text', max: 280, required: true, multiline: true },
    ],
  },
};

export const PLATFORM_KEYS = Object.keys(AD_PLATFORMS);

export const getPlatform = (key) => AD_PLATFORMS[String(key || '').toLowerCase()] || null;

/** Human label for a level on a given platform ("Ad Set" vs "Ad Group"). */
export const levelLabel = (platformKey, level) =>
  getPlatform(platformKey)?.levels?.[level] || ({ campaign: 'Campaign', ad_group: 'Ad Group', ad: 'Ad' })[level];

/** Targeting fields, described once so the UI can render them generically. */
export const TARGETING_FIELDS = {
  locations:         { label: 'Locations', type: 'tags', placeholder: 'e.g. Brazil, São Paulo' },
  languages:         { label: 'Languages', type: 'tags', placeholder: 'e.g. Portuguese, English' },
  age:               { label: 'Age range', type: 'range', min: 13, max: 65 },
  genders:           { label: 'Genders', type: 'multi', options: ['all', 'male', 'female'] },
  interests:         { label: 'Interests', type: 'tags', placeholder: 'e.g. Marketing, SaaS' },
  custom_audiences:  { label: 'Custom audiences', type: 'tags', placeholder: 'Audience name' },
  placements:        { label: 'Placements', type: 'multi', options: ['automatic', 'feed', 'stories', 'reels', 'search'] },
  keywords:          { label: 'Keywords', type: 'tags', placeholder: 'e.g. crm software' },
  audiences:         { label: 'Audience segments', type: 'tags', placeholder: 'e.g. In-market: CRM' },
  devices:           { label: 'Devices', type: 'multi', options: ['all', 'mobile', 'desktop', 'tablet'] },
  job_titles:        { label: 'Job titles', type: 'tags', placeholder: 'e.g. Head of Marketing' },
  industries:        { label: 'Industries', type: 'tags', placeholder: 'e.g. Software' },
  company_size:      { label: 'Company size', type: 'multi', options: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001+'] },
  seniority:         { label: 'Seniority', type: 'multi', options: ['entry', 'senior', 'manager', 'director', 'vp', 'cxo', 'owner'] },
  skills:            { label: 'Skills', type: 'tags', placeholder: 'e.g. Demand Generation' },
};

/**
 * Validate one level against its platform before we ever try to publish.
 * Returns an array of plain-English problems (empty means OK) so the UI can tell
 * a non-technical user exactly what is missing.
 */
export function validateLevel(level, entity, platformKey) {
  const p = getPlatform(platformKey);
  const problems = [];
  if (!p) return ['Choose an ad platform first.'];

  if (level === 'campaign') {
    if (!entity?.name?.trim()) problems.push('The campaign needs a name.');
    if (!entity?.objective) problems.push('Choose what the campaign should achieve (its objective).');
    if (p.budgetLevels.includes('campaign') && !p.budgetLevels.includes('ad_group')) {
      if (!(Number(entity?.budget) > 0)) problems.push('Set a budget for the campaign.');
    }
    if (entity?.starts_at && entity?.ends_at && new Date(entity.ends_at) <= new Date(entity.starts_at)) {
      problems.push('The end date must be after the start date.');
    }
  }

  if (level === 'ad_group') {
    if (!entity?.name?.trim()) problems.push(`The ${p.levels.ad_group.toLowerCase()} needs a name.`);
    const t = entity?.targeting || {};
    if (!t.locations?.length) problems.push('Add at least one location to target.');
    if (p.needsKeywords && !t.keywords?.length) problems.push('Google search ads need at least one keyword.');
  }

  if (level === 'ad') {
    if (!entity?.name?.trim()) problems.push('The ad needs a name.');
    if (!entity?.destination_url?.trim()) problems.push('Add the link people should land on.');
    for (const f of p.copyFields) {
      const value = entity?.[f.key] ?? entity?.copy_data?.[f.key];
      if (f.required && !String(value || '').trim()) problems.push(`${f.label} is required.`);
      if (f.max && String(value || '').length > f.max) {
        problems.push(`${f.label} is too long (max ${f.max} characters).`);
      }
    }
    const fmt = p.formats.find(f => f.key === entity?.format);
    if (fmt?.media > 0 && !(entity?.media_urls?.length)) {
      problems.push(`Add ${fmt.media === 1 ? 'an image or video' : 'at least one image'} for this format.`);
    }
  }

  return problems;
}
