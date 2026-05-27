import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { api, apiFetch } from '@/api/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadProfile = useCallback(async (session) => {
    if (!session) {
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
    } catch (err) {
      console.error('[AuthContext] loadProfile error:', err);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoadingAuth(true);
      loadProfile(session);
    });
    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signInWithGoogle = async () => {
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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  };

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
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
