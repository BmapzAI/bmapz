import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { api, apiFetch } from '@/api/apiClient';
import { isNativeApp } from '@/lib/platform';
import { authEventPlan } from '@/lib/authEvents';

// The links in e-mails (sign-up confirmation) must open on the website: the app's own origin (capacitor://localhost or https://localhost) is not a page any mail client can open.
const WEB_APP_URL = import.meta.env.VITE_APP_URL || 'https://ai.bmapz.com';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  // Who is on screen right now, so a repeat "signed in" announcement for the same person does not reset the whole app.
  const loadedUserId = useRef(null);

  const loadProfile = useCallback(async (session, { silent = false } = {}) => {
    if (!session) {
      loadedUserId.current = null;
      setUser(null); setDbUser(null); setCompany(null);
      setIsLoadingAuth(false);
      return;
    }
    try {
      setUser(session.user);
      const { user: dbU, company: co } = await apiFetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setDbUser(dbU); setCompany(co); setAuthError(null);
      loadedUserId.current = session.user.id;
      // A sales team member who signs in becomes available for leads again
      // (unless they deliberately set themselves Offline).
      if (dbU?.is_sales_team) {
        api.patch('/api/users/me/presence', { connected: true }).catch(() => {});
      }
    } catch (err) {
      console.error('[AuthContext] loadProfile error:', err);
      // A quiet refresh that fails (no signal) must not replace a working app with an error screen.
      if (silent) return;
      const msg = err.message || '';
      if (msg.includes('403') || msg.toLowerCase().includes('not registered') || msg.toLowerCase().includes('complete registration')) {
        setAuthError({ type: 'unknown', message: msg });
      } else {
        setAuthError({ type: 'server_error', message: msg });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { loadProfile(session); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const plan = authEventPlan({ event, sessionUserId: session?.user?.id, loadedUserId: loadedUserId.current });
      if (!plan.reload) return;
      if (plan.spinner) setIsLoadingAuth(true);
      loadProfile(session, { silent: plan.silent });
    });
    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signInWithGoogle = async () => {
    // This redirect flow cannot work inside the app (its origin is not a page Google or Supabase can send the browser back to).
    // The app signs in through the phone's account picker instead (lib/nativeAuth.js, shown by GoogleSignInButton).
    if (isNativeApp()) throw new Error('Use the Continue with Google button.');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw error;
    return data;
  };

  const signUp = async ({ email, password, full_name, company_name }) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name, company_name },
        emailRedirectTo: `${isNativeApp() ? WEB_APP_URL : window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  };

  const logout = async (shouldRedirect = true) => {
    // Drop to Stand by BEFORE signing out (the request needs a valid token), so
    // new leads stop being routed to someone who has left and the SDR picks them
    // up instead.
    if (dbUser?.is_sales_team) {
      await api.patch('/api/users/me/presence', { connected: false }).catch(() => {});
    }
    // On the phone, sign out of THIS device only: the default scope is global and would also end the person's session on their computer.
    await supabase.auth.signOut(isNativeApp() ? { scope: 'local' } : undefined);
    api.post('/api/auth/logout').catch(() => {});
    setUser(null); setDbUser(null); setCompany(null);
    if (shouldRedirect) window.location.href = '/';
  };

  const navigateToLogin = () => { window.location.href = '/login'; };

  const refreshCompany = useCallback(async () => {
    try {
      const co = await api.get('/api/companies/current');
      setCompany(co);
      return co;
    } catch (_e) { /* silently ignore — company stays as last fetched value */ }
  }, []);

  const updateCompany = useCallback(async (updates) => {
    const updated = await api.patch('/api/companies/current', updates);
    setCompany(updated);
    return updated;
  }, []);

  const isAuthenticated = !!user;
  const isAdmin = dbUser?.role === 'system_admin' || dbUser?.role === 'owner';
  const isCompanyAdmin = ['owner', 'system_admin', 'company_admin'].includes(dbUser?.role);

  return (
    <AuthContext.Provider value={{
      user, dbUser, company, isLoadingAuth, authError,
      isAuthenticated, isAdmin, isCompanyAdmin,
      signIn, signInWithGoogle, signUp, logout,
      navigateToLogin, refreshCompany, updateCompany,
      setCompany, setDbUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
