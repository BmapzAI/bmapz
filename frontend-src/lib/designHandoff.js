/**
 * Design Studio → Blog / Social / Ads handoff.
 *
 * The Design page exports slides as PNGs (uploaded to storage), writes a
 * handoff record here, and navigates to the target section. The target page
 * calls consumeDesignHandoff() on mount and attaches the images.
 */
const KEY = 'bmapz_design_handoff';
const RETURN_KEY = 'bmapz_design_return';
const TTL_MS = 5 * 60 * 1000;
const DRAFT_TTL_MS = 60 * 60 * 1000; // drafts live longer — designing can take a while

export function setDesignHandoff({ target, urls, name, draft }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ target, urls, name, draft: draft || null, at: Date.now() }));
  } catch { /* storage full/blocked — handoff just won't happen */ }
}

/**
 * Read-and-clear the handoff if it targets `target` and is fresh.
 * Returns { urls, name, draft } or null. `draft` is the section's saved
 * work-in-progress (post/creatives state) captured before the user left
 * for the Design Studio — restore it so nothing they typed is lost.
 */
export function consumeDesignHandoff(target) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.target !== target) return null;
    localStorage.removeItem(KEY);
    if (Date.now() - (data.at || 0) > TTL_MS) return null;
    return { urls: data.urls || [], name: data.name || 'Design', draft: data.draft || null };
  } catch {
    return null;
  }
}

/**
 * Called by Social/Blog/Ads BEFORE navigating to /Design: remembers where the
 * user came from and their in-progress draft. The Design page shows a
 * "Send back to your <section> draft" action; on send, the draft rides along
 * in the handoff so the origin page restores it with the images attached.
 */
export function saveDesignReturn(source, draft, label, brief) {
  try {
    localStorage.setItem(RETURN_KEY, JSON.stringify({ source, draft: draft || null, label: label || null, brief: brief || null, at: Date.now() }));
  } catch { /* non-fatal */ }
}

/**
 * Normalize the different AI design-brief shapes (Social / Ads single / Ads A-B)
 * into one flat payload the Design Studio can consume.
 */
export function normalizeBrief(raw, source) {
  if (!raw) return null;
  return {
    source,
    concept: raw.concept || raw.visual_concept || '',
    headline: raw.headline || '',
    subheadline: raw.subheadline || '',
    visual_concept: raw.visual_concept || raw.concept || '',
    color_palette: raw.color_palette || [],
    typography: raw.typography || raw.typography_suggestion || '',
    mood: raw.mood || '',
    image_style: raw.image_style || '',
    do_list: raw.do_list || [],
    dont_list: raw.dont_list || [],
    cta: raw.cta || '',
    image_prompt: raw.ai_image_prompt || raw.image_prompt || '',
    label: raw._label || null,
  };
}

/** Turn a normalized brief into a ready-to-use AI image prompt. */
export function briefToPrompt(b) {
  if (!b) return '';
  const parts = [
    b.image_prompt || b.visual_concept || b.concept,
    b.image_style ? `Style: ${b.image_style}` : null,
    b.mood ? `Mood: ${b.mood}` : null,
    b.color_palette?.length ? `Color palette: ${b.color_palette.join(', ')}` : null,
    b.do_list?.length ? `Must include: ${b.do_list.slice(0, 4).join('; ')}` : null,
    b.dont_list?.length ? `Avoid: ${b.dont_list.slice(0, 4).join('; ')}` : null,
  ].filter(Boolean);
  return parts.join('. ');
}

/** Design page: peek at the pending return context (without clearing). */
export function peekDesignReturn() {
  try {
    const raw = localStorage.getItem(RETURN_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - (data.at || 0) > DRAFT_TTL_MS) { localStorage.removeItem(RETURN_KEY); return null; }
    return data;
  } catch {
    return null;
  }
}

export function clearDesignReturn() {
  try { localStorage.removeItem(RETURN_KEY); } catch { /* non-fatal */ }
}
