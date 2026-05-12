import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

const PLATFORMS = [
  { key: 'meta_ads', label: 'Meta Ads', color: '#1877F2' },
  { key: 'google_ads', label: 'Google Ads', color: '#4285F4' },
  { key: 'tiktok_ads', label: 'TikTok Ads', color: '#69C9D0' },
  { key: 'linkedin_ads', label: 'LinkedIn Ads', color: '#0077b5' },
  { key: 'twitter_ads', label: 'X Ads', color: '#000000' },
];

export default function PlatformSelector({ selectedPlatform, onSelectPlatform, connectedPlatforms, loading }) {
   const [isOpen, setIsOpen] = useState(false);

   const selected = PLATFORMS.find(p => p.key === selectedPlatform);

   return (
     <div className="relative inline-block">
       <Button
         size="sm"
         onClick={() => setIsOpen(!isOpen)}
         disabled={loading}
         className="h-8 px-3 text-xs gap-1.5 bg-[#3572b9] hover:bg-[#3572b9]/90 text-white"
       >
         {selected?.label || 'Select Platform'}
         <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
       </Button>

       {isOpen && (
         <div className="absolute top-full left-0 mt-1 w-48 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-lg z-50">
           {PLATFORMS.map(p => {
             const isConnected = connectedPlatforms.includes(p.key);
             return (
               <button
                 key={p.key}
                 onClick={() => {
                   onSelectPlatform(p.key);
                   setIsOpen(false);
                 }}
                 className={`w-full text-left px-4 py-2 text-xs hover:bg-white/10 transition-colors flex items-center gap-2 ${
                   selectedPlatform === p.key ? 'bg-white/20 text-white' : 'text-gray-300'
                 } ${!isConnected ? 'opacity-50' : ''}`}
               >
                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                 {p.label}
                 {!isConnected && <span className="text-gray-600 text-xs ml-auto">(connect)</span>}
               </button>
             );
           })}
         </div>
       )}
     </div>
   );
 }