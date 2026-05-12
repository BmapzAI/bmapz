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
import AIChat from './pages/AIChat';
import Inbox from './pages/Inbox';
import Billing from './pages/Billing';
import Pricing from './pages/Pricing';
import BrandScan from './pages/BrandScan';
import AIOutputs from './pages/AIOutputs';
import Ads from './pages/Ads';
import Blog from './pages/Blog';
import Dashboards from './pages/Dashboards';
import Help from './pages/Help';
import Home from './pages/Home';
import Integrations from './pages/Integrations';
import LeadDetails from './pages/LeadDetails';
import Profile from './pages/Profile';
import SEO from './pages/SEO';
import Sales from './pages/Sales';
import Settings from './pages/Settings';
import SocialMedia from './pages/SocialMedia';
import TextTemplates from './pages/TextTemplates';
import WorkflowAnalytics from './pages/WorkflowAnalytics';
import Workflows from './pages/Workflows';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Inbox": Inbox,
    "AIChat": AIChat,
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