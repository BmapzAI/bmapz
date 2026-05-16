import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Upload, Wand2, X, ExternalLink, Image, Video, Sparkles, Loader2, Download, FileImage } from 'lucide-react';
import GoogleDriveImagePicker from '@/components/integrations/GoogleDriveImagePicker';
import { InvokeLLM, GenerateImage, UploadFile } from '@/api/integrations';

const DESIGN_TOOLS = [
  { name: 'Canva', url: 'https://www.canva.com/', color: '#00C4CC', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Canva_icon_2021.svg/512px-Canva_icon_2021.svg.png', desc: 'Free design tool — social media, ads, presentations' },
  { name: 'Adobe Express', url: 'https://www.adobe.com/express/', color: '#FF0000', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Adobe_Express_2021_logo.svg/512px-Adobe_Express_2021_logo.svg.png', desc: 'Quick Adobe designs for ads and social media' },
  { name: 'Figma', url: 'https://www.figma.com/', color: '#F24E1E', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Figma-logo.svg/512px-Figma-logo.svg.png', desc: 'Professional UI/design tool for ad creatives' },
  { name: 'Creatopy', url: 'https://www.creatopy.com/', color: '#6C48D5', logo: null, desc: 'Ad-specific creative design platform' },
];

const AD_SIZES = {
  meta: [
    { name: 'Feed Square', size: '1080×1080', ratio: '1:1' },
    { name: 'Feed Portrait', size: '1080×1350', ratio: '4:5' },
    { name: 'Story/Reel', size: '1080×1920', ratio: '9:16' },
    { name: 'Landscape', size: '1200×628', ratio: '1.91:1' },
  ],
  google: [
    { name: 'Leaderboard', size: '728×90', ratio: '~8:1' },
    { name: 'Rectangle', size: '300×250', ratio: '6:5' },
    { name: 'Billboard', size: '970×250', ratio: '~4:1' },
    { name: 'Skyscraper', size: '160×600', ratio: '~1:4' },
  ],
  tiktok: [
    { name: 'In-Feed', size: '1080×1920', ratio: '9:16' },
    { name: 'TopView', size: '1080×1920', ratio: '9:16' },
  ],
  x: [
    { name: 'X Post (Square)', size: '1024×512', ratio: '2:1' },
    { name: 'Promoted Tweet', size: '1024×512', ratio: '2:1' },
    { name: 'X Card', size: '506×506', ratio: '1:1' },
  ],
  linkedin: [
    { name: 'Single Image', size: '1200×627', ratio: '~1.91:1' },
    { name: 'Carousel', size: '1080×1080', ratio: '1:1' },
  ],
};

export default function AdsCreativesTab({ company }) {
  const [uploadedCreatives, setUploadedCreatives] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [briefPrompt, setBriefPrompt] = useState('');
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [designBrief, setDesignBrief] = useState(null);
  const [abDesignBriefs, setAbDesignBriefs] = useState([]);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [generatedAbImages, setGeneratedAbImages] = useState([]);
  const [selectedPlatform, setSelectedPlatform] = useState('meta');
  const [imagePrompt, setImagePrompt] = useState('');
  const [abTestEnabled, setAbTestEnabled] = useState(false);
  const [showGoogleDrivePicker, setShowGoogleDrivePicker] = useState(false);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsUploading(true);
    try {
      const results = await Promise.all(
        files.map(f => UploadFile({ file: f }))
      );
      const uploaded = results.map((r, i) => ({
        url: r.file_url,
        name: files[i].name,
        type: files[i].type,
        size: files[i].size,
      }));
      setUploadedCreatives(prev => [...prev, ...uploaded]);
      toast.success(`${files.length} creative(s) uploaded`);
    } catch {
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const singleBriefSchema = {
    type: 'object',
    properties: {
      concept: { type: 'string' },
      headline: { type: 'string' },
      subheadline: { type: 'string' },
      visual_concept: { type: 'string' },
      color_palette: { type: 'array', items: { type: 'string' } },
      typography: { type: 'string' },
      mood: { type: 'string' },
      image_style: { type: 'string' },
      do_list: { type: 'array', items: { type: 'string' } },
      dont_list: { type: 'array', items: { type: 'string' } },
      cta: { type: 'string' },
      ai_image_prompt: { type: 'string' },
    }
  };

  const generateDesignBrief = async () => {
    if (!briefPrompt.trim()) return;
    setIsGeneratingBrief(true);
    try {
      if (abTestEnabled) {
        // Generate two distinct variations A and B
        const [responseA, responseB] = await Promise.all([
          InvokeLLM({
            prompt: `You are a senior creative director. Generate Ad Creative Brief VARIATION A (bold/direct approach) for:
"${briefPrompt}"
Company: ${company?.name || 'N/A'}, Platform: ${selectedPlatform}
Value props: ${company?.value_propositions?.join(', ') || 'N/A'}
Tone: ${company?.briefing?.tone_of_voice?.join(', ') || 'professional'}
Return JSON.`,
            response_json_schema: singleBriefSchema
          }),
          InvokeLLM({
            prompt: `You are a senior creative director. Generate Ad Creative Brief VARIATION B (emotional/storytelling approach, clearly different from A) for:
"${briefPrompt}"
Company: ${company?.name || 'N/A'}, Platform: ${selectedPlatform}
Value props: ${company?.value_propositions?.join(', ') || 'N/A'}
Tone: ${company?.briefing?.tone_of_voice?.join(', ') || 'professional'}
Make this noticeably different from Variation A in concept, headline and visual direction. Return JSON.`,
            response_json_schema: singleBriefSchema
          })
        ]);
        setAbDesignBriefs([{ ...responseA, _label: 'A' }, { ...responseB, _label: 'B' }]);
        setDesignBrief(null);
        setGeneratedAbImages([]);
        toast.success('A/B design briefs generated!');
      } else {
        const response = await InvokeLLM({
          prompt: `You are a senior creative director specializing in performance advertising.
Generate a detailed ad creative brief for the following request:
"${briefPrompt}"
Company: ${company?.name || 'N/A'}, Industry: ${company?.industry || 'N/A'}, Platform: ${selectedPlatform}
Value propositions: ${company?.value_propositions?.join(', ') || 'N/A'}
Tone of voice: ${company?.briefing?.tone_of_voice?.join(', ') || 'professional'}
Return a comprehensive creative brief in JSON.`,
          response_json_schema: singleBriefSchema
        });
        setDesignBrief(response);
        setAbDesignBriefs([]);
        if (response?.ai_image_prompt) setImagePrompt(response.ai_image_prompt);
        toast.success('Design brief generated!');
      }
    } catch {
      toast.error('Failed to generate brief');
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  const generateAIImage = async () => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingImage(true);
    try {
      const result = await GenerateImage({
        prompt: `Professional advertising creative for ${selectedPlatform} ads. ${imagePrompt}. High quality, photorealistic, suitable for performance advertising.`,
      });
      if (result?.url) {
        setGeneratedImage(result.url);
        setUploadedCreatives(prev => [...prev, { url: result.url, name: 'AI Generated', type: 'image/png', isAI: true }]);
        toast.success('AI image generated!');
      }
    } catch {
      toast.error('Image generation failed');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const sizes = AD_SIZES[selectedPlatform] || AD_SIZES.meta;

  return (
    <div className="space-y-6">
      {/* Platform selector */}
      <div className="flex gap-2 flex-wrap">
        {Object.keys(AD_SIZES).map(p => (
          <button key={p} onClick={() => setSelectedPlatform(p)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize
              ${selectedPlatform === p ? 'bg-[#38b6ff] text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
            {p}
          </button>
        ))}
      </div>

      {/* Ad Sizes Reference */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
        <p className="text-white font-medium text-sm mb-3 flex items-center gap-2">
          <Image size={14} className="text-[#38b6ff]" /> {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)} Ad Sizes
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {sizes.map(s => (
            <div key={s.name} className="p-3 rounded-xl bg-black/30 border border-white/10 text-center">
              <p className="text-white text-xs font-medium">{s.name}</p>
              <p className="text-[#38b6ff] text-xs mt-0.5">{s.size}</p>
              <p className="text-gray-500 text-[10px]">{s.ratio}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Creatives */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Upload size={16} className="text-[#38b6ff]" /> Upload Ad Creatives
          </h3>
          <label className={`flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-xl p-8 cursor-pointer hover:border-[#38b6ff]/50 transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload size={32} className="text-gray-400 mb-3" />
            <p className="text-white text-sm mb-1">Drop your creatives here</p>
            <p className="text-gray-500 text-xs">Images (JPG, PNG, GIF) and Videos (MP4, MOV)</p>
            <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            <div className="mt-3 px-4 py-1.5 rounded-lg bg-[#38b6ff]/20 text-[#38b6ff] text-sm">
              {isUploading ? <><Loader2 size={14} className="animate-spin inline mr-1" />Uploading...</> : 'Choose Files'}
            </div>
          </label>
          <button
            onClick={() => setShowGoogleDrivePicker(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm font-medium transition-all"
          >
            <FileImage size={16} />
            Select from Google Drive
          </button>

          {uploadedCreatives.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {uploadedCreatives.map((c, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden border border-white/10">
                  {c.type.startsWith('image/') ? (
                    <img src={c.url} alt={c.name} className="w-full h-20 object-cover" />
                  ) : (
                    <div className="w-full h-20 bg-white/5 flex items-center justify-center">
                      <Video size={24} className="text-gray-400" />
                    </div>
                  )}
                  {c.isAI && <div className="absolute top-1 left-1 px-1 py-0.5 rounded bg-[#cb6ce6]/80 text-white text-[9px]">AI</div>}
                  <button onClick={() => setUploadedCreatives(p => p.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={10} />
                  </button>
                  <p className="text-[9px] text-gray-400 p-1 truncate">{c.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Design Tools */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <ExternalLink size={16} className="text-[#cb6ce6]" /> Integrated Design Tools
          </h3>
          <p className="text-gray-400 text-xs">Open these tools to create your ad creatives, then upload them here.</p>
          <div className="space-y-2">
            {DESIGN_TOOLS.map(tool => (
              <a key={tool.name} href={tool.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl border border-white/10 hover:border-white/20 bg-black/20 hover:bg-black/30 transition-all group">
                {tool.logo ? (
                  <img src={tool.logo} alt={tool.name} className="w-8 h-8 rounded-lg object-contain bg-white p-0.5" onError={(e) => e.target.style.display = 'none'} />
                ) : (
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: tool.color + '30' }}>
                    <Wand2 size={16} style={{ color: tool.color }} />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{tool.name}</p>
                  <p className="text-gray-500 text-xs">{tool.desc}</p>
                </div>
                <ExternalLink size={14} className="text-gray-500 group-hover:text-white transition-colors" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* AI Design Brief */}
      <div className="rounded-2xl bg-gradient-to-r from-[#cb6ce6]/10 to-[#38b6ff]/10 border border-[#cb6ce6]/20 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Sparkles size={16} className="text-[#cb6ce6]" /> AI Design Brief Generator
          </h3>
          {/* A/B Test Toggle */}
          <button
            onClick={() => setAbTestEnabled(v => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all
              ${abTestEnabled ? 'bg-[#38b6ff]/20 border-[#38b6ff]/50 text-[#38b6ff]' : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-white'}`}
          >
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${abTestEnabled ? 'bg-[#38b6ff] text-black' : 'bg-white/20 text-gray-300'}`}>
              {abTestEnabled ? '✓' : 'AB'}
            </span>
            A/B Test {abTestEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        {abTestEnabled && (
          <div className="px-3 py-2 rounded-lg bg-[#38b6ff]/10 border border-[#38b6ff]/20 text-[#38b6ff] text-xs">
            A/B mode: Generates two distinct creative variations (A = bold/direct, B = emotional/storytelling) so you can test which performs better.
          </div>
        )}
        <div className="flex gap-3">
          <Input value={briefPrompt} onChange={e => setBriefPrompt(e.target.value)}
            placeholder={`Describe the ad you want to create for ${selectedPlatform}...`}
            className="flex-1 bg-black/30 border-white/10 text-white"
            onKeyDown={e => e.key === 'Enter' && generateDesignBrief()} />
          <Button onClick={generateDesignBrief} disabled={isGeneratingBrief || !briefPrompt.trim()}
            className="bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2 whitespace-nowrap">
            {isGeneratingBrief ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {abTestEnabled ? 'Generate A/B Briefs' : 'Generate Brief'}
          </Button>
        </div>

        {/* A/B Briefs */}
        {abDesignBriefs.length === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {abDesignBriefs.map((brief, idx) => (
                <div key={idx} className={`rounded-xl border p-4 space-y-2 ${idx === 0 ? 'border-[#38b6ff]/40 bg-[#38b6ff]/5' : 'border-[#cb6ce6]/40 bg-[#cb6ce6]/5'}`}>
                  <p className={`text-xs font-bold ${idx === 0 ? 'text-[#38b6ff]' : 'text-[#cb6ce6]'}`}>
                    {idx === 0 ? '🅰 Variation A — Bold/Direct' : '🅱 Variation B — Emotional/Story'}
                  </p>
                  {brief.headline && <p className="text-white text-sm font-semibold">{brief.headline}</p>}
                  {brief.subheadline && <p className="text-gray-400 text-xs">{brief.subheadline}</p>}
                  {brief.concept && <p className="text-gray-300 text-xs"><span className="text-gray-500">Concept: </span>{brief.concept}</p>}
                  {brief.visual_concept && <p className="text-gray-300 text-xs"><span className="text-gray-500">Visual: </span>{brief.visual_concept}</p>}
                  {brief.cta && <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${idx === 0 ? 'bg-[#38b6ff]/20 text-[#38b6ff]' : 'bg-[#cb6ce6]/20 text-[#cb6ce6]'}`}>{brief.cta}</span>}
                  {brief.color_palette?.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      {brief.color_palette.slice(0, 5).map((c, i) => <div key={i} className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: c }} title={c} />)}
                    </div>
                  )}
                  {brief.ai_image_prompt && (
                    <div className="mt-2 space-y-1">
                      <p className="text-gray-500 text-[10px]">Image prompt:</p>
                      <div className="flex gap-2 items-start">
                        <p className="text-gray-400 text-[10px] flex-1 italic line-clamp-2">{brief.ai_image_prompt}</p>
                        <Button size="sm"
                          disabled={isGeneratingImage}
                          onClick={async () => {
                            setIsGeneratingImage(true);
                            try {
                              const result = await GenerateImage({
                                prompt: `Professional ${selectedPlatform} ad creative. ${brief.ai_image_prompt}. High quality, photorealistic.`,
                              });
                              if (result?.url) {
                                setGeneratedAbImages(prev => {
                                  const next = [...prev]; next[idx] = result.url; return next;
                                });
                                setUploadedCreatives(prev => [...prev, { url: result.url, name: `AI Variation ${brief._label}`, type: 'image/png', isAI: true }]);
                                toast.success(`Variation ${brief._label} image generated!`);
                              }
                            } catch { toast.error('Image generation failed'); }
                            finally { setIsGeneratingImage(false); }
                          }}
                          className="text-[10px] px-2 py-1 h-auto bg-white/10 hover:bg-white/20 text-white border-0 whitespace-nowrap"
                        >
                          {isGeneratingImage ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                          Generate
                        </Button>
                      </div>
                      {generatedAbImages[idx] && <img src={generatedAbImages[idx]} alt={`Variation ${brief._label}`} className="w-full rounded-lg object-cover border border-white/10 mt-1" style={{ maxHeight: 120 }} />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {designBrief && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {designBrief.concept && (
                <div className="p-3 rounded-xl bg-black/30 border border-white/10">
                  <p className="text-gray-400 text-xs mb-1">Concept</p>
                  <p className="text-white text-sm">{designBrief.concept}</p>
                </div>
              )}
              {designBrief.headline && (
                <div className="p-3 rounded-xl bg-black/30 border border-white/10">
                  <p className="text-gray-400 text-xs mb-1">Headline</p>
                  <p className="text-white text-sm font-semibold">{designBrief.headline}</p>
                  {designBrief.subheadline && <p className="text-gray-400 text-xs mt-1">{designBrief.subheadline}</p>}
                </div>
              )}
            </div>
            {designBrief.visual_concept && (
              <div className="p-3 rounded-xl bg-black/30 border border-white/10">
                <p className="text-gray-400 text-xs mb-1">Visual Concept</p>
                <p className="text-white text-sm">{designBrief.visual_concept}</p>
              </div>
            )}
            {designBrief.color_palette?.length > 0 && (
              <div className="flex items-center gap-3">
                <p className="text-gray-400 text-xs">Colors:</p>
                {designBrief.color_palette.map((c, i) => (
                  <div key={i} className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: c }} title={c} />
                ))}
                <p className="text-gray-500 text-xs">{designBrief.color_palette.join(', ')}</p>
              </div>
            )}
            {designBrief.cta && (
              <div className="flex items-center gap-2">
                <p className="text-gray-400 text-xs">CTA:</p>
                <span className="px-3 py-1 rounded-full bg-[#38b6ff]/20 text-[#38b6ff] text-xs font-medium">{designBrief.cta}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {designBrief.do_list?.length > 0 && (
                <div>
                  <p className="text-green-400 text-xs font-medium mb-1">✅ Do</p>
                  {designBrief.do_list.slice(0, 3).map((item, i) => <p key={i} className="text-gray-300 text-xs">• {item}</p>)}
                </div>
              )}
              {designBrief.dont_list?.length > 0 && (
                <div>
                  <p className="text-red-400 text-xs font-medium mb-1">❌ Don't</p>
                  {designBrief.dont_list.slice(0, 3).map((item, i) => <p key={i} className="text-gray-300 text-xs">• {item}</p>)}
                </div>
              )}
            </div>

            {/* AI Image Generation */}
            <div className="mt-2 p-3 rounded-xl bg-[#38b6ff]/10 border border-[#38b6ff]/20 space-y-2">
              <p className="text-[#38b6ff] text-xs font-semibold flex items-center gap-1"><Image size={12} /> Generate AI Image from Brief</p>
              <Textarea value={imagePrompt} onChange={e => setImagePrompt(e.target.value)}
                className="min-h-[60px] text-xs bg-black/30 border-white/10 text-white resize-none" placeholder="AI image prompt (auto-filled from brief)..." />
              <Button onClick={generateAIImage} disabled={isGeneratingImage || !imagePrompt.trim()}
                size="sm" className="bg-[#38b6ff] text-black gap-1.5 text-xs">
                {isGeneratingImage ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {isGeneratingImage ? 'Generating...' : 'Generate Image'}
              </Button>
              {generatedImage && (
                <div className="flex gap-3 items-start mt-2">
                  <img src={generatedImage} alt="AI Generated" className="w-32 h-32 rounded-xl object-cover border border-[#38b6ff]/30" />
                  <div className="flex flex-col gap-2">
                    <p className="text-green-400 text-xs">✅ Generated! Added to your creatives above.</p>
                    <a href={generatedImage} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-1 text-xs">
                        <Download size={12} /> Download
                      </Button>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Google Drive Image Picker */}
      <GoogleDriveImagePicker
        open={showGoogleDrivePicker}
        onClose={() => setShowGoogleDrivePicker(false)}
        onSelect={(image) => {
          setUploadedCreatives(prev => [...prev, { url: image.url, name: image.name, type: 'image/jpeg' }]);
          setShowGoogleDrivePicker(false);
        }}
      />
    </div>
  );
}