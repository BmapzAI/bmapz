/**
 * The market a company operates in.
 *
 * One list, shared by the frontend (via the @shared alias) and the backend, so a
 * region means the same thing in the calendar, in scheduling, and in the Company
 * Brain. The calendar previously hard-coded US public holidays for everyone —
 * a Brazilian company was shown Thanksgiving and never Carnaval.
 *
 * `code` is an ISO 3166-1 alpha-2 country code, which is what the public-holiday
 * API expects, so the calendar needs no mapping table of its own.
 */
export const REGIONS = [
  { code: 'BR', name: 'Brazil',         namePt: 'Brasil',           timezone: 'America/Sao_Paulo',   locale: 'pt-BR', currency: 'BRL' },
  { code: 'US', name: 'United States',  namePt: 'Estados Unidos',   timezone: 'America/New_York',    locale: 'en-US', currency: 'USD' },
  { code: 'PT', name: 'Portugal',       namePt: 'Portugal',         timezone: 'Europe/Lisbon',       locale: 'pt-PT', currency: 'EUR' },
  { code: 'GB', name: 'United Kingdom', namePt: 'Reino Unido',      timezone: 'Europe/London',       locale: 'en-GB', currency: 'GBP' },
  { code: 'ES', name: 'Spain',          namePt: 'Espanha',          timezone: 'Europe/Madrid',       locale: 'es-ES', currency: 'EUR' },
  { code: 'DE', name: 'Germany',        namePt: 'Alemanha',         timezone: 'Europe/Berlin',       locale: 'de-DE', currency: 'EUR' },
  { code: 'FR', name: 'France',         namePt: 'França',           timezone: 'Europe/Paris',        locale: 'fr-FR', currency: 'EUR' },
  { code: 'IT', name: 'Italy',          namePt: 'Itália',           timezone: 'Europe/Rome',         locale: 'it-IT', currency: 'EUR' },
  { code: 'CA', name: 'Canada',         namePt: 'Canadá',           timezone: 'America/Toronto',     locale: 'en-CA', currency: 'CAD' },
  { code: 'MX', name: 'Mexico',         namePt: 'México',           timezone: 'America/Mexico_City', locale: 'es-MX', currency: 'MXN' },
  { code: 'AR', name: 'Argentina',      namePt: 'Argentina',        timezone: 'America/Buenos_Aires', locale: 'es-AR', currency: 'ARS' },
  { code: 'AU', name: 'Australia',      namePt: 'Austrália',        timezone: 'Australia/Sydney',    locale: 'en-AU', currency: 'AUD' },
];

/** Fallback when a company has not chosen one. */
export const DEFAULT_REGION_CODE = 'BR';

const BY_CODE = new Map(REGIONS.map(r => [r.code, r]));

/** Look a region up by code, always returning a usable region. */
export function getRegion(code) {
  return BY_CODE.get(String(code || '').toUpperCase()) || BY_CODE.get(DEFAULT_REGION_CODE);
}

/** The region a company operates in, read from its settings. */
export function regionOf(company) {
  return getRegion(company?.settings?.region || company?.region);
}

/**
 * "now" where the company actually is.
 *
 * Scheduling, "due today" and automation windows are meaningless in server time —
 * a task due Friday should turn over at the company's midnight, not UTC's.
 */
export function nowInRegion(code, at = new Date()) {
  const { timezone } = getRegion(code);
  try {
    return new Date(at.toLocaleString('en-US', { timeZone: timezone }));
  } catch {
    return at;
  }
}

/** Today's date as YYYY-MM-DD in the company's own timezone. */
export function todayInRegion(code, at = new Date()) {
  const { timezone } = getRegion(code);
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

export default { REGIONS, DEFAULT_REGION_CODE, getRegion, regionOf, nowInRegion, todayInRegion };
