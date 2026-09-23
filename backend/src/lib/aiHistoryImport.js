/**
 * Importing AI history — Claude Desktop, Claude Code, Cowork and ChatGPT.
 *
 * WHAT THIS IS, AND IS NOT.
 *
 * ONE-WAY, INWARD ONLY. Nothing leaves Bmapz. There is no export path here by
 * design: the point is that a customer's scattered AI context ends up centralised
 * in their company profile, running on Bmapz's own providers.
 *
 * Neither Anthropic nor OpenAI exposes an API for reading a person's past
 * conversations, and both desktop apps keep their data in Electron's
 * IndexedDB/LevelDB — binary, undocumented, unsafe to parse. So this is an IMPORT
 * of files the user already has, not a live sync. Claiming otherwise would promise
 * a connection that cannot exist.
 *
 * Four formats, covering everything actually obtainable:
 *   claude_code     — ~/.claude/projects/<dir>/*.jsonl  (Claude Code / Cowork)
 *   claude_export   — conversations.json from claude.ai "Export data"
 *   chatgpt_export  — conversations.json from ChatGPT "Export data"
 *   markdown        — memory files, project instructions, any .md notes
 *
 * THE IMPORTANT DESIGN DECISION: nothing is pasted into the Company Brain.
 *
 * The brain runs on a fixed ~6000-character budget, and a single Claude Code
 * session here is 19,000 records. Dumping history into it would push the operating
 * rules out of the block — precisely the truncation bug fixed earlier. So imports
 * are DISTILLED into brain_learnings, the same store the approval-outcome loop
 * already feeds, and the brain reads a bounded number of those.
 *
 * Everything runs inside Bmapz, on the company's existing Anthropic/OpenAI
 * provider, through the same runAIChat choke point as every other generation.
 */
import crypto from 'node:crypto';
import { supabaseAdmin } from './supabase.js';
import { invalidateCompanyBrain } from './companyBrain.js';

/** Hard caps. A session file can be tens of MB; nothing here may become unbounded. */
const MAX_MESSAGES = 400;        // most recent, per import
const MAX_CHARS_PER_MSG = 1500;
const MAX_BRIEF_CHARS = 24000;   // what we hand the model to distil
const MAX_LESSONS = 12;          // what one import may add to the brain

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/* ── Format detection ───────────────────────────────────────────────────── */

/**
 * Work out which of the three shapes this file is, without trusting its name.
 * A user will upload `export.json` that is really a session log, or rename things.
 */
export function detectFormat(text) {
  const head = text.slice(0, 4000).trim();
  if (!head) return null;

  if (head.startsWith('{')) {
    // A .jsonl session is many objects, one per line — its first line parses but
    // the whole file does not.
    const firstLine = head.split('\n')[0];
    try {
      const j = JSON.parse(firstLine);
      if (j.type && (j.sessionId || j.uuid || j.parentUuid !== undefined)) return 'claude_code';
    } catch { /* fall through */ }
  }
  if (head.startsWith('[')) {
    try {
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) {
        // Both assistants call the file conversations.json, so the NAME tells us
        // nothing — the shape does. ChatGPT stores a `mapping` tree keyed by node
        // id; Claude stores a flat chat_messages array.
        if (arr.some(c => c && typeof c.mapping === 'object')) return 'chatgpt_export';
        if (arr.some(c => c?.chat_messages || c?.messages)) return 'claude_export';
      }
    } catch { /* a truncated array is not usable */ }
  }
  if (/^#|\*\*|^- /m.test(head)) return 'markdown';
  return null;
}

/* ── Extraction ─────────────────────────────────────────────────────────── */

/** Flatten Anthropic message content, which is a string OR an array of blocks. */
function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    // tool_use and tool_result are the bulk of a session and almost none of the
    // meaning — file dumps, diffs, command output. Only prose is kept.
    .filter(b => b?.type === 'text' && typeof b.text === 'string')
    .map(b => b.text)
    .join('\n');
}

/**
 * Claude Code / Cowork session log.
 *
 * Keeps what carries intent and drops what carries volume:
 *  - sidechains are subagent chatter, not the user's thread
 *  - compaction summaries are already distilled and are worth more than raw turns
 *  - transcript-only records are UI furniture
 */
export function parseClaudeCode(text) {
  const out = { title: null, messages: [], summaries: [] };

  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let j;
    try { j = JSON.parse(line); } catch { continue; }

    if ((j.type === 'custom-title' || j.type === 'ai-title') && !out.title) {
      out.title = j.customTitle || j.aiTitle || null;
      continue;
    }
    if (j.isSidechain) continue;
    if (j.type !== 'user' && j.type !== 'assistant') continue;
    if (j.isVisibleInTranscriptOnly) continue;

    const body = textOf(j.message?.content).trim();
    if (!body) continue;

    if (j.isCompactSummary) { out.summaries.push(body.slice(0, 6000)); continue; }

    out.messages.push({
      role: j.type,
      text: body.slice(0, MAX_CHARS_PER_MSG),
      at: j.timestamp || null,
    });
  }
  return out;
}

/** claude.ai "Export data" — an array of conversations with chat_messages[]. */
export function parseClaudeExport(text) {
  let arr;
  try { arr = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(arr)) return [];

  return arr.map(c => ({
    title: c.name || c.title || 'Untitled conversation',
    messages: (c.chat_messages || c.messages || []).map(m => ({
      role: m.sender === 'human' || m.role === 'user' ? 'user' : 'assistant',
      text: String(m.text ?? textOf(m.content) ?? '').slice(0, MAX_CHARS_PER_MSG),
      at: m.created_at || null,
    })).filter(m => m.text.trim()),
    summaries: [],
  })).filter(c => c.messages.length);
}

/**
 * ChatGPT "Export data" — conversations.json.
 *
 * Shaped very differently from Claude's: each conversation is a `mapping` of node
 * id -> { message, parent, children }, i.e. the full branching tree including every
 * regenerated answer. Walking the values and sorting by create_time gives the
 * readable thread without having to reconstruct the branch the user actually kept —
 * a distillation does not need the exact path, only the substance.
 *
 * system and tool authors are dropped: system carries ChatGPT's own custom
 * instructions boilerplate and tool carries code/browser output, neither of which
 * is a durable fact about the business.
 */
export function parseChatGptExport(text) {
  let arr;
  try { arr = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(arr)) return [];

  return arr.map(c => {
    const nodes = Object.values(c.mapping || {});
    const messages = nodes
      .map(n => n?.message)
      .filter(Boolean)
      .filter(m => {
        const role = m.author?.role;
        if (role !== 'user' && role !== 'assistant') return false;
        // Hidden scaffolding ChatGPT injects into its own transcripts.
        if (m.metadata?.is_visually_hidden_from_conversation) return false;
        return true;
      })
      .map(m => {
        const parts = m.content?.parts;
        const body = Array.isArray(parts)
          ? parts.filter(x => typeof x === 'string').join('\n')
          : (typeof m.content?.text === 'string' ? m.content.text : '');
        return {
          role: m.author.role === 'user' ? 'user' : 'assistant',
          text: String(body).slice(0, MAX_CHARS_PER_MSG),
          at: m.create_time ? new Date(m.create_time * 1000).toISOString() : null,
        };
      })
      .filter(m => m.text.trim())
      .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));

    return { title: c.title || 'Untitled conversation', messages, summaries: [] };
  }).filter(c => c.messages.length);
}

/**
 * Turn any parsed source into the brief handed to the model.
 *
 * The most RECENT turns are kept, because a long thread's later half is where the
 * decisions land. Summaries go first: they are pre-distilled and worth more per
 * character than raw turns.
 */
export function buildBrief(conversations) {
  const parts = [];

  for (const c of conversations) {
    parts.push(`\n=== ${c.title || 'Conversation'} ===`);
    for (const s of (c.summaries || []).slice(0, 3)) parts.push(`[earlier summary] ${s}`);

    const recent = (c.messages || []).slice(-MAX_MESSAGES);
    for (const m of recent) parts.push(`${m.role === 'user' ? 'THEM' : 'AI'}: ${m.text}`);
  }

  let brief = parts.join('\n');
  if (brief.length > MAX_BRIEF_CHARS) {
    // Trim from the FRONT: the end of a thread is where conclusions are.
    brief = `…(earlier context trimmed)\n${brief.slice(-MAX_BRIEF_CHARS)}`;
  }
  return brief;
}

/** Normalise any supported file into a list of conversations. */
export function parseAny(text, format) {
  const fmt = format || detectFormat(text);
  if (fmt === 'claude_code') {
    const s = parseClaudeCode(text);
    return { format: fmt, conversations: s.messages.length || s.summaries.length ? [s] : [] };
  }
  if (fmt === 'claude_export') return { format: fmt, conversations: parseClaudeExport(text) };
  if (fmt === 'chatgpt_export') return { format: fmt, conversations: parseChatGptExport(text) };
  if (fmt === 'markdown') {
    return {
      format: fmt,
      conversations: [{
        title: (text.match(/^#\s*(.+)$/m) || [])[1] || 'Notes',
        messages: [{ role: 'user', text: text.slice(0, MAX_BRIEF_CHARS), at: null }],
        summaries: [],
      }],
    };
  }
  return { format: null, conversations: [] };
}

/* ── Distillation ───────────────────────────────────────────────────────── */

const DISTILL_SYSTEM = [
  'You are folding a customer\'s own AI conversation history into their company profile.',
  'Extract only DURABLE facts about the business, its customers, its preferences and its decisions —',
  'the things that would still be true next month and would change how work is done for them.',
  '',
  'Keep: positioning, audience, tone, offers, pricing, constraints, named preferences, standing',
  'decisions, things they explicitly rejected and why.',
  'Discard: one-off debugging, code, tool output, pleasantries, anything about the AI itself,',
  'and anything that is only true inside one task.',
  '',
  'Never invent. If the material does not support a durable fact, return fewer lessons —',
  'an empty list is a valid and useful answer.',
].join('\n');

/**
 * Distil an import into durable lessons, then store them.
 *
 * Returns { lessons, summary }. Never throws on a model hiccup: a failed import
 * must leave a readable record, not a half-written brain.
 */
export async function distillImport({ companyId, userId, importId, brief, label }) {
  const { runAIChat } = await import('../routes/ai.js');

  const result = await runAIChat({
    companyId,
    userId: userId || null,
    userRole: 'user',
    system: DISTILL_SYSTEM,
    messages: [{
      role: 'user',
      content: `Source: ${label || 'imported conversation'}\n\n${brief}\n\n`
        + `Return JSON: { "summary": "<3 sentences on what this material covers>", `
        + `"lessons": [{ "category": "<positioning|audience|tone|offer|process|constraint|other>", `
        + `"lesson": "<one durable fact, max 200 chars>" }] } — at most ${MAX_LESSONS} lessons.`,
    }],
    response_format: { type: 'json_object' },
    action: 'brain_distill',
    // The brain is what we are WRITING to; feeding it back in would have the model
    // restate what it already knows instead of reading the new material.
    skipBrain: true,
    skipArchive: true,
    temperature: 0.2,
    max_tokens: 1600,
  });

  let parsed = {};
  try { parsed = JSON.parse(result?.content ?? '{}'); } catch { parsed = {}; }

  const lessons = Array.isArray(parsed.lessons)
    ? parsed.lessons
      .filter(l => l && typeof l.lesson === 'string' && l.lesson.trim())
      .slice(0, MAX_LESSONS)
      .map(l => ({
        company_id: companyId,
        scope: 'company',
        category: String(l.category || 'other').slice(0, 40),
        lesson: l.lesson.trim().slice(0, 400),
        evidence: `Imported from ${label || 'Claude'}`,
        source_import_id: importId,
      }))
    : [];

  if (lessons.length) {
    const { error } = await supabaseAdmin.from('brain_learnings').insert(lessons);
    if (error) throw new Error(`Could not save what was learned: ${error.message}`);
    // The brain is cached 5 minutes; without this the import appears to do nothing.
    invalidateCompanyBrain(companyId);
  }

  return {
    lessons: lessons.length,
    summary: String(parsed.summary || '').slice(0, 2000) || null,
  };
}

export default { detectFormat, parseAny, buildBrief, distillImport, sha256 };
