import React from 'react';

/**
 * Brand icons for the social / ad platforms, as inline SVG.
 *
 * These used to be emoji characters in a constants array. The file lost its
 * UTF-8 encoding at some point and every glyph decayed into "=", "<", "5", "•",
 * which is what users saw across Social Media, Ads and the platform filters.
 * Real vector paths render identically everywhere and cannot be corrupted by an
 * encoding change.
 *
 * `color` defaults to currentColor so the icon inherits the button's colour;
 * pass brand={true} to render in the platform's own brand colour.
 */

export const PLATFORM_COLORS = {
  instagram: '#E1306C',
  linkedin: '#0A66C2',
  tiktok: '#FF0050',
  twitter: '#FFFFFF',
  x: '#FFFFFF',
  youtube: '#FF0000',
  facebook: '#1877F2',
  meta: '#0668E1',
  google: '#4285F4',
  whatsapp: '#25D366',
  pinterest: '#E60023',
  threads: '#FFFFFF',
};

const PATHS = {
  instagram: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="17.6" cy="6.4" r="1.3" fill="currentColor" />
    </>
  ),
  linkedin: (
    <path
      fill="currentColor"
      d="M20.45 2H3.55A1.55 1.55 0 0 0 2 3.55v16.9A1.55 1.55 0 0 0 3.55 22h16.9A1.55 1.55 0 0 0 22 20.45V3.55A1.55 1.55 0 0 0 20.45 2M8.34 18.34H5.67V9.75h2.67zM7 8.58a1.55 1.55 0 1 1 0-3.1 1.55 1.55 0 0 1 0 3.1m11.34 9.76h-2.67v-4.18c0-1 0-2.28-1.39-2.28s-1.6 1.09-1.6 2.21v4.25h-2.67V9.75h2.56v1.17h.04a2.81 2.81 0 0 1 2.53-1.39c2.7 0 3.2 1.78 3.2 4.1z"
    />
  ),
  tiktok: (
    <path
      fill="currentColor"
      d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1 0-5.18c.27 0 .53.04.78.12v-3.2a5.86 5.86 0 0 0-.78-.05A5.72 5.72 0 0 0 4.14 15.3 5.72 5.72 0 0 0 9.86 21a5.72 5.72 0 0 0 5.72-5.7V9.01a7.35 7.35 0 0 0 4.28 1.37V7.3a4.29 4.29 0 0 1-3.26-1.48"
    />
  ),
  twitter: (
    <path
      fill="currentColor"
      d="M17.53 3h3.05l-6.66 7.61L21.75 21h-6.13l-4.8-6.28L5.32 21H2.27l7.12-8.14L2.25 3h6.29l4.34 5.74zm-1.07 16.17h1.69L7.62 4.74H5.8z"
    />
  ),
  youtube: (
    <>
      <path
        fill="currentColor"
        d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42a2.5 2.5 0 0 0-1.76 1.77A26 26 0 0 0 2 12a26 26 0 0 0 .42 4.81 2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.42-4.81"
      />
      <path fill="#0a0a0a" d="M10.25 15.02 15.4 12l-5.15-3.02z" />
    </>
  ),
  facebook: (
    <path
      fill="currentColor"
      d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94"
    />
  ),
  whatsapp: (
    <path
      fill="currentColor"
      d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.45 1.34 4.95L2 22l5.23-1.37a9.9 9.9 0 0 0 4.81 1.23h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2m5.83 14.06c-.24.68-1.42 1.31-1.96 1.36-.5.05-1.14.07-1.83-.11-.42-.13-.97-.31-1.66-.61-2.92-1.26-4.83-4.2-4.98-4.4-.14-.2-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.26-.29.57-.36.77-.36h.55c.18 0 .41-.07.64.49.24.57.81 1.98.88 2.12.07.15.12.32.02.51-.09.2-.14.32-.28.49l-.42.49c-.14.14-.28.29-.12.57.16.28.72 1.18 1.54 1.92 1.06.94 1.95 1.23 2.23 1.37.28.14.44.12.6-.07.17-.2.7-.81.88-1.09.18-.29.36-.24.61-.14.25.09 1.6.75 1.87.89.28.14.46.21.53.32.07.12.07.68-.17 1.35"
    />
  ),
  pinterest: (
    <path
      fill="currentColor"
      d="M12 2a10 10 0 0 0-3.65 19.31c-.09-.79-.17-2 .03-2.86.19-.79 1.2-5.05 1.2-5.05s-.3-.61-.3-1.52c0-1.42.82-2.48 1.85-2.48.87 0 1.29.66 1.29 1.44 0 .88-.56 2.19-.85 3.4-.24 1.02.51 1.85 1.51 1.85 1.82 0 3.21-1.92 3.21-4.68 0-2.45-1.76-4.16-4.27-4.16-2.91 0-4.62 2.18-4.62 4.43 0 .88.34 1.82.76 2.33.08.1.09.19.07.29l-.28 1.13c-.04.18-.15.22-.34.13-1.26-.59-2.05-2.43-2.05-3.91 0-3.18 2.31-6.11 6.67-6.11 3.5 0 6.22 2.5 6.22 5.83 0 3.48-2.19 6.28-5.24 6.28-1.02 0-1.98-.53-2.31-1.16l-.63 2.4c-.23.87-.84 1.97-1.25 2.64A10 10 0 1 0 12 2"
    />
  ),
};

// Aliases so callers can pass either spelling.
const ALIASES = { x: 'twitter', meta: 'facebook', threads: 'instagram' };

export default function PlatformIcon({ platform, size = 16, brand = false, className = '', style }) {
  const key = ALIASES[String(platform || '').toLowerCase()] || String(platform || '').toLowerCase();
  const path = PATHS[key];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ color: brand ? PLATFORM_COLORS[key] || 'currentColor' : undefined, flexShrink: 0, ...style }}
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
}
