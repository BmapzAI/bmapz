import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Edit3, Check, Copy, GitBranch, Plus, X } from 'lucide-react';

const stageColors = { 'TOF': 'bg-blue-500/20 text-blue-400', 'MOF': 'bg-yellow-500/20 text-yellow-400', 'BOF': 'bg-green-500/20 text-green-400' };

export default function AdsCopyOutput({ copies, setCopies, company, strategy }) {
  const [editingCopy, setEditingCopy] = useState(null);
  const [copied, setCopied] = useState(null);
  const [abTests, setAbTests] = useState({}); // { [adIndex]: {variantB: {hook, body, cta}} }

  const toggleABTest = (i) => {
    setAbTests(prev => {
      if (prev[i]) {
        const next = { ...prev };
        delete next[i];
        return next;
      }
      const original = copies[i];
      return { ...prev, [i]: { variantB: { hook: original.hook + ' [Variant B — edit this]', body: original.body, cta: original.cta } } };
    });
  };

  const updateVariantB = (i, field, value) => {
    setAbTests(prev => ({ ...prev, [i]: { variantB: { ...prev[i]?.variantB, [field]: value } } }));
  };

  const updateCopy = (i, field, value) => {
    setCopies(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!copies) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-12 flex flex-col items-center justify-center text-center h-full">
        <FileText size={48} className="text-gray-600 mb-4" />
        <h3 className="text-white font-semibold mb-2">No Ad Copies Generated Yet</h3>
        <p className="text-gray-400 text-sm max-w-sm">
          {company ? `✅ Using ${company.name} data. ${strategy ? 'Strategy context ready — copies will follow your strategy.' : 'Generate a strategy first for better results.'}` : 'Fill in Settings for one-click generation.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {copies.map((ad, i) => (
        <div key={i} className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageColors[ad.stage?.toUpperCase()] || 'bg-white/10 text-gray-400'}`}>
              {ad.stage?.toUpperCase()}
            </span>
            <span className="text-gray-400 text-xs capitalize">{ad.angle?.replace('_', ' ')}</span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => toggleABTest(i)}
                title={abTests[i] ? 'Remove A/B test' : 'Add A/B variant'}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-colors ${abTests[i] ? 'border-[#cb6ce6]/50 text-[#cb6ce6] bg-[#cb6ce6]/10' : 'border-white/10 text-gray-400 hover:border-white/30 hover:text-white'}`}>
                <GitBranch size={12} /> {abTests[i] ? 'A/B On' : 'A/B Test'}
              </button>
              <button onClick={() => setEditingCopy(editingCopy === i ? null : i)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                <Edit3 size={14} />
              </button>
              <button onClick={() => copyToClipboard(`HOOK:\n${ad.hook}\n\nBODY:\n${ad.body}\n\nCTA: ${ad.cta}`, i)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                {copied === i ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          {editingCopy === i ? (
            <div className="space-y-3">
              <div>
                <label className="text-[#38b6ff] text-xs font-medium">HOOK</label>
                <Textarea value={ad.hook} onChange={e => updateCopy(i, 'hook', e.target.value)}
                  className="mt-1 bg-black/30 border-white/10 text-white text-sm min-h-[60px]" />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium">BODY COPY</label>
                <Textarea value={ad.body} onChange={e => updateCopy(i, 'body', e.target.value)}
                  className="mt-1 bg-black/30 border-white/10 text-white text-sm min-h-[120px]" />
              </div>
              <div>
                <label className="text-green-400 text-xs font-medium">CTA</label>
                <Input value={ad.cta} onChange={e => updateCopy(i, 'cta', e.target.value)}
                  className="mt-1 bg-black/30 border-white/10 text-white text-sm" />
              </div>
              <Button size="sm" onClick={() => setEditingCopy(null)} className="bg-green-600 hover:bg-green-700 gap-1 text-xs"><Check size={12} />Done</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-[#38b6ff]/10 border border-[#38b6ff]/20">
                <span className="text-[#38b6ff] text-xs font-medium">HOOK (0-3s)</span>
                <p className="text-white text-sm mt-1 font-semibold">{ad.hook}</p>
              </div>
              <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                <span className="text-gray-400 text-xs font-medium">BODY COPY</span>
                <p className="text-gray-300 text-sm mt-1 whitespace-pre-line">{ad.body}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <span className="text-green-400 text-xs font-medium">CTA</span>
                <p className="text-white text-sm font-semibold">{ad.cta}</p>
              </div>
              {ad.platform_notes && <p className="text-gray-500 text-xs italic">{ad.platform_notes}</p>}
            </div>
          )}

          {/* A/B Variant B */}
          {abTests[i] && (
            <div className="mt-4 pt-4 border-t border-[#cb6ce6]/20">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[#cb6ce6] text-xs font-semibold flex items-center gap-1"><GitBranch size={12} />Variant B (A/B Test)</span>
                <span className="text-gray-500 text-xs">— Edit to test a different angle</span>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-[#cb6ce6] text-xs font-medium">HOOK B</label>
                  <Textarea value={abTests[i].variantB.hook} onChange={e => updateVariantB(i, 'hook', e.target.value)}
                    className="mt-1 bg-black/30 border-[#cb6ce6]/20 text-white text-sm min-h-[50px]" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium">BODY B</label>
                  <Textarea value={abTests[i].variantB.body} onChange={e => updateVariantB(i, 'body', e.target.value)}
                    className="mt-1 bg-black/30 border-[#cb6ce6]/20 text-white text-sm min-h-[80px]" />
                </div>
                <div>
                  <label className="text-green-400 text-xs font-medium">CTA B</label>
                  <Input value={abTests[i].variantB.cta} onChange={e => updateVariantB(i, 'cta', e.target.value)}
                    className="mt-1 bg-black/30 border-[#cb6ce6]/20 text-white text-sm" />
                </div>
                <button onClick={() => copyToClipboard(`[VARIANT B]\nHOOK: ${abTests[i].variantB.hook}\n\nBODY: ${abTests[i].variantB.body}\n\nCTA: ${abTests[i].variantB.cta}`, `b_${i}`)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-white">
                  {copied === `b_${i}` ? <Check size={12} className="text-green-400" /> : <Copy size={12} />} Copy Variant B
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}