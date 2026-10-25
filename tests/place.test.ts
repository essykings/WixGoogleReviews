import { describe, expect, it } from 'vitest';
import { parsePlaceInput, PLACE_HELP } from '../src/shared/place';

const ID = 'ChIJV8gP0ykFdkgRFEAEHoE1YVk';
const PLACE = 'https://www.google.com/maps/place/Alpine+Ski+Shop+Sterling/@39.0042075,-77.4297877,15z/data=!4m6!3m5!1s0x89b638f97c712121:0xbf52c36118f79a21!8m2!3d39.0042075!4d-77.4297877!16s%2Fg%2F1tgd7dsm?hl=en';

describe('parsePlaceInput', () => {
  it('takes a Google Maps place link as it is, the way owners paste it', () => {
    const r = parsePlaceInput(`  ${PLACE}\n`);
    expect(r).toMatchObject({ ok: true, kind: 'url' });
    expect((r as any).url).toContain('/maps/place/Alpine+Ski+Shop+Sterling');
  });
  it('knows a Share link needs following', () => {
    expect(parsePlaceInput('https://maps.app.goo.gl/AbCdEf123')).toEqual({ ok: true, kind: 'short', url: 'https://maps.app.goo.gl/AbCdEf123' });
    expect(parsePlaceInput('maps.app.goo.gl/AbCdEf123')).toMatchObject({ ok: true, kind: 'short' });
  });
  it('accepts a bare Place ID, with spaces around it, and IDs with underscores and dashes', () => {
    expect(parsePlaceInput(`  ${ID}\n`)).toEqual({ ok: true, kind: 'id', placeId: ID });
    expect(parsePlaceInput('ChIJC6gOeBkXLxgRG1KnMqgeZ_M')).toEqual({ ok: true, kind: 'id', placeId: 'ChIJC6gOeBkXLxgRG1KnMqgeZ_M' });
  });
  it('finds a Place ID inside a link that carries one, which is cheaper than a lookup', () => {
    expect(parsePlaceInput(`https://www.google.com/maps/place/?q=place_id:${ID}`)).toEqual({ ok: true, kind: 'id', placeId: ID });
    expect(parsePlaceInput(`https://www.google.com/maps/search/?api=1&query=x&query_place_id=${ID}`)).toEqual({ ok: true, kind: 'id', placeId: ID });
    expect(parsePlaceInput(`https://maps.google.com/?place_id=${ID}&hl=en`)).toEqual({ ok: true, kind: 'id', placeId: ID });
  });
  it('rejects empty, wrong, other-site and over-long input with a plain message', () => {
    for (const bad of ['', '   ', undefined, 42, 'hello', 'ChIJshort', 'x'.repeat(2001), 'https://example.com/maps/place/x', 'https://www.google.com/search?q=cafe', 'javascript:alert(1)']) {
      const r = parsePlaceInput(bad);
      expect(r.ok).toBe(false);
    }
    expect((parsePlaceInput('hello') as any).message).toBe(PLACE_HELP);
  });
  it('does not take a longer string that only starts like an ID', () => {
    expect(parsePlaceInput(ID + 'EXTRA').ok).toBe(false);
  });
});
