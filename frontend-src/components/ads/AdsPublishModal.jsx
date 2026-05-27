import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/apiClient';


const NEVER_SHOW_KEY = 'bmapz_never_show_budget_warning';

export default function AdsPublishModal({ isOpen, onClose, onConfirm, platform, adTitle, isUpdate = false, campaignData = {} }) {
  const [neverShowAgain, setNeverShowAgain] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    if (neverShowAgain) {
      localStorage.setItem(NEVER_SHOW_KEY, 'true');
    }
    
    setPublishing(true);
    setError(null);
    
    try {
      const res = await api.post('/api/ads/records', {
        platform,
        campaignData: {
          ...campaignData,
          title: adTitle,
          description: campaignData.description || campaignData.strategy?.summary || '',
          landing_url: campaignData.landing_url || campaignData.strategy?.recommended_link || '',
        },
        isUpdate,
      });

      if (!res.success && res.error) {
        throw new Error(res.error);
      }

      setConfirmed(true);
      onConfirm?.();
      setTimeout(() => {
        setConfirmed(false);
        onClose?.();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to publish ad');
      toast.error(err.message || 'Failed to publish ad');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {confirmed ? (
              <><Check size={20} className="text-green-400" /> {isUpdate ? 'Updated!' : 'Published!'}</>
            ) : (
              <><AlertTriangle size={20} className="text-yellow-400" /> {isUpdate ? 'Update Ad' : 'Publish Ad'}</>
            )}
          </DialogTitle>
        </DialogHeader>

        {confirmed ? (
          <div className="py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-green-400" />
            </div>
            <p className="text-white font-semibold">{isUpdate ? 'Ad Updated Successfully!' : 'Ad Published Successfully!'}</p>
            <p className="text-gray-400 text-sm mt-1">"{adTitle}" has been {isUpdate ? 'updated' : 'sent'} to {platform || 'your ad platform'}.</p>
          </div>
        ) : (
          <>
            <div className="py-4 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              {!isUpdate && (
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-yellow-400 font-semibold text-sm flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} /> Budget Review Reminder
                  </p>
                  <p className="text-gray-300 text-sm">
                    Before publishing this ad, please make sure you have reviewed your available budget in your {platform || 'ad'} account to avoid unexpected charges.
                  </p>
                  {platform && (
                    <a href={
                      platform === 'meta' ? 'https://adsmanager.facebook.com/' :
                      platform === 'google' ? 'https://ads.google.com/' :
                      platform === 'tiktok' ? 'https://ads.tiktok.com/' :
                      platform === 'linkedin' ? 'https://www.linkedin.com/campaignmanager/' : '#'
                    } target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[#38b6ff] text-xs hover:underline">
                      <ExternalLink size={10} /> Open {platform} Ads Manager to review budget
                    </a>
                  )}
                </div>
              )}

              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-gray-400 text-sm">
                  {isUpdate ? 'You are about to update:' : 'You are about to publish:'} <span className="text-white font-medium">"{adTitle}"</span>
                  {platform && <> to <span className="text-[#38b6ff] capitalize">{platform} Ads</span></>}
                </p>
              </div>

              {!isUpdate && (
                <label className="flex items-center gap-3 cursor-pointer group" onClick={() => setNeverShowAgain(v => !v)}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0
                    ${neverShowAgain ? 'bg-[#38b6ff] border-[#38b6ff]' : 'border-white/30 hover:border-white/60'}`}>
                    {neverShowAgain && <Check size={10} className="text-white" />}
                  </div>
                  <span className="text-gray-400 text-sm">Never show me this reminder again</span>
                </label>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} disabled={publishing}
                className="flex-1 border-white/10 text-white hover:bg-white/5">Cancel</Button>
              <Button onClick={handleConfirm} disabled={publishing}
                className="flex-1 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
                {publishing ? (
                  <><Loader2 size={16} className="animate-spin" /> Publishing...</>
                ) : (
                  <><Check size={16} /> {isUpdate ? 'Update' : 'Publish'}</>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}