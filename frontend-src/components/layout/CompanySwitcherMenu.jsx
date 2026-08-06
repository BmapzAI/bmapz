import React from 'react';
import { Check, ChevronsUpDown, Loader2, Building2 } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

/**
 * The interactive half of the account switcher. Split into its own lazily
 * loaded chunk because it pulls in the Radix dropdown, and the sidebar sits in
 * the entry graph — users with a single company should not download a menu
 * they can never open.
 */
export default function CompanySwitcherMenu({ companies, activeId, active, initial, collapsed, switching, onSwitch, isPt }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`w-full flex items-center gap-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors ${collapsed ? 'justify-center p-2 mb-2' : 'px-2 py-2 mb-1'}`}
          title={isPt ? `Trocar empresa (${companies.length})` : `Switch company (${companies.length})`}
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#38b6ff] to-[#cb6ce6] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initial}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-white text-sm font-medium truncate">{active?.name}</p>
                <p className="text-white/40 text-[11px] truncate">
                  {isPt ? `${companies.length} empresas` : `${companies.length} companies`}
                </p>
              </div>
              <ChevronsUpDown size={14} className="text-white/40 flex-shrink-0" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side={collapsed ? 'right' : 'top'}
        className="w-64 bg-[#1a1a1a] border-white/10 max-h-80 overflow-y-auto"
      >
        <DropdownMenuLabel className="text-gray-400 text-xs font-normal">
          {isPt ? 'Trocar de empresa' : 'Switch company'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        {companies.map(c => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => onSwitch(c)}
            className="text-white focus:bg-white/10 cursor-pointer gap-2"
          >
            <Building2 size={14} className="text-[#38b6ff] flex-shrink-0" />
            <span className="flex-1 truncate">{c.name}</span>
            {switching === c.id
              ? <Loader2 size={13} className="animate-spin text-gray-400" />
              : c.id === activeId && <Check size={14} className="text-green-400" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
