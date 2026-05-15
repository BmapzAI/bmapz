import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import {
  ChevronLeft, ChevronRight, LogOut,
  LayoutDashboard, Users, MessageSquare, Bot, GitBranch,
  Megaphone, Search, Share2, BookOpen, ScanLine,
  Sparkles, FileText, BarChart3,
  Plug, HelpCircle, User, Settings as SettingsIcon,
  Building2, Shield,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { name: 'Home',      path: '/',          icon: LayoutDashboard },
      { name: 'Sales',     path: '/Sales',     icon: Users           },
      { name: 'Inbox',     path: '/Inbox',     icon: MessageSquare   },
      { name: 'AI Chat',   path: '/AIChat',    icon: Bot             },
      { name: 'Workflows', path: '/Workflows', icon: GitBranch       },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { name: 'Ads',          path: '/Ads',         icon: Megaphone },
      { name: 'SEO',          path: '/SEO',         icon: Search    },
      { name: 'Social Media', path: '/SocialMedia', icon: Share2    },
      { name: 'Blog',         path: '/Blog',        icon: BookOpen  },
      { name: 'Brand Scan',   path: '/BrandScan',   icon: ScanLine  },
    ],
  },
  {
    label: 'Content & AI',
    items: [
      { name: 'AI Outputs',      path: '/AIOutputs',      icon: Sparkles  },
      { name: 'Text Templates',  path: '/TextTemplates',  icon: FileText  },
      { name: 'Dashboards',      path: '/Dashboards',     icon: BarChart3 },
    ],
  },
  {
    label: 'Tools',
    items: [
      { name: 'Integrations', path: '/Integrations', icon: Plug       },
      { name: 'Help',         path: '/Help',         icon: HelpCircle },
    ],
  },
];

function SectionLabel({ label, collapsed }) {
  if (!label || collapsed) return null;
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-white/25 uppercase tracking-wider select-none">
      {label}
    </p>
  );
}

function NavItem({ path, icon: Icon, name, collapsed, isActive }) {
  return (
    <Link
      to={path}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
        isActive
          ? 'bg-[#38b6ff]/10 text-[#38b6ff] border border-[#38b6ff]/20'
          : 'text-white/60 hover:text-white hover:bg-white/5'
      )}
      title={collapsed ? name : undefined}
    >
      {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
      {!collapsed && <span className="text-sm font-medium truncate">{name}</span>}
    </Link>
  );
}

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const { dbUser, company, logout, isAdmin, isCompanyAdmin } = useAuth();

  const handleSignOut = () => logout(true);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-full z-40 bg-[#0f0f0f] border-r border-white/10 flex flex-col transition-all duration-300',
        'hidden md:flex',
        collapsed ? 'w-[72px]' : 'w-[240px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#38b6ff] to-[#cb6ce6] flex-shrink-0" />
        {!collapsed && (
          <span className="font-bold text-white text-lg tracking-tight truncate">
            {company?.personal_agent_name || 'Bmapz AI'}
          </span>
        )}
      </div>

  