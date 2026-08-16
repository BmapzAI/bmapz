import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

/**
 * Shared client options.
 *
 * `realtime.transport` is what keeps this process alive. createClient ALWAYS
 * constructs a RealtimeClient — even though this backend never opens a realtime
 * channel — and newer @supabase/realtime-js throws at construction when it cannot
 * find a WebSocket implementation. Native WebSocket only arrives in Node 22, so on
 * 18 AND 20 the process died at import, before a single route was mounted.
 *
 * Installing `ws` alone is not enough: realtime-js requires it handed over
 * explicitly, which is exactly what its own error message asks for.
 */
const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws },
};

// Service-role client — bypasses RLS, for backend operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, clientOptions);

// Anon client — for verifying JWTs from the frontend
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, clientOptions);

export default supabaseAdmin;
