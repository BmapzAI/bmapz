import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Home, TrendingUp, GitBranch, Bot, Inbox } from 'lucide-react';

const NAV_ITEMS = [
  { icon: Home,        label: 'Home',      path: 'Home' },
  { icon: TrendingUp,  label: 'Sales',     path: 'Sales' },
  { icon: Bot,         label: 'AI Agent',  path: 'AIChat' },
  { icon: GitBranch,   label: 'Workflows', path: 'Workflows' },
  { icon: Inbox,       label: 'Inbox',     path: 'Inbox' },
];

export default function MobileBottomNav() {
  const location = useLocation();

  const isActive = (path) => {
    const current = location.pathname.replace('/', '');
    return current === path || (current === '' && path === 'Home');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0a0a0a]/95 backdrop-blur-md border-t border-white/10">
      <div className="flex items-center justify-around px-2 py-2 pb-safe">
        {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
          const active = isActive(path);
          return (
            <Link
              key={path}
              to={createPageUrl(path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[56px]
                ${active
                  ? 'text-[#38b6ff]'
                  : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              <div className={`relative ${active ? 'scale-110' : ''} transition-transform duration-200`}>
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                {active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#38b6ff]" />
                )}
              </div>
              <span className={`text-[10px] font-medium leading-none mt-1 ${active ? 'text-[#38b6ff]' : 'text-gray-600'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}