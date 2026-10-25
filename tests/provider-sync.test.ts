import { describe, expect, it, vi } from 'vitest';
import { buildProviderInput, fetchReviews, ProviderError } from '../src/shared/provider';
import { syncReviews, type SyncDeps } from '../src/shared/sync-core';
import type { RegisteredPlace, ReviewCache } from '../src/shared/store-types';
import { DAY_MS } from '../src/shared/plan';

const NOW = Date.UTC(2026, 9, 25);
const raw = (i: number) => ({ reviewId: `r${i}`, name: `N${i}`, stars: 5, text: 't', publishedAtDate: `2026-10-${10 + i}T00:00:00.000Z`, title: 'Cafe', totalScore: 4.5, reviewsCount: 10 });

describe('provider', () => {
  it('asks for author names and never sends the token in the URL', async () => {
    const f = vi.fn(async (_u: any, _i: any) => new Response(JSON.stringify([raw(1)]), { status: 200 }));
    const out = await fetchReviews('ChIJabc', { maxReviews: 5, token: 'SECRET', fetchImpl: f as any });
    const [url, init] = f.mock.calls[0];
    expect(String(url)).not.toContain('SECRET');
    expect(init.headers.Authorization).toBe('Bearer SECRET');
    expect(JSON.parse(init.body)).toEqual(buildProviderInput('ChIJabc', 5));
    expect(JSON.parse(init.body).personalData).toBe(true);
    expect(out.reviews).toHaveLength(1);
  });
  it('fails clearly without a token, on a bad status, and on bad JSON', async () => {
    await expect(fetchReviews('x', { maxReviews: 5, token: '' })).rejects.toThrow(ProviderError);
    await expect(fetchReviews('x', { maxReviews: 5, token: 't', fetchImpl: (async () => new Response('no', { status: 402 })) as any })).rejects.toThrow(/402/);
    await expect(fetchReviews('x', { maxReviews: 5, token: 't', fetchImpl: (async () => new Response('<html>', { status: 200 })) as any })).rejects.toThrow(ProviderError);
  });
});

function makeDeps(place: RegisteredPlace | null, fetchImpl: SyncDeps['fetchReviews']) {
  const state = { place, cache: null as ReviewCache | null };
  const deps: SyncDeps = {
    loadPlace: async () => state.place,
    savePlace: async (p) => void (state.place = p),
    saveCache: async (c) => void (state.cache = c),
    fetchReviews: fetchImpl,
  };
  return { deps, state };
}
const fresh: RegisteredPlace = { placeId: 'ChIJabc', placeName: '', registeredAt: NOW, lastAttemptAt: null, lastSuccessAt: null, lastStatus: 'pending', scrapesThisPeriod: 0, periodStart: null, lastPlan: null };
const okFetch = vi.fn(async () => ({ reviews: Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, author: 'A', rating: 5, text: 't', publishedAt: `2026-10-${10 + i}T00:00:00.000Z`, language: 'en', photoUrl: '', replyText: '', replyAt: '', url: '' })), place: { placeName: 'Cafe', imageUrl: '', rating: 4.5, totalReviews: 10 } }));

describe('syncReviews', () => {
  it('first run saves the cache, trimmed to the plan, and the place status', async () => {
    const { deps, state } = makeDeps(fresh, okFetch);
    expect(await syncReviews(deps, { plan: 'free' }, NOW)).toEqual({ status: 'updated', reviews: 5 });
    expect(okFetch).toHaveBeenCalledWith('ChIJabc', 10);
    expect(state.cache?.reviews).toHaveLength(5);
    expect(state.cache).toMatchObject({ id: 'ChIJabc', placeId: 'ChIJabc', isActive: true });
    expect(state.place).toMatchObject({ lastStatus: 'ok', lastSuccessAt: NOW, placeName: 'Cafe', scrapesThisPeriod: 1 });
  });
  it('does not call the provider when the saved reviews are fresh', async () => {
    const f = vi.fn(okFetch);
    const { deps } = makeDeps({ ...fresh, lastSuccessAt: NOW - DAY_MS, lastAttemptAt: NOW - DAY_MS, lastStatus: 'ok', periodStart: NOW - DAY_MS }, f);
    expect(await syncReviews(deps, { plan: 'pro' }, NOW)).toEqual({ status: 'fresh' });
    expect(f).not.toHaveBeenCalled();
  });
  it('without a place, does nothing', async () => {
    const f = vi.fn(okFetch);
    expect(await syncReviews(makeDeps(null, f).deps, { plan: 'pro' }, NOW)).toEqual({ status: 'no_place' });
    expect(f).not.toHaveBeenCalled();
  });
  it('on provider failure keeps the old cache, records the failure and counts the attempt', async () => {
    const { deps, state } = makeDeps({ ...fresh, lastSuccessAt: NOW - 40 * DAY_MS, lastStatus: 'ok' }, async () => { throw new Error('boom'); });
    state.cache = { id: 'ChIJabc', isActive: true, placeId: 'ChIJabc', placeName: 'Cafe', placeImageUrl: '', rating: 4, totalReviews: 1, reviews: [], fetchedAt: 1 };
    const r = await syncReviews(deps, { plan: 'pro' }, NOW);
    expect(r.status).toBe('error');
    expect(state.cache?.fetchedAt).toBe(1);
    expect(state.place).toMatchObject({ lastStatus: 'failed', scrapesThisPeriod: 1, lastAttemptAt: NOW });
  });
  it('a missing provider token is reported without using up an attempt or calling the provider', async () => {
    const f = vi.fn(okFetch);
    const { deps, state } = makeDeps(fresh, f);
    const r = await syncReviews({ ...deps, providerReady: () => false }, { plan: 'pro' }, NOW);
    expect(r.status).toBe('error');
    expect(f).not.toHaveBeenCalled();
    expect(state.place).toEqual(fresh);
  });
  it('a place with no reviews is "empty", not an error', async () => {
    const { deps, state } = makeDeps(fresh, async () => ({ reviews: [], place: { placeName: '', imageUrl: '', rating: null, totalReviews: null } }));
    expect(await syncReviews(deps, { plan: 'pro' }, NOW)).toEqual({ status: 'empty' });
    expect(state.place?.lastStatus).toBe('empty');
  });
});
