import { describe, expect, it } from 'vitest';
import { selectForDisplay } from '../src/shared/review-filter';
import { normalizeSettings } from '../src/shared/settings';
import type { Review } from '../src/shared/reviews';

const r = (id: string, rating: number, text: string, day: number): Review => ({
  id, author: id, rating, text, publishedAt: new Date(Date.UTC(2026, 9, day)).toISOString(), language: 'en', photoUrl: '', replyText: '', replyAt: '', url: '',
});
const all = [r('a', 5, 'Great and clean rooms', 20), r('b', 1, 'Slow, rude staff', 22), r('c', 4, '', 21), r('d', 3, 'Clean but noisy', 19), r('e', 5, 'Friendly', 18)];
const s = (o: any) => normalizeSettings({ count: 100, ...o });
const ids = (list: Review[]) => list.map((x) => x.id).join('');

describe('selectForDisplay', () => {
  it('defaults to newest first', () => expect(ids(selectForDisplay(all, s({}), 'pro'))).toBe('bcade'));
  it('filters by stars', () => expect(ids(selectForDisplay(all, s({ stars: [5] }), 'pro'))).toBe('ae'));
  it('include keywords keep only matching reviews, case-insensitively; star-only reviews never match', () => {
    expect(ids(selectForDisplay(all, s({ include: ['CLEAN'] }), 'pro'))).toBe('ad');
  });
  it('exclude keywords drop matching reviews but keep star-only ones', () => {
    expect(ids(selectForDisplay(all, s({ exclude: ['rude', 'noisy'] }), 'pro'))).toBe('cae');
  });
  it('only-with-text drops star-only reviews', () => expect(ids(selectForDisplay(all, s({ onlyWithText: true }), 'pro'))).toBe('bade'));
  it('sorts', () => {
    expect(ids(selectForDisplay(all, s({ sort: 'oldest' }), 'pro'))).toBe('edacb');
    expect(ids(selectForDisplay(all, s({ sort: 'highest' }), 'pro'))).toBe('aecdb');
    expect(ids(selectForDisplay(all, s({ sort: 'lowest' }), 'pro'))).toBe('bdcae');
  });
  it('leaves out reviews the owner hid, on any plan, before counting', () => {
    expect(ids(selectForDisplay(all, s({ hiddenIds: ['b', 'zzz'] }), 'pro'))).toBe('cade');
    expect(ids(selectForDisplay(all, s({ hiddenIds: ['b'], count: 5 }), 'free'))).toBe('cade');
    expect(ids(selectForDisplay(all, s({ hiddenIds: ['b'], count: 5 }), 'pro')).length).toBe(4);
    const many = Array.from({ length: 8 }, (_, i) => r(`m${i}`, 5, 'ok', i + 1));
    expect(selectForDisplay(many, s({ hiddenIds: ['m7'], count: 5 }), 'pro').map((x) => x.id)).toEqual(['m6', 'm5', 'm4', 'm3', 'm2']);
  });
  it('limits the count', () => expect(selectForDisplay(all, s({ count: 5 }), 'pro')).toHaveLength(5));
  it('Free ignores stars, keywords and sort, and shows at most 5', () => {
    const many = Array.from({ length: 12 }, (_, i) => r(`x${i}`, 5, 'ok', i + 1));
    const out = selectForDisplay(many, s({ stars: [1], include: ['nomatch'], sort: 'oldest', count: 100 }), 'free');
    expect(out).toHaveLength(5);
    expect(out[0].id).toBe('x11');
  });
  it('an unknown plan is not treated as Free', () => {
    expect(ids(selectForDisplay(all, s({ stars: [5] }), 'unknown'))).toBe('ae');
  });
});
