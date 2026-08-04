import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';

/**
 * The app header, shown on every screen at every size.
 *
 *   left   — hamburger + logo/name, which navigate home
 *   centre — global search
 *   right  — notifications with an unread counter
 *
 * The hamburger opens and closes the sidebar. On desktop it collapses the
 * sidebar to icons; on mobile it slides the same sidebar in over the content,
 * which replaces the old bottom tab bar.
 */
export default function AppHeader({ sidebarOpen, onToggleSidebar, companyName }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/10">
      <div className="h-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4">

        {/* Hamburger — one control for both sizes */}
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={sidebarOpen}
          className="p-2 -ml-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Logo + name → home */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity" title="Home">
          <img
            src="/bmapz-logo.png"
            alt="Bmapz AI"
            className="w-7 h-7 rounded-lg object-contain flex-shrink-0"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
          />
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#38b6ff] to-[#cb6ce6] flex-shrink-0" style={{ display: 'none' }} />
          {/* The name is the product's, not the company's — keep it stable. */}
          <span className="hidden sm:inline font-bold text-white text-base tracking-tight truncate max-w-[160px]">
            {companyName || 'Bmapz AI'}
          </span>
        </Link>

        {/* Search takes the middle and is the widest thing on the bar */}
        <div className="flex-1 flex justify-center min-w-0 px-1">
          <GlobalSearch className="w-full max-w-xl" />
        </div>

        <div className="flex-shrink-0">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
