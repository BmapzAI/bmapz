import { lazy } from 'react';

/**
 * React.lazy that survives a failed chunk download.
 *
 * THE BLANK PAGE BUG: every deploy gives the JS chunks new hashed filenames. A
 * user who already had the app open still holds the OLD file list, so the moment
 * they navigate to a screen they had not visited yet, the browser asks for a
 * chunk that no longer exists on the CDN. The import rejects, React.lazy throws,
 * and with no error boundary the whole app renders blank — which is why it
 * "worked again after a refresh".
 *
 * This wrapper:
 *   1. retries the import once (covers a transient network blip), then
 *   2. if it still fails, reloads the page ONCE to pick up the new file list.
 *
 * The reload is recorded in sessionStorage per chunk, so a genuinely broken
 * build can never put the app in a reload loop — the second failure is allowed
 * to reach the error boundary, which shows a real message instead.
 */

const RELOAD_KEY = 'bmapz_chunk_reload';
// A reload attempt only counts as "just tried" for this long, so a genuine new
// deploy later in the same session can still self-heal.
const RELOAD_WINDOW_MS = 60_000;

const isChunkLoadError = (error) => {
  const msg = String(error?.message || error || '');
  return (
    error?.name === 'ChunkLoadError' ||
    /Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(msg)
  );
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function lazyWithRetry(factory, name = 'route') {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      // One quiet retry — most failures here are a dropped request.
      try {
        await sleep(350);
        return await factory();
      } catch (retryError) {
        if (isChunkLoadError(retryError)) {
          let reloaded = {};
          try { reloaded = JSON.parse(sessionStorage.getItem(RELOAD_KEY) || '{}'); } catch { reloaded = {}; }

          // Only reload if we have NOT just tried that for this chunk. The guard
          // is time-based rather than cleared on a successful mount: the app
          // shell mounts fine even when a route chunk fails, so clearing it
          // there would let a permanently-missing chunk reload forever.
          const lastTry = Number(reloaded[name] || 0);
          const recentlyTried = lastTry && (Date.now() - lastTry) < RELOAD_WINDOW_MS;

          if (!recentlyTried) {
            reloaded[name] = Date.now();
            try { sessionStorage.setItem(RELOAD_KEY, JSON.stringify(reloaded)); } catch { /* private mode */ }
            // The app on screen is stale; fetch the new index.html and assets.
            window.location.reload();
            // Keep the promise pending so nothing renders during the reload.
            return await new Promise(() => {});
          }
        }
        throw retryError;
      }
    }
  });
}

/** Kept for callers that want to forget past attempts (e.g. a manual retry). */
export function clearChunkReloadGuard() {
  try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* ignore */ }
}
