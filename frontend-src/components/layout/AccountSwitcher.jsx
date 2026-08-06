import React, { useState, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/components/ui/LanguageContext';

/**
 * Account switcher — lets a user who can reach more than one company move
 * between them, so data scope never mixes.
 *
 * Backed by users.accessible_company_ids (plus every company for owner /
 * system_admin). Switching writes users.active_company_id, NOT company_id, so
 * the user's home company and role are untouched — see migration 021.
 *
 * With a single company this renders a plain, non-interactive label and never
 * loads the dropdown chunk — the sidebar is in the entry graph, so the menu is
 * split out to keep first load small.
 */
const CompanySwitcherMenu = React.lazy(() => import('@/components/layout/CompanySwitcherMenu'));

export default function AccountSwitcher({ collapsed = false }) {
  const { company, dbUser } = useAuth();
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();
  const [switching, setSwitching] = useState(null);

  const { data } = useQuery({
    queryKey: ['switchableCompanies'],
    queryFn: () => api.get('/api/companies/switchable'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const companies = data?.data || [];
  const activeId = data?.active_company_id || company?.id;
  const canSwitch = companies.length > 1;
  const active = companies.find(c => c.id === activeId) || company;
  const initial = (active?.name || 'C')[0].toUpperCase();

  const switchTo = async (target) => {
    if (target.id === activeId) return;
    setSwitching(target.id);
    try {
      await api.post('/api/companies/switch', { company_id: target.id });
      // Everything on screen belongs to the previous company — drop the whole
      // cache rather than invalidating individual keys, so no record from the
      // old scope can survive the switch.
      queryClient.clear();
      toast.success(isPt ? `Agora em ${target.name}` : `Now in ${target.name}`);
      // Full reload guarantees every provider (auth, company, language) re-reads
      // under the new scope.
      window.location.reload();
    } catch (e) {
      toast.error(
        (isPt ? 'Não foi possível trocar de empresa: ' : 'Could not switch company: ')
        + (e?.response?.data?.error || e.message),
      );
      setSwitching(null);
    }
  };

  if (!active) return null;

  // Single company — show it, but don't pretend it's a menu.
  if (!canSwitch) {
    if (collapsed) {
      return (
        <div className="flex justify-center mb-2" title={active.name}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#38b6ff] to-[#cb6ce6] flex items-center justify-center text-xs font-bold text-white">
            {initial}
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 px-2 py-2 mb-1 rounded-lg bg-white/5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#38b6ff] to-[#cb6ce6] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate">{active.name}</p>
          {dbUser?.role && <p className="text-white/40 text-[11px] capitalize truncate">{dbUser.role.replace(/_/g, ' ')}</p>}
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className={`flex items-center gap-2 rounded-lg bg-white/5 ${collapsed ? 'justify-center p-2 mb-2' : 'px-2 py-2 mb-1'}`}>
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#38b6ff] to-[#cb6ce6] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
          {initial}
        </div>
        {!collapsed && <p className="text-white text-sm font-medium truncate">{active.name}</p>}
      </div>
    }>
      <CompanySwitcherMenu
        companies={companies}
        activeId={activeId}
        active={active}
        initial={initial}
        collapsed={collapsed}
        switching={switching}
        onSwitch={switchTo}
        isPt={isPt}
      />
    </Suspense>
  );
}
