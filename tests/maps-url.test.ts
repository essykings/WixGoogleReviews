import { describe, expect, it, vi } from 'vitest';
import { classifyMapsUrl, providerUrlFor, resolveShortLink } from '../src/shared/maps-url';

const PLACE = 'https://www.google.com/maps/place/Cafe+Roma/@1.1,2.2,15z/data=!4m6!3m5';

describe('classifyMapsUrl', () => {
  it('accepts Google Maps place links on Google domains, with or without the scheme', () => {
    for (const u of [PLACE, 'www.google.com/maps/place/Cafe/@1,2,3z', 'https://google.co.uk/maps/place/Cafe', 'https://maps.google.com/maps/place/Cafe', 'https://www.google.com/maps?cid=1234567890']) {
      expect(classifyMapsUrl(u)?.kind).toBe('place');
    }
  });
  it('accepts Share links as short', () => {
    expect(classifyMapsUrl('https://maps.app.goo.gl/AbC123')?.kind).toBe('short');
    expect(classifyMapsUrl('https://goo.gl/maps/AbC123')?.kind).toBe('short');
  });
  it('rejects look-alike hosts, other pages, junk and anything with spaces', () => {
    for (const u of ['https://google.com.evil.test/maps/place/x', 'https://evil.test/maps/place/x', 'https://www.google.com/search?q=maps', 'https://maps.app.goo.gl/', 'ftp://www.google.com/maps/place/x', 'hello world', '', 'https://www.google.com/maps/place/a b']) {
      expect(classifyMapsUrl(u)).toBeNull();
    }
  });
  it('drops the #fragment and keeps the query', () => {
    expect(classifyMapsUrl(PLACE + '?hl=en#frag')?.url).toBe(PLACE + '?hl=en');
  });
});

const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

describe('resolveShortLink', () => {
  it('follows a Share link to the full place link', async () => {
    const f = vi.fn(async (u: any) => (String(u).startsWith('https://maps.app.goo.gl') ? redirect(PLACE + '&g_st=ic') : new Response('', { status: 200 })));
    expect(await resolveShortLink('https://maps.app.goo.gl/AbC123', f as any)).toContain('/maps/place/Cafe+Roma');
    expect(f).toHaveBeenCalledTimes(1);
    expect((f.mock.calls[0] as any)[1]).toMatchObject({ redirect: 'manual', method: 'GET' });
  });
  it('follows more than one hop, up to four', async () => {
    const hops = ['https://goo.gl/maps/a', 'https://maps.app.goo.gl/b', 'https://www.google.com/maps/c', PLACE];
    let i = 0;
    const f = async () => redirect(hops[++i] ?? PLACE);
    expect(await resolveShortLink('https://goo.gl/maps/a', f as any)).toBe(PLACE);
  });
  it('never contacts a host that is not Google\'s, so an owner cannot aim it elsewhere', async () => {
    const f = vi.fn(async () => redirect('https://evil.test/steal'));
    expect(await resolveShortLink('https://maps.app.goo.gl/AbC123', f as any)).toBeNull();
    expect(f).toHaveBeenCalledTimes(1); // the first hop is allowed; the redirect target is never fetched
    const g = vi.fn();
    expect(await resolveShortLink('https://evil.test/x', g as any)).toBeNull();
    expect(await resolveShortLink('http://maps.app.goo.gl/x', g as any)).toBeNull();
    expect(g).not.toHaveBeenCalled();
  });
  it('gives up on loops, errors and links that lead nowhere', async () => {
    expect(await resolveShortLink('https://goo.gl/maps/a', (async () => redirect('https://goo.gl/maps/a')) as any)).toBeNull();
    expect(await resolveShortLink('https://goo.gl/maps/a', (async () => { throw new Error('down'); }) as any)).toBeNull();
    expect(await resolveShortLink('https://goo.gl/maps/a', (async () => new Response('', { status: 200 })) as any)).toBeNull();
    expect(await resolveShortLink('https://goo.gl/maps/a', (async () => redirect('https://www.google.com/search?q=x')) as any)).toBeNull();
  });
});

describe('providerUrlFor (the link we send to the provider)', () => {
  // A real link that found no reviews: the first block is the owner's earlier search ("Bali, Indonesia"), the last is the business.
  const WITH_SEARCH = 'https://www.google.com/maps/place/Garuda+Wisnu+Kencana+Cultural+Park/@-8.78,115.18,14z/data=!4m15!1m8!3m7!1s0x2dd141d3e8100fa1:0x24910fb14b24e690!2sBali,+Indonesia!3b1!8m2!3d-8.4!4d115.18!16s%2Fg%2F121hxh1j!3m5!1s0x2dd244cf54e1dec7:0x1988663e064f5a51!8m2!3d-8.81!4d115.16!16zL20vMGRyenpx?entry=ttu';
  it('points at the business itself, not the search area that came first', () => {
    expect(providerUrlFor(WITH_SEARCH)).toBe(`https://www.google.com/maps?cid=${BigInt('0x1988663e064f5a51').toString()}`);
    expect(providerUrlFor(WITH_SEARCH)).toBe('https://www.google.com/maps?cid=1839832864360716881');
  });
  it('uses the only ID in a simple link', () => {
    expect(providerUrlFor('https://www.google.com/maps/place/Cafe/@1,2,17z/data=!3m1!4b1!4m6!3m5!1s0x1:0xff!8m2')).toBe('https://www.google.com/maps?cid=255');
  });
  it('leaves links without an ID, and cid links, as they are', () => {
    expect(providerUrlFor('https://www.google.com/maps/place/Cafe+Roma/@1.1,2.2,15z')).toBe('https://www.google.com/maps/place/Cafe+Roma/@1.1,2.2,15z');
    expect(providerUrlFor('https://www.google.com/maps?cid=123')).toBe('https://www.google.com/maps?cid=123');
  });
});
