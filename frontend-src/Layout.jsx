import React, { useState } from 'react';
import { LanguageProvider } from '@/components/ui/LanguageContext';
import { ThemeProvider } from '@/components/ui/ThemeContext';
import Sidebar from '@/components/layout/Sidebar';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { useAuth } from '@/lib/AuthContext';
import { Toaster } from 'sonner';

function LayoutContent({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const { dbUser, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#38b6ff] border-t-transparent animate-spin" />
          <span className="text-white font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <style>{`
        :root {
          --color-primary: #3572b9;
          --color-primary-light: #38b6ff;
          --color-accent: #00e7ff;
          --color-magenta: #cb6ce6;
          --gradient-primary: linear-gradient(90deg, #3572b9, #38b6ff, #00e7ff);
          --gradient-accent: linear-gradient(90deg, #cb6ce6, #38b6ff);
          --gradient-silver: linear-gradient(90deg, #a6a6a6, #ffffff);
        }
        .gradient-border { position: relative; }
        .gradient-border::before {
          content: '';
          position: absolute;
          inset: 0;
          padding: 1px;
          border-radius: inherit;
          background: linear-gradient(90deg, #3572b9, #38b6ff, #cb6ce6);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
        }
        .glow-blue { box-shadow: 0 0 20px rgba(56,182,255,0.3); }
        .glow-magenta { box-shadow: 0 0 20px rgba(203,108,230,0.3); }
        .text-gradient {
          background: linear-gradient(90deg, #38b6ff, #cb6ce6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
        ::-webkit-scrollbar-thumb { background: rgba(56,182,255,0.3); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(56,182,255,0.5); }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-float { animation: float 3s ease-in-out infinite; }
        @keyframes glow-pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        .animate-glow-pulse { animation: glow-pulse 2s ease-in-out infinite; }
      `}</style>
      <div data-theme="dark">
        <Sidebar user={dbUser} collapsed={collapsed} setCollapsed={setCollapsed} />
        <main className={`transition-all duration-300 ml-0 min-h-screen ${collapsed ? 'md:ml-[72px]' : 'md:ml-[240px]'}`}>
          <div className="p-4 sm:p-6 pt-14 md:pt-4 pb-24 md:pb-6">
            {children}
          </div>
        </main>
        <MobileBottomNav />
        <OnboardingWizard />
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{ style: { background: '#1a1a1a', border: '1px solid rgba(56,182,255,0.2)', color: '#ffffff' } }}
        />
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <LayoutContent>{children}</LayoutContent>
      </LanguageProvider>
    </ThemeProvider>
  );
}
