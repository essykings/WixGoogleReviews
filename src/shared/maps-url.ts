// Google Maps links: which ones we accept, and how a short "Share" link is turned into the full one. Pure apart from the
// fetch it is given, so it is unit-tested. Only Google's own link hosts are ever contacted (never an address typed by an owner).

const MAX_LENGTH = 2000;
const GOOGLE_HOST = /^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/i;
const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);

export type UrlKind = 'place' | 'short';

function toUrl(text: string): URL | null {
  const t = text.trim();
  if (!t || t.length > MAX_LENGTH || /\s/.test(t)) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : /^(www\.|maps\.)?google\.|^maps\.app\.goo\.gl|^goo\.gl\//i.test(t) ? `https://${t}` : '';
  if (!withScheme) return null;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null;
  } catch {
    return null;
  }
}

function isPlaceUrl(u: URL): boolean {
  if (!GOOGLE_HOST.test(u.hostname)) return false;
  return u.pathname.startsWith('/maps/place') || ((u.pathname === '/maps' || u.pathname === '/maps/' || u.pathname === '/') && u.searchParams.has('cid'));
}

/** 'place' for a full Google Maps place link, 'short' for a Share link (maps.app.goo.gl), null for anything else. */
export function classifyMapsUrl(text: string): { kind: UrlKind; url: string } | null {
  const u = toUrl(text);
  if (!u) return null;
  u.hash = '';
  if (isPlaceUrl(u)) return { kind: 'place', url: u.toString().slice(0, MAX_LENGTH) };
  if (SHORT_HOSTS.has(u.hostname.toLowerCase()) && u.pathname.length > 1) return { kind: 'short', url: u.toString().slice(0, MAX_LENGTH) };
  return null;
}

/**
 * Follows a Share link's redirects (at most 4, and only between Google's own hosts) and returns the full place link,
 * or null if it does not lead to one. `fetchImpl` is injectable for tests.
 */
export async function resolveShortLink(url: string, fetchImpl: typeof fetch = fetch, hops = 4): Promise<string | null> {
  let current = url;
  for (let i = 0; i < hops; i++) {
    const u = toUrl(current);
    if (!u || u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    if (!SHORT_HOSTS.has(host) && !GOOGLE_HOST.test(host)) return null;
    if (isPlaceUrl(u)) {
      u.hash = '';
      return u.toString().slice(0, MAX_LENGTH);
    }
    let res: Response;
    try {
      res = await fetchImpl(u.toString(), { method: 'GET', redirect: 'manual' });
    } catch {
      return null;
    }
    const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    if (!next) return null;
    try {
      current = new URL(next, u).toString();
    } catch {
      return null;
    }
  }
  return null;
}
