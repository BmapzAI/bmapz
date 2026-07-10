/**
 * Design Studio templates — per-company brand design presets.
 * config JSONB holds the full design document:
 *   { format: 'single'|'carousel', aspect_ratio, slides: [{ background, layers }] }
 */
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('design_templates')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('design_templates')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Design template not found' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, config, thumbnail_url, is_brand_preset } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { data, error } = await supabaseAdmin
      .from('design_templates')
      .insert({
        company_id: req.companyId,
        name: String(name).slice(0, 120),
        config: config || {},
        thumbnail_url: thumbnail_url || null,
        is_brand_preset: !!is_brand_preset,
        created_by: req.dbUser?.id || null,
      })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { name, config, thumbnail_url, is_brand_preset } = req.body;
    const fields = { updated_at: new Date().toISOString() };
    if (name !== undefined) fields.name = String(name).slice(0, 120);
    if (config !== undefined) fields.config = config;
    if (thumbnail_url !== undefined) fields.thumbnail_url = thumbnail_url;
    if (is_brand_preset !== undefined) fields.is_brand_preset = !!is_brand_preset;

    const { data, error } = await supabaseAdmin
      .from('design_templates')
      .update(fields)
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

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('design_templates')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
