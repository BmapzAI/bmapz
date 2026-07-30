/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
/*
 * Pages are loaded LAZILY (route-level code splitting). Importing all 25 pages
 * eagerly put every screen — plus their heavy dependencies (charts, PDF export,
 * canvas, rich text) — into one ~3.2 MB bundle that every visitor downloaded
 * before seeing anything. Each page is now its own chunk, fetched on first use.
 * App.jsx renders them inside a <Suspense> boundary.
 */
import { lazy } from 'react';

const AIChat = lazy(() => import('./pages/AIChat'));
const AIAutomations = lazy(() => import('./pages/AIAutomations'));
const Design = lazy(() => import('./pages/Design'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Notifications = lazy(() => import('./pages/Notifications'));
const SDR = lazy(() => import('./pages/SDR'));
const Billing = lazy(() => import('./pages/Billing'));
const Pricing = lazy(() => import('./pages/Pricing'));
const BrandScan = lazy(() => import('./pages/BrandScan'));
const AIOutputs = lazy(() => import('./pages/AIOutputs'));
const Ads = lazy(() => import('./pages/Ads'));
const Blog = lazy(() => import('./pages/Blog'));
const Dashboards = lazy(() => import('./pages/Dashboards'));
const Help = lazy(() => import('./pages/Help'));
const Home = lazy(() => import('./pages/Home'));
const Integrations = lazy(() => import('./pages/Integrations'));
const LeadDetails = lazy(() => import('./pages/LeadDetails'));
const Profile = lazy(() => import('./pages/Profile'));
const SEO = lazy(() => import('./pages/SEO'));
const Sales = lazy(() => import('./pages/Sales'));
const Settings = lazy(() => import('./pages/Settings'));
const SocialMedia = lazy(() => import('./pages/SocialMedia'));
const TextTemplates = lazy(() => import('./pages/TextTemplates'));
const WorkflowAnalytics = lazy(() => import('./pages/WorkflowAnalytics'));
const Workflows = lazy(() => import('./pages/Workflows'));
// The layout wraps every page, so it stays eagerly loaded.
import __Layout from './Layout.jsx';


export const PAGES = {
    "Inbox": Inbox,
    "AIChat": AIChat,
    "AIAutomations": AIAutomations,
    "Design": Design,
    "Notifications": Notifications,
    "SDR": SDR,
    "Billing": Billing,
    "Pricing": Pricing,
    "BrandScan": BrandScan,
    "AIOutputs": AIOutputs,
    "Ads": Ads,
    "Blog": Blog,
    "Dashboards": Dashboards,
    "Help": Help,
    "Home": Home,
    "Integrations": Integrations,
    "LeadDetails": LeadDetails,
    "Profile": Profile,
    "SEO": SEO,
    "Sales": Sales,
    "Settings": Settings,
    "SocialMedia": SocialMedia,
    "TextTemplates": TextTemplates,
    "WorkflowAnalytics": WorkflowAnalytics,
    "Workflows": Workflows,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};