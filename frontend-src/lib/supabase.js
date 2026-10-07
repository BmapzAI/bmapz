import { createClient } from '@supabase/supabase-js';

// Inside the app the session lives in the phone's own preferences store (SharedPreferences / UserDefaults), reached through the plugin the
// native shell injects, not in the WebView's localStorage: iOS can evict that under storage pressure, which silently signs people out.
// The website keeps the default (localStorage). If the plugin is not in this build the default is used too, so sign-in never breaks.
function nativeSessionStorage() {
  const prefs = typeof window !== 'undefined' ? window.Capacitor?.Plugins?.Preferences : undefined;
  if (!prefs) return undefined;
  return {
    getItem: async (key) => (await prefs.get({ key })).value ?? null,
    setItem: async (key, value) => { await prefs.set({ key, value }); },
    removeItem: async (key) => { await prefs.remove({ key }); },
  };
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
}

const nativeStorage = nativeSessionStorage();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    ...(nativeStorage ? { storage: nativeStorage } : {}),
  },
});

export default supabase;
