import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../src/shared/plan';
import { decideRefresh } from '../src/shared/refresh';
import { disconnectedPlace, idsToPrune, pickActive, registeredPlaceFor, MAX_SAVED_PLACES } from '../src/shared/cache-rules';
import type { RegisteredPlace, ReviewCache } from '../src/shared/store-types';

const NOW = Date.UTC(2026, 9, 25);
const existing: RegisteredPlace = {
  placeId: 'A', placeUrl: '', placeName: 'Cafe A', registeredAt: NOW - 9 * DAY_MS, lastAttemptAt: NOW - DAY_MS, lastSuccessAt: NOW - DAY_MS,
  lastStatus: 'ok', scrapesThisPeriod: 2, periodStart: NOW - 5 * DAY_MS, lastPlan: 'pro', reviewAskedAt: null, lastRequested: 100,
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
    expect(registeredPlaceFor({ existing, target: { placeId: 'A' }, cached: null, now: NOW })).toBe(existing);
  });
  it('a brand-new place starts fresh but carries the scrape count', () => {
    const p = registeredPlaceFor({ existing, target: { placeId: 'B' }, cached: null, now: NOW });
    expect(p).toMatchObject({ placeId: 'B', lastSuccessAt: null, lastAttemptAt: null, lastStatus: 'pending', scrapesThisPeriod: 2, periodStart: existing.periodStart });
  });
  it('a place with a saved copy counts the copy as its last success', () => {
    const p = registeredPlaceFor({ existing, target: { placeId: 'B' }, cached: { fetchedAt: NOW - 3 * DAY_MS, placeName: 'Cafe B' }, now: NOW });
    expect(p).toMatchObject({ placeName: 'Cafe B', lastSuccessAt: NOW - 3 * DAY_MS, lastStatus: 'ok', lastAttemptAt: null });
  });
  it('the first place on a site has no count to carry', () => {
    expect(registeredPlaceFor({ existing: null, target: { placeId: 'A' }, cached: null, now: NOW }).scrapesThisPeriod).toBe(0);
  });
});

describe('registeredPlaceFor with a pasted Maps link', () => {
  const url = 'https://www.google.com/maps/place/Cafe/@1,2,15z/data=!4m6';
  it('starts with no Place ID and the link kept, carrying the scrape count', () => {
    const p = registeredPlaceFor({ existing, target: { url }, cached: null, now: NOW });
    expect(p).toMatchObject({ placeId: '', placeUrl: url, lastSuccessAt: null, lastStatus: 'pending', scrapesThisPeriod: 2 });
  });
  it('the same link again is unchanged, even after it has been resolved to a Place ID', () => {
    const resolved = { ...existing, placeId: 'ChIJxyz', placeUrl: url };
    expect(registeredPlaceFor({ existing: resolved, target: { url }, cached: null, now: NOW })).toBe(resolved);
    expect(registeredPlaceFor({ existing: resolved, target: { placeId: 'ChIJxyz' }, cached: null, now: NOW })).toBe(resolved);
  });
  it('a different link is a new business', () => {
    const resolved = { ...existing, placeId: 'ChIJxyz', placeUrl: url };
    expect(registeredPlaceFor({ existing: resolved, target: { url: url + 'x' }, cached: null, now: NOW }).placeId).toBe('');
  });
});

describe('reusing a saved copy through the refresh rules', () => {
  const state = (plan: 'free' | 'pro', copyAgeDays: number) => {
    const p = registeredPlaceFor({ existing, target: { placeId: 'B' }, cached: { fetchedAt: NOW - copyAgeDays * DAY_MS, placeName: 'B' }, now: NOW });
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

describe('disconnectedPlace', () => {
  it('clears the business and what was fetched, but keeps the usage counter and its period', () => {
    const d = disconnectedPlace(existing, NOW);
    expect(d).toMatchObject({ placeId: '', placeUrl: '', placeName: '', lastSuccessAt: null, lastAttemptAt: null, lastStatus: 'pending', lastPlan: null });
    expect(d.scrapesThisPeriod).toBe(existing.scrapesThisPeriod);
    expect(d.periodStart).toBe(existing.periodStart);
  });
  it('works when there was no record at all', () => {
    expect(disconnectedPlace(null, NOW)).toMatchObject({ placeId: '', scrapesThisPeriod: 0, periodStart: null });
  });
  it('reconnecting the same business after disconnecting still carries the count, so the monthly cap cannot be dodged', () => {
    const d = disconnectedPlace(existing, NOW);
    const again = registeredPlaceFor({ existing: d, target: { placeId: existing.placeId }, cached: null, now: NOW });
    expect(again.scrapesThisPeriod).toBe(existing.scrapesThisPeriod);
    expect(again.periodStart).toBe(existing.periodStart);
    expect(again.lastSuccessAt).toBeNull(); // nothing saved any more, so it fetches again (and counts)
    const viaLink = registeredPlaceFor({ existing: d, target: { url: 'https://www.google.com/maps/place/Cafe' }, cached: null, now: NOW });
    expect(viaLink.scrapesThisPeriod).toBe(existing.scrapesThisPeriod);
  });
});

describe('the "already asked for a review" flag', () => {
  const asked = { ...existing, reviewAskedAt: NOW - DAY_MS };
  it('is carried to a new business and kept through a disconnect, so a site is asked only once', () => {
    expect(registeredPlaceFor({ existing: asked, target: { placeId: 'B' }, cached: null, now: NOW }).reviewAskedAt).toBe(NOW - DAY_MS);
    expect(registeredPlaceFor({ existing: asked, target: { url: 'https://www.google.com/maps/place/x' }, cached: null, now: NOW }).reviewAskedAt).toBe(NOW - DAY_MS);
    expect(disconnectedPlace(asked, NOW).reviewAskedAt).toBe(NOW - DAY_MS);
    expect(registeredPlaceFor({ existing: null, target: { placeId: 'A' }, cached: null, now: NOW }).reviewAskedAt).toBeNull();
    expect(disconnectedPlace(null, NOW).reviewAskedAt).toBeNull();
  });
});

describe('what was asked for last time', () => {
  it('a new business forgets how much was asked for, and a disconnect clears it', () => {
    expect(registeredPlaceFor({ existing, target: { placeId: 'B' }, cached: null, now: NOW }).lastRequested).toBeNull();
    expect(disconnectedPlace(existing, NOW).lastRequested).toBeNull();
  });
});
