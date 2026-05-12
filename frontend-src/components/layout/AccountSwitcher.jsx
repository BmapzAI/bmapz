import React from 'react';
import { useAuth } from '@/lib/AuthContext';

// Account switcher — simplified for standalone (single company per user)
export default function AccountSwitcher() {
  const { company, dbUser } = useAuth();

  if (!company) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
      <div className="w-6 h-6 rounded bg-gradient-to-br from-[#38b6ff] to-[#cb6ce6] flex items-center justify-center text-xs font-bold text-white">
        {company.name?.[0] || 'C'}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">{company.name}</p>
        {dbUser?.role && (
          <p className="text-xs text-white/40 capitalize">{dbUser.role}</p>
        )}
      </div>
    </div>
  );
}
