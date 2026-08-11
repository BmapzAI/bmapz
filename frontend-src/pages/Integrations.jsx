import React, { useState, useEffect } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, CheckCircle, AlertCircle, Zap, Upload, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from 'sonner';
import ConnectIntegrationModal from '@/components/integrations/ConnectIntegrationModal';
import { useAuth } from '@/lib/AuthContext';
import { Company, Lead, Message, Activity } from '@/api/entities';
// Same missing import as AddLeadForm: the lead-import flow here referenced
// ExtractDataFromUploadedFile without importing it.
import { UploadFile, ExtractDataFromUploadedFile } from '@/api/integrations';

const INTEGRATIONS = [
  // ── AD ACCOUNTS ──────────────────────────────────
  {
    category: 'Ad Accounts',
    items: [
      { type: 'meta_ads', name: 'Meta Ads', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/2021_Facebook_icon.svg/512px-2021_Facebook_icon.svg.png', description: 'Facebook & Instagram campaigns — spend, CTR, ROAS, conversions', statusKey: 'meta_ads', configKey: 'meta_access_token', setupUrl: 'https://developers.facebook.com/', loginBased: false, easySetup: 'Enter your Meta Access Token and Ad Account ID from Ads Manager.' },
      { type: 'google_ads', name: 'Google Ads', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Google_Ads_logo.svg/512px-Google_Ads_logo.svg.png', description: 'Search, Display and YouTube campaign performance data', statusKey: 'google_ads', configKey: 'google_ads_refresh_token', setupUrl: 'https://ads.google.com/', loginBased: false, easySetup: 'Connect via Google OAuth. You will need a Developer Token from Google Ads API Center.' },
      { type: 'tiktok_ads', name: 'TikTok Ads', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a9/TikTok_logo.svg/512px-TikTok_logo.svg.png', description: 'TikTok campaign metrics and creative performance', statusKey: 'tiktok_ads', configKey: 'tiktok_access_token', setupUrl: 'https://ads.tiktok.com/', loginBased: false, easySetup: 'Get your Access Token from TikTok for Business → My Apps.' },
      { type: 'linkedin_ads', name: 'LinkedIn Ads', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/LinkedIn_logo_initials.png/480px-LinkedIn_logo_initials.png', description: 'B2B campaign manager insights and lead gen performance', statusKey: 'linkedin_ads', configKey: 'linkedin_ads_access_token', setupUrl: 'https://www.linkedin.com/campaignmanager/', loginBased: false, easySetup: 'Generate an OAuth token in LinkedIn Developer Portal with r_ads and r_ads_reporting scopes.' },
    ]
  },
  // ── SOCIAL MEDIA ──────────────────────────────────
  {
    category: 'Social Media',
    items: [
      { type: 'instagram', name: 'Instagram', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Instagram_logo_2016.svg/512px-Instagram_logo_2016.svg.png', description: 'Post content, track engagement, manage DMs', statusKey: 'meta', configKey: 'meta_access_token', setupUrl: 'https://developers.facebook.com/', loginBased: false, easySetup: 'Uses the same Meta Access Token as Facebook. Add your Instagram Account ID.' },
      { type: 'facebook', name: 'Facebook', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/2021_Facebook_icon.svg/512px-2021_Facebook_icon.svg.png', description: 'Facebook Business Suite — posts, pages, lead forms', statusKey: 'meta', configKey: 'meta_access_token', setupUrl: 'https://developers.facebook.com/', loginBased: false, easySetup: 'Get a User Access Token from Meta for Developers with pages_manage_posts scope.' },
      { type: 'linkedin_social', name: 'LinkedIn (Posts)', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/LinkedIn_logo_initials.png/480px-LinkedIn_logo_initials.png', description: 'Publish posts and articles to your LinkedIn profile or company page', statusKey: 'linkedin', configKey: 'linkedin_access_token', setupUrl: 'https://www.linkedin.com/developers/', loginBased: false, easySetup: 'Create a LinkedIn app and generate an OAuth token with w_member_social scope.' },
      { type: 'twitter', name: 'X (Twitter)', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/X_icon_2.svg/512px-X_icon_2.svg.png', description: 'Schedule and publish tweets, track performance', statusKey: 'twitter', configKey: null, setupUrl: 'https://developer.twitter.com/', loginBased: false, easySetup: 'Requires a Twitter Developer App. Apply at developer.twitter.com for API access.' },
      { type: 'youtube', name: 'YouTube', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/512px-YouTube_full-color_icon_%282017%29.svg.png', description: 'Upload videos, manage channel, track analytics', statusKey: 'youtube', configKey: null, setupUrl: 'https://console.cloud.google.com/', loginBased: false, easySetup: 'Create a Google Cloud project and enable YouTube Data API v3. Get an OAuth token.' },
      { type: 'tiktok_social', name: 'TikTok (Organic)', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a9/TikTok_logo.svg/512px-TikTok_logo.svg.png', description: 'Schedule and publish TikTok videos organically', statusKey: 'tiktok_social', configKey: 'tiktok_access_token', setupUrl: 'https://developers.tiktok.com/', loginBased: false, easySetup: 'Uses TikTok for Business access token. Also used for TikTok Ads.' },
      { type: 'pinterest', name: 'Pinterest', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Pinterest_Logo.png/512px-Pinterest_Logo.png', description: 'Publish pins, manage boards, track Pinterest analytics', statusKey: 'pinterest', configKey: null, setupUrl: 'https://developers.pinterest.com/', loginBased: false, easySetup: 'Create a Pinterest App and get an access token with ads:read and boards:write scopes.' },
      { type: 'snapchat', name: 'Snapchat Ads', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/ad/Snapchat_logo.svg/512px-Snapchat_logo.svg.png', description: 'Manage Snapchat ad campaigns and track performance', statusKey: 'snapchat', configKey: null, setupUrl: 'https://business.snapchat.com/', loginBased: false, easySetup: 'Connect via Snapchat Business. Get OAuth credentials from ads.snapchat.com/setup.' },
    ]
  },
  // ── EMAIL MARKETING ──────────────────────────────────
  {
    category: 'Email Marketing',
    items: [
      { type: 'mailchimp', name: 'Mailchimp', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Mailchimp-freddie-wink.svg/512px-Mailchimp-freddie-wink.svg.png', description: 'Email campaigns, audiences, automation, and analytics', statusKey: 'mailchimp', configKey: null, setupUrl: 'https://mailchimp.com/', loginBased: true, easySetup: 'Log in to Mailchimp → Account → Extras → API Keys → Create API Key. Paste it here.' },
      { type: 'klaviyo', name: 'Klaviyo', logo: 'https://www.klaviyo.com/favicon.ico', description: 'E-commerce email and SMS marketing automation', statusKey: 'klaviyo', configKey: null, setupUrl: 'https://klaviyo.com/', loginBased: true, easySetup: 'In Klaviyo: Account → Settings → API Keys → Create Private API Key.' },
      { type: 'activecampaign', name: 'ActiveCampaign', logo: 'https://www.activecampaign.com/favicon.ico', description: 'Email, marketing automation, and CRM in one platform', statusKey: 'activecampaign', configKey: null, setupUrl: 'https://www.activecampaign.com/', loginBased: true, easySetup: 'In ActiveCampaign: Settings → Developer → API Access. Copy the URL and key.' },
      { type: 'brevo', name: 'Brevo (Sendinblue)', logo: 'https://www.brevo.com/favicon.ico', description: 'Transactional email, SMS, and marketing automation', statusKey: 'brevo', configKey: null, setupUrl: 'https://brevo.com/', loginBased: true, easySetup: 'In Brevo: Profile → SMTP & API → API Keys → Generate a new API key.' },
      { type: 'convertkit', name: 'ConvertKit', logo: 'https://convertkit.com/favicon.ico', description: 'Creator-focused email marketing with sequences and tags', statusKey: 'convertkit', configKey: null, setupUrl: 'https://convertkit.com/', loginBased: true, easySetup: 'In ConvertKit: Settings → Advanced → API → Copy your API Key and API Secret.' },
      { type: 'mailerlite', name: 'MailerLite', logo: 'https://www.mailerlite.com/favicon.ico', description: 'Simple email campaigns with landing pages and pop-ups', statusKey: 'mailerlite', configKey: null, setupUrl: 'https://mailerlite.com/', loginBased: true, easySetup: 'In MailerLite: Integrations → API → Generate new token.' },
    ]
  },
  // ── MESSAGING ──────────────────────────────────
  {
    category: 'Messaging & Communication',
    items: [
      { type: 'whatsapp', name: 'WhatsApp Business', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/512px-WhatsApp.svg.png', description: 'Send messages via WhatsApp Business API', statusKey: 'whatsapp', configKey: 'whatsapp_api_token', setupUrl: 'https://developers.facebook.com/docs/whatsapp', loginBased: false, easySetup: 'Go to Meta for Developers → WhatsApp → API Setup. Get your Token and Phone Number ID.' },
      { type: 'gmail', name: 'Gmail', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gmail_icon_%282020%29.svg/512px-Gmail_icon_%282020%29.svg.png', description: 'Send emails from your Gmail account via OAuth', statusKey: 'gmail', configKey: 'gmail_refresh_token', setupUrl: 'https://console.cloud.google.com/', loginBased: false, easySetup: 'Create a Google Cloud project, enable Gmail API, set up OAuth 2.0 credentials and generate a refresh token via OAuth Playground.' },
      { type: 'slack', name: 'Slack', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Slack_icon_2019.svg/512px-Slack_icon_2019.svg.png', description: 'Send notifications and messages to Slack channels', statusKey: 'slack', configKey: null, setupUrl: 'https://api.slack.com/apps', loginBased: true, easySetup: 'Create a Slack App → OAuth & Permissions → Add bot scopes (chat:write) → Install to workspace → Copy Bot Token.' },
      { type: 'twilio', name: 'Twilio (SMS)', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Twilio-logo-red.svg/512px-Twilio-logo-red.svg.png', description: 'Send SMS messages to leads anywhere in the world', statusKey: 'twilio', configKey: null, setupUrl: 'https://twilio.com/', loginBased: true, easySetup: 'In Twilio Console: Get your Account SID and Auth Token from the dashboard. Buy a phone number to send SMS.' },
      { type: 'intercom', name: 'Intercom', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Intercom_logo.png/512px-Intercom_logo.png', description: 'Live chat, chatbots, and customer messaging platform', statusKey: 'intercom', configKey: null, setupUrl: 'https://intercom.com/', loginBased: true, easySetup: 'In Intercom: Settings → Integrations → Developer Hub → Create an App → API Keys.' },
    ]
  },
  // ── MARKETING AUTOMATION ──────────────────────────────────
  {
    category: 'Marketing Automation',
    items: [
      { type: 'hubspot_mktg', name: 'HubSpot Marketing', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/HubSpot_Logo.svg/512px-HubSpot_Logo.svg.png', description: 'Marketing hub — campaigns, forms, landing pages, analytics', statusKey: 'hubspot', configKey: null, setupUrl: 'https://hubspot.com/', loginBased: true, easySetup: 'In HubSpot: Settings → Integrations → Private Apps → Create private app → Copy token. (Note: does not connect CRM data)' },
      { type: 'zapier', name: 'Zapier', logo: 'https://cdn.zapier.com/zapier/images/logos/zapier-logo.png', description: 'Connect 7,000+ apps with automated workflows', statusKey: 'zapier', configKey: 'zapier_webhook_url', setupUrl: 'https://zapier.com/', loginBased: false, easySetup: 'In Zapier: Create a Zap → Trigger: Webhooks by Zapier → Catch Hook → Copy the URL here.' },
      { type: 'make', name: 'Make (Integromat)', logo: 'https://www.make.com/favicon.ico', description: 'Visual automation builder — connect any app', statusKey: 'make', configKey: 'make_webhook_url', setupUrl: 'https://make.com/', loginBased: false, easySetup: 'In Make: Create a Scenario → Add Webhooks module → Custom webhook → Copy the URL.' },
      { type: 'n8n', name: 'n8n', logo: 'https://n8n.io/favicon.ico', description: 'Self-hosted or cloud workflow automation', statusKey: 'n8n', configKey: 'n8n_webhook_url', setupUrl: 'https://n8n.io/', loginBased: false, easySetup: 'In n8n: Create workflow → Add Webhook trigger node → Copy the webhook URL here.' },
      { type: 'segment', name: 'Segment', logo: 'https://segment.com/favicon.ico', description: 'Customer data platform — track events and sync to 300+ tools', statusKey: 'segment', configKey: null, setupUrl: 'https://segment.com/', loginBased: true, easySetup: 'In Segment: Connections → Sources → Create a Source → HTTP API → Copy Write Key.' },
      { type: 'mixpanel', name: 'Mixpanel', logo: 'https://mixpanel.com/favicon.ico', description: 'Product analytics — user behavior, funnels, retention', statusKey: 'mixpanel', configKey: null, setupUrl: 'https://mixpanel.com/', loginBased: true, easySetup: 'In Mixpanel: Settings → Project Settings → Copy Project Token and Secret.' },
    ]
  },
  // ── AI TOOLS ──────────────────────────────────
  {
    category: 'AI Tools',
    items: [
      { type: 'openai', name: 'OpenAI / ChatGPT', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/ChatGPT_logo.svg/512px-ChatGPT_logo.svg.png', description: 'Power AI features with your own OpenAI API key', statusKey: 'openai', configKey: 'openai_api_key', setupUrl: 'https://platform.openai.com/api-keys', loginBased: false, easySetup: 'Go to platform.openai.com → API Keys → Create new secret key. Add it in Settings → API Keys.' },
      { type: 'anthropic', name: 'Anthropic (Claude)', logo: 'https://www.anthropic.com/favicon.ico', description: 'Use Claude models for AI-powered content and analysis', statusKey: 'anthropic', configKey: null, setupUrl: 'https://console.anthropic.com/', loginBased: true, easySetup: 'In Anthropic Console: Settings → API Keys → Create Key.' },
      { type: 'perplexity', name: 'Perplexity AI', logo: 'https://www.perplexity.ai/favicon.ico', description: 'Real-time AI search and research automation', statusKey: 'perplexity', configKey: null, setupUrl: 'https://www.perplexity.ai/', loginBased: true, easySetup: 'In Perplexity: Settings → API → Generate API key.' },
      { type: 'midjourney', name: 'Midjourney / DALL-E', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/ChatGPT_logo.svg/512px-ChatGPT_logo.svg.png', description: 'AI image generation for ads and creative content', statusKey: 'dalle', configKey: 'openai_api_key', setupUrl: 'https://platform.openai.com/', loginBased: false, easySetup: 'Uses your OpenAI API key for DALL-E image generation. No separate setup needed.' },
      { type: 'jasper', name: 'Jasper AI', logo: 'https://www.jasper.ai/favicon.ico', description: 'AI content writer for marketing copy and blog posts', statusKey: 'jasper', configKey: null, setupUrl: 'https://jasper.ai/', loginBased: true, easySetup: 'In Jasper: Settings → Integrations → API → Copy API key.' },
    ]
  },
  // ── VIDEO & WEBINAR ──────────────────────────────────
  {
    category: 'Video & Webinar',
    items: [
      { type: 'zoom', name: 'Zoom', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Zoom_Communications_Logo.svg/512px-Zoom_Communications_Logo.svg.png', description: 'Schedule meetings, webinars, and track attendance', statusKey: 'zoom', configKey: null, setupUrl: 'https://marketplace.zoom.us/', loginBased: true, easySetup: 'Create a Zoom App in marketplace.zoom.us → Server-to-Server OAuth → Get Account ID, Client ID, Client Secret.' },
      { type: 'google_meet', name: 'Google Meet', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Google_Meet_icon_%282020%29.svg/512px-Google_Meet_icon_%282020%29.svg.png', description: 'Create and manage Google Meet video calls', statusKey: 'google_calendar', configKey: 'google_calendar_token', setupUrl: 'https://console.cloud.google.com/', loginBased: false, easySetup: 'Uses your Google Calendar OAuth token. Enable Google Meet in Google Cloud Console.' },
      { type: 'loom', name: 'Loom', logo: 'https://www.loom.com/favicon.ico', description: 'Record and share video messages with prospects', statusKey: 'loom', configKey: null, setupUrl: 'https://www.loom.com/', loginBased: true, easySetup: 'In Loom: Settings → Privacy → Integrations → Enable API access.' },
      { type: 'demio', name: 'Demio', logo: 'https://demio.com/favicon.ico', description: 'Marketing webinars and automated evergreen funnels', statusKey: 'demio', configKey: null, setupUrl: 'https://demio.com/', loginBased: true, easySetup: 'In Demio: Settings → Integrations → API → Copy API key and secret.' },
    ]
  },
  // ── LEAD GENERATION ──────────────────────────────────
  {
    category: 'Lead Generation & Prospecting',
    items: [
      { type: 'apollo', name: 'Apollo.io', logo: 'https://www.apollo.io/favicon.ico', description: 'B2B lead database with 270M+ contacts — OAuth integration (API keys being deprecated)', statusKey: 'apollo', configKey: null, setupUrl: 'https://developer.apollo.io/keys#/oauth-registration', loginBased: true, easySetup: 'Apollo now uses OAuth. Go to developer.apollo.io → OAuth Registration to register. Contact BMAPZ admin to configure. Temporary: Settings → Integrations → API → API Key.' },
      { type: 'hunter', name: 'Hunter.io', logo: 'https://hunter.io/favicon.ico', description: 'Find and verify professional email addresses', statusKey: 'hunter', configKey: null, setupUrl: 'https://hunter.io/', loginBased: true, easySetup: 'In Hunter: Settings → API → Copy your API key.' },
      { type: 'lusha', name: 'Lusha', logo: 'https://www.lusha.com/favicon.ico', description: 'B2B contact data enrichment and phone numbers', statusKey: 'lusha', configKey: null, setupUrl: 'https://lusha.com/', loginBased: true, easySetup: 'In Lusha: Settings → API → Generate your API key.' },
      { type: 'clay', name: 'Clay', logo: 'https://www.clay.com/favicon.ico', description: 'AI-powered lead enrichment and outreach automation', statusKey: 'clay', configKey: null, setupUrl: 'https://clay.com/', loginBased: true, easySetup: 'In Clay: Settings → API → Create API key.' },
      { type: 'typeform', name: 'Typeform', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Typeform_logo_2018.svg/512px-Typeform_logo_2018.svg.png', description: 'Lead capture forms with conversational design', statusKey: 'typeform', configKey: null, setupUrl: 'https://typeform.com/', loginBased: true, easySetup: 'In Typeform: Settings → Developer API → Create a personal access token.' },
      { type: 'lemlist', name: 'Lemlist', logo: 'https://lemlist.com/favicon.ico', description: 'Cold email outreach with personalization and automation', statusKey: 'lemlist', configKey: null, setupUrl: 'https://lemlist.com/', loginBased: true, easySetup: 'In Lemlist: Settings → Integrations → API → Copy API key.' },
    ]
  },
  // ── CALENDAR & SCHEDULING ──────────────────────────────────
  {
    category: 'Calendar & Scheduling',
    items: [
      { type: 'google_calendar', name: 'Google Calendar', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/512px-Google_Calendar_icon_%282020%29.svg.png', description: 'Sync meetings and schedule calls with leads', statusKey: 'google_calendar', configKey: 'google_calendar_token', setupUrl: 'https://console.cloud.google.com/', loginBased: false, easySetup: 'Enable Google Calendar API in Cloud Console, generate OAuth 2.0 credentials, and get a refresh token via OAuth Playground.' },
      { type: 'calendly', name: 'Calendly', logo: 'https://www.calendly.com/favicon.ico', description: 'Let leads book meetings directly on your calendar', statusKey: 'calendly', configKey: 'calendly_api_key', setupUrl: 'https://developer.calendly.com/', loginBased: false, easySetup: 'In Calendly: Settings → Integrations → API & Webhooks → Personal Access Token → Create token.' },
      { type: 'cal_com', name: 'Cal.com', logo: 'https://cal.com/favicon.ico', description: 'Open-source scheduling infrastructure', statusKey: 'cal_com', configKey: null, setupUrl: 'https://cal.com/', loginBased: true, easySetup: 'In Cal.com: Settings → Security → Create API key.' },
      { type: 'chilipiper', name: 'Chili Piper', logo: 'https://chilipiper.com/favicon.ico', description: 'Instant booking for inbound leads with round-robin routing', statusKey: 'chilipiper', configKey: null, setupUrl: 'https://chilipiper.com/', loginBased: true, easySetup: 'In Chili Piper: Admin → API Access → Generate API key.' },
    ]
  },
  // ── WEBSITE & CMS ──────────────────────────────────
  {
    category: 'Website & CMS',
    items: [
      { type: 'wordpress', name: 'WordPress', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/WordPress_blue_logo.svg/512px-WordPress_blue_logo.svg.png', description: 'Publish blog posts directly to your WordPress site', statusKey: 'wordpress', configKey: 'wordpress_url', setupUrl: 'https://wordpress.org/', loginBased: false, easySetup: 'In WordPress: Users → Your Profile → Application Passwords → Add new password. Use your username + this password here.' },
      { type: 'webflow', name: 'Webflow', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Webflow_logo_%282023%29.svg/512px-Webflow_logo_%282023%29.svg.png', description: 'Publish CMS content and manage your Webflow site', statusKey: 'webflow', configKey: null, setupUrl: 'https://webflow.com/', loginBased: true, easySetup: 'In Webflow: Account Settings → Workspaces → Site Settings → Integrations → Generate API token.' },
      { type: 'shopify', name: 'Shopify', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Shopify_logo_2018.svg/512px-Shopify_logo_2018.svg.png', description: 'Sync e-commerce customers and orders for marketing', statusKey: 'shopify', configKey: null, setupUrl: 'https://shopify.com/', loginBased: true, easySetup: 'In Shopify Admin: Settings → Apps → Develop Apps → Create app → Get Admin API access token.' },
      { type: 'notion', name: 'Notion', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Notion-logo.svg/512px-Notion-logo.svg.png', description: 'Sync content, docs, and databases with Notion', statusKey: 'notion', configKey: null, setupUrl: 'https://www.notion.so/', loginBased: true, easySetup: 'In Notion: Settings → API → Integrations → Create integration → Copy Internal Integration Secret.' },
    ]
  },
  // ── ANALYTICS & REPORTING ──────────────────────────────────
  {
    category: 'Analytics & Reporting',
    items: [
      { type: 'google_analytics', name: 'Google Analytics 4', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/GAnalytics.svg/512px-GAnalytics.svg.png', description: 'Website traffic, conversions, and user behavior analytics', statusKey: 'google_analytics', configKey: null, setupUrl: 'https://analytics.google.com/', loginBased: false, easySetup: 'Enable Google Analytics Data API in Cloud Console. Use the same OAuth setup as Google Ads.' },
      { type: 'google_search_console', name: 'Google Search Console', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/GAnalytics.svg/512px-GAnalytics.svg.png', description: 'Search performance, rankings, crawl issues, and real keyword data', statusKey: 'google_search_console', configKey: null, setupUrl: 'https://search.google.com/search-console', loginBased: false, easySetup: 'Enable Search Console API in Google Cloud Console with the same OAuth credentials. Used to enrich SEO analysis with real Google data.' },
      { type: 'google_drive', name: 'Google Drive', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Google_Drive_icon_%282020%29.svg/512px-Google_Drive_icon_%282020%29.svg.png', description: 'Access images and docs as AI inputs for ads, social posts, and workflows', statusKey: 'google_drive', configKey: null, setupUrl: 'https://drive.google.com/', loginBased: false, easySetup: 'Uses your Google OAuth credentials. Select images from Drive for content creation across Ads, Social Media, and AI features.' },
      { type: 'hotjar', name: 'Hotjar', logo: 'https://www.hotjar.com/favicon.ico', description: 'Heatmaps, session recordings, and conversion funnels', statusKey: 'hotjar', configKey: null, setupUrl: 'https://hotjar.com/', loginBased: true, easySetup: 'In Hotjar: Account → Personal API Keys → Create API key.' },
    ]
  },
  // ── AUTOMATION ──────────────────────────────────
  {
    category: 'Webhooks & Custom API',
    items: [
      { type: 'custom', name: 'Custom API / Webhook', logo: null, description: 'Connect any service via a custom REST API or webhook endpoint', statusKey: 'custom', configKey: 'custom_api_url', setupUrl: null, loginBased: false, easySetup: 'Paste your API endpoint URL. Optionally add a Bearer token in the API key field.' },
    ]
  },
  // ── DESIGN TOOLS ──────────────────────────────────
  {
    category: 'Design Tools',
    items: [
      { type: 'canva', name: 'Canva', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Canva_icon_2021.svg/512px-Canva_icon_2021.svg.png', description: 'Import & export designs to/from Canva — used in Design, Ads, Social & Blog', statusKey: 'canva', configKey: null, easySetup: 'Click Connect and sign in to Canva. Then use the "From Canva" buttons in Design, Ads, Social Media and Blog.' },
      { type: 'figma', name: 'Figma', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Figma-logo.svg/512px-Figma-logo.svg.png', description: 'Access design files, export assets, and sync brand visuals', statusKey: 'figma', configKey: null, setupUrl: 'https://www.figma.com/developers/', loginBased: true, easySetup: 'In Figma: Account Settings → Personal access tokens → Create a new token.' },
      { type: 'adobe_express', name: 'Adobe Express', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Adobe_Express_logo.svg/512px-Adobe_Express_logo.svg.png', description: 'Create branded content with Adobe Express templates and assets', statusKey: 'adobe', configKey: null, setupUrl: 'https://developer.adobe.com/', loginBased: true, easySetup: 'In Adobe Developer Console: Create a project → Generate client ID and secret for Adobe Express API.' },
      { type: 'crello', name: 'VistaCreate (Crello)', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/VistaCreate_logo.svg/512px-VistaCreate_logo.svg.png', description: 'Design animated visuals, social media graphics, and video ads', statusKey: 'crello', configKey: null, setupUrl: 'https://create.vista.com/', loginBased: true, easySetup: 'In VistaCreate: Account Settings → API Access → Request developer access.' },
      { type: 'dalle_images', name: 'AI Image Generation (DALL-E)', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/ChatGPT_logo.svg/512px-ChatGPT_logo.svg.png', description: 'Generate AI images for social posts, ads, and creatives using DALL-E', statusKey: 'openai', configKey: 'openai_api_key', setupUrl: 'https://platform.openai.com/', loginBased: false, easySetup: 'Uses your OpenAI API key. Go to Settings → API Keys to add your key, then AI image generation is enabled across Social Media and Ads.' },
    ]
  },
  // ── PROJECT MANAGEMENT ──────────────────────────────────
  {
    category: 'Project Management',
    items: [
      { type: 'trello', name: 'Trello', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8c/Trello_logo.svg/512px-Trello_logo.svg.png', description: 'Manage boards, lists and cards — sync leads with Trello workflows', statusKey: 'trello', configKey: null, setupUrl: 'https://trello.com/app-key', loginBased: true, easySetup: 'In Trello: Go to trello.com/app-key → Copy your API Key → Click "Token" link → Authorize and copy the token.' },
    ]
  },
  // ── CRM & DATA ──────────────────────────────────
  {
    category: 'Data Import / Export',
    items: [
      { type: 'import_csv', name: 'Import from CSV / Excel', logo: null, description: 'Import leads from any CRM, spreadsheet, or list', statusKey: null, configKey: null, setupUrl: null, loginBased: false, easySetup: 'Upload a CSV or Excel file. Columns are auto-detected and mapped to lead fields.' },
      { type: 'export_data', name: 'Export Data', logo: null, description: 'Export leads, messages, and activities to CSV', statusKey: null, configKey: null, setupUrl: null, loginBased: false, easySetup: 'Download all your data as a CSV file at any time.' },
    ]
  },
];

export default function Integrations() {
  const queryClient = useQueryClient();
  const { dbUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [exportType, setExportType] = useState('leads');

  // Handle OAuth callbacks — both URL params (legacy) and postMessage (new popup flow)
  React.useEffect(() => {
    // URL param fallback (for non-popup flows)
    const params = new URLSearchParams(window.location.search);
    if (params.get('success')) {
      toast.success(`${params.get('success') === 'google' ? 'Google' : 'Meta'} connected successfully!`);
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('error')) {
      toast.error('Connection failed: ' + decodeURIComponent(params.get('error')));
      window.history.replaceState({}, '', window.location.pathname);
    }

    // postMessage from OAuth popup
    const onMessage = (event) => {
      if (event.data?.type === 'oauth_success') {
        toast.success(`${event.data.provider || 'Account'} connected successfully!`);
        queryClient.invalidateQueries({ queryKey: ['companies'] });
      } else if (event.data?.type === 'oauth_error') {
        toast.error(`Connection failed: ${event.data.error || 'Unknown error'}`);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => Company.list() });
  const company = companies[0];
  const integrationStatus = company?.integration_status || {};
  const apiKeys = company?.api_keys || {};

  const { data: leads = [] } = useQuery({ queryKey: ['leads'], queryFn: () => Lead.list() });
  const { data: messages = [] } = useQuery({ queryKey: ['messages'], queryFn: () => Message.list() });
  const { data: activities = [] } = useQuery({ queryKey: ['activities'], queryFn: () => Activity.list() });

  const getStatus = (item) => {
    if (!item.statusKey) return null;
    if (integrationStatus[item.statusKey] === true) return 'connected';
    if (item.configKey && apiKeys[item.configKey]) return 'configured';
    // Check dynamic credential keys
    if (item.type && apiKeys[`${item.type}_api_key`]) return 'configured';
    if (item.type && apiKeys[`${item.type}_access_token`]) return 'configured';
    return 'disconnected';
  };

  const handleAction = (item) => {
    if (item.type === 'import_csv') { setShowImportDialog(true); return; }
    if (item.type === 'export_data') { setShowExportDialog(true); return; }
    setShowSetupDialog(item);
  };

  const connectedCount = Object.values(integrationStatus).filter(v => v === true).length;

  const filteredCategories = INTEGRATIONS.map(cat => ({
    ...cat,
    items: cat.items.filter(i => !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.description.toLowerCase().includes(searchQuery.toLowerCase()))
  })).filter(cat => cat.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            Integrations
          </h1>
          <p className="text-gray-400 mt-1">Connect your tools — {connectedCount} verified • Your keys, your data</p>
        </div>
        <div />
      </div>

      {connectedCount === 0 && (
        <div className="p-4 rounded-2xl bg-[#38b6ff]/10 border border-[#38b6ff]/20 flex items-start gap-3">
          <AlertCircle size={20} className="text-[#38b6ff] flex-shrink-0 mt-0.5" />
          <p className="text-gray-300 text-sm">Click any integration card to get started. Simply sign in with your existing account — no technical setup required.</p>
        </div>
      )}

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input placeholder="Search integrations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
      </div>

      {filteredCategories.map((category) => (
        <div key={category.category} className="space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Zap size={16} className="text-[#38b6ff]" /> {category.category}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {category.items.map((item) => {
              const status = getStatus(item);
              const isConnected = status === 'connected';
              const isConfigured = status === 'configured';
              return (
                <button key={item.type} onClick={() => handleAction(item)}
                  className={`group p-4 rounded-2xl border text-left transition-all duration-200 hover:scale-[1.02]
                    ${isConnected ? 'bg-green-500/10 border-green-500/20 hover:border-green-400/40'
                      : isConfigured ? 'bg-[#38b6ff]/5 border-[#38b6ff]/20 hover:border-[#38b6ff]/40'
                      : 'bg-white/5 border-white/10 hover:border-[#38b6ff]/30 hover:bg-white/8'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {item.logo ? (
                      <img src={item.logo} alt={item.name} className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 flex-shrink-0"
                        onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-[#38b6ff]/20 flex items-center justify-center flex-shrink-0">
                        <Zap size={16} className="text-[#38b6ff]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-white text-xs font-semibold truncate">{item.name}</span>
                        {isConnected && <CheckCircle size={10} className="text-green-400 flex-shrink-0" />}
                      </div>
                      {isConnected && <span className="text-green-400 text-[10px]">✓ Connected</span>}
                      {isConfigured && !isConnected && <span className="text-[#38b6ff] text-[10px]">Configured</span>}
                      {!isConnected && !isConfigured && item.statusKey && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-[#38b6ff]/20 text-[#38b6ff]">
                          Connect
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-500 text-[11px] line-clamp-2 leading-relaxed">{item.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Connect Modal */}
      {showSetupDialog && (
        <ConnectIntegrationModal
          integration={showSetupDialog}
          company={company}
          user={dbUser}
          isConnected={getStatus(showSetupDialog) === 'connected'}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['companies'] })}
          onClose={() => setShowSetupDialog(null)}
        />
      )}

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3"><Upload size={20} className="text-green-400" />Import Leads from CSV / Excel</DialogTitle>
            <DialogDescription className="text-gray-400">Upload a file exported from any CRM or spreadsheet</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-[#38b6ff]/50 transition-colors">
              <Upload size={32} className="mx-auto mb-3 text-gray-400" />
              <p className="text-white text-sm mb-1">Drop your CSV or Excel file here</p>
              <p className="text-gray-500 text-xs mb-4">Supports: .csv, .xlsx, .xls</p>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={e => setImportFile(e.target.files[0])} className="hidden" id="import-file" />
              <label htmlFor="import-file" className="cursor-pointer px-4 py-2 rounded-lg bg-[#38b6ff]/20 text-[#38b6ff] hover:bg-[#38b6ff]/30 transition-colors text-sm">Choose File</label>
              {importFile && <p className="text-green-400 text-sm mt-3">✅ {importFile.name}</p>}
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 space-y-1">
              <p className="text-white font-medium mb-1">Auto-detected columns:</p>
              <p>• "Company" / "Company Name" → Company</p>
              <p>• "Name" / "First Name" + "Last Name" → Contact Name</p>
              <p>• "Email" → Email • "Phone" → Phone</p>
            </div>
            {importResult && (
              <div className={`p-3 rounded-xl border text-sm ${importResult.success ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                {importResult.message}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setShowImportDialog(false); setImportFile(null); setImportResult(null); }} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
            <Button disabled={!importFile || isImporting} onClick={async () => {
              if (!importFile || !company) return;
              setIsImporting(true);
              try {
                const { url: file_url } = await UploadFile({ file: importFile });
                const result = await ExtractDataFromUploadedFile({
                  file_url,
                  json_schema: { type: 'object', properties: { leads: { type: 'array', items: { type: 'object', properties: { lead_company_name: { type: 'string' }, lead_name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, role: { type: 'string' } } } } } }
                });
                if (result.status === 'success' && result.output?.leads) {
                  const toImport = result.output.leads.map(l => ({ ...l, company_id: company.id, status: 'active' }));
                  await Lead.bulkCreate(toImport);
                  setImportResult({ success: true, message: `✅ Imported ${toImport.length} leads!` });
                  queryClient.invalidateQueries({ queryKey: ['leads'] });
                  toast.success(`Imported ${toImport.length} leads`);
                } else {
                  setImportResult({ success: false, message: 'Could not extract data. Check file format.' });
                }
              } catch (e) { setImportResult({ success: false, message: 'Import failed: ' + e.message }); }
              finally { setIsImporting(false); }
            }} className="bg-gradient-to-r from-green-600 to-green-500 gap-2">
              {isImporting ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Upload size={16} />}
              Import Leads
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3"><Download size={20} className="text-[#38b6ff]" />Export Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-2">
              {[{ id: 'leads', label: 'Leads', count: leads.length }, { id: 'messages', label: 'Messages', count: messages.length }, { id: 'activities', label: 'Activities', count: activities.length }].map(opt => (
                <button key={opt.id} onClick={() => setExportType(opt.id)}
                  className={`p-3 rounded-xl border text-center transition-all ${exportType === opt.id ? 'border-[#38b6ff] bg-[#38b6ff]/10 text-[#38b6ff]' : 'border-white/10 text-gray-400 hover:border-white/20'}`}>
                  <p className="text-lg font-bold">{opt.count}</p>
                  <p className="text-xs">{opt.label}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowExportDialog(false)} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
            <Button onClick={() => {
              const data = exportType === 'leads' ? leads : exportType === 'messages' ? messages : activities;
              if (!data.length) { toast.error('No data to export'); return; }
              const csv = [Object.keys(data[0]).join(','), ...data.map(row => Object.values(row).map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bmapz_${exportType}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
              toast.success(`Exported ${data.length} ${exportType}`);
              setShowExportDialog(false);
            }} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
              <Download size={16} /> Export CSV
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}