import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { canSeeDesign } from '@/lib/featureFlags';
import { useLanguage } from '@/components/ui/LanguageContext';
import {
  Home, TrendingUp, GitBranch, Bot, Inbox,
  Megaphone, Search, Share2, BookOpen, ScanLine,
  Sparkles, FileText, BarChart3, Plug, HelpCircle,
  User, Settings, Building2, Shield, X, MoreHorizontal,
  Palette, Clock, Bell as BellIcon,
} from 'lucide-react';

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
  const { dbUser, isAdmin, isCompanyAdmin } = useAuth();
  const { t, isPt } = useLanguage();
  const [showMore, setShowMore] = useState(false);

  const PRIMARY_ITEMS = [
    { icon: Home,       label: t('home'),   path: '/'       },
    { icon: Bot,        label: t('aiChat'), path: '/AIChat' },
    { icon: TrendingUp, label: t('sales'),  path: '/Sales'  },
    { icon: Inbox,      label: t('inbox'),  path: '/Inbox'  },
  ];

  const MORE_SECTIONS = [
    {
      label: isPt ? 'Núcleo' : 'Core',
      items: [
        { icon: GitBranch, label: t('workflows'), path: '/Workflows' },
        { icon: Bot,       label: 'SDR',          path: '/SDR' },
        { icon: BellIcon,  label: isPt ? 'Notificações' : 'Notifications', path: '/Notifications' },
      ],
    },
    {
      label: t('marketing'),
      items: [
        { icon: Megaphone, label: t('ads'),        path: '/Ads'         },
        { icon: Search,    label: 'SEO',           path: '/SEO'         },
        { icon: Share2,    label: isPt ? 'Social' : 'Social', path: '/SocialMedia' },
        { icon: BookOpen,  label: t('blog'),       path: '/Blog'        },
        // Design Studio is confidential until the next launch cycle.
        ...(canSeeDesign(dbUser) ? [{ icon: Palette, label: 'Design', path: '/Design' }] : []),
        { icon: ScanLine,  label: t('brandScan'),  path: '/BrandScan'   },
      ],
    },
    {
      label: t('contentAndAI'),
      items: [
        { icon: Clock,     label: isPt ? 'Automações' : 'Automations', path: '/AIAutomations' },
        { icon: Sparkles,  label: t('aiOutputs'),     path: '/AIOutputs'     },
        { icon: FileText,  label: t('templates'),     path: '/TextTemplates' },
        { icon: BarChart3, label: t('dashboardsTitle'), path: '/Dashboards'  },
        { icon: TrendingUp, label: 'Insights',        path: '/WorkflowAnalytics' },
      ],
    },
    {
      label: isPt ? 'Ferramentas & Conta' : 'Tools & Account',
      items: [
        { icon: Plug,       label: t('integrations'), path: '/Integrations' },
        { icon: HelpCircle, label: t('help'),         path: '/Help'         },
        { icon: User,       label: t('profile'),      path: '/Profile'      },
        { icon: Settings,   label: t('settings'),     path: '/Settings'     },
      ],
    },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const adminItems = [];
  if (isCompanyAdmin) adminItems.push({ icon: Building2, label: t('companyAdmin'), path: '/CompanyAdmin' });
  if (isAdmin) adminItems.push({ icon: Shield, label: t('systemAdmin'), path: '/Admin' });

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
          <span className="text-[10px] font-medium">{t('more')}</span>
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
