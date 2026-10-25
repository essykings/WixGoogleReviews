import { describe, expect, it } from 'vitest';
import { parsePlaceInput } from '../src/shared/place';

const ID = 'ChIJV8gP0ykFdkgRFEAEHoE1YVk';

describe('parsePlaceInput', () => {
  it('accepts a bare Place ID, with spaces around it', () => {
    expect(parsePlaceInput(`  ${ID}\n`)).toEqual({ ok: true, placeId: ID });
  });
  it('accepts IDs with underscores and dashes', () => {
    expect(parsePlaceInput('ChIJC6gOeBkXLxgRG1KnMqgeZ_M')).toEqual({ ok: true, placeId: 'ChIJC6gOeBkXLxgRG1KnMqgeZ_M' });
  });
  it('finds the ID in a link that carries one', () => {
    expect(parsePlaceInput(`https://www.google.com/maps/place/?q=place_id:${ID}`)).toEqual({ ok: true, placeId: ID });
    expect(parsePlaceInput(`https://www.google.com/maps/search/?api=1&query=x&query_place_id=${ID}`)).toEqual({ ok: true, placeId: ID });
    expect(parsePlaceInput(`https://maps.google.com/?place_id=${ID}&hl=en`)).toEqual({ ok: true, placeId: ID });
  });
  it('rejects empty, wrong and over-long input with a plain message', () => {
    for (const bad of ['', '   ', undefined, 42, 'hello', 'ChIJshort', 'x'.repeat(2001)]) {
      const r = parsePlaceInput(bad);
      expect(r.ok).toBe(false);
    }
  });
  it('does not take a longer string that only starts like an ID', () => {
    expect(parsePlaceInput(ID + 'EXTRA').ok).toBe(false);
  });
});
