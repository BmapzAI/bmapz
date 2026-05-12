import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Tracks page navigation — logs to console in dev, no-op in production
export default function NavigationTracker() {
  const location = useLocation();
  const previousPath = useRef(null);

  useEffect(() => {
    const pageName = location.pathname.split('/')[1] || 'home';
    if (pageName !== previousPath.current) {
      previousPath.current = pageName;
      if (import.meta.env.DEV) {
        console.debug('[Nav]', location.pathname);
      }
    }
  }, [location]);

  return null;
}
