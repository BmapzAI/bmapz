/**
 * Importing AI history into the Company Brain.
 *
 * ONE-WAY. There is no export route in this file and there should never be one:
 * the product promise is that scattered AI context ends up centralised in Bmapz,
 * running on Bmapz's own providers, not that Bmapz feeds another assistant.
 *
 * Company-admin only. An import writes durable facts into the shared Company
 * Brain, which then shapes every generation for everyone in the company — that is
 * a company-level act, not a personal preference, and a plain member should not be
 * able to steer the whole account's AI by uploading a chat log.
 */
import { Router } from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireCompanyAdmin } from '../middleware/auth.js';
import { detectFormat, parseAny, buildBrief, distillImport, sha256 } from '../lib/aiHistoryImport.js';
import { friendlyError } from '../lib/aiActions.js';

const router = Router();

/** A full Claude Code session is genuinely large; a ChatGPT export can be larger. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

const SOURCE_LABEL = {
  claude_code: 'Claude Code / Cowork session',
  claude_export: 'Claude export',
  chatgpt_export: 'ChatGPT export',
  markdown: 'Notes',
};

/** Multer errors are user mistakes; they get a 4xx, not a 500. */
const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'That file is larger than the 25MB limit.' });
    }
    console.error('[aiImports] upload rejected:', err.message);
    return res.status(400).json({ error: 'That upload could not be accepted.' });
  });
};

// GET /api/ai-imports — what has been imported, newest first.
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_context_imports')
      .select('id, source, label, conversations, messages_seen, lessons_added, status, error, summary, created_at')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('[aiImports] list failed:', err.message);
    res.status(500).json({ error: friendlyError(err) });
  }
});

/**
 * POST /api/ai-imports — upload a conversation export and fold it into the brain.
 *
 * Synchronous on purpose. The distillation is one model call on a bounded brief,
 * and returning the summary immediately is what makes the feature legible: the
 * user sees exactly what was learned before deciding whether to keep it.
 */
router.post('/', requireAuth, requireCompanyAdmin, handleUpload, async (req, res) => {
  let importRow = null;
  try {
    const raw = req.file?.buffer;
    const inlineText = typeof req.body?.text === 'string' ? req.body.text : null;
    if (!raw && !inlineText) {
      return res.status(400).json({ error: 'Attach an export file, or paste the text.' });
    }

    const text = raw ? raw.toString('utf8') : inlineText;
    const bytes = raw ? raw.length : Buffer.byteLength(inlineText, 'utf8');
    const hash = sha256(raw || Buffer.from(inlineText, 'utf8'));

    const format = detectFormat(text);
    if (!format) {
      return res.status(400).json({
        error: 'That file was not recognised. Supported: a Claude Code session (.jsonl), '
          + 'a Claude or ChatGPT conversations.json export, or a markdown notes file.',
      });
    }

    // Re-uploading the same export must not double the brain.
    const { data: existing } = await supabaseAdmin
      .from('ai_context_imports').select('id, label, lessons_added, summary, created_at')
      .eq('company_id', req.companyId).eq('file_hash', hash).maybeSingle();
    if (existing) {
      return res.status(409).json({
        error: 'This file has already been imported.',
        code: 'ALREADY_IMPORTED',
        existing,
      });
    }

    const { conversations } = parseAny(text, format);
    if (!conversations.length) {
      return res.status(400).json({ error: 'No conversations could be read from that file.' });
    }

    const messagesSeen = conversations.reduce((n, c) => n + (c.messages?.length || 0), 0);
    const label = String(
      req.file?.originalname || conversations[0]?.title || SOURCE_LABEL[format] || 'Import',
    ).slice(0, 200);

    // Recorded BEFORE the model call, so a failure leaves a visible, explainable
    // row rather than nothing at all.
    const { data: created, error: insErr } = await supabaseAdmin
      .from('ai_context_imports').insert({
        company_id: req.companyId,
        imported_by: req.dbUser?.id || null,
        source: format,
        label,
        file_hash: hash,
        file_bytes: bytes,
        conversations: conversations.length,
        messages_seen: messagesSeen,
        status: 'distilling',
      }).select().single();
    if (insErr) throw insErr;
    importRow = created;

    const brief = buildBrief(conversations);
    const { lessons, summary } = await distillImport({
      companyId: req.companyId,
      userId: req.dbUser?.id,
      importId: created.id,
      brief,
      label,
    });

    const { data: done } = await supabaseAdmin
      .from('ai_context_imports')
      .update({
        status: 'done', lessons_added: lessons, summary, updated_at: new Date().toISOString(),
      })
      .eq('id', created.id).eq('company_id', req.companyId)
      .select().single();

    res.json({
      ...(done || created),
      source_label: SOURCE_LABEL[format] || format,
    });
  } catch (err) {
    console.error('[aiImports] import failed:', err.message);
    if (importRow) {
      await supabaseAdmin.from('ai_context_imports')
        .update({ status: 'failed', error: String(err.message).slice(0, 500), updated_at: new Date().toISOString() })
        .eq('id', importRow.id);
    }
    res.status(500).json({ error: friendlyError(err) });
  }
});

/**
 * DELETE /api/ai-imports/:id — undo an import.
 *
 * The lessons it created carry source_import_id with ON DELETE CASCADE, so
 * removing the import removes exactly what it taught and nothing else. Without
 * that link, undoing would mean guessing which lessons came from where.
 */
router.delete('/:id', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const { data: row } = await supabaseAdmin
      .from('ai_context_imports').select('id')
      .eq('id', req.params.id).eq('company_id', req.companyId).maybeSingle();
    if (!row) return res.status(404).json({ error: 'Import not found in this company.' });

    const { error } = await supabaseAdmin
      .from('ai_context_imports').delete()
      .eq('id', req.params.id).eq('company_id', req.companyId);
    if (error) throw error;

    const { invalidateCompanyBrain } = await import('../lib/companyBrain.js');
    invalidateCompanyBrain(req.companyId);

    res.json({ success: true });
  } catch (err) {
    console.error('[aiImports] delete failed:', err.message);
    res.status(500).json({ error: friendlyError(err) });
  }
});

export default router;
