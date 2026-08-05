import { useState, useEffect, useCallback } from 'react';

/**
 * usePersistentDraft — like useState, but the value survives navigating away,
 * switching tabs and reloading the page.
 *
 * AI generations used to live in plain useState, so leaving the page threw the
 * work away and the user had to generate again (spending AI credits again).
 * This keeps the last generation exactly where it was produced until the user
 * regenerates or clears it.
 *
 * Storage is localStorage, namespaced per key. Values must be JSON-serialisable.
 * Entries older than maxAgeMs are ignored (and cleaned up) so stale generations
 * don't resurface weeks later.
 */
const PREFIX = 'bmapz_draft:';
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function usePersistentDraft(key, initialValue = null, { maxAgeMs = DEFAULT_MAX_AGE_MS } = {}) {
  const storageKey = `${PREFIX}${key}`;

  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return initialValue;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !('v' in parsed)) return initialValue;
      if (maxAgeMs && parsed.at && Date.now() - parsed.at > maxAgeMs) {
        localStorage.removeItem(storageKey);
        return initialValue;
      }
      return parsed.v;
    } catch {
      // Private mode / quota / corrupt JSON — fall back to in-memory only.
      return initialValue;
    }
  });

  // Track when the stored draft was written, so the UI can say "kept from …".
  const [savedAt, setSavedAt] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw).at ?? null) : null;
    } catch { return null; }
  });

  useEffect(() => {
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(storageKey);
        setSavedAt(null);
        return;
      }
      const at = Date.now();
      localStorage.setItem(storageKey, JSON.stringify({ at, v: value }));
      setSavedAt(at);
    } catch {
      // Storage unavailable or full — the value still works for this session.
    }
  }, [storageKey, value]);

  const clear = useCallback(() => setValue(initialValue), [initialValue]);

  return [value, setValue, { savedAt, clear }];
}

export default usePersistentDraft;
