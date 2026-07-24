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
  Upload, Wand2, Shapes, Smile, Crop, RotateCw, FlipHorizontal, FlipVertical, Scissors,
} from 'lucide-react';
import { toast } from 'sonner';
import { Company, DesignTemplate, Canva } from '@/api/entities';
import { GenerateImage, UploadFile } from '@/api/integrations';
import { api } from '@/api/apiClient';
import CanvaPicker from '@/components/integrations/CanvaPicker';
import { setDesignHandoff, peekDesignReturn, clearDesignReturn, briefToPrompt } from '@/lib/designHandoff';

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

// ─── Shapes / frames library (unit-square polygons → SVG preview + canvas export) ──
// All shapes/frames can be FILLED WITH AN IMAGE (layer.imageUrl): the image is
// clipped inside the shape's borders, Canva-frame style.
const SHAPES = [
  { id: 'rect',          label: '■',  kind: 'poly', pts: [[0,0],[1,0],[1,1],[0,1]] },
  { id: 'circle',        label: '●',  kind: 'ellipse' },
  { id: 'triangle',      label: '▲',  kind: 'poly', pts: [[0.5,0],[1,1],[0,1]] },
  { id: 'triangle-down', label: '▼',  kind: 'poly', pts: [[0,0],[1,0],[0.5,1]] },
  { id: 'diamond',       label: '◆',  kind: 'poly', pts: [[0.5,0],[1,0.5],[0.5,1],[0,0.5]] },
  { id: 'pentagon',      label: '⬟',  kind: 'poly', pts: [[0.5,0],[1,0.38],[0.81,1],[0.19,1],[0,0.38]] },
  { id: 'hexagon',       label: '⬢',  kind: 'poly', pts: [[0.25,0],[0.75,0],[1,0.5],[0.75,1],[0.25,1],[0,0.5]] },
  { id: 'octagon',       label: '⯃',  kind: 'poly', pts: [[0.3,0],[0.7,0],[1,0.3],[1,0.7],[0.7,1],[0.3,1],[0,0.7],[0,0.3]] },
  { id: 'star',          label: '★',  kind: 'poly', pts: [[0.5,0],[0.612,0.346],[0.975,0.345],[0.681,0.559],[0.794,0.905],[0.5,0.69],[0.206,0.905],[0.319,0.559],[0.025,0.345],[0.388,0.346]] },
  { id: 'starburst',     label: '✹',  kind: 'poly', pts: [[0.5,0],[0.6,0.11],[0.75,0.07],[0.78,0.22],[0.93,0.25],[0.89,0.4],[1,0.5],[0.89,0.6],[0.93,0.75],[0.78,0.78],[0.75,0.93],[0.6,0.89],[0.5,1],[0.4,0.89],[0.25,0.93],[0.22,0.78],[0.07,0.75],[0.11,0.6],[0,0.5],[0.11,0.4],[0.07,0.25],[0.22,0.22],[0.25,0.07],[0.4,0.11]] },
  { id: 'heart',         label: '♥',  kind: 'poly', pts: [[0.5,0.25],[0.42,0.14],[0.3,0.06],[0.18,0.06],[0.07,0.14],[0.02,0.28],[0.05,0.44],[0.16,0.6],[0.5,0.95],[0.84,0.6],[0.95,0.44],[0.98,0.28],[0.93,0.14],[0.82,0.06],[0.7,0.06],[0.58,0.14]] },
  { id: 'arrow',         label: '➤',  kind: 'poly', pts: [[0,0.3],[0.6,0.3],[0.6,0],[1,0.5],[0.6,1],[0.6,0.7],[0,0.7]] },
  { id: 'chevron',       label: '❯',  kind: 'poly', pts: [[0,0],[0.7,0],[1,0.5],[0.7,1],[0,1],[0.3,0.5]] },
  { id: 'bolt',          label: '⚡', kind: 'poly', pts: [[0.6,0],[0.2,0.55],[0.45,0.55],[0.4,1],[0.8,0.45],[0.55,0.45]] },
  { id: 'plus',          label: '✚',  kind: 'poly', pts: [[0.35,0],[0.65,0],[0.65,0.35],[1,0.35],[1,0.65],[0.65,0.65],[0.65,1],[0.35,1],[0.35,0.65],[0,0.65],[0,0.35],[0.35,0.35]] },
  { id: 'parallelogram', label: '▱',  kind: 'poly', pts: [[0.25,0],[1,0],[0.75,1],[0,1]] },
  { id: 'trapezoid',     label: '⏢',  kind: 'poly', pts: [[0.2,0],[0.8,0],[1,1],[0,1]] },
  { id: 'bubble',        label: '💬', kind: 'poly', pts: [[0.05,0.05],[0.95,0.05],[0.95,0.7],[0.4,0.7],[0.2,0.95],[0.22,0.7],[0.05,0.7]] },
  { id: 'line',          label: '—',  kind: 'poly', pts: [[0,0.44],[1,0.44],[1,0.56],[0,0.56]] },
  { id: 'frame',         label: '▢', kind: 'frame', dash: null,   double: false },
  { id: 'frame-rounded', label: '▢', kind: 'frame', dash: null,   double: false, rounded: true },
  { id: 'frame-dashed',  label: '⬚', kind: 'frame', dash: [12,8], double: false },
  { id: 'frame-dotted',  label: '⣏', kind: 'frame', dash: [2,6],  double: false },
  { id: 'frame-double',  label: '▣', kind: 'frame', dash: null,   double: true },
  { id: 'frame-circle',  label: '◯', kind: 'frame', dash: null,   double: false, circle: true },
  { id: 'frame-circle-dashed', label: '◌', kind: 'frame', dash: [10,7], double: false, circle: true },
];

// Every shape can hold an image (Canva-style photo frame). These read best as frames:
const FRAME_SHAPE_IDS = ['frame', 'frame-rounded', 'frame-dashed', 'frame-dotted', 'frame-double', 'frame-circle', 'frame-circle-dashed', 'circle', 'rect', 'hexagon', 'diamond', 'star', 'heart', 'pentagon', 'octagon'];

// Icon library (emoji — render identically in preview and canvas export)
const ICONS = [
  '⭐','❤️','🔥','💡','✅','➡️','📞','✉️','📍','🎯','🎁','💰','📈','🚀','👍','💬',
  '🎉','⏰','🏆','✨','📸','🎵','☀️','🌙','🛒','🔒','🌍','⚡','😀','😍','🤔','👀',
  '🙌','👏','💪','🧠','📣','🔔','⬅️','⬆️','⬇️','🔁','🏠','🏢','🛠️','⚙️','💳','🏷️',
  '💎','🎬','🎨','🖌️','📅','📊','📋','✏️','🥇','🎖️','❓','❗','➕','🔗','🌐','♻️',
];

const BG_PRESETS = ['#111111', '#ffffff', '#38b6ff', '#3572b9', '#cb6ce6', '#22c55e', '#f59e0b', '#ef4444', '#0f172a', '#fdf6ec'];
const FALLBACK_BRAND_COLORS = ['#3572b9', '#38b6ff', '#cb6ce6', '#0d0d0d', '#ffffff'];

let idCounter = 1;
const nextId = () => `l${Date.now().toString(36)}${idCounter++}`;

const newSlide = () => ({
  background: { type: 'color', color: '#111111', imageUrl: null, posX: 0.5, posY: 0.5, opacity: 1, flipH: false, flipV: false },
  layers: [],
});

const DEFAULT_DESIGN = () => ({
  format: 'single',
  aspectRatio: 'square',
  brandMode: false,
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

function roundedPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, rr); return; }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Apply rotate/flip/opacity around the layer box center, run draw(), restore.
function withTransforms(ctx, { cx, cy, rotation, flipH, flipV, opacity }, draw) {
  ctx.save();
  ctx.translate(cx, cy);
  if (rotation) ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.globalAlpha = opacity ?? 1;
  draw();
  ctx.restore();
}

// Draw an image "cover"-fitted into a box centered at (0,0), honoring an
// object-position (posX/posY in 0..1; 0.5 = centered).
function drawCover(ctx, img, dw, dh, posX = 0.5, posY = 0.5) {
  const scale = Math.max(dw / img.width, dh / img.height);
  const iw = img.width * scale, ih = img.height * scale;
  const ox = (iw - dw) * (posX - 0.5);
  const oy = (ih - dh) * (posY - 0.5);
  ctx.drawImage(img, -iw / 2 - ox, -ih / 2 - oy, iw, ih);
}

async function renderSlideToCanvas(slide, ratio) {
  const canvas = document.createElement('canvas');
  canvas.width = ratio.w;
  canvas.height = ratio.h;
  const ctx = canvas.getContext('2d');

  // Background — color always fills first (shows through transparent images);
  // an image background honors position (posX/posY), opacity and flips.
  const bg = slide.background || {};
  ctx.fillStyle = bg.color || '#111';
  ctx.fillRect(0, 0, ratio.w, ratio.h);
  if (bg.imageUrl) {
    try {
      const img = await loadImg(bg.imageUrl);
      const scale = Math.max(ratio.w / img.width, ratio.h / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      const dx = (ratio.w - dw) * (bg.posX ?? 0.5);
      const dy = (ratio.h - dh) * (bg.posY ?? 0.5);
      withTransforms(ctx, { cx: ratio.w / 2, cy: ratio.h / 2, rotation: 0, flipH: bg.flipH, flipV: bg.flipV, opacity: bg.opacity ?? 1 }, () => {
        ctx.drawImage(img, dx - ratio.w / 2, dy - ratio.h / 2, dw, dh);
      });
    } catch { /* keep the color fill */ }
  }

  await document.fonts.ready;

  for (const layer of slide.layers) {
    const opacity = layer.opacity ?? 1;
    const rotation = layer.rotation || 0;
    const { flipH, flipV } = layer;

    if (layer.type === 'image') {
      try {
        const img = await loadImg(layer.url);
        const crop = layer.crop || { x: 0, y: 0, w: 1, h: 1 };
        const sx = crop.x * img.width, sy = crop.y * img.height;
        const sw = crop.w * img.width, sh = crop.h * img.height;
        const dw = layer.w * ratio.w;
        const dh = dw * (sh / sw);
        const dx = layer.x * ratio.w, dy = layer.y * ratio.h;
        withTransforms(ctx, { cx: dx + dw / 2, cy: dy + dh / 2, rotation, flipH, flipV, opacity }, () => {
          if (layer.radius) {
            roundedPath(ctx, -dw / 2, -dh / 2, dw, dh, (layer.radius / 100) * Math.min(dw, dh));
            ctx.clip();
          }
          ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
        });
      } catch { /* skip broken image */ }
    } else if (layer.type === 'shape') {
      const def = SHAPES.find(s => s.id === layer.shape) || SHAPES[0];
      const dw = layer.w * ratio.w;
      const dh = dw * (layer.hRel || 1);
      const dx = layer.x * ratio.w, dy = layer.y * ratio.h;
      // Optional image fill (Canva-frame style): clip the image inside the shape.
      let fillImg = null;
      if (layer.imageUrl) { try { fillImg = await loadImg(layer.imageUrl); } catch { /* fill color instead */ } }

      withTransforms(ctx, { cx: dx + dw / 2, cy: dy + dh / 2, rotation, flipH, flipV, opacity }, () => {
        ctx.fillStyle = layer.fill || '#38b6ff';
        ctx.strokeStyle = layer.fill || '#38b6ff';

        const buildShapePath = () => {
          if (def.kind === 'ellipse' || def.circle) {
            ctx.beginPath();
            ctx.ellipse(0, 0, dw / 2, dh / 2, 0, 0, Math.PI * 2);
          } else if (def.kind === 'frame' || layer.shape === 'rect') {
            const r = ((layer.radius || 0) / 100) * Math.min(dw, dh);
            roundedPath(ctx, -dw / 2, -dh / 2, dw, dh, r);
          } else {
            ctx.beginPath();
            def.pts.forEach(([px, py], i) => {
              const X = (px - 0.5) * dw, Y = (py - 0.5) * dh;
              i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
            });
            ctx.closePath();
          }
        };

        // 1) interior: image fill (clipped) or color fill (frames have no interior fill)
        if (fillImg) {
          ctx.save();
          buildShapePath();
          ctx.clip();
          drawCover(ctx, fillImg, dw, dh, layer.fillPosX ?? 0.5, layer.fillPosY ?? 0.5);
          ctx.restore();
        } else if (def.kind !== 'frame') {
          buildShapePath();
          ctx.fill();
        }

        // 2) frame borders drawn on top
        if (def.kind === 'frame') {
          const sw2 = Math.max(2, (layer.strokeW || 4) * (ratio.w / 1080));
          ctx.lineWidth = sw2;
          if (def.dash) ctx.setLineDash(def.dash.map(d => d * (ratio.w / 1080)));
          if (def.circle) {
            ctx.beginPath();
            ctx.ellipse(0, 0, dw / 2 - sw2 / 2, dh / 2 - sw2 / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            const r = ((layer.radius || 0) / 100) * Math.min(dw, dh);
            roundedPath(ctx, -dw / 2 + sw2 / 2, -dh / 2 + sw2 / 2, dw - sw2, dh - sw2, r);
            ctx.stroke();
            if (def.double) {
              const inset = sw2 * 2.5;
              roundedPath(ctx, -dw / 2 + inset, -dh / 2 + inset, dw - inset * 2, dh - inset * 2, Math.max(0, r - inset));
              ctx.stroke();
            }
          }
          ctx.setLineDash([]);
        }
      });
    } else if (layer.type === 'text') {
      const fontPx = layer.size * (ratio.w / 1080);
      ctx.font = `${layer.weight || 400} ${fontPx}px "${layer.font || 'Inter'}", sans-serif`;
      const maxW = (layer.wFrac || 0.8) * ratio.w;
      // word-wrap
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
      const lineH = fontPx * 1.25;
      const blockH = lines.length * lineH;
      const bx = layer.x * ratio.w, by = layer.y * ratio.h;
      withTransforms(ctx, { cx: bx + maxW / 2, cy: by + blockH / 2, rotation, flipH, flipV, opacity }, () => {
        ctx.font = `${layer.weight || 400} ${fontPx}px "${layer.font || 'Inter'}", sans-serif`;
        ctx.fillStyle = layer.color || '#fff';
        ctx.textAlign = layer.align || 'left';
        ctx.textBaseline = 'top';
        const tx = layer.align === 'center' ? 0 : layer.align === 'right' ? maxW / 2 : -maxW / 2;
        lines.forEach((ln, i) => ctx.fillText(ln, tx, -blockH / 2 + i * lineH));
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

// Persist a data-URL (from AI generate/edit) to storage so it survives.
async function persistDataUrl(dataUrl, name = 'design-asset') {
  const blob = await fetch(dataUrl).then(r => r.blob());
  const saved = await UploadFile({ file: new File([blob], `${name}.png`, { type: 'image/png' }), folder: 'designs' });
  return saved.url;
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
  const [aiMode, setAiMode] = useState('bg'); // 'bg' → background, 'layer' → new image layer
  const [aiBgPrompt, setAiBgPrompt] = useState('');
  const [aiEditPrompt, setAiEditPrompt] = useState('');
  const [showShapes, setShowShapes] = useState(false);
  const [showIcons, setShowIcons] = useState(false);
  const [croppingId, setCroppingId] = useState(null);
  const [adjustFillId, setAdjustFillId] = useState(null); // reposition an image inside a frame
  const [hoverFrameId, setHoverFrameId] = useState(null); // frame being hovered while dragging an image onto it
  const [bgSelected, setBgSelected] = useState(false); // background is a selectable/draggable target
  const [showCanva, setShowCanva] = useState(false);
  const [busy, setBusy] = useState(null);
  const draggingImgRef = useRef(null); // { url } of the image layer currently being moved
  const dropTargetRef = useRef(null);  // frame id under the cursor at drop time
  const canvasWrapRef = useRef(null);
  const dragRef = useRef(null);
  const [returnCtx] = useState(peekDesignReturn);

  // ── Undo/Redo history (Ctrl+Z · Ctrl+Y / Ctrl+Shift+Z) ──────────────────
  const historyRef = useRef([]);
  const redoRef = useRef([]);
  const lastPushRef = useRef(0);
  const pushHistory = useCallback(() => {
    redoRef.current = []; // any NEW edit invalidates the redo branch
    const now = Date.now();
    if (now - lastPushRef.current < 500) return;
    lastPushRef.current = now;
    setDesign(current => {
      historyRef.current.push(JSON.stringify({ design: current }));
      if (historyRef.current.length > 50) historyRef.current.shift();
      return current;
    });
  }, []);

  const afterTimeTravel = (target) => {
    lastPushRef.current = 0;
    setActiveSlide(i => Math.min(i, target.slides.length - 1));
    setSelectedLayerId(null);
    setCroppingId(null);
    setAdjustFillId(null);
  };

  const undo = useCallback(() => {
    const snap = historyRef.current.pop();
    if (!snap) return;
    const { design: prev } = JSON.parse(snap);
    setDesign(current => {
      redoRef.current.push(JSON.stringify({ design: current }));
      return prev;
    });
    afterTimeTravel(prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redo = useCallback(() => {
    const snap = redoRef.current.pop();
    if (!snap) return;
    const { design: next } = JSON.parse(snap);
    setDesign(current => {
      historyRef.current.push(JSON.stringify({ design: current }));
      return next;
    });
    afterTimeTravel(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA';
      if (inField) return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault(); undo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault(); redo(); return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLayerId) {
        e.preventDefault();
        removeLayer(selectedLayerId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, selectedLayerId, activeSlide]);

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

  // ── Brand identity mode ─────────────────────────────────────────────────
  const brandMode = !!design.brandMode;
  const brandColors = (company?.briefing?.brand_colors?.length ? company.briefing.brand_colors : null)
    || (company?.brand_colors?.length ? company.brand_colors : null)
    || FALLBACK_BRAND_COLORS;
  const brandFont = company?.briefing?.brand_font || company?.brand_font || 'Montserrat';
  const bgPresets = brandMode ? brandColors : BG_PRESETS;

  const toggleBrandMode = () => {
    pushHistory();
    const turningOn = !brandMode;
    setDesign(p => ({ ...p, brandMode: turningOn }));
    if (turningOn) {
      ensureFontLoaded(brandFont);
      toast.success(isPt
        ? 'Modo marca ativado — cores, fonte e logo da empresa aplicados aos novos elementos.'
        : 'Brand mode on — company colors, font and logo applied to new elements.');
    }
  };

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

  // Metadata-only updates (e.g. measured image aspect) — no undo history entry
  const updateLayerSilent = (layerId, patch) => {
    setDesign(prev => ({
      ...prev,
      slides: prev.slides.map((s, i) => i === activeSlide
        ? { ...s, layers: s.layers.map(l => (l.id === layerId ? { ...l, ...patch } : l)) }
        : s),
    }));
  };

  const addTextLayer = (role) => {
    const r = TEXT_ROLES.find(t => t.id === role) || TEXT_ROLES[0];
    const layer = {
      id: nextId(), type: 'text', role: r.id,
      text: r.label === 'Text' ? (isPt ? 'Seu texto aqui' : 'Your text here') : r.label,
      font: brandMode ? brandFont : 'Inter',
      size: r.size, weight: r.weight,
      color: brandMode && r.id === 'h1' ? brandColors[0] : '#ffffff',
      align: 'left', x: 0.08, y: 0.1 + slide.layers.length * 0.08, wFrac: 0.84,
    };
    if (brandMode) ensureFontLoaded(brandFont);
    updateSlide(s => ({ ...s, layers: [...s.layers, layer] }));
    setSelectedLayerId(layer.id);
  };

  const addIconLayer = (emoji) => {
    const layer = {
      id: nextId(), type: 'text', role: 'icon', text: emoji,
      font: 'Inter', size: 120, weight: 400, color: '#ffffff',
      align: 'center', x: 0.4, y: 0.4, wFrac: 0.2,
    };
    updateSlide(s => ({ ...s, layers: [...s.layers, layer] }));
    setSelectedLayerId(layer.id);
    setShowIcons(false);
  };

  const addShapeLayer = (shapeId) => {
    const isFrame = shapeId.startsWith('frame');
    const layer = {
      id: nextId(), type: 'shape', shape: shapeId,
      fill: brandMode ? brandColors[1] || brandColors[0] : '#38b6ff',
      w: isFrame ? 0.9 : 0.25,
      hRel: isFrame ? (ratio.h / ratio.w) * 0.9 / 0.9 : (shapeId === 'line' ? 0.04 : 1),
      x: isFrame ? 0.05 : 0.375, y: isFrame ? 0.05 * (ratio.w / ratio.h) : 0.375,
      strokeW: 6, opacity: 1,
      ...(shapeId === 'frame-rounded' ? { radius: 20 } : {}),
    };
    updateSlide(s => ({ ...s, layers: [...s.layers, layer] }));
    setSelectedLayerId(layer.id);
    setShowShapes(false);
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
    if (croppingId === layerId) setCroppingId(null);
  };

  const setBg = (patch) => updateSlide(s => ({ ...s, background: { ...s.background, ...patch } }));

  // Detach the background image into a normal (fully editable) image layer.
  const detachBackground = () => {
    const b = slide.background;
    if (!b.imageUrl) return;
    updateSlide(s => ({
      ...s,
      background: { ...s.background, type: 'color', imageUrl: null },
      layers: [
        { id: nextId(), type: 'image', role: 'image', url: b.imageUrl, x: 0, y: 0, w: 1, opacity: b.opacity ?? 1, flipH: b.flipH, flipV: b.flipV },
        ...s.layers,
      ],
    }));
    setBgSelected(false);
    toast.success(isPt ? 'Fundo destacado como camada' : 'Background detached as a layer');
  };

  // Promote an image layer to be the slide background.
  const setLayerAsBackground = (l) => {
    updateSlide(s => ({
      ...s,
      background: { ...s.background, type: 'image', imageUrl: l.url, posX: 0.5, posY: 0.5, opacity: l.opacity ?? 1, flipH: !!l.flipH, flipV: !!l.flipV },
      layers: s.layers.filter(x => x.id !== l.id),
    }));
    setSelectedLayerId(null);
    setBgSelected(true);
  };

  // Pop the image out of a frame back into its own independent image layer,
  // leaving the frame empty (reverse of dragging an image onto a frame).
  const detachImageFromFrame = (l) => {
    if (!l?.imageUrl) return;
    const newId = nextId();
    updateSlide(s => ({
      ...s,
      layers: [
        ...s.layers.map(x => x.id === l.id ? { ...x, imageUrl: undefined, fillPosX: undefined, fillPosY: undefined } : x),
        { id: newId, type: 'image', role: 'image', url: l.imageUrl, x: l.x, y: l.y, w: l.w ?? 0.4, opacity: l.opacity ?? 1, flipH: !!l.flipH, flipV: !!l.flipV },
      ],
    }));
    setAdjustFillId(null);
    setSelectedLayerId(newId);
    toast.success(isPt ? 'Imagem destacada da moldura' : 'Image detached from frame');
  };

  // Crop presets: set the crop window to the largest centered region of the
  // given DISPLAY aspect (w:h). 'free' keeps the current window for hand-dragging.
  const applyCropPreset = (l, r) => {
    if (!l?.natAsp) { toast.error(isPt ? 'Aguarde a imagem carregar' : 'Wait for the image to load'); return; }
    if (r === 'free') return;
    const k = r * l.natAsp; // crop.w / crop.h needed for the display ratio
    let w, h;
    if (k >= 1) { w = 1; h = 1 / k; } else { w = k; h = 1; }
    updateLayer(l.id, { crop: { x: (1 - w) / 2, y: (1 - h) / 2, w, h } });
  };

  // Reorder layers (array order = z-order everywhere: preview + export).
  const moveLayer = (from, to) => {
    if (to < 0 || to >= slide.layers.length || from === to) return;
    updateSlide(s => {
      const arr = [...s.layers];
      const [it] = arr.splice(from, 1);
      arr.splice(to, 0, it);
      return { ...s, layers: arr };
    });
  };
  const dragLayerIdx = useRef(null);

  const uploadBgImage = async (file) => {
    setBusy('upload');
    try {
      const { url } = await UploadFile({ file, folder: 'designs' });
      setBg({ type: 'image', imageUrl: url });
    } catch (e) {
      toast.error((isPt ? 'Falha no upload: ' : 'Upload failed: ') + e.message);
    } finally { setBusy(null); }
  };

  // ── AI: generate (background or layer) ──────────────────────────────────
  const generateAI = async () => {
    if (!aiBgPrompt.trim()) return;
    setBusy('aibg');
    try {
      const brandHint = brandMode ? ` Use the brand color palette: ${brandColors.join(', ')}.` : '';
      const url = await GenerateImage({
        prompt: aiMode === 'bg'
          ? `${aiBgPrompt}. Style: clean marketing background image, no text, no words, no letters.${brandHint}`
          : `${aiBgPrompt}.${brandHint}`,
        size: ratio.w >= ratio.h ? '1792x1024' : '1024x1792',
        quality: 'hd', // request the highest-quality output
      });
      if (!url) throw new Error('No image returned');
      const savedUrl = await persistDataUrl(url, 'ai-image');
      if (aiMode === 'bg') {
        setBg({ type: 'ai', imageUrl: savedUrl });
      } else {
        const layer = { id: nextId(), type: 'image', role: 'image', url: savedUrl, x: 0.15, y: 0.15, w: 0.5, opacity: 1 };
        updateSlide(s => ({ ...s, layers: [...s.layers, layer] }));
        setSelectedLayerId(layer.id);
      }
      setShowAIBg(false);
      setAiBgPrompt('');
      toast.success(isPt ? 'Imagem gerada!' : 'Image generated!');
    } catch (e) {
      toast.error((isPt ? 'Falha ao gerar: ' : 'Generation failed: ') + e.message);
    } finally { setBusy(null); }
  };

  // ── AI: free-form edit of the selected image ("make the sky purple") ──────
  const aiEditImage = async (prompt) => {
    if (!selectedLayer || selectedLayer.type !== 'image' || !prompt?.trim()) return;
    setBusy('ai:custom');
    try {
      const res = await api.post('/api/ai/edit-image', { image_url: selectedLayer.url, prompt });
      const savedUrl = await persistDataUrl(res.url, 'ai-edit');
      updateLayer(selectedLayer.id, { url: savedUrl, crop: undefined, natAsp: undefined });
      setAiEditPrompt('');
      toast.success(isPt ? 'Imagem editada!' : 'Image edited!');
    } catch (e) {
      toast.error((isPt ? 'Falha na edição: ' : 'Edit failed: ') + e.message);
    } finally { setBusy(null); }
  };

  // ── Carousel ────────────────────────────────────────────────────────────
  const addSlide = () => {
    pushHistory();
    const s = newSlide();
    if (brandMode && company?.logo_url) {
      s.layers.push({ id: nextId(), type: 'image', role: 'logo', url: company.logo_url, x: 0.78, y: 0.05, w: 0.16, opacity: 1 });
    }
    setDesign(prev => ({ ...prev, format: 'carousel', slides: [...prev.slides, s] }));
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

  // ── Drag: move / resize / crop ──────────────────────────────────────────
  const startDrag = (e, layer, mode = 'move', extra = null) => {
    e.preventDefault();
    e.stopPropagation();
    if (mode !== 'bg') { setSelectedLayerId(layer.id); setBgSelected(false); }
    // Track an image being moved so it can be dropped INTO a frame.
    draggingImgRef.current = (mode === 'move' && layer?.type === 'image') ? { url: layer.url, id: layer.id } : null;
    dropTargetRef.current = null;
    const rect = canvasWrapRef.current.getBoundingClientRect();
    dragRef.current = {
      layerId: layer?.id, mode, extra, rect,
      startX: e.clientX, startY: e.clientY,
      orig: mode === 'bg'
        ? { posX: slide.background.posX ?? 0.5, posY: slide.background.posY ?? 0.5 }
        : { x: layer.x, y: layer.y, w: layer.w, wFrac: layer.wFrac, size: layer.size, crop: layer.crop ? { ...layer.crop } : { x: 0, y: 0, w: 1, h: 1 }, natAsp: layer.natAsp || 1, fillPosX: layer.fillPosX ?? 0.5, fillPosY: layer.fillPosY ?? 0.5 },
    };
    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const fx = (ev.clientX - d.startX) / d.rect.width;
      const fy = (ev.clientY - d.startY) / d.rect.height;

      if (d.mode === 'bg') {
        // Reposition the background image (object-position semantics: higher %
        // shifts the image left/up, so subtract the drag delta to follow the cursor).
        setDesign(prev => ({
          ...prev,
          slides: prev.slides.map((s, i) => i === activeSlide
            ? { ...s, background: { ...s.background,
                posX: Math.min(1, Math.max(0, d.orig.posX - fx * 2)),
                posY: Math.min(1, Math.max(0, d.orig.posY - fy * 2)) } }
            : s),
        }));
      } else if (d.mode === 'move') {
        updateLayer(d.layerId, {
          x: Math.min(0.98, Math.max(-0.4, d.orig.x + fx)),
          y: Math.min(0.98, Math.max(-0.4, d.orig.y + fy)),
        });
        // If moving an image, highlight a frame/shape under the cursor as a drop target.
        if (draggingImgRef.current) {
          const cx = (ev.clientX - d.rect.left) / d.rect.width;
          const cy = (ev.clientY - d.rect.top) / d.rect.height;
          const target = (slide.layers || []).find(s => s.type === 'shape' && s.id !== d.layerId
            && cx >= s.x && cx <= s.x + s.w && cy >= s.y && cy <= s.y + s.w * (s.hRel || 1));
          dropTargetRef.current = target?.id || null;
          setHoverFrameId(target?.id || null);
        }
      } else if (d.mode === 'resize') {
        // corner handle: drag right/down to grow
        const grow = fx; // horizontal movement drives size
        if (d.orig.wFrac !== undefined && d.orig.size !== undefined) {
          // text layer: scale box AND font together
          const factor = Math.max(0.1, (d.orig.wFrac + grow) / d.orig.wFrac);
          updateLayer(d.layerId, {
            wFrac: Math.min(1, Math.max(0.05, d.orig.wFrac + grow)),
            size: Math.max(8, Math.round(d.orig.size * factor)),
          });
        } else {
          updateLayer(d.layerId, { w: Math.min(1.5, Math.max(0.03, d.orig.w + grow)) });
        }
      } else if (d.mode === 'crop') {
        // The FULL image is displayed fixed at (layer.w × canvasW) × natAsp.
        // fx/fy are fractions of that full image, so only the dragged crop edge
        // moves — the image never shifts.
        const o = d.orig.crop;
        const dispW = d.orig.w * d.rect.width;
        const dispH = dispW * (d.orig.natAsp || 1);
        const gx = (ev.clientX - d.startX) / dispW;
        const gy = (ev.clientY - d.startY) / dispH;
        const MIN = 0.05;
        let { x, y, w, h } = o;
        const K = d.extra;
        if (K === 'move') {
          x = Math.min(1 - o.w, Math.max(0, o.x + gx));
          y = Math.min(1 - o.h, Math.max(0, o.y + gy));
        } else {
          if (K.includes('w')) { x = Math.min(o.x + o.w - MIN, Math.max(0, o.x + gx)); w = o.x + o.w - x; }
          if (K.includes('e')) { w = Math.min(1 - o.x, Math.max(MIN, o.w + gx)); }
          if (K.includes('n')) { y = Math.min(o.y + o.h - MIN, Math.max(0, o.y + gy)); h = o.y + o.h - y; }
          if (K.includes('s')) { h = Math.min(1 - o.y, Math.max(MIN, o.h + gy)); }
        }
        updateLayer(d.layerId, { crop: { x, y, w, h } });
      } else if (d.mode === 'fillpos') {
        // Reposition an image FILL inside a shape/frame (object-position).
        updateLayer(d.layerId, {
          fillPosX: Math.min(1, Math.max(0, d.orig.fillPosX - fx * 1.5)),
          fillPosY: Math.min(1, Math.max(0, d.orig.fillPosY - fy * 1.5)),
        });
      }
    };
    const onUp = () => {
      // Dropped an image onto a frame → fill the frame with it and remove the
      // standalone image layer (only when released INSIDE the frame).
      const targetId = dropTargetRef.current;
      const dragged = draggingImgRef.current;
      if (targetId && dragged) {
        updateSlide(s => ({
          ...s,
          layers: s.layers
            .map(x => x.id === targetId ? { ...x, imageUrl: dragged.url, fillPosX: 0.5, fillPosY: 0.5 } : x)
            .filter(x => x.id !== dragged.id),
        }));
        setSelectedLayerId(targetId);
        toast.success(isPt ? 'Imagem colocada na moldura' : 'Image placed in the frame');
      }
      draggingImgRef.current = null;
      dropTargetRef.current = null;
      setHoverFrameId(null);
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
      const cameFromTarget = returnCtx?.source === target;
      setDesignHandoff({ target, urls, name: templateName || 'Design', draft: cameFromTarget ? returnCtx.draft : null });
      if (cameFromTarget) clearDesignReturn();
      toast.success(isPt ? 'Design enviado!' : 'Design sent!');
      navigate(path);
    } catch (e) {
      toast.error((isPt ? 'Falha ao enviar: ' : 'Send failed: ') + e.message);
    } finally { setBusy(null); }
  };

  // Canva: import a design as an image layer
  const addCanvaImage = async ({ url }) => {
    setBusy('upload');
    try {
      // Persist Canva's export URL into our storage (their URLs expire)
      const savedUrl = await persistDataUrl(url, 'canva-import').catch(() => url);
      const layer = { id: nextId(), type: 'image', role: 'image', url: savedUrl, x: 0.1, y: 0.1, w: 0.5, opacity: 1 };
      updateSlide(s => ({ ...s, layers: [...s.layers, layer] }));
      setSelectedLayerId(layer.id);
    } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };

  // Canva: export the current design and open it in Canva for editing
  const editInCanva = async () => {
    setBusy('canva-export');
    try {
      const files = await exportSlides();
      const { url } = await UploadFile({ file: files[0], folder: 'designs' });
      const { edit_url } = await Canva.import(url, templateName || 'Bmapz Design');
      if (edit_url) { window.open(edit_url, '_blank'); toast.success(isPt ? 'Aberto no Canva!' : 'Opened in Canva!'); }
      else throw new Error('No edit URL returned');
    } catch (e) {
      toast.error(e.code === 'NOT_CONNECTED'
        ? (isPt ? 'Conecte o Canva primeiro (Importar do Canva → Conectar).' : 'Connect Canva first (Import from Canva → Connect).')
        : (isPt ? 'Falha ao enviar ao Canva: ' : 'Send to Canva failed: ') + e.message);
    } finally { setBusy(null); }
  };

  const loadTemplate = (t) => {
    try {
      const cfg = t.config || {};
      if (!cfg.slides?.length) throw new Error('empty');
      pushHistory();
      setDesign({ format: cfg.format || 'single', aspectRatio: cfg.aspectRatio || 'square', brandMode: !!cfg.brandMode, slides: cfg.slides });
      setActiveSlide(0);
      setSelectedLayerId(null);
      cfg.slides.forEach(s => s.layers?.forEach(l => l.font && ensureFontLoaded(l.font)));
      toast.success(isPt ? `Template "${t.name}" carregado` : `Template "${t.name}" loaded`);
    } catch {
      toast.error(isPt ? 'Template inválido' : 'Invalid template');
    }
  };

  useEffect(() => { ensureFontLoaded('Inter'); ensureFontLoaded('Bebas Neue'); }, []);

  // Preview sizing — fit viewport height AND container width
  const stageRef = useRef(null);
  const [stageW, setStageW] = useState(0);
  useEffect(() => {
    if (!stageRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => setStageW(entries[0]?.contentRect?.width || 0));
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);
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

  // ── Layer preview renderers ─────────────────────────────────────────────
  const layerTransform = (l) => {
    const parts = [];
    if (l.rotation) parts.push(`rotate(${l.rotation}deg)`);
    if (l.flipH) parts.push('scaleX(-1)');
    if (l.flipV) parts.push('scaleY(-1)');
    return parts.join(' ') || undefined;
  };

  const renderShapePreview = (l, isSel) => {
    const def = SHAPES.find(s => s.id === l.shape) || SHAPES[0];
    const wPct = l.w * 100;
    const hPx = l.w * previewW * (l.hRel || 1);
    const isCircle = def.kind === 'ellipse' || def.circle;
    const clip = def.kind === 'poly' && l.shape !== 'rect'
      ? `polygon(${def.pts.map(([px, py]) => `${px * 100}% ${py * 100}%`).join(', ')})`
      : undefined;
    // Show a temporary preview of an image being dragged onto this frame.
    const previewUrl = (hoverFrameId === l.id && draggingImgRef.current?.url) ? draggingImgRef.current.url : l.imageUrl;
    const fillImg = previewUrl ? (
      <img src={previewUrl} alt="" draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          objectPosition: `${(l.fillPosX ?? 0.5) * 100}% ${(l.fillPosY ?? 0.5) * 100}%`,
          opacity: (hoverFrameId === l.id && !l.imageUrl) ? 0.7 : 1 }} />
    ) : null;

    let body;
    if (def.kind === 'frame') {
      const bw = Math.max(1, (l.strokeW || 4) * (previewW / 1080));
      const line = `${bw}px ${def.dash ? 'dashed' : 'solid'} ${l.fill}`;
      const br = isCircle ? '50%' : `${l.radius || 0}%`;
      body = (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {fillImg && (
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: br }}>{fillImg}</div>
          )}
          <div style={{ position: 'absolute', inset: 0, border: line, borderRadius: br }} />
          {def.double && !isCircle && (
            <div style={{ position: 'absolute', inset: bw * 2.5, border: line, borderRadius: `${Math.max(0, (l.radius || 0) - 4)}%` }} />
          )}
        </div>
      );
    } else if (isCircle || l.shape === 'rect') {
      const br = isCircle ? '50%' : `${l.radius || 0}%`;
      body = (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: br, background: fillImg ? 'transparent' : l.fill }}>
          {fillImg}
        </div>
      );
    } else if (fillImg) {
      body = (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', clipPath: clip }}>
          {fillImg}
        </div>
      );
    } else {
      body = (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
          <polygon points={def.pts.map(([px, py]) => `${px * 100},${py * 100}`).join(' ')} fill={l.fill} />
        </svg>
      );
    }

    const adjusting = adjustFillId === l.id && l.imageUrl;
    const hovering = hoverFrameId === l.id;
    return (
      <div key={l.id}
        onMouseDown={(e) => { if (adjusting) startDrag(e, l, 'fillpos'); else startDrag(e, l); }}
        onDoubleClick={() => { if (l.imageUrl) { setSelectedLayerId(l.id); setAdjustFillId(adjusting ? null : l.id); } }}
        className={`absolute select-none ${adjusting ? 'cursor-move ring-2 ring-[#f59e0b]' : hovering ? 'ring-2 ring-[#22c55e] cursor-copy' : isSel ? 'ring-2 ring-[#38b6ff] cursor-move' : 'cursor-move'}`}
        style={{
          left: `${l.x * 100}%`, top: `${l.y * 100}%`,
          width: `${wPct}%`, height: hPx,
          transform: layerTransform(l), opacity: l.opacity ?? 1,
        }}>
        {body}
        {adjusting && (
          <div className="absolute -top-6 left-0 text-[10px] px-1.5 py-0.5 rounded bg-[#f59e0b] text-black whitespace-nowrap">
            {isPt ? 'Arraste a imagem • dê 2 cliques p/ sair' : 'Drag image • double-click to exit'}
          </div>
        )}
        {isSel && !adjusting && renderResizeHandle(l)}
      </div>
    );
  };

  const renderResizeHandle = (l) => (
    <div
      onMouseDown={(e) => startDrag(e, l, 'resize')}
      title={isPt ? 'Arraste para redimensionar' : 'Drag to resize'}
      className="absolute -right-2 -bottom-2 w-4 h-4 rounded-full bg-[#38b6ff] border-2 border-white cursor-nwse-resize shadow"
      style={{ zIndex: 5 }}
    />
  );

  // 8 crop handles positioned relative to the CROP RECTANGLE (not the image).
  const CROP_HANDLES = [
    { k: 'nw', style: { left: -6, top: -6 }, cur: 'nwse-resize' },
    { k: 'n',  style: { left: '50%', top: -6, marginLeft: -8 }, cur: 'ns-resize' },
    { k: 'ne', style: { right: -6, top: -6 }, cur: 'nesw-resize' },
    { k: 'e',  style: { right: -6, top: '50%', marginTop: -8 }, cur: 'ew-resize' },
    { k: 'se', style: { right: -6, bottom: -6 }, cur: 'nwse-resize' },
    { k: 's',  style: { left: '50%', bottom: -6, marginLeft: -8 }, cur: 'ns-resize' },
    { k: 'sw', style: { left: -6, bottom: -6 }, cur: 'nesw-resize' },
    { k: 'w',  style: { left: -6, top: '50%', marginTop: -8 }, cur: 'ew-resize' },
  ];

  const renderImagePreview = (l, isSel) => {
    const crop = l.crop;
    const isCropping = croppingId === l.id;

    // ── CROP MODE ── show the FULL image fixed; overlay a movable crop rectangle.
    if (isCropping) {
      const c = crop || { x: 0, y: 0, w: 1, h: 1 };
      return (
        <div key={l.id}
          className="absolute select-none ring-2 ring-[#f59e0b]"
          style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%`, width: `${l.w * 100}%`, aspectRatio: l.natAsp ? `${1 / l.natAsp}` : '1', transform: layerTransform(l), opacity: l.opacity ?? 1 }}>
          {/* full image, dimmed */}
          <img src={l.url} alt="" draggable={false}
            style={{ width: '100%', height: '100%', display: 'block', objectFit: 'fill', opacity: 0.4 }}
            onLoad={(e) => { if (!l.natAsp) updateLayerSilent(l.id, { natAsp: e.target.naturalHeight / e.target.naturalWidth }); }} />
          {/* bright crop window + move-by-drag */}
          <div onMouseDown={(e) => startDrag(e, l, 'crop', 'move')}
            className="absolute overflow-hidden cursor-move border border-white/80"
            style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` }}>
            <img src={l.url} alt="" draggable={false}
              style={{ position: 'absolute', width: `${100 / c.w}%`, height: `${100 / c.h}%`, left: `${-(c.x / c.w) * 100}%`, top: `${-(c.y / c.h) * 100}%`, maxWidth: 'none' }} />
          </div>
          {CROP_HANDLES.map(h => (
            <div key={h.k}
              onMouseDown={(e) => startDrag(e, l, 'crop', h.k)}
              className="absolute w-3 h-3 bg-[#f59e0b] border border-white rounded-sm shadow z-10"
              style={{ ...cropHandlePos(h.k, c), cursor: h.cur }} />
          ))}
        </div>
      );
    }

    // ── NORMAL MODE ──
    const common = {
      onMouseDown: (e) => startDrag(e, l),
      onDoubleClick: () => { setSelectedLayerId(l.id); setCroppingId(l.id); },
      className: `absolute select-none cursor-move ${isSel ? 'ring-2 ring-[#38b6ff]' : ''}`,
      style: { left: `${l.x * 100}%`, top: `${l.y * 100}%`, width: `${l.w * 100}%`, transform: layerTransform(l), opacity: l.opacity ?? 1 },
    };
    const imgInner = crop && l.natAsp ? (
      <div style={{ width: '100%', overflow: 'hidden', aspectRatio: `${crop.w / (crop.h * l.natAsp)}`, borderRadius: `${l.radius || 0}%` }}>
        <img src={l.url} alt="" draggable={false}
          style={{ width: `${100 / crop.w}%`, transform: `translate(-${(crop.x / crop.w) * 100}%, -${(crop.y / crop.h) * 100}%)`, display: 'block' }}
          onLoad={(e) => { if (!l.natAsp) updateLayerSilent(l.id, { natAsp: e.target.naturalHeight / e.target.naturalWidth }); }} />
      </div>
    ) : (
      <img src={l.url} alt="" draggable={false}
        style={{ width: '100%', display: 'block', borderRadius: `${l.radius || 0}%` }}
        onLoad={(e) => { if (!l.natAsp) updateLayerSilent(l.id, { natAsp: e.target.naturalHeight / e.target.naturalWidth }); }} />
    );
    return (
      <div key={l.id} {...common}>
        {imgInner}
        {isSel && renderResizeHandle(l)}
      </div>
    );
  };

  // Position a crop handle at the corner/edge of the crop rectangle.
  const cropHandlePos = (k, c) => {
    const cx = (c.x + c.w / 2) * 100, cy = (c.y + c.h / 2) * 100;
    const l = c.x * 100, r = (c.x + c.w) * 100, t = c.y * 100, b = (c.y + c.h) * 100;
    const map = {
      nw: [l, t], n: [cx, t], ne: [r, t], e: [r, cy], se: [r, b], s: [cx, b], sw: [l, b], w: [l, cy],
    };
    const [px, py] = map[k];
    return { left: `${px}%`, top: `${py}%`, transform: 'translate(-50%, -50%)' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            Design
          </h1>
          <p className="text-gray-400 mt-1">
            {isPt
              ? 'Crie imagens alinhadas à marca para Blog, Redes Sociais e Anúncios — templates, textos, fundos, formas e logos.'
              : 'Create on-brand images for Blog, Social Media and Ads — templates, text, backgrounds, shapes and logos.'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Brand identity toggle */}
          <button onClick={toggleBrandMode}
            title={isPt ? 'Seguir identidade da marca' : 'Follow brand identity'}
            className={`flex items-center gap-2 px-3 h-9 rounded-lg border text-sm transition-all ${brandMode ? 'bg-[#cb6ce6]/20 border-[#cb6ce6]/50 text-[#cb6ce6]' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
            <span className={`w-7 h-4 rounded-full relative transition-colors ${brandMode ? 'bg-[#cb6ce6]' : 'bg-white/20'}`}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${brandMode ? 'left-3.5' : 'left-0.5'}`} />
            </span>
            {isPt ? 'Marca' : 'Brand'}
          </button>
          <Button variant="outline" onClick={undo} title="Ctrl+Z"
            className="border-white/10 text-white hover:bg-white/5 gap-2">
            ↩ {isPt ? 'Desfazer' : 'Undo'}
          </Button>
          <Button variant="outline" onClick={redo} title="Ctrl+Y / Ctrl+Shift+Z"
            className="border-white/10 text-white hover:bg-white/5 gap-2">
            ↪ {isPt ? 'Refazer' : 'Redo'}
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
        {/* ── LEFT ── */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <p className="text-white text-sm font-semibold flex items-center gap-2"><LayoutTemplate size={14} className="text-[#38b6ff]" /> {isPt ? 'Formato' : 'Format'}</p>
            <div className="flex gap-2">
              <button onClick={() => { pushHistory(); setDesign(p => ({ ...p, format: 'single', slides: [p.slides[activeSlide] || p.slides[0]] })); setActiveSlide(0); }}
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

          {/* Shared AI design brief (sent from Social/Ads with one click) */}
          {returnCtx?.brief && (
            <div className="rounded-2xl bg-[#f59e0b]/5 border border-[#f59e0b]/25 p-4 space-y-2">
              <p className="text-[#f59e0b] text-sm font-semibold">📋 {isPt ? 'Brief de design recebido' : 'Design brief received'}{returnCtx.brief.label ? ` (${returnCtx.brief.label})` : ''}</p>
              <p className="text-gray-300 text-xs line-clamp-3">{returnCtx.brief.visual_concept || returnCtx.brief.concept}</p>
              {returnCtx.brief.color_palette?.length > 0 && (
                <div className="flex gap-1">
                  {returnCtx.brief.color_palette.slice(0, 6).map((c, i) => (
                    <span key={i} className="w-5 h-5 rounded border border-white/20" style={{ background: c }} title={c} />
                  ))}
                </div>
              )}
              <button onClick={() => { setAiBgPrompt(briefToPrompt(returnCtx.brief)); setAiMode('layer'); setShowAIBg(true); }}
                className="w-full py-1.5 rounded-lg text-xs bg-[#f59e0b]/15 border border-[#f59e0b]/40 text-[#f59e0b] hover:bg-[#f59e0b]/25 transition-all">
                <Wand2 size={11} className="inline mr-1" /> {isPt ? 'Gerar imagem com este brief' : 'Generate image from this brief'}
              </button>
            </div>
          )}

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
          {design.format === 'carousel' && (
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))} className="text-gray-400 hover:text-white"><ChevronLeft size={18} /></button>
              <span className="text-gray-400 text-sm">Slide {activeSlide + 1}/{design.slides.length}</span>
              <button onClick={() => setActiveSlide(Math.min(design.slides.length - 1, activeSlide + 1))} className="text-gray-400 hover:text-white"><ChevronRight size={18} /></button>
              <div className="flex gap-1 ml-2">
                <Button size="sm" variant="outline" onClick={duplicateSlide} className="border-white/10 text-white h-7 px-2 text-xs gap-1"><Copy size={11} />{isPt ? 'Duplicar' : 'Duplicate'}</Button>
                <Button size="sm" variant="outline" onClick={addSlide} className="border-white/10 text-white h-7 px-2 text-xs gap-1"><Plus size={11} />Slide</Button>
                {design.slides.length > 1 && (
                  <Button size="sm" variant="outline" onClick={removeSlide} className="border-red-500/20 text-red-400 h-7 px-2 text-xs"><Trash2 size={11} /></Button>
                )}
              </div>
            </div>
          )}

          <div ref={stageRef} className="flex items-center justify-center rounded-2xl bg-black/40 border border-white/10 p-3 sm:p-6 overflow-auto">
            <div ref={canvasWrapRef}
              className={`relative overflow-hidden shadow-2xl flex-shrink-0 ${bgSelected ? 'ring-2 ring-[#cb6ce6]' : ''}`}
              style={{ width: previewW, height: previewH, background: slide.background.color }}
              onMouseDown={() => {
                setSelectedLayerId(null); setCroppingId(null); setAdjustFillId(null);
                // Clicking the canvas selects the background (if it has an image)
                setBgSelected(!!slide.background.imageUrl);
              }}>
              {/* Background image — selectable + draggable like a layer */}
              {slide.background.imageUrl && (
                <img src={slide.background.imageUrl} alt="" draggable={false}
                  onMouseDown={(e) => {
                    if (bgSelected) { startDrag(e, null, 'bg'); }
                    else { e.stopPropagation(); setSelectedLayerId(null); setCroppingId(null); setBgSelected(true); }
                  }}
                  className={bgSelected ? 'cursor-move' : ''}
                  style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    objectFit: 'cover',
                    objectPosition: `${(slide.background.posX ?? 0.5) * 100}% ${(slide.background.posY ?? 0.5) * 100}%`,
                    opacity: slide.background.opacity ?? 1,
                    transform: [slide.background.flipH ? 'scaleX(-1)' : '', slide.background.flipV ? 'scaleY(-1)' : ''].join(' ').trim() || undefined,
                  }} />
              )}
              {slide.layers.map(layer => {
                const isSel = layer.id === selectedLayerId;
                if (layer.type === 'image') return renderImagePreview(layer, isSel);
                if (layer.type === 'shape') return renderShapePreview(layer, isSel);
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
                      transform: layerTransform(layer),
                      opacity: layer.opacity ?? 1,
                    }}>
                    {layer.text}
                    {isSel && renderResizeHandle(layer)}
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
            <button onClick={() => { setShowShapes(v => !v); setShowIcons(false); }}
              className={`flex items-center gap-1.5 px-3 h-9 rounded-lg border text-sm transition-all ${showShapes ? 'bg-[#38b6ff]/15 border-[#38b6ff]/40 text-[#38b6ff]' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>
              <Shapes size={13} /> {isPt ? '+ Forma' : '+ Shape'}
            </button>
            <button onClick={() => { setShowIcons(v => !v); setShowShapes(false); }}
              className={`flex items-center gap-1.5 px-3 h-9 rounded-lg border text-sm transition-all ${showIcons ? 'bg-[#38b6ff]/15 border-[#38b6ff]/40 text-[#38b6ff]' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>
              <Smile size={13} /> {isPt ? '+ Ícone' : '+ Icon'}
            </button>
            <button onClick={() => { setAiMode('layer'); setShowAIBg(true); }}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-gradient-to-r from-[#cb6ce6]/20 to-[#38b6ff]/20 border border-[#cb6ce6]/30 hover:border-[#cb6ce6]/60 text-sm text-white transition-all">
              <Wand2 size={13} /> {isPt ? '+ Imagem IA' : '+ AI Image'}
            </button>
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
            <button onClick={() => setShowCanva(true)}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[#00c4cc]/40 bg-[#00c4cc]/10 hover:bg-[#00c4cc]/20 text-[#00c4cc] text-sm transition-all">
              🎨 {isPt ? 'Do Canva' : 'From Canva'}
            </button>
            <button onClick={editInCanva} disabled={!!busy}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[#00c4cc]/40 bg-[#00c4cc]/10 hover:bg-[#00c4cc]/20 text-[#00c4cc] text-sm transition-all">
              {busyIs('canva-export') ? <Loader2 size={13} className="animate-spin" /> : '↗'} {isPt ? 'Editar no Canva' : 'Edit in Canva'}
            </button>
          </div>

          {/* Shapes library */}
          {showShapes && (
            <div className="flex justify-center">
              <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-[#151515] border border-white/10 max-w-[520px] justify-center">
                {SHAPES.map(s => (
                  <button key={s.id} onClick={() => addShapeLayer(s.id)}
                    title={s.id.startsWith('frame') ? `${s.id} (${isPt ? 'moldura — pode receber imagem' : 'frame — can hold an image'})` : s.id}
                    className="w-10 h-10 rounded-lg bg-white/5 hover:bg-[#38b6ff]/20 border border-white/10 hover:border-[#38b6ff]/40 text-white text-lg transition-all flex items-center justify-center">
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Icons library */}
          {showIcons && (
            <div className="flex justify-center">
              <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 p-3 rounded-2xl bg-[#151515] border border-white/10">
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => addIconLayer(ic)}
                    className="w-10 h-10 rounded-lg bg-white/5 hover:bg-[#38b6ff]/20 border border-white/10 hover:border-[#38b6ff]/40 text-xl transition-all">
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: properties ── */}
        <div className="space-y-4">
          {/* Background */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <p className="text-white text-sm font-semibold flex items-center justify-between">
              {isPt ? 'Fundo' : 'Background'}
              {brandMode && <span className="text-[10px] text-[#cb6ce6] font-normal">{isPt ? 'cores da marca' : 'brand colors'}</span>}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {bgPresets.map(c => (
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
              <button onClick={() => { setAiMode('bg'); setShowAIBg(true); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-gradient-to-r from-[#cb6ce6]/20 to-[#38b6ff]/20 border border-[#cb6ce6]/30 hover:border-[#cb6ce6]/60 text-xs text-white transition-all">
                <Wand2 size={12} /> {isPt ? 'Fundo IA' : 'AI Background'}
              </button>
            </div>

            {/* Image-background controls: position/opacity/flip/detach */}
            {slide.background.imageUrl && (
              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <p className="text-[10px] text-gray-500">
                  {bgSelected
                    ? (isPt ? '✦ Fundo selecionado — arraste no canvas para posicionar.' : '✦ Background selected — drag on the canvas to position it.')
                    : (isPt ? 'Clique no fundo do canvas para selecioná-lo e arrastar.' : 'Click the canvas background to select and drag it.')}
                </p>
                <div>
                  <Label className="text-gray-400 text-xs">{isPt ? 'Opacidade do fundo' : 'Background opacity'} ({Math.round((slide.background.opacity ?? 1) * 100)}%)</Label>
                  <input type="range" min={10} max={100} value={(slide.background.opacity ?? 1) * 100}
                    onChange={(e) => setBg({ opacity: Number(e.target.value) / 100 })}
                    className="w-full mt-1 accent-[#cb6ce6]" />
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setBg({ flipH: !slide.background.flipH })}
                    className={`flex-1 py-1.5 rounded-lg text-xs border flex items-center justify-center gap-1 ${slide.background.flipH ? 'bg-[#cb6ce6]/15 border-[#cb6ce6]/40 text-[#cb6ce6]' : 'bg-black/20 border-white/10 text-gray-400'}`}>
                    <FlipHorizontal size={12} /> {isPt ? 'Inverter H' : 'Flip H'}
                  </button>
                  <button onClick={() => setBg({ flipV: !slide.background.flipV })}
                    className={`flex-1 py-1.5 rounded-lg text-xs border flex items-center justify-center gap-1 ${slide.background.flipV ? 'bg-[#cb6ce6]/15 border-[#cb6ce6]/40 text-[#cb6ce6]' : 'bg-black/20 border-white/10 text-gray-400'}`}>
                    <FlipVertical size={12} /> {isPt ? 'Inverter V' : 'Flip V'}
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={detachBackground}
                    className="flex-1 py-1.5 rounded-lg text-xs border bg-black/20 border-white/10 text-gray-300 hover:border-[#cb6ce6]/50">
                    ⇱ {isPt ? 'Destacar como camada' : 'Detach as layer'}
                  </button>
                  <button onClick={() => { setBg({ type: 'color', imageUrl: null }); setBgSelected(false); }}
                    className="py-1.5 px-2.5 rounded-lg text-xs border bg-black/20 border-white/10 text-gray-400 hover:text-red-400">
                    {isPt ? 'Remover' : 'Remove'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Selected layer */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-white text-sm font-semibold flex items-center gap-2"><Layers size={14} className="text-[#38b6ff]" /> {isPt ? 'Camada' : 'Layer'}</p>
              {selectedLayer && (
                <button onClick={() => removeLayer(selectedLayer.id)} className="text-red-400/70 hover:text-red-400"><Trash2 size={13} /></button>
              )}
            </div>
            {!selectedLayer && <p className="text-gray-500 text-xs">{isPt ? 'Clique em um elemento no canvas. Arraste para mover; use o ponto azul para redimensionar.' : 'Click an element on the canvas. Drag to move; use the blue dot to resize.'}</p>}

            {selectedLayer && (
              <>
                {/* Common: rotate / flip / opacity / radius */}
                <div className="space-y-2.5">
                  <div>
                    <Label className="text-gray-400 text-xs flex items-center gap-1"><RotateCw size={11} /> {isPt ? 'Rotação' : 'Rotation'} ({selectedLayer.rotation || 0}°)</Label>
                    <input type="range" min={-180} max={180} value={selectedLayer.rotation || 0}
                      onChange={(e) => updateLayer(selectedLayer.id, { rotation: Number(e.target.value) })}
                      onDoubleClick={() => updateLayer(selectedLayer.id, { rotation: 0 })}
                      className="w-full mt-1 accent-[#38b6ff]" />
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => updateLayer(selectedLayer.id, { flipH: !selectedLayer.flipH })}
                      className={`flex-1 py-1.5 rounded-lg text-xs border flex items-center justify-center gap-1 ${selectedLayer.flipH ? 'bg-[#38b6ff]/15 border-[#38b6ff]/40 text-[#38b6ff]' : 'bg-black/20 border-white/10 text-gray-400'}`}>
                      <FlipHorizontal size={12} /> {isPt ? 'Inverter H' : 'Flip H'}
                    </button>
                    <button onClick={() => updateLayer(selectedLayer.id, { flipV: !selectedLayer.flipV })}
                      className={`flex-1 py-1.5 rounded-lg text-xs border flex items-center justify-center gap-1 ${selectedLayer.flipV ? 'bg-[#38b6ff]/15 border-[#38b6ff]/40 text-[#38b6ff]' : 'bg-black/20 border-white/10 text-gray-400'}`}>
                      <FlipVertical size={12} /> {isPt ? 'Inverter V' : 'Flip V'}
                    </button>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">{isPt ? 'Opacidade' : 'Opacity'} ({Math.round((selectedLayer.opacity ?? 1) * 100)}%)</Label>
                    <input type="range" min={5} max={100} value={(selectedLayer.opacity ?? 1) * 100}
                      onChange={(e) => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) / 100 })}
                      className="w-full mt-1 accent-[#38b6ff]" />
                  </div>
                  {(selectedLayer.type === 'image' || (selectedLayer.type === 'shape' && ['rect', 'frame', 'frame-dashed', 'frame-double'].includes(selectedLayer.shape))) && (
                    <div>
                      <Label className="text-gray-400 text-xs">{isPt ? 'Cantos arredondados' : 'Border radius'} ({selectedLayer.radius || 0}%)</Label>
                      <input type="range" min={0} max={50} value={selectedLayer.radius || 0}
                        onChange={(e) => updateLayer(selectedLayer.id, { radius: Number(e.target.value) })}
                        className="w-full mt-1 accent-[#38b6ff]" />
                    </div>
                  )}
                </div>

                {/* Image-specific: crop + AI tools */}
                {selectedLayer.type === 'image' && (
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex gap-1.5">
                      <button onClick={() => setCroppingId(croppingId === selectedLayer.id ? null : selectedLayer.id)}
                        className={`flex-1 py-1.5 rounded-lg text-xs border flex items-center justify-center gap-1 ${croppingId === selectedLayer.id ? 'bg-[#f59e0b]/20 border-[#f59e0b]/50 text-[#f59e0b]' : 'bg-black/20 border-white/10 text-gray-400'}`}>
                        <Crop size={12} /> {croppingId === selectedLayer.id ? (isPt ? 'Concluir corte' : 'Done cropping') : (isPt ? 'Cortar' : 'Crop')}
                      </button>
                      {selectedLayer.crop && (
                        <button onClick={() => updateLayer(selectedLayer.id, { crop: undefined })}
                          className="py-1.5 px-2.5 rounded-lg text-xs border bg-black/20 border-white/10 text-gray-400">
                          {isPt ? 'Resetar' : 'Reset'}
                        </button>
                      )}
                    </div>
                    {croppingId === selectedLayer.id && (
                      <>
                        <p className="text-[10px] text-[#f59e0b]/80">{isPt ? 'Arraste as alças nas bordas para corte livre, ou escolha uma proporção:' : 'Drag the edge handles to crop freely, or pick a ratio:'}</p>
                        <div className="flex gap-1 flex-wrap">
                          {[
                            { k: 'free', label: isPt ? 'Livre' : 'Free' },
                            { k: 1, label: '1:1' },
                            { k: 4 / 5, label: '4:5' },
                            { k: 3 / 4, label: '3:4' },
                            { k: 16 / 9, label: '16:9' },
                            { k: 9 / 16, label: '9:16' },
                          ].map(({ k, label }) => (
                            <button key={label} onClick={() => applyCropPreset(selectedLayer, k)}
                              className="px-2 py-1 rounded-lg text-[10px] border bg-black/20 border-white/10 text-gray-300 hover:border-[#f59e0b]/50 hover:text-[#f59e0b]">
                              {label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <button onClick={() => setLayerAsBackground(selectedLayer)}
                      className="w-full py-1.5 rounded-lg text-xs border bg-black/20 border-white/10 text-gray-300 hover:border-[#cb6ce6]/50">
                      ⇲ {isPt ? 'Usar como fundo do slide' : 'Set as slide background'}
                    </button>
                    <div className="flex gap-1.5">
                      <Input value={aiEditPrompt} onChange={(e) => setAiEditPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && aiEditPrompt.trim() && aiEditImage(aiEditPrompt)}
                        placeholder={isPt ? 'Editar com IA: ex. "deixe o céu roxo"' : 'AI edit: e.g. "make the sky purple"'}
                        className="bg-black/30 border-white/10 text-white text-xs h-8" />
                      <Button size="sm" disabled={!aiEditPrompt.trim() || !!busy}
                        onClick={() => aiEditImage(aiEditPrompt)}
                        className="h-8 px-2.5 bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff]">
                        {busyIs('ai:custom') ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Shape-specific */}
                {selectedLayer.type === 'shape' && (
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <Label className="text-gray-400 text-xs">{isPt ? 'Cor' : 'Color'}</Label>
                      <input type="color" value={selectedLayer.fill}
                        onChange={(e) => updateLayer(selectedLayer.id, { fill: e.target.value })}
                        className="w-8 h-8 rounded-lg bg-transparent border border-white/20 cursor-pointer" />
                      {brandMode && brandColors.map(c => (
                        <button key={c} onClick={() => updateLayer(selectedLayer.id, { fill: c })}
                          className="w-6 h-6 rounded border border-white/20" style={{ background: c }} />
                      ))}
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">{isPt ? 'Altura' : 'Height'} ({Math.round((selectedLayer.hRel || 1) * 100)}%)</Label>
                      <input type="range" min={2} max={200} value={(selectedLayer.hRel || 1) * 100}
                        onChange={(e) => updateLayer(selectedLayer.id, { hRel: Number(e.target.value) / 100 })}
                        className="w-full mt-1 accent-[#38b6ff]" />
                    </div>
                    {selectedLayer.shape?.startsWith('frame') && (
                      <div>
                        <Label className="text-gray-400 text-xs">{isPt ? 'Espessura da borda' : 'Border thickness'} ({selectedLayer.strokeW || 4}px)</Label>
                        <input type="range" min={1} max={40} value={selectedLayer.strokeW || 4}
                          onChange={(e) => updateLayer(selectedLayer.id, { strokeW: Number(e.target.value) })}
                          className="w-full mt-1 accent-[#38b6ff]" />
                      </div>
                    )}
                    {/* Canva-style frame fill: an image clipped inside the shape */}
                    <div className="flex gap-1.5">
                      <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs border bg-black/20 border-white/10 text-gray-300 hover:border-[#38b6ff]/50 cursor-pointer">
                        <ImageIcon size={12} /> {selectedLayer.imageUrl ? (isPt ? 'Trocar imagem' : 'Change image') : (isPt ? 'Preencher com imagem' : 'Fill with image')}
                        <input type="file" accept="image/*" className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setBusy('upload');
                            try {
                              const { url } = await UploadFile({ file, folder: 'designs' });
                              updateLayer(selectedLayer.id, { imageUrl: url });
                            } catch (err) { toast.error(err.message); }
                            finally { setBusy(null); }
                          }} />
                      </label>
                      {selectedLayer.imageUrl && (
                        <button onClick={() => detachImageFromFrame(selectedLayer)}
                          title={isPt ? 'Soltar a imagem como camada independente' : 'Pop the image out as its own layer'}
                          className="py-1.5 px-2.5 rounded-lg text-xs border bg-black/20 border-white/10 text-gray-300 hover:text-[#38b6ff] hover:border-[#38b6ff]/50 flex items-center gap-1">
                          <Scissors size={12} /> {isPt ? 'Soltar' : 'Detach'}
                        </button>
                      )}
                      {selectedLayer.imageUrl && (
                        <button onClick={() => updateLayer(selectedLayer.id, { imageUrl: undefined })}
                          className="py-1.5 px-2.5 rounded-lg text-xs border bg-black/20 border-white/10 text-gray-400 hover:text-red-400">
                          {isPt ? 'Limpar' : 'Clear'}
                        </button>
                      )}
                    </div>
                    {selectedLayer.imageUrl && (
                      <p className="text-gray-500 text-[10px]">
                        {isPt
                          ? 'Duplo-clique na moldura para reposicionar a imagem dentro dela. "Soltar" tira a imagem da moldura como camada livre.'
                          : 'Double-click the frame to reposition the image inside it. "Detach" pops the image out as a free layer.'}
                      </p>
                    )}
                  </div>
                )}

                {/* Text-specific */}
                {selectedLayer.type === 'text' && (
                  <div className="space-y-3 pt-2 border-t border-white/10">
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
                        <Input type="number" min={8} max={400} value={selectedLayer.size}
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
              </>
            )}
          </div>

          {/* Layer list — drag to reorder (array order = stacking order, last = front) */}
          {slide.layers.length > 0 && (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="text-white text-sm font-semibold mb-1">{isPt ? 'Camadas' : 'Layers'}</p>
              <p className="text-gray-600 text-[10px] mb-2">{isPt ? 'Arraste para reordenar — itens mais abaixo ficam na frente.' : 'Drag to reorder — items lower in the list sit in front.'}</p>
              <div className="space-y-1">
                {slide.layers.map((l, idx) => (
                  <div key={l.id}
                    draggable
                    onDragStart={() => { dragLayerIdx.current = idx; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); if (dragLayerIdx.current != null) moveLayer(dragLayerIdx.current, idx); dragLayerIdx.current = null; }}
                    className={`flex items-center gap-1 rounded-lg transition-all ${l.id === selectedLayerId ? 'bg-[#38b6ff]/15' : 'hover:bg-white/5'}`}>
                    <span className="cursor-grab active:cursor-grabbing text-gray-600 pl-1.5 select-none" title={isPt ? 'Arrastar' : 'Drag'}>⠿</span>
                    <button onClick={() => setSelectedLayerId(l.id)}
                      className={`flex-1 flex items-center gap-2 px-1 py-1.5 text-xs text-left min-w-0 ${l.id === selectedLayerId ? 'text-[#38b6ff]' : 'text-gray-400'}`}>
                      {l.type === 'text' ? <Type size={11} /> : l.type === 'shape' ? <Shapes size={11} /> : <ImageIcon size={11} />}
                      <span className="truncate">
                        {l.type === 'text' ? l.text?.slice(0, 22)
                          : l.type === 'shape' ? (SHAPES.find(s => s.id === l.shape)?.id || 'shape')
                          : (l.role === 'logo' ? 'Logo' : (isPt ? 'Imagem' : 'Image'))}
                      </span>
                    </button>
                    <div className="flex flex-col pr-1">
                      <button onClick={() => moveLayer(idx, idx - 1)} disabled={idx === 0}
                        title={isPt ? 'Enviar para trás' : 'Send backward'}
                        className="text-gray-600 hover:text-white disabled:opacity-30 leading-none text-[10px]">▲</button>
                      <button onClick={() => moveLayer(idx, idx + 1)} disabled={idx === slide.layers.length - 1}
                        title={isPt ? 'Trazer para frente' : 'Bring forward'}
                        className="text-gray-600 hover:text-white disabled:opacity-30 leading-none text-[10px]">▼</button>
                    </div>
                  </div>
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
                ? 'O template salva formato, proporção, fundos, textos, formas, posições, modo marca e logos.'
                : 'The template saves format, aspect ratio, backgrounds, texts, shapes, positions, brand mode and logos.'}
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

      {/* AI generate dialog (background or layer) */}
      <Dialog open={showAIBg} onOpenChange={setShowAIBg}>
        <DialogContent className="max-w-md bg-[#111] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>
              {aiMode === 'bg'
                ? (isPt ? 'Gerar fundo com IA' : 'Generate AI background')
                : (isPt ? 'Gerar imagem com IA' : 'Generate AI image')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea value={aiBgPrompt} onChange={(e) => setAiBgPrompt(e.target.value)}
              placeholder={aiMode === 'bg'
                ? (isPt ? 'Descreva o fundo: ex. "gradiente azul-escuro tech com formas geométricas sutis"' : 'Describe the background: e.g., "dark blue tech gradient with subtle geometric shapes"')
                : (isPt ? 'Descreva a imagem: ex. "foto de um notebook em mesa de madeira, luz natural"' : 'Describe the image: e.g., "photo of a laptop on a wooden desk, natural light"')}
              className="bg-black/30 border-white/10 text-white min-h-[90px]" />
            {brandMode && (
              <p className="text-[11px] text-[#cb6ce6]">
                {isPt ? '🎨 Modo marca: a paleta da empresa será aplicada.' : '🎨 Brand mode: company palette will be applied.'}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAIBg(false)} className="border-white/10 text-white">{isPt ? 'Cancelar' : 'Cancel'}</Button>
              <Button disabled={!aiBgPrompt.trim() || busyIs('aibg')} onClick={generateAI}
                className="bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-2">
                {busyIs('aibg') ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                {isPt ? 'Gerar' : 'Generate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CanvaPicker open={showCanva} onClose={() => setShowCanva(false)} onSelect={addCanvaImage} />
    </div>
  );
}
