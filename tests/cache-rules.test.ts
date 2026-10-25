import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../src/shared/plan';
import { decideRefresh } from '../src/shared/refresh';
import { idsToPrune, pickActive, registeredPlaceFor, MAX_SAVED_PLACES } from '../src/shared/cache-rules';
import type { RegisteredPlace, ReviewCache } from '../src/shared/store-types';

const NOW = Date.UTC(2026, 9, 25);
const existing: RegisteredPlace = {
  placeId: 'A', placeName: 'Cafe A', registeredAt: NOW - 9 * DAY_MS, lastAttemptAt: NOW - DAY_MS, lastSuccessAt: NOW - DAY_MS,
  lastStatus: 'ok', scrapesThisPeriod: 2, periodStart: NOW - 5 * DAY_MS, lastPlan: 'pro',
};

describe('idsToPrune', () => {
  const item = (id: string, daysAgo: number) => ({ id, fetchedAt: NOW - daysAgo * DAY_MS });
  it('keeps at most 3 copies, deleting the oldest and never the one just saved', () => {
    expect(MAX_SAVED_PLACES).toBe(3);
    expect(idsToPrune([item('a', 1), item('b', 5), item('c', 9), item('d', 0)], 'd')).toEqual(['c']);
    expect(idsToPrune([item('a', 30), item('b', 5), item('c', 9), item('d', 0)], 'a')).toEqual(['c']);
  });
  it('deletes nothing while there is room', () => {
    expect(idsToPrune([item('a', 1), item('b', 2)], 'a')).toEqual([]);
    expect(idsToPrune([item('a', 1), item('b', 2), item('c', 3)], 'c')).toEqual([]);
  });
  it('clears older copies such as the legacy "main" one when over the limit', () => {
    expect(idsToPrune([item('main', 20), item('a', 1), item('b', 2), item('c', 0)], 'c')).toEqual(['main']);
  });
});

describe('registeredPlaceFor', () => {
  it('leaves the same place unchanged', () => {
    expect(registeredPlaceFor({ existing, placeId: 'A', cached: null, now: NOW })).toBe(existing);
  });
  it('a brand-new place starts fresh but carries the scrape count', () => {
    const p = registeredPlaceFor({ existing, placeId: 'B', cached: null, now: NOW });
    expect(p).toMatchObject({ placeId: 'B', lastSuccessAt: null, lastAttemptAt: null, lastStatus: 'pending', scrapesThisPeriod: 2, periodStart: existing.periodStart });
  });
  it('a place with a saved copy counts the copy as its last success', () => {
    const p = registeredPlaceFor({ existing, placeId: 'B', cached: { fetchedAt: NOW - 3 * DAY_MS, placeName: 'Cafe B' }, now: NOW });
    expect(p).toMatchObject({ placeName: 'Cafe B', lastSuccessAt: NOW - 3 * DAY_MS, lastStatus: 'ok', lastAttemptAt: null });
  });
  it('the first place on a site has no count to carry', () => {
    expect(registeredPlaceFor({ existing: null, placeId: 'A', cached: null, now: NOW }).scrapesThisPeriod).toBe(0);
  });
});

describe('reusing a saved copy through the refresh rules', () => {
  const state = (plan: 'free' | 'pro', copyAgeDays: number) => {
    const p = registeredPlaceFor({ existing, placeId: 'B', cached: { fetchedAt: NOW - copyAgeDays * DAY_MS, placeName: 'B' }, now: NOW });
    return decideRefresh({ plan, hasPlace: true, lastSuccessAt: p.lastSuccessAt, lastAttemptAt: p.lastAttemptAt, lastAttemptFailed: false, periodStart: p.periodStart, scrapesThisPeriod: p.scrapesThisPeriod, now: NOW, force: false }).action;
  };
  it('a young copy means no provider call; an old one means a fetch', () => {
    expect(state('pro', 3)).toBe('fresh');
    expect(state('pro', 8)).toBe('fetch');
    expect(state('free', 20)).toBe('fresh');
    expect(state('free', 31)).toBe('fetch');
  });
});

describe('pickActive', () => {
  const rev = { id: 'r', author: 'A', rating: 5, text: 't', publishedAt: '', language: 'en', photoUrl: '', replyText: '', replyAt: '', url: '' };
  const copy = (id: string, o: Partial<ReviewCache> = {}): ReviewCache => ({ id, placeId: id, placeName: id, placeImageUrl: '', rating: 4, totalReviews: 1, reviews: [rev], fetchedAt: 1, isActive: false, ...o });
  it('prefers the flagged copy', () => {
    expect(pickActive([copy('a', { fetchedAt: 9 }), copy('b', { isActive: true })])?.id).toBe('b');
  });
  it('falls back to the newest copy when none is flagged (saved before the flag existed)', () => {
    expect(pickActive([copy('main', { fetchedAt: 5 }), copy('old', { fetchedAt: 2 })])?.id).toBe('main');
  });
  it('ignores copies without reviews, and returns null when there is nothing', () => {
    expect(pickActive([copy('a', { reviews: [], isActive: true }), copy('b')])?.id).toBe('b');
    expect(pickActive([])).toBeNull();
  });
});
