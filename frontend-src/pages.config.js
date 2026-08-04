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
import { lazyWithRetry } from './lib/lazyWithRetry';

const AIChat = lazyWithRetry(() => import('./pages/AIChat'), 'AIChat');
const AIAutomations = lazyWithRetry(() => import('./pages/AIAutomations'), 'AIAutomations');
const Design = lazyWithRetry(() => import('./pages/Design'), 'Design');
const Inbox = lazyWithRetry(() => import('./pages/Inbox'), 'Inbox');
const TeamChat = lazyWithRetry(() => import('./pages/TeamChat'), 'TeamChat');
const Notifications = lazyWithRetry(() => import('./pages/Notifications'), 'Notifications');
const SDR = lazyWithRetry(() => import('./pages/SDR'), 'SDR');
const Billing = lazyWithRetry(() => import('./pages/Billing'), 'Billing');
const Pricing = lazyWithRetry(() => import('./pages/Pricing'), 'Pricing');
const BrandScan = lazyWithRetry(() => import('./pages/BrandScan'), 'BrandScan');
const AIOutputs = lazyWithRetry(() => import('./pages/AIOutputs'), 'AIOutputs');
const Ads = lazyWithRetry(() => import('./pages/Ads'), 'Ads');
const Blog = lazyWithRetry(() => import('./pages/Blog'), 'Blog');
const Dashboards = lazyWithRetry(() => import('./pages/Dashboards'), 'Dashboards');
const Help = lazyWithRetry(() => import('./pages/Help'), 'Help');
const Home = lazyWithRetry(() => import('./pages/Home'), 'Home');
const Integrations = lazyWithRetry(() => import('./pages/Integrations'), 'Integrations');
const LeadDetails = lazyWithRetry(() => import('./pages/LeadDetails'), 'LeadDetails');
const Profile = lazyWithRetry(() => import('./pages/Profile'), 'Profile');
const SEO = lazyWithRetry(() => import('./pages/SEO'), 'SEO');
const Sales = lazyWithRetry(() => import('./pages/Sales'), 'Sales');
const Settings = lazyWithRetry(() => import('./pages/Settings'), 'Settings');
const SocialMedia = lazyWithRetry(() => import('./pages/SocialMedia'), 'SocialMedia');
const TextTemplates = lazyWithRetry(() => import('./pages/TextTemplates'), 'TextTemplates');
const WorkflowAnalytics = lazyWithRetry(() => import('./pages/WorkflowAnalytics'), 'WorkflowAnalytics');
const Workflows = lazyWithRetry(() => import('./pages/Workflows'), 'Workflows');
// The layout wraps every page, so it stays eagerly loaded.
import __Layout from './Layout.jsx';


export const PAGES = {
    "Inbox": Inbox,
    "TeamChat": TeamChat,
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

/**
 * Warm the chunks people reach for most, once the browser is idle. This makes
 * the first click into a section feel instant without adding anything to the
 * initial download. Failures are ignored — it is only a nicety.
 */
const COMMON_ROUTES = [
    () => import('./pages/Sales'),
    () => import('./pages/Inbox'),
    () => import('./pages/AIChat'),
    () => import('./pages/Workflows'),
];

let warmed = false;
export function prefetchCommonRoutes() {
    if (warmed) return;
    warmed = true;
    for (const load of COMMON_ROUTES) {
        load().catch(() => { /* a warm-up must never surface an error */ });
    }
}