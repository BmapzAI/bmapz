import React from 'react';
import { Zap, AlertCircle, ChevronDown } from 'lucide-react';

const PLATFORM_GUIDES = {
  'Meta (Facebook/Instagram)': {
    steps: [
      { step: 1, title: 'Create Meta Business Account', desc: 'Go to business.facebook.com → Create account → Add your business name and email.' },
      { step: 2, title: 'Set Up Ad Account & Pixel', desc: 'In Business Settings → Ad Accounts → Create. Then go to Events Manager → Add new data source → Meta Pixel → Install on your website.' },
      { step: 3, title: 'Create Your Campaign', desc: 'Go to Ads Manager → Create → Choose your objective (Lead Generation / Conversions). Name your campaign and set budget at campaign or ad set level.' },
      { step: 4, title: 'Configure Your Ad Set (Targeting)', desc: 'Choose your audience: Custom Audiences (from your pixel), Lookalike Audiences, or Detailed Targeting. Set location, age, interests. Set placement (Automatic recommended for beginners).' },
      { step: 5, title: 'Create Your Ad', desc: 'Choose format (Single image, Carousel, Video). Upload your creative. Add the hook as headline, body copy in primary text, and CTA button. Preview on mobile before publishing.' },
      { step: 6, title: 'Set Budget & Schedule', desc: 'For TOF: Daily budget $20-50. MOF: $15-30. BOF: $10-20. Run ads continuously (not scheduled) initially. Set campaign budget optimization (CBO) if scaling.' },
      { step: 7, title: 'Monitor & Optimize', desc: 'Check daily: CTR (should be >1%), CPM, CPC, Cost per lead. After 3-5 days with data: pause ads with CTR <0.5%, scale ads with CPA at or below target. Never edit running ads — duplicate and test.' },
    ]
  },
  'LinkedIn': {
    steps: [
      { step: 1, title: 'Create LinkedIn Campaign Manager', desc: 'Go to linkedin.com/campaignmanager → Create account → Associate with your LinkedIn Company Page.' },
      { step: 2, title: 'Install LinkedIn Insight Tag', desc: 'In Campaign Manager → Account Assets → Insight Tag → Install on your website for conversion tracking and retargeting.' },
      { step: 3, title: 'Create Campaign Group & Campaign', desc: 'Create Campaign Group (e.g., "Lead Gen Q2"). Choose objective: Lead Generation (for direct leads), Website Conversions, or Brand Awareness.' },
      { step: 4, title: 'Set Up Targeting', desc: 'LinkedIn targeting is B2B gold: Job Title, Seniority, Company Size, Industry, Skills. Create Matched Audiences from your CRM/email list. Minimum audience: 50,000 for best delivery.' },
      { step: 5, title: 'Choose Ad Format', desc: 'Single Image: best for awareness/consideration. Lead Gen Form: highest conversion for B2B leads (pre-fills user data). Sponsored Messaging: direct message to inboxes. Video: for storytelling.' },
      { step: 6, title: 'Set Budget', desc: 'LinkedIn is more expensive: minimum $10/day. Recommended: $50-100/day for meaningful data. Cost per lead $30-80 is typical for B2B. Use Manual bidding for better control.' },
      { step: 7, title: 'Optimize', desc: 'LinkedIn takes 7-14 days to optimize. Monitor: Lead form completion rate (target >10%), CTR (target >0.35%), CPL. Test different audience segments — company size vs job title targeting often performs very differently.' },
    ]
  },
  'Google Ads': {
    steps: [
      { step: 1, title: 'Create Google Ads Account', desc: 'Go to ads.google.com → New account → Set up billing. Link to Google Analytics for conversion tracking.' },
      { step: 2, title: 'Install Google Tag & Conversion Tracking', desc: 'In Tools → Measurement → Conversions → Add conversion. Install Google Tag on your website or use Google Tag Manager. Track: form submissions, calls, purchases.' },
      { step: 3, title: 'Keyword Research', desc: 'Use Google Keyword Planner (in Tools). Find keywords your ICP searches. Target: high intent (e.g., "buy [product]", "[problem] solution"), medium competition. Aim for 15-30 keywords per ad group.' },
      { step: 4, title: 'Create Search Campaign', desc: 'New Campaign → Sales or Leads → Search. Write 3 headlines (30 chars max) and 2 descriptions (90 chars max). Include primary keyword in Headline 1. Use your hook as the main headline.' },
      { step: 5, title: 'Configure Bidding & Budget', desc: 'Start with Maximize Clicks to get data, then switch to Target CPA once you have 30+ conversions. Daily budget: 5-10x your target CPA. For $50 CPA target, set $250-500/day budget.' },
      { step: 6, title: 'Add Negative Keywords', desc: 'Critical step: add negative keywords to avoid wasted spend. Common negatives: "free", "jobs", "how to", "salary", competitor names if not targeting them. Review Search Terms report weekly.' },
      { step: 7, title: 'Optimize Weekly', desc: 'Check Quality Score (aim for 7+). Pause keywords with 0 conversions after 50 clicks. Test 2 ads per ad group. Use Ad Extensions: Sitelinks, Callouts, Structured Snippets to increase CTR.' },
    ]
  },
  'TikTok': {
    steps: [
      { step: 1, title: 'Create TikTok Ads Manager', desc: 'Go to ads.tiktok.com → Create account → Set up business info and billing.' },
      { step: 2, title: 'Install TikTok Pixel', desc: 'In Assets → Events → Create Pixel → Install manually or via partner integration. Track ViewContent, Lead, Purchase events.' },
      { step: 3, title: 'Set Campaign Objective', desc: 'For lead gen: choose "Lead Generation". For product sales: "Product Sales" or "Conversions". TikTok works best for TOF brand awareness and BOF retargeting.' },
      { step: 4, title: 'Configure Ad Group (Targeting)', desc: 'TikTok audiences: Interest & Behavior targeting, Custom Audiences (email/pixel), Lookalike. Keep audiences broad initially (5M+). TikTok algorithm is powerful — let it optimize.' },
      { step: 5, title: 'Create In-Feed Ad', desc: 'Video 9:16 vertical (1080x1920px), 15-60 seconds. First 3 seconds = your hook (use the hook from the strategy). Add sound-off captions. Include clear CTA. Native-feeling content outperforms polished ads.' },
      { step: 6, title: 'Budget & Bidding', desc: 'Minimum $20/day per ad group. Recommended: $50-100/day. Use "Lowest Cost" bidding initially. CPM target: $5-15. TikTok needs 50 events/week to optimize — scale quickly once profitable.' },
      { step: 7, title: 'Creative Testing', desc: 'TikTok is a creative-driven platform. Test 3-5 different hooks every 2 weeks. UGC-style (user-generated content) almost always outperforms studio-produced. Repurpose top organic posts as paid ads.' },
    ]
  },
  'X (Twitter)': {
    steps: [
      { step: 1, title: 'Create X Ads Account', desc: 'Go to ads.twitter.com → Sign in with your X account → Create ads account → Add business name and website.' },
      { step: 2, title: 'Set Up Conversion Tracking', desc: 'In Conversion Tools → Create conversion event. Install X Pixel on your website (manually or via Google Tag Manager). Track: page views, leads, purchases, sign-ups.' },
      { step: 3, title: 'Create Campaign', desc: 'New Campaign → Choose objective: Website Traffic (leads), Engagement (awareness), App Installs, or Video Views. Set daily budget ($20-50 starting) and campaign dates.' },
      { step: 4, title: 'Create Tweets/Content', desc: 'Create your ad tweets first in the X app (unlisted or public). Use your hook in the first 1-2 lines. Include a clear CTA. Add relevant media (image or video). Promote via Ads Manager.' },
      { step: 5, title: 'Set Up Targeting', desc: 'Target by: Keywords (what X users tweet/search), Interests, Followers of similar accounts, Conversations. Exclude competitors if desired. X is great for reaching professionals and tech audiences.' },
      { step: 6, title: 'Budget & Bidding', desc: 'Use Automatic bidding initially (X optimizes for your goal). Daily budget: $20-100. X CPM typically $5-15. Cost per lead: $5-30 depending on audience quality. Scale profitable campaigns 20-30% weekly.' },
      { step: 7, title: 'Monitor & Optimize', desc: 'Track: Impressions, Engagements, CTR (aim >0.5%), Cost per result. Pause tweets with low engagement (Engagement Rate <0.1%) after 3-5 days. Test 2-3 tweet variations per campaign to find your winning hook.' },
    ]
  },
  'YouTube': {
    steps: [
      { step: 1, title: 'Link Google Ads to YouTube Channel', desc: 'In Google Ads → Tools → Linked accounts → YouTube → Link your channel. This enables advertising on your own channel and others.' },
      { step: 2, title: 'Set Up Conversion Tracking', desc: 'Use Google Tag Manager to install Google Ads conversion tag. Track: website leads, purchases, video views to site. Import Google Analytics goals into Google Ads.' },
      { step: 3, title: 'Choose Ad Format', desc: 'In-Stream Skippable: 15-60 sec, skippable after 5 sec. Best for awareness. In-Stream Non-Skippable: 15 sec max. Bumper Ads: 6 sec. Video Discovery: thumbnail in search results. Use skippable for most campaigns.' },
      { step: 4, title: 'Create Video Ad', desc: 'Upload your video to YouTube (unlisted). In Google Ads → New Campaign → Video → Choose objective. Paste your YouTube video URL. First 5 seconds must be your hook — viewers skip after that.' },
      { step: 5, title: 'Set Targeting', desc: 'Audience segments: Custom Intent (people searching your keywords), In-Market (actively researching), Affinity, Remarketing. Combine Custom Intent + Remarketing for highest-intent targeting.' },
      { step: 6, title: 'Budget & Bidding', desc: 'Start with CPV (Cost per View) bidding. Budget: $30-100/day. Target CPV: $0.03-0.10. Once data collected, switch to Target CPA for conversion-focused campaigns.' },
      { step: 7, title: 'Optimize', desc: 'View rate (target >30%). Skip rate: lower = better hook. Check Audience segments report. Exclude irrelevant audiences. Frequency cap: 3-5 impressions/user/week to avoid ad fatigue.' },
    ]
  }
};

export { PLATFORM_GUIDES };

export default function AdsGuideModal({ platform, onClose }) {
  const guide = PLATFORM_GUIDES[platform];
  if (!guide) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Zap size={20} className="text-[#38b6ff]" />
            How to Set Up {platform} Campaigns
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1"><ChevronDown size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          {guide.steps.map(s => (
            <div key={s.step} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3572b9] to-[#38b6ff] flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">{s.step}</div>
              <div>
                <p className="text-white font-semibold text-sm">{s.title}</p>
                <p className="text-gray-400 text-sm mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
          <div className="mt-4 p-4 rounded-xl bg-[#38b6ff]/10 border border-[#38b6ff]/20">
            <p className="text-[#38b6ff] text-sm font-medium flex items-center gap-2"><AlertCircle size={16} /> Pro Tip</p>
            <p className="text-gray-300 text-sm mt-1">Use the hook and angles from your generated strategy as your first ads to test. Start with the TOF campaign, collect data for 7 days, then activate MOF and BOF.</p>
          </div>
        </div>
      </div>
    </div>
  );
}