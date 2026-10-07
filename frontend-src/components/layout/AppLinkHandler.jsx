import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isNativeApp, nativePlugin, onAppUrlOpen } from '@/lib/platform';
import { isOauthFlowActive } from '@/lib/oauthConnect';
import { statusOfAppLink } from '@/lib/oauthState';

/**
 * Takes the bmapz://oauth link the system browser sends after a connect, for the cases where no dialog is waiting for it: the app was in the
 * background and Android/iOS killed it while the person signed in, or the link is what launched the app. It sends them to the Integrations page,
 * which asks the server whether the connection exists (the link is only a hint) and says so. While a connect dialog IS waiting, that flow takes
 * the link itself (lib/oauthConnect.js) and this stays out of its way. Renders nothing; does nothing on the website.
 */
export default function AppLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return undefined;

    const handle = (url) => {
      const status = statusOfAppLink(url);
      if (!status || isOauthFlowActive()) return;
      let integration = '';
      try { integration = new URL(String(url)).searchParams.get('integration') || ''; } catch { /* handled by statusOfAppLink */ }
      navigate(`/Integrations?oauth=${status}&provider=${encodeURIComponent(integration.slice(0, 40))}`);
    };

    const off = onAppUrlOpen(handle);
    // When the link is what LAUNCHED the app, the "opened" event can fire before this listener exists: ask for the launch URL too.
    try {
      Promise.resolve(nativePlugin('App').getLaunchUrl())
        .then((launch) => { if (launch?.url) handle(launch.url); })
        .catch(() => {});
    } catch { /* the App plugin is not in this build */ }
    return off;
  }, [navigate]);

  return null;
}
