import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { pagesConfig } from '@/pages.config';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const { dbUser, company, logout } = useAuth();

  const handleSignOut = () => logout(true);

  const visiblePages = pagesConfig.filter(p => !p.hidden);

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-full z-40 bg-[#0f0f0f] border-r border-white/10 flex flex-col transition-all duration-300',
        'hidden md:flex',
        collapsed ? 'w-[72px]' : 'w-[240px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#38b6ff] to-[#cb6ce6] flex-shrink-0" />
        {!collapsed && (
          <span className="font-bold text-white text-lg tracking-tight">
            {company?.personal_agent_name || 'Bmapz AI'}
          </span>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {visiblePages.map((page) => {
          const Icon = page.icon;
          const isActive = location.pathname === page.path || location.pathname.startsWith(page.path + '/');
          return (
            <Link
              key={page.path}
              to={page.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                isActive
                  ? 'bg-[#38b6ff]/10 text-[#38b6ff] border border-[#38b6ff]/20'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
              title={collapsed ? page.name : undefined}
            >
              {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
              {!collapsed && <span className="text-sm font-medium truncate">{page.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User + sign out */}
      <div className="border-t border-white/10 p-3">
        {!collapsed && dbUser && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#38b6ff] to-[#cb6ce6] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {dbUser.full_name?.[0] || dbUser.email?.[0] || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{dbUser.full_name || dbUser.email}</p>
              <p className="text-xs text-white/40 truncate capitalize">{dbUser.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Sign out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center px-3 py-2 mt-1 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
