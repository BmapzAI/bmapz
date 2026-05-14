import './App.css';
import { Toaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import NavigationTracker from '@/lib/NavigationTracker';
import { pagesConfig } from './pages.config';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import PrivacyPolicy from './pages/PrivacyPolicy';
import DataDeletion from './pages/DataDeletion';
import AdminPanel from './pages/AdminPanel';
import CompanyAdminPanel from './pages/CompanyAdminPanel';
import Documentation from './pages/Documentation';
import VideoTutorials from './pages/VideoTutorials';
import TermsOfService from './pages/TermsOfService';
import Pricing from './pages/Pricing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AuthCallback from './pages/AuthCallback';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : () => null;

const LayoutWrapper = ({ children, currentPageName }) =>
  Layout ? <Layout currentPageName={currentPageName}>{children}</Layout> : <>{children}</>;

// ─── Public routes (no auth required) ────────────────────────────────────────
const PublicRoutes = () => (
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
);

// ─── Authenticated app routes ─────────────────────────────────────────────────
const AuthenticatedRoutes = () => (
  <Routes>
    <Route path="/" element={
      <LayoutWrapper currentPageName={mainPageKey}>
        <MainPage />
      </LayoutWrapper>
    } />

    {Object.entries(Pages).map(([path, Page]) => (
      <Route key={path} path={`/${path}`} element={
        <LayoutWrapper currentPageName={path}>
          <Page />
        </LayoutWrapper>
      } />
    ))}

    {/* Auth pages redirect to home when already logged in */}
    <Route path="/login" element={<Navigate to="/" replace />} />
    <Route path="/signup" element={<Navigate to="/" replace />} />

    {/* Auth callback can still be hit after OAuth */}
    <Route path="/auth/callback" element={<AuthCallback />} />

    {/* Public static pages */}
    <Route path="/PrivacyPolicy" element={<LayoutWrapper currentPageName="PrivacyPolicy"><PrivacyPolicy /></LayoutWrapper>} />
    <Route path="/DataDeletion" element={<DataDeletion />} />
    <Route path="/AdminPanel" element={<LayoutWrapper currentPageName="AdminPanel"><AdminPanel /></LayoutWrapper>} />
    <Route path="/CompanyAdminPanel" element={<LayoutWrapper currentPageName="CompanyAdminPanel"><CompanyAdminPanel /></LayoutWrapper>} />
    <Route path="/Documentation" element={<LayoutWrapper currentPageName="Documentation"><Documentation /></LayoutWrapper>} />
    <Route path="/VideoTutorials" element={<LayoutWrapper currentPageName="VideoTutorials"><VideoTutorials /></LayoutWrapper>} />
    <Route path="/TermsOfService" element={<LayoutWrapper currentPageName="TermsOfService"><TermsOfService /></LayoutWrapper>} />
    <Route path="/Pricing" element={<Pricing />} />
    <Route path="/pricing" element={<Pricing />} />

    <Route path="*" element={<PageNotFound />} />
  </Routes>
);

// ─── Root auth guard ──────────────────────────────────────────────────────────
const AppRoutes = () => {
  const { isLoadingAuth, isAuthenticated, authError } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#111]">
        <div className="w-8 h-8 border-4 border-white/20 border-t-[#38b6ff] rounded-full animate-spin" />
      </div>
    );
  }

  if (authError?.type === 'unknown') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated) {
    return <PublicRoutes />;
  }

  return <AuthenticatedRoutes />;
};

// ─── App root ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AppRoutes />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
