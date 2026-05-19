import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ─── Social Posts CRUD ────────────────────────────────────────────────────────

router.get('/posts', requireAuth, async (req, res) => {
  try {
    const { platform, status, limit = 50, offset = 0 } = req.query;
    let query = supabaseAdmin
      .from('social_posts')
      .select('*', { count: 'exact' })
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (platform) query = query.contains('platforms', [platform]);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/posts', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('social_posts')
      .insert({ ...req.body, company_id: req.companyId })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/posts/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('social_posts')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Post not found' });
  }
});

router.patch('/posts/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('social_posts')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/posts/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('social_posts')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Publish a post to real social platforms ──────────────────────────────────

router.post('/posts/:id/publish', requireAuth, async (req, res) => {
  try {
    const { data: post } = await supabaseAdmin
      .from('social_posts')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', req.companyId)
      .single();
    const company = companyRow
      ? { ...companyRow, ...(companyRow.api_keys || {}), ...(companyRow.settings || {}) }
      : {};

    const results = {};
    const platforms = post.platforms || [];

    for (const platform of platforms) {
      const content = post.platform_contents?.[platform] || post.content || '';
      try {
        if (platform === 'facebook') {
          results.facebook = await publishToFacebook(company, content, post.media_urls);
        } else if (platform === 'instagram') {
          results.instagram = await publishToInstagram(company, content, post.media_urls);
        } else if (platform === 'linkedin') {
          results.linkedin = await publishToLinkedIn(company, content, post.media_urls);
        } else if (platform === 'twitter') {
          results.twitter = await publishToTwitter(company, content, post.media_urls);
        } else if (platform === 'tiktok') {
          results.tiktok = { status: 'pending', note: 'TikTok video upload requires file upload flow' };
        }
      } catch (pErr) {
        results[platform] = { error: pErr.message };
      }
    }

    const allSuccess = Object.values(results).every(r => !r.error);
    const newStatus = allSuccess ? 'published' : 'failed';

    await supabaseAdmin.from('social_posts').update({
      status: newStatus,
      platform_post_ids: results,
      published_at: allSuccess ? new Date().toISOString() : null,
    }).eq('id', post.id);

    res.json({ success: allSuccess, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Fetch real posts from connected platforms ────────────────────────────────

router.get('/feed', requireAuth, async (req, res) => {
  try {
    const { platform } = req.query;
    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', req.companyId)
      .single();
    const company = companyRow
      ? { ...companyRow, ...(companyRow.api_keys || {}), ...(companyRow.settings || {}) }
      : {};

    const feed = [];

    if (!platform || platform === 'facebook') {
      if (company.facebook_page_access_token && company.facebook_page_id) {
        try {
          const r = await fetch(
            `https://graph.facebook.com/v19.0/${company.facebook_page_id}/posts?fields=id,message,created_time,full_picture,permalink_url,likes.summary(true),comments.summary(true),shares&limit=20&access_token=${company.facebook_page_access_token}`
          );
          const d = await r.json();
          (d.data || []).forEach(p => feed.push({
            id: p.id, platform: 'facebook', content: p.message, created_at: p.created_time,
            image: p.full_picture, url: p.permalink_url,
            likes: p.likes?.summary?.total_count || 0,
            comments: p.comments?.summary?.total_count || 0,
            shares: p.shares?.count || 0,
          }));
        } catch { /* skip */ }
      }
    }

    if (!platform || platform === 'instagram') {
      if (company.meta_access_token && company.instagram_business_account_id) {
        try {
          const r = await fetch(
            `https://graph.facebook.com/v19.0/${company.instagram_business_account_id}/media?fields=id,caption,timestamp,media_type,media_url,permalink,like_count,comments_count&limit=20&access_token=${company.meta_access_token}`
          );
          const d = await r.json();
          (d.data || []).forEach(p => feed.push({
            id: p.id, platform: 'instagram', content: p.caption, created_at: p.timestamp,
            image: p.media_url, url: p.permalink,
            likes: p.like_count || 0, comments: p.comments_count || 0,
          }));
        } catch { /* skip */ }
      }
    }

    if (!platform || platform === 'linkedin') {
      if (company.linkedin_access_token) {
        try {
          const r = await fetch(
            'https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(urn:li:person:~)&count=20',
            { headers: { Authorization: `Bearer ${company.linkedin_access_token}` } }
          );
          const d = await r.json();
          (d.elements || []).forEach(p => feed.push({
            id: p.id, platform: 'linkedin',
            content: p.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '',
            created_at: new Date(p.created?.time || Date.now()).toISOString(),
          }));
        } catch { /* skip */ }
      }
    }

    if (!platform || platform === 'twitter') {
      if (company.twitter_access_token) {
        try {
          const meResp = await fetch('https://api.twitter.com/2/users/me', {
            headers: { Authorization: `Bearer ${company.twitter_access_token}` }
          });
          const meData = await meResp.json();
          if (meData.data?.id) {
            const r = await fetch(
              `https://api.twitter.com/2/users/${meData.data.id}/tweets?max_results=20&tweet.fields=created_at,public_metrics`,
              { headers: { Authorization: `Bearer ${company.twitter_access_token}` } }
            );
            const d = await r.json();
            (d.data || []).forEach(t => feed.push({
              id: t.id, platform: 'twitter', content: t.text, created_at: t.created_at,
              likes: t.public_metrics?.like_count || 0,
              retweets: t.public_metrics?.retweet_count || 0,
              impressions: t.public_metrics?.impression_count || 0,
            }));
          }
        } catch { /* skip */ }
      }
    }

    // Sort by date descending
    feed.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(feed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Analytics ────────────────────────────────────────────────────────────────

router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const { platform, period = '30d' } = req.query;
    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', req.companyId)
      .single();
    const company = companyRow
      ? { ...companyRow, ...(companyRow.api_keys || {}), ...(companyRow.settings || {}) }
      : {};

    const analytics = {};

    if (!platform || platform === 'facebook') {
      if (company.facebook_page_access_token && company.facebook_page_id) {
        try {
          const metrics = 'page_impressions,page_engaged_users,page_post_engagements,page_fans';
          const r = await fetch(
            `https://graph.facebook.com/v19.0/${company.facebook_page_id}/insights?metric=${metrics}&period=day&limit=30&access_token=${company.facebook_page_access_token}`
          );
          const d = await r.json();
          analytics.facebook = d.data || [];
        } catch (e) {
          analytics.facebook = { error: e.message };
        }
      }
    }

    if (!platform || platform === 'instagram') {
      if (company.meta_access_token && company.instagram_business_account_id) {
        try {
          const metrics = 'impressions,reach,profile_views,follower_count';
          const r = await fetch(
            `https://graph.facebook.com/v19.0/${company.instagram_business_account_id}/insights?metric=${metrics}&period=day&limit=30&access_token=${company.meta_access_token}`
          );
          const d = await r.json();
          analytics.instagram = d.data || [];
        } catch (e) {
          analytics.instagram = { error: e.message };
        }
      }
    }

    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Publisher helpers ────────────────────────────────────────────────────────

async function publishToFacebook(company, content, mediaUrls) {
  const pageToken = company.facebook_page_access_token;
  const pageId = company.facebook_page_id;
  if (!pageToken || !pageId) throw new Error('Facebook page not connected');

  const body = { message: content, access_token: pageToken };
  if (mediaUrls?.length) body.link = mediaUrls[0];

  const r = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return { post_id: d.id };
}

async function publishToInstagram(company, content, mediaUrls) {
  const token = company.meta_access_token;
  const igId = company.instagram_business_account_id;
  if (!token || !igId) throw new Error('Instagram not connected');

  if (!mediaUrls?.length) throw new Error('Instagram requires an image URL');

  // Step 1: Create media container
  const containerResp = await fetch(`https://graph.facebook.com/v19.0/${igId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: mediaUrls[0], caption: content, access_token: token }),
  });
  const container = await containerResp.json();
  if (container.error) throw new Error(container.error.message);

  // Step 2: Publish container
  const publishResp = await fetch(`https://graph.facebook.com/v19.0/${igId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: token }),
  });
  const published = await publishResp.json();
  if (published.error) throw new Error(published.error.message);
  return { post_id: published.id };
}

async function publishToLinkedIn(company, content, mediaUrls) {
  const token = company.linkedin_access_token;
  if (!token) throw new Error('LinkedIn not connected');

  const meResp = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const me = await meResp.json();
  const authorUrn = `urn:li:person:${me.sub}`;

  const body = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: content },
        shareMediaCategory: 'NONE',
      }
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  const r = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (d.status >= 400) throw new Error(d.message || 'LinkedIn post failed');
  return { post_id: d.id };
}

async function publishToTwitter(company, content, mediaUrls) {
  const token = company.twitter_access_token;
  if (!token) throw new Error('Twitter/X not connected');

  const r = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: content }),
  });
  const d = await r.json();
  if (d.errors) throw new Error(d.errors[0]?.message || 'Tweet failed');
  return { post_id: d.data?.id };
}

export default router;
