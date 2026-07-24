/**
 * Canva Connect API — list designs, export a design to an image (import INTO
 * Bmapz), and upload a Bmapz image as a Canva asset (send TO Canva).
 *
 * Requires the company to have connected Canva (OAuth in oauth.js) AND a Canva
 * developer app configured via CANVA_CLIENT_ID/SECRET. Access tokens are
 * short-lived, so every call refreshes when expired.
 */
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { refreshCanvaToken } from './oauth.js';

const router = Router();
const CANVA_API = 'https://api.canva.com/rest/v1';

async function getValidToken(companyId) {
  const { data } = await supabaseAdmin.from('companies').select('api_keys').eq('id', companyId).single();
  const keys = data?.api_keys || {};
  if (!keys.canva_access_token) { const e = new Error('Canva is not connected'); e.code = 'NOT_CONNECTED'; throw e; }
  const exp = keys.canva_token_expires_at ? new Date(keys.canva_token_expires_at).getTime() : 0;
  if (exp && exp < Date.now() + 60000) {
    try { return await refreshCanvaToken(companyId); } catch { /* fall through to existing token */ }
  }
  return keys.canva_access_token;
}

const authHeaders = (token) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

// GET /api/canva/status
router.get('/status', requireAuth, async (req, res) => {
  try {
    const { data } = await supabaseAdmin.from('companies').select('api_keys, integration_status').eq('id', req.companyId).single();
    const connected = !!(data?.api_keys?.canva_access_token) && data?.integration_status?.canva !== false;
    const configured = !!(data?.api_keys?.canva_client_id || process.env.CANVA_CLIENT_ID);
    res.json({ connected, configured });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/canva/designs — list the user's Canva designs
router.get('/designs', requireAuth, async (req, res) => {
  try {
    const token = await getValidToken(req.companyId);
    const r = await fetch(`${CANVA_API}/designs?limit=30`, { headers: authHeaders(token) });
    const body = await r.json();
    if (!r.ok) throw new Error(body.message || `Canva list failed (${r.status})`);
    const designs = (body.items || []).map(d => ({
      id: d.id,
      title: d.title || 'Untitled',
      thumbnail: d.thumbnail?.url || null,
      edit_url: d.urls?.edit_url || null,
    }));
    res.json(designs);
  } catch (err) {
    res.status(err.code === 'NOT_CONNECTED' ? 409 : 500).json({ error: err.message, code: err.code });
  }
});

// POST /api/canva/export { design_id } — export a design to PNG and return its URL
router.post('/export', requireAuth, async (req, res) => {
  try {
    const { design_id } = req.body;
    if (!design_id) return res.status(400).json({ error: 'design_id is required' });
    const token = await getValidToken(req.companyId);

    const startRes = await fetch(`${CANVA_API}/exports`, {
      method: 'POST', headers: authHeaders(token),
      body: JSON.stringify({ design_id, format: { type: 'png' } }),
    });
    const startBody = await startRes.json();
    if (!startRes.ok) throw new Error(startBody.message || 'Canva export failed to start');
    const jobId = startBody.job?.id;

    // Poll the export job (Canva jobs are async)
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1500));
      const pollRes = await fetch(`${CANVA_API}/exports/${jobId}`, { headers: authHeaders(token) });
      const poll = await pollRes.json();
      const status = poll.job?.status;
      if (status === 'success') {
        const url = poll.job?.urls?.[0] || poll.job?.exports?.[0]?.url;
        if (!url) throw new Error('Export finished but returned no URL');
        return res.json({ url });
      }
      if (status === 'failed') throw new Error(poll.job?.error?.message || 'Canva export failed');
    }
    throw new Error('Canva export timed out');
  } catch (err) {
    res.status(err.code === 'NOT_CONNECTED' ? 409 : 500).json({ error: err.message, code: err.code });
  }
});

// POST /api/canva/import { image_url, title } — upload a Bmapz image as a Canva
// asset and create a design; returns the Canva edit URL.
router.post('/import', requireAuth, async (req, res) => {
  try {
    const { image_url, title = 'Bmapz Design' } = req.body;
    if (!image_url) return res.status(400).json({ error: 'image_url is required' });
    const token = await getValidToken(req.companyId);

    const imgRes = await fetch(image_url);
    if (!imgRes.ok) throw new Error('Could not load the image to upload');
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    // Asset upload uses a metadata header + binary body
    const metadata = Buffer.from(JSON.stringify({ name_base64: Buffer.from(title).toString('base64') })).toString('base64');
    const upRes = await fetch(`${CANVA_API}/asset-uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream', 'Asset-Upload-Metadata': metadata },
      body: buffer,
    });
    const upBody = await upRes.json();
    if (!upRes.ok) throw new Error(upBody.message || 'Canva asset upload failed');
    const jobId = upBody.job?.id;

    let assetId = null;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1500));
      const pollRes = await fetch(`${CANVA_API}/asset-uploads/${jobId}`, { headers: authHeaders(token) });
      const poll = await pollRes.json();
      if (poll.job?.status === 'success') { assetId = poll.job?.asset?.id; break; }
      if (poll.job?.status === 'failed') throw new Error('Canva asset processing failed');
    }
    if (!assetId) throw new Error('Canva asset upload timed out');

    const designRes = await fetch(`${CANVA_API}/designs`, {
      method: 'POST', headers: authHeaders(token),
      body: JSON.stringify({ design_type: { type: 'preset', name: 'presentation' }, asset_id: assetId, title }),
    });
    const design = await designRes.json();
    if (!designRes.ok) throw new Error(design.message || 'Canva design creation failed');
    res.json({ edit_url: design.design?.urls?.edit_url || null, design_id: design.design?.id || null });
  } catch (err) {
    res.status(err.code === 'NOT_CONNECTED' ? 409 : 500).json({ error: err.message, code: err.code });
  }
});

export default router;
