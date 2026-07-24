import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, ExternalLink, Plug } from 'lucide-react';
import { toast } from 'sonner';
import { Canva } from '@/api/entities';
import { api } from '@/api/apiClient';

/**
 * Canva design picker — lists the user's Canva designs and exports the chosen
 * one to a PNG, returning its URL via onSelect({ url, name }).
 */
export default function CanvaPicker({ open, onClose, onSelect }) {
  const { isPt } = useLanguage();
  const [exportingId, setExportingId] = useState(null);

  const { data: status } = useQuery({ queryKey: ['canvaStatus'], queryFn: () => Canva.status(), enabled: open });
  const { data: designs = [], isLoading, error } = useQuery({
    queryKey: ['canvaDesigns'],
    queryFn: () => Canva.designs(),
    enabled: open && status?.connected,
  });

  const connectCanva = async () => {
    try {
      const { authUrl } = await api.get('/api/oauth/canva/initiate-url', { type: 'canva', origin: window.location.origin });
      const popup = window.open(authUrl, 'canva_oauth', 'width=620,height=760,left=200,top=80');
      const onMsg = (e) => {
        if (e.data?.type === 'oauth_success') { window.removeEventListener('message', onMsg); popup?.close(); toast.success('Canva connected!'); }
        if (e.data?.type === 'oauth_error') { window.removeEventListener('message', onMsg); toast.error('Canva connection failed'); }
      };
      window.addEventListener('message', onMsg);
    } catch (e) {
      toast.error(e.code === 'NOT_CONFIGURED'
        ? (isPt ? 'A integração com o Canva ainda não foi configurada pelo administrador.' : 'Canva integration is not configured yet by the admin.')
        : e.message);
    }
  };

  const pick = async (d) => {
    setExportingId(d.id);
    try {
      const { url } = await Canva.export(d.id);
      onSelect?.({ url, name: d.title || 'Canva design' });
      onClose?.();
      toast.success(isPt ? 'Design importado do Canva!' : 'Design imported from Canva!');
    } catch (e) {
      toast.error((isPt ? 'Falha ao exportar do Canva: ' : 'Canva export failed: ') + e.message);
    } finally { setExportingId(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#111] border-white/10 text-white">
        <DialogHeader><DialogTitle className="flex items-center gap-2">🎨 {isPt ? 'Importar do Canva' : 'Import from Canva'}</DialogTitle></DialogHeader>

        {!status?.connected ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-gray-400 text-sm">
              {status?.configured === false
                ? (isPt ? 'A integração com o Canva ainda não foi configurada nesta conta.' : 'The Canva integration is not configured on this platform yet.')
                : (isPt ? 'Conecte sua conta do Canva para importar designs.' : 'Connect your Canva account to import designs.')}
            </p>
            <Button onClick={connectCanva} disabled={status?.configured === false} className="bg-[#00c4cc] hover:bg-[#00b0b8] text-black gap-2">
              <Plug size={15} /> {isPt ? 'Conectar Canva' : 'Connect Canva'}
            </Button>
          </div>
        ) : isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-[#00c4cc]" /></div>
        ) : error ? (
          <p className="text-red-400 text-sm py-8 text-center">{error.message}</p>
        ) : designs.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">{isPt ? 'Nenhum design encontrado na sua conta Canva.' : 'No designs found in your Canva account.'}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
            {designs.map(d => (
              <button key={d.id} onClick={() => pick(d)} disabled={!!exportingId}
                className="rounded-xl overflow-hidden border border-white/10 hover:border-[#00c4cc]/50 bg-white/5 text-left group relative">
                {d.thumbnail ? (
                  <img src={d.thumbnail} alt={d.title} className="w-full h-28 object-cover" />
                ) : (
                  <div className="w-full h-28 bg-white/5 flex items-center justify-center text-gray-600 text-xs">No preview</div>
                )}
                <p className="text-white text-xs p-2 truncate">{d.title}</p>
                {exportingId === d.id && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 className="animate-spin text-[#00c4cc]" /></div>
                )}
              </button>
            ))}
          </div>
        )}

        {status?.connected && (
          <a href="https://www.canva.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 text-xs hover:text-white flex items-center gap-1 justify-center">
            {isPt ? 'Abrir Canva' : 'Open Canva'} <ExternalLink size={11} />
          </a>
        )}
      </DialogContent>
    </Dialog>
  );
}
