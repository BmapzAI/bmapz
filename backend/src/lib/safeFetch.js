/**
 * Outbound HTTP to an address a CUSTOMER chose.
 *
 * Webhooks and "custom API" endpoints are legitimately arbitrary, so the storage
 * allowlist in companyView.js cannot apply here. What still must not happen is the
 * server being used as a proxy into its own network: a company admin could point a
 * webhook at http://169.254.169.254/ (cloud metadata — instance credentials),
 * http://localhost:5432 or a 10.x address and read things no outside client can
 * reach, because the request originates INSIDE the perimeter.
 *
 * The check is on the RESOLVED address, not the hostname. A blocklist of names is
 * trivially defeated by pointing a public DNS record at 127.0.0.1, so every address
 * the host resolves to is inspected.
 */
import dns from 'node:dns/promises';
import net from 'node:net';

/** Turn a 32-bit number into dotted quad. */
const toDotted = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

/** RFC1918, loopback, link-local, CGNAT, and the IPv6 equivalents. */
function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;           // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true;                         // multicast / reserved
    return false;
  }

  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true;

    // IPv4-mapped addresses, in BOTH spellings. Node normalises
    // [::ffff:127.0.0.1] to ::ffff:7f00:1, so handling only the dotted form let
    // the hex form — plain loopback — straight through.
    const dotted = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return isPrivateAddress(dotted[1]);

    const hex = v.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const n = ((parseInt(hex[1], 16) << 16) | parseInt(hex[2], 16)) >>> 0;
      return isPrivateAddress(toDotted(n));
    }
    return false;
  }

  return true; // unparseable: refuse
}

/**
 * Validate a customer-supplied URL for outbound use.
 * Throws with code OUTBOUND_URL_BLOCKED; returns the URL when acceptable.
 */
export async function assertPublicUrl(value) {
  const fail = (msg) => {
    const e = new Error(msg);
    e.code = 'OUTBOUND_URL_BLOCKED';
    throw e;
  };

  let url;
  try {
    url = new URL(String(value));
  } catch {
    fail('That is not a valid URL.');
  }

  // https only: a webhook carrying an Authorization header must not go in clear text.
  if (url.protocol !== 'https:') fail('Webhook URLs must use https.');
  if (url.username || url.password) fail('Credentials in the URL are not accepted.');

  // A literal IP is checked directly; a name is checked on everything it resolves to.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) fail('That address is not reachable from here.');
    return url;
  }

  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    fail('That hostname could not be resolved.');
  }
  if (!addrs?.length) fail('That hostname could not be resolved.');
  for (const { address } of addrs) {
    if (isPrivateAddress(address)) fail('That address is not reachable from here.');
  }
  return url;
}

/**
 * fetch() for customer-supplied URLs.
 *
 * `redirect: 'error'` matters as much as the address check: a public URL that 302s
 * to 169.254.169.254 would otherwise walk straight past it.
 */
export async function safeFetch(value, options = {}) {
  const url = await assertPublicUrl(value);
  return fetch(url, {
    ...options,
    redirect: 'error',
    signal: options.signal ?? AbortSignal.timeout(15_000),
  });
}

export default { assertPublicUrl, safeFetch };
