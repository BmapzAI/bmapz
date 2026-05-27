/**
 * AuthCallback — handles Supabase OAuth redirects and email confirmation links.
 *
 * Supabase redirects to /auth/callback with a code in the URL fragment/query.
 * The Supabase client picks it up automatically via detectSessionInUrl: true
 * (PKCE code exchange happens in the client constructor / onAuthStateChange).
 * We must NOT call exchangeCodeForSession here — doing so causes a double-
 * exchange which invalidates the PKCE code and results in no session.
 *
 * Strategy: listen for onAuthStateChange. If we get SIGNED_IN, go home.
 * If nothing arrives within the timeout, try a manual exchange as fallback.
 *
 * For OAuth popups (ConnectIntegrationModal), the popup sends a postMessage
 * to the opener rather than doing a full redirect.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const { searchParams } = new URL(window.location.href);
    const type = searchParams.get('type');   // integration type (e.g. 'google_ads')
    const code = searchParams.get('code');

    // ── Integration OAuth popup path ──────────────────────────────────────────
    if (type && window.opener) {
      window.opener.postMessage({ type: 'oauth_success', integration: type }, '*');
      window.close();
      return;
    }

    // ── Regular sign-in / email confirmation ──────────────────────────────────
    // detectSessionInUrl: true causes Supabase to exchange the PKCE code
    // automatically when the client initialises on this page.  We simply wait
    // for the resulting SIGNED_IN event and then navigate home.
    // A short timeout acts as a safety net (e.g. email magic-link with no code).

    let unsubscribe = () => {};
    let timer;

    const cleanup = () => {
      clearTimeout(timer);
      unsubscribe();
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        cleanup();
        navigate('/', { replace: true });
      } else if (event === 'SIGNED_OUT') {
        // Code was already used or expired — fall back to login
        cleanup();
        navigate('/login?error=callback_failed', { replace: true });
      }
    });
    unsubscribe = () => subscription.unsubscribe();

    // Fallback: if no auth event fires in 8 s, try explicit exchange then redirect
    timer = setTimeout(async () => {
      unsubscribe();
      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            navigate('/', { replace: true });
            return;
          }
        } catch (_e) { /* fall through to login redirect */ }
      }
      navigate('/login?error=callback_failed', { replace: true });
    }, 8000);

    return cleanup;
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-4 border-white/20 border-t-[#38b6ff] rounded-full animate-spin mx-auto" />
        <p className="text-gray-400 text-sm">Completing sign-in…</p>
      </div>
    </div>
  );
}
