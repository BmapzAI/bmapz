/**
 * File upload endpoint.
 *
 * Uses Supabase Storage with the service-role key (bypasses RLS) so users
 * don't need their own storage permissions configured. Auto-creates the
 * 'assets' bucket on first use if it doesn't exist.
 *
 * The frontend used to upload directly to Supabase Storage from the browser,
 * which required a public bucket + permissive RLS policies. Going through
 * the backend is more controllable and lets us validate content type, size,
 * and ownership in one place.
 */
import { Router } from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const BUCKET = 'assets';

// In-memory upload with 10MB cap. We pipe to Supabase Storage from memory.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Ensure the bucket exists. Called once per process, cached.
let bucketEnsured = false;
async function ensureBucket() {
  if (bucketEnsured) return;
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const exists = (buckets || []).some(b => b.name === BUCKET);
    if (!exists) {
      const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
      });
      if (error && !/already exists/i.test(error.message)) {
        throw error;
      }
      console.log(`[uploads] created bucket "${BUCKET}"`);
    }
    bucketEnsured = true;
  } catch (err) {
    console.error('[uploads] ensureBucket failed:', err.message);
    // Don't throw — let the actual upload attempt surface the real error.
  }
}

/**
 * POST /api/uploads
 * Multipart form-data with field name "file". Auth required.
 * Returns: { url, path }
 *
 * Optional form fields:
 *   - folder: subfolder under the bucket (e.g. "profile-pictures")
 */
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Send multipart/form-data with field "file".' });
    }

    await ensureBucket();

    const folder = (req.body.folder || 'uploads').replace(/[^a-zA-Z0-9_-]/g, '');
    const ext = (req.file.originalname.match(/\.[a-zA-Z0-9]+$/) || [''])[0].toLowerCase();
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const path = `${folder}/${req.companyId || 'shared'}/${safeName}`;

    const { error: uploadError } = await supabaseAdmin
      .storage
      .from(BUCKET)
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error('[uploads] storage error:', uploadError.message);
      // Real error messages help the user understand what's wrong
      const msg = uploadError.message || 'Storage upload failed';
      const isBucketIssue = /bucket|policy|permission|not found/i.test(msg);
      return res.status(500).json({
        error: isBucketIssue
          ? `Storage bucket issue: ${msg}. The backend should have auto-created the 'assets' bucket — check Supabase Storage settings.`
          : msg,
      });
    }

    const { data: publicData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    res.json({
      url: publicData.publicUrl,
      path,
      size: req.file.size,
      mime: req.file.mimetype,
    });
  } catch (err) {
    console.error('[uploads] handler error:', err.message);
    // Surface size-limit errors from multer
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Max 10MB.' });
    }
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

export default router;
