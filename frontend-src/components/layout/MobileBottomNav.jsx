import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  Home, TrendingUp, GitBranch, Bot, Inbox,
  Megaphone, Search, Share2, BookOpen, ScanLine,
  Sparkles, FileText, BarChart3, Plug, HelpCircle,
  User, Settings, Building2, Shield, X, MoreHorizontal,
} from 'lucide-react';

// Primary 4 items always visible + "More" button
const PRIMARY_ITEMS = [
  { icon: Home,        label: 'Home',      path: '/'          },
  { icon: Bot,         label: 'AI Chat',   path: '/AIChat'    },
  { icon: TrendingUp,  label: 'Sales',     path: '/Sales'     },
  { icon: Inbox,       label: 'Inbox',     path: '/Inbox'     },
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
      { icon: Megaphone, label: 'Ads',         path: '/Ads'         },
      { icon: Search,    label: 'SEO',         path: '/SEO'         },
      { icon: Share2,    label: 'Social',      path: '/SocialMedia' },
      { icon: BookOpen,  label: 'Blog',        path: '/Blog'        },
      { icon: ScanLine,  label: 'Brand Scan',  path: '/BrandScan'   },
    ],
  },
  {
    label: 'Content & AI',
    items: [
      { icon: Sparkles,  label: 'AI Outputs',  path: '/AIOutputs'     },
      { icon: FileText,  label: 'Templates',   path: '/TextTemplates' },
      { icon: BarChart3, label: 'Dashboards',  path: '/Dashboards'    },
    ],
  },
  {
    label: 'Tools & Account',
    items: [
      { icon: Plug,       label: 'Integrations', path: '/Integrations' },
      { icon: HelpCircle, label: 'Help',         path: '/Help'         },
      { icon: User,       label: 'Profile',      path: '/Profile'      },
      { icon: Settings,   label: 'Settings',     path: '/Settings'     },
    ],
  },
];

function NavBtn({ icon: Icon, label, path, active, onClick }) {
  return (
    <Link
      to={path}
      onClick={onClick}
      className={`flex flex-col items-cen