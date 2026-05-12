import React, { createContext, useContext } from 'react';

const ThemeContext = createContext();

// Dark mode only — this app is always dark
export function ThemeProvider({ children }) {
  return (
    <ThemeContext.Provider value={{}}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return { theme: 'dark', isDark: true };
}

// Convenience hook — always returns dark-mode classes
export function useThemeClasses() {
  return {
    isDark: true,
    card: 'bg-white/5 border-white/10',
    cardHover: 'hover:bg-white/8',
    text: 'text-white',
    textMuted: 'text-gray-400',
    textSecondary: 'text-gray-300',
    input: 'bg-black/30 border-white/10 text-white placeholder:text-gray-500',
    select: 'bg-black/30 border-white/10 text-white',
    selectContent: 'bg-[#1a1a1a] border-white/10',
    selectItem: 'text-white hover:bg-white/10',
    controlBar: 'bg-white/5 border-white/10',
    viewToggle: 'bg-black/30',
    viewToggleActive: 'bg-[#38b6ff]/20 text-[#38b6ff]',
    viewToggleInactive: 'text-gray-400 hover:text-white',
    tabsList: 'bg-white/5 border border-white/10',
    sectionHeader: 'border-white/5',
    labelText: 'text-gray-400',
    badge: 'bg-white/10 text-gray-400',
    outlineBtn: 'border-white/10 text-white hover:bg-white/5',
    dialogBg: 'bg-[#1a1a1a] border-white/10 text-white',
    emptyState: 'bg-white/5 border-white/10',
    stickyBar: 'bg-[#0a0a0a]/90 border-white/10',
    infoBox: 'bg-[#38b6ff]/10 border-[#38b6ff]/20',
    infoText: 'text-gray-300',
  };
}

export default ThemeContext;