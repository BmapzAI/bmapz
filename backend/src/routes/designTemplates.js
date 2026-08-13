/**
 * Design Studio templates — per-company brand design presets.
 * config JSONB holds the full design document:
 *   { format: 'single'|'carousel', aspect_ratio, slides: [{ background, layers }] }
 */
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAppOwner } from '../middleware/auth.js';

const router = Router();

/**
 * THE WHOLE ROUTER IS APP-OWNER ONLY.
 *
 * The Design Studio is a confidential, unreleased section. The frontend hides the
 * route, the sidebar entry, every cross-section shortcut, the global search
 * destinations and the support assistant's page list — all from
 * `canSeeDesign` / `role === 'owner'`. But these endpoints carried only
 * `requireAuth`, so hiding the UI was the only thing protecting them: any
 * authenticated customer who guessed `/api/design-templates` could confirm the
 * feature exists and read or write their company's design presets.
 *
 * Applied router-wide rather than per route so a handler added later is covered by
 * default instead of being forgotten. Returns 404, so the endpoint is
 * indistinguishable from one that does not exist.
 *
 * The only caller is frontend-src/pages/Design.jsx, which is already unreachable
 * for anyone but an App Owner — so this changes nothing for legitimate use.
 */
router.use(requireAuth, requireAppOwner);

router.get('/', async (req, res) => {
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

router.get('/:id', async (req, res) => {
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

router.post('/', async (req, res) => {
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

router.patch('/:id', async (req, res) => {
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

router.delete('/:id', async (req, res) => {
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
