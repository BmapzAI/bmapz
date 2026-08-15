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

/**
 * The UTC instant of a wall-clock time in a region.
 *
 * This is the piece everything else needs. `new Date(y, m, d, h)` builds the time
 * in the SERVER's zone (UTC on Railway), so "9am daily" fired at 06:00 in São
 * Paulo, and a due date of "2026-09-01" parsed as UTC midnight — which is 21:00 the
 * PREVIOUS day locally, making a task look overdue before its day began.
 *
 * Offset is measured at the target instant rather than assumed, so it follows DST
 * instead of drifting by an hour for half the year.
 */
export function zonedTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0, ms = 0 }, code) {
  const { timezone } = getRegion(code);
  // Treat the wall time as if it were UTC, then correct by that zone's offset.
  const guess = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  try {
    const asZone = new Date(new Date(guess).toLocaleString('en-US', { timeZone: timezone }));
    const asUtc = new Date(new Date(guess).toLocaleString('en-US', { timeZone: 'UTC' }));
    return new Date(guess - (asZone.getTime() - asUtc.getTime()));
  } catch {
    return new Date(guess);
  }
}

/** The calendar parts of an instant, as seen in the region. */
export function partsInRegion(code, at = new Date()) {
  const { timezone } = getRegion(code);
  try {
    const f = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(at).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    return {
      year: +f.year, month: +f.month, day: +f.day,
      hour: +f.hour % 24, minute: +f.minute, second: +f.second,
    };
  } catch {
    return {
      year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate(),
      hour: at.getUTCHours(), minute: at.getUTCMinutes(), second: at.getUTCSeconds(),
    };
  }
}

/**
 * When a due date actually expires.
 *
 * A task due "1 September" is not late until the 1st is over WHERE THE COMPANY IS.
 * A bare date is therefore the end of that local day, not its UTC midnight.
 * Values that already carry a time are left exactly as given.
 */
export function dueInstant(value, code) {
  if (!value) return null;
  const s = String(value).trim();

  const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return zonedTimeToUtc({
      year: +dateOnly[1], month: +dateOnly[2], day: +dateOnly[3],
      hour: 23, minute: 59, second: 59, ms: 999,
    }, code);
  }

  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : new Date(ms);
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

/** The region code a company operates in, fetched once. Never throws. */
export async function regionCodeForCompany(supabaseAdmin, companyId) {
  if (!companyId) return DEFAULT_REGION_CODE;
  try {
    const { data } = await supabaseAdmin
      .from('companies').select('settings').eq('id', companyId).maybeSingle();
    return getRegion(data?.settings?.region).code;
  } catch {
    return DEFAULT_REGION_CODE;
  }
}

export default {
  REGIONS, DEFAULT_REGION_CODE, getRegion, regionOf, nowInRegion, todayInRegion,
  zonedTimeToUtc, partsInRegion, dueInstant, regionCodeForCompany,
};
