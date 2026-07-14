import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Palette, Download, Save, Send, Plus, Trash2, Type, Image as ImageIcon,
  Layers, Loader2, Sparkles, ChevronLeft, ChevronRight, Copy, LayoutTemplate,
  Upload, Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Company, DesignTemplate } from '@/api/entities';
import { GenerateImage, UploadFile } from '@/api/integrations';
import { setDesignHandoff, peekDesignReturn, clearDesignReturn } from '@/lib/designHandoff';

// ─── Aspect ratios (export resolution) ───────────────────────────────────────
const ASPECT_RATIOS = [
  { id: 'square',      label: '1:1 — Feed (IG/FB/LinkedIn)', w: 1080, h: 1080 },
  { id: 'portrait',    label: '4:5 — Feed Portrait (IG/FB)', w: 1080, h: 1350 },
  { id: 'story',       label: '9:16 — Story / Reels / TikTok', w: 1080, h: 1920 },
  { id: 'landscape',   label: '16:9 — YouTube / Widescreen', w: 1920, h: 1080 },
  { id: 'link',        label: '1.91:1 — Link/OG & Meta Ads', w: 1200, h: 628 },
  { id: 'blog',        label: '2:1 — Blog Hero', w: 1600, h: 800 },
  { id: 'banner',      label: '3:1 — Website Banner', w: 1500, h: 500 },
  { id: 'twitter',     label: '16:9 — X/Twitter Post', w: 1600, h: 900 },
  { id: 'pinterest',   label: '2:3 — Pinterest Pin', w: 1000, h: 1500 },
  { id: 'leaderboard', label: '8.1:1 — Display Ad Leaderboard', w: 728, h: 90 },
];

// ─── Font library (system + Google Fonts, loaded on demand) ─────────────────
const FONTS = [
  { name: 'Inter', google: 'Inter:wght@400;700;900' },
  { name: 'Bebas Neue', google: 'Bebas+Neue' },
  { name: 'Montserrat', google: 'Montserrat:wght@400;700;900' },
  { name: 'Poppins', google: 'Poppins:wght@400;700;900' },
  { name: 'Roboto', google: 'Roboto:wght@400;700;900' },
  { name: 'Open Sans', google: 'Open+Sans:wght@400;700' },
  { name: 'Lato', google: 'Lato:wght@400;700;900' },
  { name: 'Raleway', google: 'Raleway:wght@400;700;900' },
  { name: 'Playfair Display', google: 'Playfair+Display:wght@400;700;900' },
  { name: 'Merriweather', google: 'Merriweather:wght@400;700;900' },
  { name: 'Oswald', google: 'Oswald:wght@400;700' },
  { name: 'Anton', google: 'Anton' },
  { name: 'Archivo Black', google: 'Archivo+Black' },
  { name: 'DM Sans', google: 'DM+Sans:wght@400;700;900' },
  { name: 'Space Grotesk', google: 'Space+Grotesk:wght@400;700' },
  { name: 'Nunito', google: 'Nunito:wght@400;700;900' },
  { name: 'Source Sans 3', google: 'Source+Sans+3:wght@400;700;900' },
  { name: 'Work Sans', google: 'Work+Sans:wght@400;700;900' },
  { name: 'Rubik', google: 'Rubik:wght@400;700;900' },
  { name: 'Barlow Condensed', google: 'Barlow+Condensed:wght@400;700' },
  { name: 'Abril Fatface', google: 'Abril+Fatface' },
  { name: 'Lobster', google: 'Lobster' },
  { name: 'Pacifico', google: 'Pacifico' },
  { name: 'Caveat', google: 'Caveat:wght@400;700' },
  { name: 'Arial', google: null },
  { name: 'Georgia', google: null },
  { name: 'Courier New', google: null },
];

const loadedFonts = new Set();
function ensureFontLoaded(fontName) {
  const font = FONTS.find(f => f.name === fontName);
  if (!font?.google || loadedFonts.has(fontName)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
  document.head.appendChild(link);
  loadedFonts.add(fontName);
}

// Text roles with default sizes (px at 1080 design width)
const TEXT_ROLES = [
  { id: 'h1', label: 'H1', size: 88, weight: 900 },
  { id: 'h2', label: 'H2', size: 64, weight: 700 },
  { id: 'h3', label: 'H3', size: 48, weight: 700 },
  { id: 'h4', label: 'H4', size: 36, weight: 700 },
  { id: 'h5', label: 'H5', size: 28, weight: 700 },
  { id: 'subtitle', label: 'Subtitle', size: 32, weight: 400 },
  { id: 'body', label: 'Text', size: 22, weight: 400 },
];

const BG_PRESETS = ['#111111', '#ffffff', '#38b6ff', '#3572b9', '#cb6ce6', '#22c55e', '#f59e0b', '#ef4444', '#0f172a', '#fdf6ec'];

let idCounter = 1;
const nextId = () => `l${Date.now().toString(36)}${idCounter++}`;

const newSlide = () => ({
  background: { type: 'color', color: '#111111', imageUrl: null },
  layers: [],
});

const DEFAULT_DESIGN = () => ({
  format: 'single',
  aspectRatio: 'square',
  slides: [newSlide()],
});

// ─── Canvas export ───────────────────────────────────────────────────────────
function loadImg(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function renderSlideToCanvas(slide, ratio) {
  const canvas = document.createElement('canvas');
  canvas.width = ratio.w;
  canvas.height = ratio.h;
  const ctx = canvas.getContext('2d');

  // Background
  if (slide.background.type !== 'color' && slide.background.imageUrl) {
    try {
      const img = await loadImg(slide.background.imageUrl);
      // cover fit
      const scale = Math.max(ratio.w / img.width, ratio.h / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, (ratio.w - dw) / 2, (ratio.h - dh) / 2, dw, dh);
    } catch {
      ctx.fillStyle = slide.background.color || '#111';
      ctx.fillRect(0, 0, ratio.w, ratio.h);
    }
  } else {
    ctx.fillStyle = slide.background.color || '#111';
    ctx.fillRect(0, 0, ratio.w, ratio.h);
  }

  await document.fonts.ready;

  for (const layer of slide.layers) {
    if (layer.type === 'image') {
      try {
        const img = await loadImg(layer.url);
        const w = layer.w * ratio.w;
        const h = w * (img.height / img.width);
        ctx.globalAlpha = layer.opacity ?? 1;
        ctx.drawImage(img, layer.x * ratio.w, layer.y * ratio.h, w, h);
        ctx.globalAlpha = 1;
      } catch { /* skip broken image */ }
    } else if (layer.type === 'text') {
      const fontPx = layer.size * (ratio.w / 1080);
      ctx.font = `${layer.weight || 400} ${fontPx}px "${layer.font || 'Inter'}", sans-serif`;
      ctx.fillStyle = layer.color || '#fff';
      ctx.textAlign = layer.align || 'left';
      ctx.textBaseline = 'top';
      const x = layer.x * ratio.w + (layer.align === 'center' ? (layer.wFrac || 0.8) * ratio.w / 2 : layer.align === 'right' ? (layer.wFrac || 0.8) * ratio.w : 0);
      // simple word wrap within layer width
      const maxW = (layer.wFrac || 0.8) * ratio.w;
      const lines = [];
      for (const para of String(layer.text || '').split('\n')) {
        let line = '';
        for (const word of para.split(' ')) {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
          else line = test;
        }
        lines.push(line);
      }
      lines.forEach((ln, i) => {
        ctx.fillText(ln, x, layer.y * ratio.h + i * fontPx * 1.25);
      });
    }
  }
  return canvas;
}

function canvasToFile(canvas, name) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(new File([blob], `${name}.png`, { type: 'image/png' })), 'image/png');
  });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function Design() {
  const { isPt } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [design, setDesign] = useState(DEFAULT_DESIGN);
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showAIBg, setShowAIBg] = useState(false);
  const [aiBgPrompt, setAiBgPrompt] = useState('');
  const [busy, setBusy] = useState(null); // 'export' | 'send:social' | 'aibg' | 'upload'
  const canvasWrapRef = useRef(null);
  const dragRef = useRef(null);
  // Where the user came from (Social/Ads/Blog) + their saved draft, if any
  const [returnCtx] = useState(peekDesignReturn);

  // ── Undo history (Ctrl+Z) ───────────────────────────────────────────────
  const historyRef = useRef([]);
  const lastPushRef = useRef(0);
  const pushHistory = useCallback(() => {
    const now = Date.now();
    if (now - lastPushRef.current < 500) return; // coalesce rapid edits (drag, typing)
    lastPushRef.current = now;
    setDesign(current => {
      historyRef.current.push(JSON.stringify({ design: current }));
      if (historyRef.current.length > 50) historyRef.current.shift();
      return current;
    });
  }, []);

  const undo = useCallback(() => {
    const snap = historyRef.current.pop();
    if (!snap) return;
    lastPushRef.current = 0;
    const { design: prev } = JSON.parse(snap);
    setDesign(prev);
    setActiveSlide(i => Math.min(i, prev.slides.length - 1));
    setSelectedLayerId(null);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      // Let native text-undo work inside inputs
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => Company.list() });
  const company = companies[0];

  const { data: templates = [] } = useQuery({
    queryKey: ['designTemplates'],
    queryFn: () => DesignTemplate.list(),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: (data) => DesignTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designTemplates'] });
      setShowSaveDialog(false);
      setTemplateName('');
      toast.success(isPt ? 'Template salvo!' : 'Template saved!');
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id) => DesignTemplate.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['designTemplates'] }),
  });

  const ratio = ASPECT_RATIOS.find(r => r.id === design.aspectRatio) || ASPECT_RATIOS[0];
  const slide = design.slides[activeSlide] || design.slides[0];
  const selectedLayer = slide?.layers.find(l => l.id === selectedLayerId) || null;

  // ── State updaters ──────────────────────────────────────────────────────
  const updateSlide = useCallback((updater) => {
    pushHistory();
    setDesign(prev => {
      const slides = prev.slides.map((s, i) => (i === activeSlide ? updater(s) : s));
      return { ...prev, slides };
    });
  }, [activeSlide, pushHistory]);

  const updateLayer = (layerId, patch) => {
    updateSlide(s => ({ ...s, layers: s.layers.map(l => (l.id === layerId ? { ...l, ...patch } : l)) }));
  };

  const addTextLayer = (role) => {
    const r = TEXT_ROLES.find(t => t.id === role) || TEXT_ROLES[0];
    const layer = {
      id: nextId(), type: 'text', role: r.id,
      text: r.label === 'Text' ? (isPt ? 'Seu texto aqui' : 'Your text here') : r.label,
      font: 'Inter', size: r.size, weight: r.weight, color: '#ffffff',
      align: 'left', x: 0.08, y: 0.1 + slide.layers.length * 0.08, wFrac: 0.84,
    };
    updateSlide(s => ({ ...s, layers: [...s.layers, layer] }));
    setSelectedLayerId(layer.id);
  };

  const addImageLayer = async (file, role = 'image') => {
    setBusy('upload');
    try {
      const { url } = await UploadFile({ file, folder: 'designs' });
      const layer = { id: nextId(), type: 'image', role, url, x: 0.1, y: 0.1, w: role === 'logo' ? 0.18 : 0.4, opacity: 1 };
      updateSlide(s => ({ ...s, layers: [...s.layers, layer] }));
      setSelectedLayerId(layer.id);
    } catch (e) {
      toast.error((isPt ? 'Falha no upload: ' : 'Upload failed: ') + e.message);
    } finally { setBusy(null); }
  };

  const removeLayer = (layerId) => {
    updateSlide(s => ({ ...s, layers: s.layers.filter(l => l.id !== layerId) }));
    if (selectedLayerId === layerId) setSelectedLayerId(null);
  };

  const setBg = (patch) => updateSlide(s => ({ ...s, background: { ...s.background, ...patch } }));

  const uploadBgImage = async (file) => {
    setBusy('upload');
    try {
      const { url } = await UploadFile({ file, folder: 'designs' });
      setBg({ type: 'image', imageUrl: url });
    } catch (e) {
      toast.error((isPt ? 'Falha no upload: ' : 'Upload failed: ') + e.message);
    } finally { setBusy(null); }
  };

  const generateAIBg = async () => {
    if (!aiBgPrompt.trim()) return;
    setBusy('aibg');
    try {
      const url = await GenerateImage({
        prompt: `${aiBgPrompt}. Style: clean marketing background image, no text, no words, no letters.`,
        size: ratio.w >= ratio.h ? '1792x1024' : '1024x1792',
      });
      if (!url) throw new Error('No image returned');
      // Persist to our storage (provider URLs expire)
      const blob = await fetch(url).then(r => r.blob());
      const saved = await UploadFile({ file: new File([blob], 'ai-bg.png', { type: 'image/png' }), folder: 'designs' });
      setBg({ type: 'ai', imageUrl: saved.url });
      setShowAIBg(false);
      setAiBgPrompt('');
      toast.success(isPt ? 'Fundo gerado!' : 'Background generated!');
    } catch (e) {
      toast.error((isPt ? 'Falha ao gerar: ' : 'Generation failed: ') + e.message);
    } finally { setBusy(null); }
  };

  // ── Carousel ────────────────────────────────────────────────────────────
  const addSlide = () => {
    pushHistory();
    setDesign(prev => ({ ...prev, format: 'carousel', slides: [...prev.slides, newSlide()] }));
    setActiveSlide(design.slides.length);
  };
  const duplicateSlide = () => {
    pushHistory();
    const copy = JSON.parse(JSON.stringify(slide));
    copy.layers = copy.layers.map(l => ({ ...l, id: nextId() }));
    setDesign(prev => ({ ...prev, format: 'carousel', slides: [...prev.slides, copy] }));
    setActiveSlide(design.slides.length);
  };
  const removeSlide = () => {
    if (design.slides.length <= 1) return;
    pushHistory();
    setDesign(prev => {
      const slides = prev.slides.filter((_, i) => i !== activeSlide);
      return { ...prev, format: slides.length > 1 ? 'carousel' : 'single', slides };
    });
    setActiveSlide(Math.max(0, activeSlide - 1));
  };

  // ── Drag positioning ────────────────────────────────────────────────────
  const startDrag = (e, layer) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedLayerId(layer.id);
    const rect = canvasWrapRef.current.getBoundingClientRect();
    dragRef.current = { layerId: layer.id, rect, startX: e.clientX, startY: e.clientY, origX: layer.x, origY: layer.y };
    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (ev.clientX - d.startX) / d.rect.width;
      const dy = (ev.clientY - d.startY) / d.rect.height;
      updateLayer(d.layerId, { x: Math.min(0.98, Math.max(-0.3, d.origX + dx)), y: Math.min(0.98, Math.max(-0.3, d.origY + dy)) });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Export / send ───────────────────────────────────────────────────────
  const exportSlides = async () => {
    const files = [];
    for (let i = 0; i < design.slides.length; i++) {
      const canvas = await renderSlideToCanvas(design.slides[i], ratio);
      files.push(await canvasToFile(canvas, `bmapz-design-${i + 1}`));
    }
    return files;
  };

  const download = async () => {
    setBusy('export');
    try {
      const files = await exportSlides();
      for (const f of files) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(f);
        a.download = f.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      toast.success(isPt ? `${files.length} imagem(ns) baixada(s)` : `${files.length} image(s) downloaded`);
    } catch (e) {
      toast.error((isPt ? 'Falha na exportação: ' : 'Export failed: ') + e.message);
    } finally { setBusy(null); }
  };

  const sendTo = async (target, path) => {
    setBusy(`send:${target}`);
    try {
      const files = await exportSlides();
      const urls = [];
      for (const f of files) {
        const { url } = await UploadFile({ file: f, folder: 'designs' });
        urls.push(url);
      }
      // If the user came FROM this section, ride their saved draft along so
      // the images attach to the exact post/creatives they were working on.
      const cameFromTarget = returnCtx?.source === target;
      setDesignHandoff({
        target, urls,
        name: templateName || 'Design',
        draft: cameFromTarget ? returnCtx.draft : null,
      });
      if (cameFromTarget) clearDesignReturn();
      toast.success(isPt ? 'Design enviado!' : 'Design sent!');
      navigate(path);
    } catch (e) {
      toast.error((isPt ? 'Falha ao enviar: ' : 'Send failed: ') + e.message);
    } finally { setBusy(null); }
  };

  const loadTemplate = (t) => {
    try {
      const cfg = t.config || {};
      if (!cfg.slides?.length) throw new Error('empty');
      pushHistory();
      setDesign({ format: cfg.format || 'single', aspectRatio: cfg.aspectRatio || 'square', slides: cfg.slides });
      setActiveSlide(0);
      setSelectedLayerId(null);
      cfg.slides.forEach(s => s.layers?.forEach(l => l.font && ensureFontLoaded(l.font)));
      toast.success(isPt ? `Template "${t.name}" carregado` : `Template "${t.name}" loaded`);
    } catch {
      toast.error(isPt ? 'Template inválido' : 'Invalid template');
    }
  };

  // Load brand fonts on mount for defaults
  useEffect(() => { ensureFontLoaded('Inter'); ensureFontLoaded('Bebas Neue'); }, []);

  // Preview scaling — fit BOTH a max height and the available container width,
  // so wide banners and phones don't overflow horizontally.
  const stageRef = useRef(null);
  const [stageW, setStageW] = useState(0);
  useEffect(() => {
    if (!stageRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => setStageW(entries[0]?.contentRect?.width || 0));
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);
  // Canvas fits BOTH the available width and the viewport height so it always
  // adjusts to the screen (laptops, big monitors, phones).
  const [maxPreviewH, setMaxPreviewH] = useState(440);
  useEffect(() => {
    const calc = () => setMaxPreviewH(Math.max(260, Math.min(540, (window.innerHeight || 800) - 330)));
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  let previewW = maxPreviewH * (ratio.w / ratio.h);
  const availableW = stageW ? stageW - 24 : 0;
  if (availableW > 100 && previewW > availableW) previewW = availableW;
  const previewH = previewW * (ratio.h / ratio.w);

  const busyIs = (k) => busy === k;

  const SEND_TARGETS = [
    { key: 'social', label: isPt ? '📱 Redes Sociais' : '📱 Social Media', path: '/SocialMedia' },
    { key: 'ads', label: isPt ? '📢 Anúncios' : '📢 Ads', path: '/Ads' },
    { key: 'blog', label: '📝 Blog', path: '/Blog' },
  ];
  const returnTarget = returnCtx ? SEND_TARGETS.find(d => d.key === returnCtx.source) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            {isPt ? 'Design' : 'Design'}
          </h1>
          <p className="text-gray-400 mt-1">
            {isPt
              ? 'Crie imagens alinhadas à marca para Blog, Redes Sociais e Anúncios — templates, textos, fundos e logos.'
              : 'Create on-brand images for Blog, Social Media and Ads — templates, text, backgrounds and logos.'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={undo} title="Ctrl+Z"
            className="border-white/10 text-white hover:bg-white/5 gap-2">
            ↩ {isPt ? 'Desfazer' : 'Undo'}
          </Button>
          <Button variant="outline" onClick={() => setShowSaveDialog(true)}
            className="border-white/10 text-white hover:bg-white/5 gap-2">
            <Save size={15} /> {isPt ? 'Salvar Template' : 'Save Template'}
          </Button>
          <Button onClick={download} disabled={!!busy} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
            {busyIs('export') ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {isPt ? 'Baixar PNG' : 'Download PNG'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_300px] gap-5">
        {/* ── LEFT: templates + format ── */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <p className="text-white text-sm font-semibold flex items-center gap-2"><LayoutTemplate size={14} className="text-[#38b6ff]" /> {isPt ? 'Formato' : 'Format'}</p>
            <div className="flex gap-2">
              <button onClick={() => { setDesign(p => ({ ...p, format: 'single', slides: [p.slides[activeSlide] || p.slides[0]] })); setActiveSlide(0); }}
                className={`flex-1 px-3 py-2 rounded-xl text-sm border transition-all ${design.format === 'single' ? 'bg-[#38b6ff]/15 border-[#38b6ff]/40 text-[#38b6ff]' : 'bg-black/20 border-white/10 text-gray-400'}`}>
                {isPt ? 'Única' : 'Single'}
              </button>
              <button onClick={() => design.format !== 'carousel' && addSlide()}
                className={`flex-1 px-3 py-2 rounded-xl text-sm border transition-all ${design.format === 'carousel' ? 'bg-[#38b6ff]/15 border-[#38b6ff]/40 text-[#38b6ff]' : 'bg-black/20 border-white/10 text-gray-400'}`}>
                {isPt ? 'Carrossel' : 'Carousel'}
              </button>
            </div>
            <div>
              <Label className="text-gray-400 text-xs">{isPt ? 'Proporção' : 'Aspect ratio'}</Label>
              <Select value={design.aspectRatio} onValueChange={(v) => { pushHistory(); setDesign(p => ({ ...p, aspectRatio: v })); }}>
                <SelectTrigger className="bg-black/30 border-white/10 text-white mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-gray-600 text-[10px] mt-1">{ratio.w}×{ratio.h}px</p>
            </div>
          </div>

          {/* Company templates */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <p className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
              <Palette size={14} className="text-[#cb6ce6]" /> {isPt ? 'Templates da Marca' : 'Brand Templates'}
            </p>
            {templates.length === 0 && (
              <p className="text-gray-500 text-xs">
                {isPt ? 'Salve seu primeiro template para reutilizar a identidade da marca.' : 'Save your first template to reuse your brand identity.'}
              </p>
            )}
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="flex items-center gap-2 p-2 rounded-xl bg-black/20 border border-white/5 hover:border-[#38b6ff]/30 transition-all group">
                  <button onClick={() => loadTemplate(t)} className="flex-1 text-left min-w-0">
                    <p className="text-white text-xs font-medium truncate">{t.name}</p>
                    <p className="text-gray-500 text-[10px]">{t.config?.slides?.length || 1} slide(s) · {t.config?.aspectRatio}</p>
                  </button>
                  <button onClick={() => deleteTemplateMutation.mutate(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400/70 hover:text-red-400 transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Send to */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
            <p className="text-white text-sm font-semibold flex items-center gap-2"><Send size={14} className="text-green-400" /> {isPt ? 'Enviar para' : 'Send to'}</p>
            {returnTarget && (
              <Button disabled={!!busy}
                onClick={() => sendTo(returnTarget.key, returnTarget.path)}
                className="w-full bg-gradient-to-r from-[#22c55e] to-[#38b6ff] text-white justify-start gap-2 text-sm font-semibold">
                {busyIs(`send:${returnTarget.key}`) ? <Loader2 size={14} className="animate-spin" /> : '↩'}
                {isPt ? `Voltar para ${returnCtx.label || returnTarget.label}` : `Send back to ${returnCtx.label || returnTarget.label}`}
              </Button>
            )}
            {SEND_TARGETS.filter(d => d.key !== returnTarget?.key).map(d => (
              <Button key={d.key} variant="outline" disabled={!!busy}
                onClick={() => sendTo(d.key, d.path)}
                className="w-full border-white/10 text-white hover:bg-white/5 justify-start gap-2 text-sm">
                {busyIs(`send:${d.key}`) ? <Loader2 size={14} className="animate-spin" /> : null}
                {d.label}
              </Button>
            ))}
          </div>
        </div>

        {/* ── CENTER: canvas ── */}
        <div className="space-y-3">
          {/* Slide nav (carousel) */}
          {design.format === 'carousel' && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))} className="text-gray-400 hover:text-white"><ChevronLeft size={18} /></button>
              <span className="text-gray-400 text-sm">{isPt ? 'Slide' : 'Slide'} {activeSlide + 1}/{design.slides.length}</span>
              <button onClick={() => setActiveSlide(Math.min(design.slides.length - 1, activeSlide + 1))} className="text-gray-400 hover:text-white"><ChevronRight size={18} /></button>
              <div className="flex gap-1 ml-2">
                <Button size="sm" variant="outline" onClick={duplicateSlide} className="border-white/10 text-white h-7 px-2 text-xs gap-1"><Copy size={11} />{isPt ? 'Duplicar' : 'Duplicate'}</Button>
                <Button size="sm" variant="outline" onClick={addSlide} className="border-white/10 text-white h-7 px-2 text-xs gap-1"><Plus size={11} />{isPt ? 'Slide' : 'Slide'}</Button>
                {design.slides.length > 1 && (
                  <Button size="sm" variant="outline" onClick={removeSlide} className="border-red-500/20 text-red-400 h-7 px-2 text-xs"><Trash2 size={11} /></Button>
                )}
              </div>
            </div>
          )}

          <div ref={stageRef} className="flex items-center justify-center rounded-2xl bg-black/40 border border-white/10 p-3 sm:p-6 overflow-auto">
            <div ref={canvasWrapRef}
              className="relative overflow-hidden shadow-2xl flex-shrink-0"
              style={{
                width: previewW, height: previewH,
                background: slide.background.type !== 'color' && slide.background.imageUrl
                  ? `url(${slide.background.imageUrl}) center/cover`
                  : slide.background.color,
              }}
              onMouseDown={() => setSelectedLayerId(null)}>
              {slide.layers.map(layer => {
                const isSel = layer.id === selectedLayerId;
                if (layer.type === 'image') {
                  return (
                    <img key={layer.id} src={layer.url} alt=""
                      draggable={false}
                      onMouseDown={(e) => startDrag(e, layer)}
                      className={`absolute cursor-move select-none ${isSel ? 'ring-2 ring-[#38b6ff]' : ''}`}
                      style={{
                        left: `${layer.x * 100}%`, top: `${layer.y * 100}%`,
                        width: `${layer.w * 100}%`, opacity: layer.opacity ?? 1,
                      }} />
                  );
                }
                const fontPx = layer.size * (previewW / 1080);
                return (
                  <div key={layer.id}
                    onMouseDown={(e) => startDrag(e, layer)}
                    className={`absolute cursor-move select-none whitespace-pre-wrap ${isSel ? 'ring-2 ring-[#38b6ff]' : ''}`}
                    style={{
                      left: `${layer.x * 100}%`, top: `${layer.y * 100}%`,
                      width: `${(layer.wFrac || 0.8) * 100}%`,
                      fontFamily: `"${layer.font}", sans-serif`,
                      fontSize: fontPx, fontWeight: layer.weight,
                      color: layer.color, textAlign: layer.align,
                      lineHeight: 1.25,
                    }}>
                    {layer.text}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add layer toolbar */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Select onValueChange={(v) => addTextLayer(v)} value="">
              <SelectTrigger className="w-auto min-w-[118px] justify-start gap-1.5 bg-white/5 border-white/10 text-white text-sm h-9">
                <Type size={14} className="shrink-0" />
                <span className="whitespace-nowrap">{isPt ? '+ Texto' : '+ Text'}</span>
              </SelectTrigger>
              <SelectContent>
                {TEXT_ROLES.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer text-sm text-white transition-all">
              <ImageIcon size={13} /> {isPt ? '+ Imagem' : '+ Image'}
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && addImageLayer(e.target.files[0], 'image')} />
            </label>
            <label className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer text-sm text-white transition-all">
              <Sparkles size={13} /> {isPt ? '+ Logo' : '+ Logo'}
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && addImageLayer(e.target.files[0], 'logo')} />
            </label>
            {company?.logo_url && (
              <Button size="sm" variant="outline" onClick={() => {
                const layer = { id: nextId(), type: 'image', role: 'logo', url: company.logo_url, x: 0.78, y: 0.05, w: 0.16, opacity: 1 };
                updateSlide(s => ({ ...s, layers: [...s.layers, layer] }));
              }} className="border-white/10 text-white h-9 text-xs">
                {isPt ? 'Logo da empresa' : 'Company logo'}
              </Button>
            )}
          </div>
        </div>

        {/* ── RIGHT: properties ── */}
        <div className="space-y-4">
          {/* Background */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <p className="text-white text-sm font-semibold">{isPt ? 'Fundo' : 'Background'}</p>
            <div className="flex flex-wrap gap-1.5">
              {BG_PRESETS.map(c => (
                <button key={c} onClick={() => setBg({ type: 'color', color: c, imageUrl: null })}
                  className={`w-7 h-7 rounded-lg border ${slide.background.type === 'color' && slide.background.color === c ? 'border-[#38b6ff] ring-1 ring-[#38b6ff]' : 'border-white/20'}`}
                  style={{ background: c }} />
              ))}
              <input type="color" value={slide.background.color || '#111111'}
                onChange={(e) => setBg({ type: 'color', color: e.target.value, imageUrl: null })}
                className="w-7 h-7 rounded-lg bg-transparent border border-white/20 cursor-pointer" />
            </div>
            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-black/20 border border-white/10 hover:bg-white/5 cursor-pointer text-xs text-gray-300 transition-all">
                <Upload size={12} /> {isPt ? 'Imagem' : 'Image'}
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadBgImage(e.target.files[0])} />
              </label>
              <button onClick={() => setShowAIBg(true)}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-gradient-to-r from-[#cb6ce6]/20 to-[#38b6ff]/20 border border-[#cb6ce6]/30 hover:border-[#cb6ce6]/60 text-xs text-white transition-all">
                <Wand2 size={12} /> {isPt ? 'Fundo IA' : 'AI Background'}
              </button>
            </div>
          </div>

          {/* Selected layer */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-white text-sm font-semibold flex items-center gap-2"><Layers size={14} className="text-[#38b6ff]" /> {isPt ? 'Camada' : 'Layer'}</p>
              {selectedLayer && (
                <button onClick={() => removeLayer(selectedLayer.id)} className="text-red-400/70 hover:text-red-400"><Trash2 size={13} /></button>
              )}
            </div>
            {!selectedLayer && <p className="text-gray-500 text-xs">{isPt ? 'Clique em um elemento no canvas para editar. Arraste para posicionar.' : 'Click an element on the canvas to edit. Drag to position.'}</p>}

            {selectedLayer?.type === 'text' && (
              <div className="space-y-3">
                <Textarea value={selectedLayer.text}
                  onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
                  className="bg-black/30 border-white/10 text-white text-sm min-h-[70px]" />
                <div>
                  <Label className="text-gray-400 text-xs">{isPt ? 'Fonte' : 'Font'}</Label>
                  <Select value={selectedLayer.font}
                    onValueChange={(v) => { ensureFontLoaded(v); updateLayer(selectedLayer.id, { font: v }); }}>
                    <SelectTrigger className="bg-black/30 border-white/10 text-white mt-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-[260px]">
                      {FONTS.map(f => <SelectItem key={f.name} value={f.name}><span style={{ fontFamily: f.name }}>{f.name}</span></SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-gray-400 text-xs">{isPt ? 'Tamanho' : 'Size'}</Label>
                    <Input type="number" min={8} max={300} value={selectedLayer.size}
                      onChange={(e) => updateLayer(selectedLayer.id, { size: Number(e.target.value) || 22 })}
                      className="bg-black/30 border-white/10 text-white mt-1 h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">{isPt ? 'Cor' : 'Color'}</Label>
                    <input type="color" value={selectedLayer.color}
                      onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
                      className="w-full h-8 mt-1 rounded-lg bg-transparent border border-white/20 cursor-pointer" />
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {['left', 'center', 'right'].map(a => (
                    <button key={a} onClick={() => updateLayer(selectedLayer.id, { align: a })}
                      className={`flex-1 py-1.5 rounded-lg text-xs border ${selectedLayer.align === a ? 'bg-[#38b6ff]/15 border-[#38b6ff]/40 text-[#38b6ff]' : 'bg-black/20 border-white/10 text-gray-400'}`}>
                      {a === 'left' ? (isPt ? 'Esq.' : 'Left') : a === 'center' ? (isPt ? 'Centro' : 'Center') : (isPt ? 'Dir.' : 'Right')}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  {[400, 700, 900].map(w => (
                    <button key={w} onClick={() => updateLayer(selectedLayer.id, { weight: w })}
                      className={`flex-1 py-1.5 rounded-lg text-xs border ${selectedLayer.weight === w ? 'bg-[#38b6ff]/15 border-[#38b6ff]/40 text-[#38b6ff]' : 'bg-black/20 border-white/10 text-gray-400'}`}
                      style={{ fontWeight: w }}>
                      {w === 400 ? 'Regular' : w === 700 ? 'Bold' : 'Black'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedLayer?.type === 'image' && (
              <div className="space-y-3">
                <div>
                  <Label className="text-gray-400 text-xs">{isPt ? 'Largura' : 'Width'} ({Math.round(selectedLayer.w * 100)}%)</Label>
                  <input type="range" min={5} max={100} value={selectedLayer.w * 100}
                    onChange={(e) => updateLayer(selectedLayer.id, { w: Number(e.target.value) / 100 })}
                    className="w-full mt-1 accent-[#38b6ff]" />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">{isPt ? 'Opacidade' : 'Opacity'} ({Math.round((selectedLayer.opacity ?? 1) * 100)}%)</Label>
                  <input type="range" min={10} max={100} value={(selectedLayer.opacity ?? 1) * 100}
                    onChange={(e) => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) / 100 })}
                    className="w-full mt-1 accent-[#38b6ff]" />
                </div>
              </div>
            )}
          </div>

          {/* Layer list */}
          {slide.layers.length > 0 && (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="text-white text-sm font-semibold mb-2">{isPt ? 'Camadas' : 'Layers'}</p>
              <div className="space-y-1">
                {slide.layers.map(l => (
                  <button key={l.id} onClick={() => setSelectedLayerId(l.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition-all ${l.id === selectedLayerId ? 'bg-[#38b6ff]/15 text-[#38b6ff]' : 'text-gray-400 hover:bg-white/5'}`}>
                    {l.type === 'text' ? <Type size={11} /> : <ImageIcon size={11} />}
                    <span className="truncate">{l.type === 'text' ? l.text?.slice(0, 26) : (l.role === 'logo' ? 'Logo' : (isPt ? 'Imagem' : 'Image'))}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save template dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-md bg-[#111] border-white/10 text-white">
          <DialogHeader><DialogTitle>{isPt ? 'Salvar como Template' : 'Save as Template'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-gray-400">{isPt ? 'Nome do template' : 'Template name'}</Label>
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)}
                placeholder={isPt ? 'ex.: Post padrão da marca' : 'e.g., Default brand post'}
                className="bg-black/30 border-white/10 text-white mt-1.5" />
            </div>
            <p className="text-gray-500 text-xs">
              {isPt
                ? 'O template salva formato, proporção, fundos, textos, fontes, posições e logos — reutilizável em qualquer criação.'
                : 'The template saves format, aspect ratio, backgrounds, texts, fonts, positions and logos — reusable in any creation.'}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)} className="border-white/10 text-white">{isPt ? 'Cancelar' : 'Cancel'}</Button>
              <Button disabled={!templateName.trim() || saveTemplateMutation.isPending}
                onClick={() => saveTemplateMutation.mutate({ name: templateName, config: design, is_brand_preset: true })}
                className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]">
                {saveTemplateMutation.isPending ? <Loader2 size={15} className="animate-spin mr-1" /> : <Save size={15} className="mr-1" />}
                {isPt ? 'Salvar' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI background dialog */}
      <Dialog open={showAIBg} onOpenChange={setShowAIBg}>
        <DialogContent className="max-w-md bg-[#111] border-white/10 text-white">
          <DialogHeader><DialogTitle>{isPt ? 'Gerar fundo com IA' : 'Generate AI background'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea value={aiBgPrompt} onChange={(e) => setAiBgPrompt(e.target.value)}
              placeholder={isPt
                ? 'Descreva o fundo: ex. "gradiente azul-escuro tech com formas geométricas sutis"'
                : 'Describe the background: e.g., "dark blue tech gradient with subtle geometric shapes"'}
              className="bg-black/30 border-white/10 text-white min-h-[90px]" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAIBg(false)} className="border-white/10 text-white">{isPt ? 'Cancelar' : 'Cancel'}</Button>
              <Button disabled={!aiBgPrompt.trim() || busyIs('aibg')} onClick={generateAIBg}
                className="bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2">
                {busyIs('aibg') ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                {isPt ? 'Gerar' : 'Generate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
