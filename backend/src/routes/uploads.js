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

/**
 * What may be stored, and what Content-Type it is served with.
 *
 * The bucket is PUBLIC, so an uploaded file is a document on the Supabase project's
 * origin. Accepting any type and echoing the client's own `mimetype` meant a
 * caller could upload `.html` or an SVG containing <script> and be served it as
 * text/html — stored XSS on that origin — or host malware behind a trusted domain.
 *
 * The map is the allowlist AND the served type: the client's declared mimetype is
 * never trusted, only matched.
 */
const ALLOWED_UPLOAD_TYPES = new Map([
  ['image/png', 'image/png'],
  ['image/jpeg', 'image/jpeg'],
  ['image/jpg', 'image/jpeg'],
  ['image/gif', 'image/gif'],
  ['image/webp', 'image/webp'],
  ['application/pdf', 'application/pdf'],
  ['video/mp4', 'video/mp4'],
  // SVG is deliberately ABSENT: it is an executable document in a browser.
]);

// In-memory upload with 10MB cap. We pipe to Supabase Storage from memory.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_UPLOAD_TYPES.has(String(file.mimetype).toLowerCase())) {
      const err = new Error('That file type cannot be uploaded.');
      err.code = 'UNSUPPORTED_FILE_TYPE';
      return cb(err);
    }
    cb(null, true);
  },
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
/**
 * Multer rejects a disallowed type (and an oversized file) by passing an error to
 * next(), which would otherwise fall through to the global handler as a 500. These
 * are user mistakes, so they get a 4xx and a sentence someone can act on.
 */
const handleUploadErrors = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'UNSUPPORTED_FILE_TYPE') {
      return res.status(415).json({
        error: `${err.message} Allowed: images (PNG, JPEG, GIF, WebP), PDF and MP4.`,
        code: 'UNSUPPORTED_FILE_TYPE',
      });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'That file is larger than the 10MB limit.', code: 'FILE_TOO_LARGE' });
    }
    console.error('[uploads] rejected:', err.message);
    return res.status(400).json({ error: 'That upload could not be accepted.' });
  });
};

router.post('/', requireAuth, handleUploadErrors, async (req, res) => {
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
        // The type WE decided, from the allowlist — never the client's string.
        // Echoing req.file.mimetype let the caller choose how a public URL is
        // served, which is the whole stored-XSS trick.
        contentType: ALLOWED_UPLOAD_TYPES.get(String(req.file.mimetype).toLowerCase())
          || 'application/octet-stream',
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
