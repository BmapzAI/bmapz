import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  Home, TrendingUp, GitBranch, Bot, Inbox,
  Megaphone, Search, Share2, BookOpen, ScanLine,
  Sparkles, FileText, BarChart3, Plug, HelpCircle,
  User, Settings, Building2, Shield, X, MoreHorizontal,
} from 'lucide-react';

const PRIMARY_ITEMS = [
  { icon: Home,       label: 'Home',    path: '/'       },
  { icon: Bot,        label: 'AI Chat', path: '/AIChat' },
  { icon: TrendingUp, label: 'Sales',   path: '/Sales'  },
  { icon: Inbox,      label: 'Inbox',   path: '/Inbox'  },
];

const MORE_SECTIONS = [
  {
    label: 'Core',
    items: [
      { icon: GitBranch, label: 'Workflows', path: '/Workflows' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { icon: Megaphone, label: 'Ads',        path: '/Ads'         },
      { icon: Search,    label: 'SEO',        path: '/SEO'         },
      { icon: Share2,    label: 'Social',     path: '/SocialMedia' },
      { icon: BookOpen,  label: 'Blog',       path: '/Blog'        },
      { icon: ScanLine,  label: 'Brand Scan', path: '/BrandScan'   },
    ],
  },
  {
    label: 'Content & AI',
    items: [
      { icon: Sparkles,  label: 'AI Outputs', path: '/AIOutputs'     },
      { icon: FileText,  label: 'Templates',  path: '/TextTemplates' },
      { icon: BarChart3, label: 'Dashboards', path: '/Dashboards'    },
    ],
  },
  {
    label: 'Tools & Account',
    items: [
      { icon: Plug,     label: 'Integrations', path: '/Integrations' },
      { icon: HelpCircle, label: 'Help',       path: '/Help'         },
      { icon: User,     label: 'Profile',      path: '/Profile'      },
      { icon: Settings, label: 'Settings',     path: '/Settings'     },
    ],
  },
];

function NavBtn({ icon: Icon, label, path, active, onClick }) {
  return (
    <Link
      to={path}
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors ${
        active ? 'text-[#38b6ff]' : 'text-white/50 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

export default function MobileBottomNav() {
  const location = useLocation();
  const { isAdmin, isCompanyAdmin } = useAuth();
  const [showMore, setShowMore] = useState(false);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const adminItems = [];
  if (isCompanyAdmin) adminItems.push({ icon: Building2, label: 'Co. Admin', path: '/CompanyAdmin' });
  if (isAdmin) adminItems.push({ icon: Shield, label: 'Admin', path: '/Admin' });

  const allSections = adminItems.length > 0
    ? [...MORE_SECTIONS, { label: 'Admin', items: adminItems }]
    : MORE_SECTIONS;

  return (
    <>
      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0f0f0f]/95 backdrop-blur-md border-t border-white/10 flex items-stretch h-[64px]">
        {PRIMARY_ITEMS.map((item) => (
          <NavBtn
            key={item.path}
            icon={item.icon}
            label={item.label}
            path={item.path}
            active={isActive(item.path)}
            onClick={() => setShowMore(false)}
          />
        ))}
        {/* More button */}
        <button
          onClick={() => setShowMore((v) => !v)}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors ${
            showMore ? 'text-[#38b6ff]' : 'text-white/50 hover:text-white'
          }`}
        >
          {showMore ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>

      {/* Slide-up "More" drawer */}
      {showMore && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setShowMore(false)}
        >
          <div
            className="absolute bottom-[64px] left-0 right-0 bg-[#141414] border-t border-white/10 rounded-t-2xl max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-2" />
            {allSections.map((section, si) => (
              <div key={si} className="px-4 pb-3">
                <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider py-2">
                  {section.label}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {section.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setShowMore(false)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
                        isActive(item.path)
                          ? 'bg-[#38b6ff]/15 text-[#38b6ff]'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
