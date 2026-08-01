import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export default function AdsSavedRecords({ adRecords, onLoad, onDelete, isDeleting }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
      <h3 className="text-white font-semibold mb-4">Saved Strategies & Copies</h3>
      {adRecords.length === 0 ? (
        <p className="text-gray-500 text-sm">No saved records yet. Generate and save a strategy or copy to see it here.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {adRecords.map(record => (
            <div key={record.id} className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/10">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${record.type === 'strategy' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                    {record.type}
                  </span>
                  <span className="text-white text-sm font-medium truncate">{record.title}</span>
                </div>
                {/* The column is created_at; created_date rendered "Invalid Date". */}
                <p className="text-gray-500 text-xs">
                  {record.created_at || record.created_date
                    ? new Date(record.created_at || record.created_date).toLocaleDateString()
                    : '—'}
                </p>
              </div>
              <div className="flex gap-1 ml-3">
                <Button size="sm" onClick={() => onLoad(record)} className="h-7 px-3 text-xs bg-[#38b6ff]/20 text-[#38b6ff] hover:bg-[#38b6ff]/30">Load</Button>
                <Button size="sm" variant="outline" onClick={() => onDelete(record.id)} disabled={isDeleting}
                  className="h-7 w-7 p-0 border-red-500/20 text-red-400 hover:bg-red-500/10"><Trash2 size={12} /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}