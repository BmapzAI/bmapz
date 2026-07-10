/**
 * Design Studio → Blog / Social / Ads handoff.
 *
 * The Design page exports slides as PNGs (uploaded to storage), writes a
 * handoff record here, and navigates to the target section. The target page
 * calls consumeDesignHandoff() on mount and attaches the images.
 */
const KEY = 'bmapz_design_handoff';
const TTL_MS = 5 * 60 * 1000;

export function setDesignHandoff({ target, urls, name }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ target, urls, name, at: Date.now() }));
  } catch { /* storage full/blocked — handoff just won't happen */ }
}

/**
 * Read-and-clear the handoff if it targets `target` and is fresh.
 * Returns { urls, name } or null.
 */
export function consumeDesignHandoff(target) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.target !== target) return null;
    localStorage.removeItem(KEY);
    if (Date.now() - (data.at || 0) > TTL_MS) return null;
    return { urls: data.urls || [], name: data.name || 'Design' };
  } catch {
    return null;
  }
}
