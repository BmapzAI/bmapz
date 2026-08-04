import './App.css';
import { Suspense, useEffect } from 'react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Toaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import NavigationTracker from '@/lib/NavigationTracker';
import { pagesConfig, prefetchCommonRoutes } from './pages.config';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
// Login/Signup are the first thing an unauthenticated visitor needs, so they
// stay eager. Everything else is split into its own chunk and fetched on demand.
import Login from './pages/Login';
import Signup from './pages/Signup';
import AuthCallback from './pages/AuthCallback';

const PrivacyPolicy = lazyWithRetry(() => import('./pages/PrivacyPolicy'), 'PrivacyPolicy');
const DataDeletion = lazyWithRetry(() => import('./pages/DataDeletion'), 'DataDeletion');
const AdminPanel = lazyWithRetry(() => import('./pages/AdminPanel'), 'AdminPanel');
const CompanyAdminPanel = lazyWithRetry(() => import('./pages/CompanyAdminPanel'), 'CompanyAdminPanel');
const Documentation = lazyWithRetry(() => import('./pages/Documentation'), 'Documentation');
const VideoTutorials = lazyWithRetry(() => import('./pages/VideoTutorials'), 'VideoTutorials');
const TermsOfService = lazyWithRetry(() => import('./pages/TermsOfService'), 'TermsOfService');
const Pricing = lazyWithRetry(() => import('./pages/Pricing'), 'Pricing');

import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { LanguageProvider } from '@/components/ui/LanguageContext';
import SupportAssistant from '@/components/layout/SupportAssistant';
import { canSeeDesign } from '@/lib/featureFlags';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const { Pages, Layout, mainPage } = pagesConfig;

/** Shown while a route's chunk is being fetched. */
const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 border-4 border-white/20 border-t-[#38b6ff] rounded-full animate-spin" />
  </div>
);

/**
 * Wraps the routes so a failed screen shows a message instead of a blank page,
 * and clears itself when the user navigates somewhere else.
 */
const RouteErrorBoundary = ({ children }) => {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
};
/**
 * Once the app has rendered successfully, forget any stale-chunk reload we did,
 * then quietly warm the screens people open most so navigation feels instant.
 * Prefetching waits for the browser to be idle so it never competes with the
 * page the user is actually looking at.
 */
const ChunkGuardReset = () => {
  useEffect(() => {
    // NOTE: deliberately does NOT clear the stale-chunk guard. The app shell
    // mounts successfully even when a ROUTE chunk fails, so clearing it here
    // would let a permanently missing chunk reload the page forever. The guard
    // expires on its own after a minute instead.
    const warm = () => { prefetchCommonRoutes(); };
    const id = 'requestIdleCallback' in window
      ? window.requestIdleCallback(warm, { timeout: 4000 })
      : setTimeout(warm, 2500);
    return () => {
      if ('cancelIdleCallback' in window) window.cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, []);
  return null;
};

const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : () => null;

const LayoutWrapper = ({ children, currentPageName }) =>
  Layout ? <Layout currentPageName={currentPageName}>{children}</Layout> : <>{children}</>;

const PublicRoutes = () => (
  <RouteErrorBoundary>
    <Suspense fallback={<RouteFallback />}>
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/Pricing" element={<Pricing />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
      <Route path="/DataDeletion" element={<DataDeletion />} />
      <Route path="/TermsOfService" element={<TermsOfService />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  </RouteErrorBoundary>
);

const AuthenticatedRoutes = ({ currentUser }) => (
  <RouteErrorBoundary>
    <Suspense fallback={<RouteFallback />}>
      <Routes>
    <Route path="/" element={
      <LayoutWrapper currentPageName={mainPageKey}>
        <MainPage />
      </LayoutWrapper>
    } />
    {Object.entries(Pages)
      // Design Studio is confidential: for anyone but an App Owner the route
      // must not exist at all, so a direct URL falls through to Not Found
      // rather than revealing that the section is there.
      .filter(([path]) => path !== 'Design' || canSeeDesign(currentUser))
      .map(([path, Page]) => (
        <Route key={path} path={`/${path}`} element={
          <LayoutWrapper currentPageName={path}>
            <Page />
          </LayoutWrapper>
        } />
      ))}
    <Route path="/login" element={<Navigate to="/" replace />} />
    <Route path="/signup" element={<Navigate to="/" replace />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/PrivacyPolicy" element={<LayoutWrapper currentPageName="PrivacyPolicy"><PrivacyPolicy /></LayoutWrapper>} />
    <Route path="/DataDeletion" element={<DataDeletion />} />
    <Route path="/AdminPanel" element={<LayoutWrapper currentPageName="AdminPanel"><AdminPanel /></LayoutWrapper>} />
    <Route path="/Admin" element={<LayoutWrapper currentPageName="Admin"><AdminPanel /></LayoutWrapper>} />
    <Route path="/CompanyAdminPanel" element={<LayoutWrapper currentPageName="CompanyAdminPanel"><CompanyAdminPanel /></LayoutWrapper>} />
    <Route path="/CompanyAdmin" element={<LayoutWrapper currentPageName="CompanyAdmin"><CompanyAdminPanel /></LayoutWrapper>} />
    <Route path="/Documentation" element={<LayoutWrapper currentPageName="Documentation"><Documentation /></LayoutWrapper>} />
    <Route path="/VideoTutorials" element={<LayoutWrapper currentPageName="VideoTutorials"><VideoTutorials /></LayoutWrapper>} />
    <Route path="/TermsOfService" element={<TermsOfService />} />
      <Route path="/Pricing" element={<Pricing />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  </RouteErrorBoundary>
);

const AppRoutes = () => {
  const { isLoadingAuth, isAuthenticated, authError, dbUser } = useAuth();
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#111]">
        <div className="w-8 h-8 border-4 border-white/20 border-t-[#38b6ff] rounded-full animate-spin" />
      </div>
    );
  }
  if (authError?.type === 'unknown') return <UserNotRegisteredError />;
  if (authError?.type === 'server_error') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-[#111] text-white px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-3xl">⚠️</div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Connection Error</h2>
          <p className="text-gray-400 text-sm max-w-sm">Unable to reach the server. Please check your connection and try again.</p>
          {authError.message && <p className="text-gray-600 text-xs mt-2 font-mono">{authError.message}</p>}
        </div>
        <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-xl bg-[#38b6ff] hover:bg-[#38b6ff]/90 text-white font-medium transition-colors">Retry</button>
      </div>
    );
  }
  if (!isAuthenticated) return <PublicRoutes />;
  // The assistant sits OUTSIDE <Routes> so it survives navigation with its
  // conversation intact — inside the Layout it remounted on every page change.
  return (
    <>
      <AuthenticatedRoutes currentUser={dbUser} />
      <SupportAssistant />
    </>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      {/* One language provider for the whole app. It used to live only inside
          Layout, which wraps authenticated pages — so public pages that call
          useLanguage (Pricing) crashed to a blank screen for logged-out
          visitors, and for logged-in ones too since /Pricing renders outside
          the Layout. */}
      <LanguageProvider>
        <Router>
          <AuthProvider>
            <NavigationTracker />
            <ChunkGuardReset />
            <AppRoutes />
            <Toaster position="top-right" richColors />
          </AuthProvider>
        </Router>
      </LanguageProvider>
    </QueryClientProvider>
  );
}