/**
 * App configuration — replaces Base44 app-params.js
 */
export const appParams = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  appName: 'Bmapz AI',
  version: '1.0.0',
};

export default appParams;
