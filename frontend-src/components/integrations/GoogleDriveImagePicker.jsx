import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, AlertCircle, Image, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/apiClient';

export default function GoogleDriveImagePicker({ open, onClose, onSelect, isLoading = false }) {
  const [files, setFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [nextPageToken, setNextPageToken] = useState(null);

  useEffect(() => {
    if (open) fetchFiles();
  }, [open]);

  const fetchFiles = async (query = '', pageToken = null) => {
    setIsFetching(true);
    setError(null);
    try {
      const params = {};
      if (query) params.query = query;
      if (pageToken) params.page_token = pageToken;

      const res = await api.get('/api/integrations/google/drive/files', params);
      setFiles(prev => pageToken ? [...prev, ...(res.files || [])] : (res.files || []));
      setNextPageToken(res.nextPageToken || null);
    } catch (e) {
      setError(e.message || 'Failed to fetch from Google Drive. Make sure Drive is connected in Integrations.');
    } finally {
      setIsFetching(false);
    }
  };

  const handleSearch = (q) => {
    setSearchQuery(q);
    fetchFiles(q);
  };

  const handleConfirm = () => {
    if (!selectedFile) return;
    // Build a usable URL from the file
    const url = `https://drive.google.com/uc?id=${selectedFile.id}&export=view`;
    onSelect?.({ ...selectedFile, url });
    toast.success('Image selected from Google Drive');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image size={20} className="text-[#38b6ff]" />
            Select Image from Google Drive
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Browse images from your connected Google Drive account
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/10 flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search images..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 bg-black/30 border-white/10 text-white"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchFiles(searchQuery)}
              className="border-white/10 text-white hover:bg-white/5"
            >
              <RefreshCw size={16} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isFetching && files.length === 0 ? (
              <div className="flex items-center justify-center h-40">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={24} className="text-[#38b6ff] animate-spin" />
                  <p className="text-gray-400 text-sm">Loading from Google Drive...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-40">
                <div className="text-center">
                  <AlertCircle size={32} className="text-red-400 mx-auto mb-2" />
                  <p className="text-gray-300 text-sm">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchFiles()}
                    className="mt-3 border-white/10 text-white"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            ) : files.length === 0 ? (
              <div className="flex items-center justify-center h-40">
                <p className="text-gray-400 text-sm">No images found. Try a different search.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {files.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => setSelectedFile(file)}
                      className={`relative group rounded-lg overflow-hidden border-2 transition-all aspect-square ${
                        selectedFile?.id === file.id
                          ? 'border-[#38b6ff] ring-2 ring-[#38b6ff]/30'
                          : 'border-white/10 hover:border-[#38b6ff]/50'
                      }`}
                    >
                      {file.thumbnailLink ? (
                        <img
                          src={file.thumbnailLink}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-white/5 flex items-center justify-center">
                          <Image size={32} className="text-white/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                        <p className="text-white text-xs p-2 line-clamp-2 w-full bg-black/60">{file.name}</p>
                      </div>
                      {selectedFile?.id === file.id && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#38b6ff] flex items-center justify-center">
                          <span className="text-white text-xs font-bold">✓</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {nextPageToken && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchFiles(searchQuery, nextPageToken)}
                      disabled={isFetching}
                      className="border-white/10 text-white"
                    >
                      {isFetching ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                      Load more
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 p-4 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedFile || isLoading}
            className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] text-white"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            Use This Image
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
