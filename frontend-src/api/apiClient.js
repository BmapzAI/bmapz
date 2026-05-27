/**
 * Bmapz API Client
 * Replaces @base44/sdk — all calls go to our Express.js backend.
 */

import { supabase } from '@/lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Returns the current user's JWT for Authorization header.
 */
async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Core fetch wrapper — attaches auth header, handles JSON, throws on error.
 */
export async function apiFetch(path, options = {}) {
  const token = await getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `API error ${response.status}`;
    let errorCode = null;
    let errorDetails = null;
    try {
      const body = await response.json();
      errorMsg = body.error || body.message || errorMsg;
      errorCode = body.code || null;
      errorDetails = body.details || null;
    } catch (_e) { /* use the default errorMsg */ }
    const err = new Error(errorMsg);
    if (errorCode) err.code = errorCode;
    if (errorDetails) err.details = errorDetails;
    err.status = response.status;
    throw err;
  }

  // 204 No Content
  if (response.status === 204) return null;

  return response.json();
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

export const api = {
  get: (path, params) => {
    const url = params
      ? `${path}?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null)))}`
      : path;
    return apiFetch(url, { method: 'GET' });
  },
  post: (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: (path, body) => apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => apiFetch(path, { method: 'DELETE' }),
};

export default api;
