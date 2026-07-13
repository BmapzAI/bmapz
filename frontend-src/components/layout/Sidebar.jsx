import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/components/ui/LanguageContext';
import { cn } from '@/lib/utils';
import {
  ChevronLeft, ChevronRight, LogOut,
  LayoutDashboard, Users, MessageSquare, Bot, GitBranch,
  Megaphone, Search, Share2, BookOpen, ScanLine,
  Sparkles, FileText, BarChart3, Clock, Palette, TrendingUp,
  Plug, HelpCircle, User, Settings as SettingsIcon,
  Building2, Shield,
} from 'lucide-react';

/**
 * User avatar: shows profile_picture if available, otherwise initials on a
 * gradient circle. Used in the sidebar footer.
 */
function UserAvatar({ user, size = 36 }) {
  const initials = (user?.full_name || user?.email || '?')
    .split(/\s+/)
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const dim = { width: size, height: size, minWidth: size };

  if (user?.profile_picture) {
    return (
      <img
        src={user.profile_picture}
        alt={user.full_name || user.email}
        className="rounded-full object-cover border border-white/10 flex-shrink-0"
        style={dim}
        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-gradient-to-br from-[#3572b9] to-[#cb6ce6] flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
      style={dim}
    >
      {initials}
    </div>
  );
}

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
  const { t, isPt } = useLanguage();

  const agentName = company?.personal_agent_name || t('aiChat');

  const NAV_SECTIONS = [
    {
      label: null,
      items: [
        { name: t('home'),      path: '/',          icon: LayoutDashboard },
        { name: t('sales'),     path: '/Sales',     icon: Users           },
        { name: t('inbox'),     path: '/Inbox',     icon: MessageSquare   },
        { name: agentName,      path: '/AIChat',    icon: Bot             },
        { name: t('workflows'), path: '/Workflows', icon: GitBranch       },
      ],
    },
    {
      label: t('marketing'),
      items: [
        { name: t('ads'),           path: '/Ads',         icon: Megaphone },
        { name: 'SEO',              path: '/SEO',         icon: Search    },
        { name: t('socialMedia'),   path: '/SocialMedia', icon: Share2    },
        { name: t('blog'),          path: '/Blog',        icon: BookOpen  },
        { name: isPt ? 'Design' : 'Design', path: '/Design', icon: Palette },
        { name: t('brandScan'),     path: '/BrandScan',   icon: ScanLine  },
      ],
    },
    {
      label: t('contentAndAI'),
      items: [
        { name: isPt ? 'Automações de IA' : 'AI Automations', path: '/AIAutomations', icon: Clock },
        { name: t('aiOutputs'),      path: '/AIOutputs',     icon: Sparkles  },
        { name: t('textTemplates'),  path: '/TextTemplates', icon: FileText  },
        { name: t('dashboardsTitle'),path: '/Dashboards',    icon: BarChart3 },
        { name: 'Insights',          path: '/WorkflowAnalytics', icon: TrendingUp },
      ],
    },
    {
      label: t('tools'),
      items: [
        { name: t('integrations'), path: '/Integrations', icon: Plug       },
        { name: t('help'),         path: '/Help',         icon: HelpCircle },
      ],
    },
  ];

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
      {/* Logo - always Bmapz AI brand. Clicking navigates home. */}
      <Link
        to="/"
        className="flex items-center gap-3 px-4 py-5 border-b border-white/10 flex-shrink-0 hover:bg-white/5 transition-colors"
        title="Home"
      >
        <img
          src="/bmapz-logo.png"
          alt="Bmapz AI"
          className="w-8 h-8 rounded-lg object-contain flex-shrink-0"
          onError={(e) => {
            // Fallback gradient square if the logo file isn't deployed yet
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'block';
          }}
        />
        <div
          className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#38b6ff] to-[#cb6ce6] flex-shrink-0"
          style={{ display: 'none' }}
        />
        {!collapsed && (
          <span className="font-bold text-white text-lg tracking-tight truncate">
            Bmapz AI
          </span>
        )}
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            <SectionLabel label={section.label} collapsed={collapsed} />
            {section.items.map((item) => (
              <NavItem
                key={item.path}
                path={item.path}
                icon={item.icon}
                name={item.name}
                collapsed={collapsed}
                isActive={isActive(item.path)}
              />
            ))}
          </div>
        ))}

        <SectionLabel label={t('account')} collapsed={collapsed} />
        <NavItem path="/Profile"  icon={User}         name={t('profile')}   collapsed={collapsed} isActive={isActive('/Profile')}  />
        <NavItem path="/Settings" icon={SettingsIcon} name={t('settings')}  collapsed={collapsed} isActive={isActive('/Settings')} />

        {isCompanyAdmin && (
          <>
            <SectionLabel label={t('admin')} collapsed={collapsed} />
            <NavItem path="/CompanyAdminPanel" icon={Building2} name={t('companyAdmin')} collapsed={collapsed} isActive={isActive('/CompanyAdminPanel')} />
          </>
        )}
        {isAdmin && (
          <NavItem path="/AdminPanel" icon={Shield} name={t('systemAdmin')} collapsed={collapsed} isActive={isActive('/AdminPanel')} />
        )}
      </nav>

      {/* User profile + Sign Out */}
      <div className="border-t border-white/10 px-2 py-3 flex-shrink-0">
        {dbUser && (
          collapsed ? (
            <Link to="/Profile" className="flex justify-center mb-2 hover:opacity-80 transition-opacity" title={dbUser.full_name || dbUser.email}>
              <UserAvatar user={dbUser} size={32} />
            </Link>
          ) : (
            <Link to="/Profile" className="flex items-center gap-3 px-2 py-2 mb-1 rounded-lg hover:bg-white/5 transition-colors">
              <UserAvatar user={dbUser} size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium truncate">{dbUser.full_name || dbUser.email}</p>
                <p className="text-white/40 text-xs truncate">{dbUser.email}</p>
              </div>
            </Link>
          )
        )}
        <button
          onClick={() => logout(true)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200',
            collapsed ? 'justify-center' : ''
          )}
          title={collapsed ? t('signOut') : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">{t('signOut')}</span>}
        </button>
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-[#1a1a1a] border border-white/20 flex items-center justify-center text-white/50 hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}