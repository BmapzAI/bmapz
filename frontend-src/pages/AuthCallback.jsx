/**
 * AuthCallback — handles Supabase OAuth redirects and email confirmation links.
 *
 * Supabase redirects to /auth/callback with a code in the URL fragment/query.
 * The Supabase client picks it up automatically via detectSessionInUrl: true.
 * We just wait for the session to resolve, then redirect home.
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

    const handleCallback = async () => {
      try {
        // Exchange the code in the URL for a session
        // (Supabase does this automatically when detectSessionInUrl is true,
        //  but we call exchangeCodeForSession explicitly for reliability)
        const { searchParams } = new URL(window.location.href);
        const code = searchParams.get('code');

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }

        // Check if this is an OAuth popup (opened by ConnectIntegrationModal)
        // The popup's URL will have an `origin` query param set by the backend
        const type = searchParams.get('type');   // integration type (e.g. 'google_ads')
        const isIntegrationOAuth = !!type;

        if (isIntegrationOAuth && window.opener) {
          // Notify the parent window that OAuth succeeded
          window.opener.postMessage({ type: 'oauth_success', integration: type }, '*');
          window.close();
          return;
        }

        // Regular sign-in / email confirmation — redirect to home
        navigate('/', { replace: true });
      } catch (err) {
        console.error('[AuthCallback] error:', err);
        // On failure, send to login with an error hint
        navigate('/login?error=callback_failed', { replace: true });
      }
    };

    handleCallback();
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
