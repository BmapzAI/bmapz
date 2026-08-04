import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { ChevronDown, Check, Plug } from 'lucide-react';

const PLATFORMS = [
  { key: 'meta_ads', label: 'Meta Ads', color: '#1877F2' },
  { key: 'google_ads', label: 'Google Ads', color: '#4285F4' },
  { key: 'tiktok_ads', label: 'TikTok Ads', color: '#69C9D0' },
  { key: 'linkedin_ads', label: 'LinkedIn Ads', color: '#0077b5' },
  { key: 'twitter_ads', label: 'X Ads', color: '#FFFFFF' },
];

/**
 * Platform picker.
 *
 * The menu is rendered in a PORTAL with fixed coordinates measured from the
 * button. Previously it was an absolutely-positioned div inside the panel, so
 * the surrounding card clipped it and the list was cut off — which is why the
 * generic Radix popup fixes did not help here: this menu is hand-rolled, not Radix.
 */
export default function PlatformSelector({ selectedPlatform, onSelectPlatform, connectedPlatforms = [], loading }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const selected = PLATFORMS.find(p => p.key === selectedPlatform);

  // Measure the trigger and clamp the menu inside the viewport.
  useLayoutEffect(() => {
    if (!isOpen || !btnRef.current) return;
    const place = () => {
      const r = btnRef.current.getBoundingClientRect();
      const width = 224;
      const margin = 8;
      const left = Math.min(Math.max(margin, r.right - width), window.innerWidth - width - margin);
      const below = window.innerHeight - r.bottom - margin;
      const openUp = below < 240 && r.top > below;
      setPos({
        left,
        top: openUp ? undefined : r.bottom + 4,
        bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
        width,
        maxHeight: Math.max(160, (openUp ? r.top : below) - 8),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setIsOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block">
      <Button
        ref={btnRef}
        size="sm"
        type="button"
        onClick={() => setIsOpen(o => !o)}
        disabled={loading}
        className="h-8 px-3 text-xs gap-1.5 bg-[#3572b9] hover:bg-[#3572b9]/90 text-white"
      >
        {selected?.label || 'Select Platform'}
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && pos && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight }}
          className="overflow-y-auto bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-[120] py-1"
        >
          {PLATFORMS.map(p => {
            const isConnected = connectedPlatforms.includes(p.key);
            const isSelected = selectedPlatform === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => { onSelectPlatform(p.key); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors flex items-center gap-2 ${
                  isSelected ? 'bg-white/10 text-white' : 'text-gray-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="flex-1 truncate">{p.label}</span>
                {isConnected
                  ? <span title="Connected" className="flex items-center gap-1 text-green-400 text-[10px] flex-shrink-0"><Check size={11} /> Connected</span>
                  : <span title="Not connected yet" className="flex items-center gap-1 text-gray-500 text-[10px] flex-shrink-0"><Plug size={10} /> Connect</span>}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
