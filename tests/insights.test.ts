import { describe, expect, it, vi } from 'vitest';
import { askBrake, buildCountPayload, buildFetchPayload, buildSitePayload, callInsights, classifyError, estimateCostUsd, parseOrigin, type FetchLog } from '../src/shared/insights';
import { syncReviews, type SyncDeps } from '../src/shared/sync-core';
import type { RegisteredPlace } from '../src/shared/store-types';

const NOW = Date.UTC(2026, 9, 25);
const cfg = (fetchImpl: any) => ({ url: 'https://x.supabase.co/functions/v1/', token: 'TOKEN', fetchImpl });
const log: FetchLog = { startedAt: NOW, finishedAt: NOW + 4200, instanceId: 'inst-1', plan: 'pro', placeId: 'ChIJabc', placeName: 'Cafe', origin: 'first_save', outcome: 'updated', requested: 100, returned: 90, kept: 90 };

describe('cost and classification', () => {
  it('estimates from the provider price', () => {
    expect(estimateCostUsd(100)).toBe(0.06005);
    expect(estimateCostUsd(0)).toBe(0.00005);
    expect(estimateCostUsd(-5)).toBe(0.00005);
  });
  it('labels failures without leaking messages', () => {
    expect(classifyError(new Error('The review provider answered 402.'))).toBe('provider_402');
    expect(classifyError(new Error('The review provider is not set up (missing token).'))).toBe('missing_token');
    expect(classifyError(new Error('The operation was aborted'))).toBe('timeout');
    expect(classifyError(new Error('something odd'))).toBe('unknown');
  });
  it('only known origins are accepted', () => {
    expect(parseOrigin('dashboard')).toBe('dashboard');
    expect(parseOrigin('hacker')).toBe('visit');
    expect(parseOrigin(undefined)).toBe('visit');
  });
});

describe('payloads', () => {
  it('a fetch row has only the allowed fields, with timing and cost', () => {
    const p = buildFetchPayload(log);
    expect(p).toMatchObject({ type: 'fetch', duration_ms: 4200, plan: 'pro', origin: 'first_save', outcome: 'updated', returned: 90, est_cost_usd: 0.05405, error_class: null });
    expect(Object.keys(p).sort()).toEqual(['duration_ms', 'error_class', 'error_detail', 'est_cost_usd', 'finished_at', 'instance_id', 'kept', 'origin', 'outcome', 'place_id', 'place_name', 'plan', 'requested', 'returned', 'started_at', 'type']);
  });
  it('a failed fetch carries a class and a hidden-key error text', () => {
    const p = buildFetchPayload({ ...log, outcome: 'failed', returned: 0, kept: 0, error: new Error(`The review provider answered 401. key ${'A'.repeat(60)}`) });
    expect(p.error_class).toBe('provider_401');
    expect(p.error_detail).toContain('[hidden]');
    expect(p.error_detail).not.toContain('A'.repeat(60));
  });
  it('counter names and site rows are cleaned', () => {
    expect(buildCountPayload('skip:paused:daily cap!').counter).toBe('skip:paused:dailycap');
    expect(buildSitePayload({ instanceId: 'i', plan: 'free', placeId: 'p', savedPlaces: 500, settingsSaved: true }).saved_places).toBe(99);
  });
});

describe('callInsights and askBrake fail open', () => {
  it('sends the token in a header, never in the URL', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    await callInsights(cfg(f), 'grc-ingest', { a: 1 });
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe('https://x.supabase.co/functions/v1/grc-ingest');
    expect(String(url)).not.toContain('TOKEN');
    expect(init.headers['x-insights-token']).toBe('TOKEN');
  });
  it('returns null on errors, bad status, bad JSON, no setup and timeouts, and never throws', async () => {
    expect(await callInsights(cfg(async () => { throw new Error('down'); }), 'grc-ingest', {})).toBeNull();
    expect(await callInsights(cfg(async () => new Response('no', { status: 500 })), 'grc-ingest', {})).toBeNull();
    expect(await callInsights(cfg(async () => new Response('<html>')), 'grc-ingest', {})).toBeNull();
    expect(await callInsights({ url: '', token: '' }, 'grc-ingest', {})).toBeNull();
    const slow = async (_u: any, init: any) => new Promise<Response>((_r, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    expect(await callInsights(cfg(slow), 'grc-allow', {}, 20)).toBeNull();
  });
  it('the brake says yes when the back office is unreachable, and obeys a no', async () => {
    expect(await askBrake(cfg(async () => { throw new Error('down'); }), 0.05, false)).toEqual({ allowed: true, reason: 'unreachable' });
    expect(await askBrake(cfg(async () => new Response(JSON.stringify({ allowed: false, reason: 'daily_cap' }))), 0.05, false)).toEqual({ allowed: false, reason: 'daily_cap' });
    expect(await askBrake(cfg(async () => new Response(JSON.stringify({ allowed: true, reason: 'ok' }))), 0.05, true)).toEqual({ allowed: true, reason: 'ok' });
    expect(await askBrake(cfg(async () => new Response(JSON.stringify({ nonsense: 1 }))), 0.05, true)).toEqual({ allowed: true, reason: 'unreachable' });
  });
});

describe('syncReviews with the back office', () => {
  const fresh: RegisteredPlace = { placeId: 'ChIJabc', placeName: '', registeredAt: NOW, lastAttemptAt: null, lastSuccessAt: null, lastStatus: 'pending', scrapesThisPeriod: 0, periodStart: null, lastPlan: null };
  const reviews = Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, author: 'A', rating: 5, text: 't', publishedAt: `2026-10-${10 + i}T00:00:00.000Z`, language: 'en', photoUrl: '', replyText: '', replyAt: '', url: '' }));
  const make = (extra: Partial<SyncDeps> = {}) => {
    const state = { place: fresh as RegisteredPlace | null, fetched: 0 };
    const deps: SyncDeps = {
      loadPlace: async () => state.place,
      savePlace: async (p) => void (state.place = p),
      saveCache: async () => {},
      fetchReviews: async () => { state.fetched++; return { reviews, place: { placeName: 'Cafe', imageUrl: '', rating: 4.5, totalReviews: 10 } }; },
      ...extra,
    };
    return { deps, state };
  };

  it('logs a successful fetch with origin, plan and counts', async () => {
    const entries: FetchLog[] = [];
    const { deps } = make({ log: async (e) => void entries.push(e) });
    await syncReviews(deps, { plan: 'free', origin: 'first_save', instanceId: 'inst-1' }, NOW);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ instanceId: 'inst-1', plan: 'free', origin: 'first_save', outcome: 'updated', requested: 10, returned: 8, kept: 5, placeId: 'ChIJabc' });
  });
  it('logs a failure with its error', async () => {
    const entries: FetchLog[] = [];
    const { deps } = make({ fetchReviews: async () => { throw new Error('The review provider answered 402.'); }, log: async (e) => void entries.push(e) });
    await syncReviews(deps, { plan: 'pro' }, NOW);
    expect(entries[0].outcome).toBe('failed');
    expect(classifyError(entries[0].error)).toBe('provider_402');
  });
  it('asks the brake first, with the first-fetch flag, and a no pauses without fetching, counting an attempt or logging a fetch', async () => {
    const asked: Array<[number, boolean]> = [];
    const counted: string[] = [];
    const entries: FetchLog[] = [];
    const { deps, state } = make({ allow: async (c, first) => { asked.push([c, first]); return { allowed: false, reason: 'daily_cap' }; }, count: async (c) => void counted.push(c), log: async (e) => void entries.push(e) });
    expect(await syncReviews(deps, { plan: 'pro' }, NOW)).toEqual({ status: 'paused', reason: 'daily_cap' });
    expect(asked).toEqual([[0.06005, true]]);
    expect(state.fetched).toBe(0);
    expect(state.place).toEqual(fresh);
    expect(entries).toEqual([]);
    expect(counted).toEqual(['skip:paused:daily_cap']);
  });
  it('counts skips so saved copies are visible as avoided fetches', async () => {
    const counted: string[] = [];
    const { deps } = make({ count: async (c) => void counted.push(c) });
    deps.loadPlace = async () => ({ ...fresh, lastSuccessAt: NOW - 3_600_000, lastAttemptAt: NOW - 3_600_000, lastStatus: 'ok', periodStart: NOW - 3_600_000, lastPlan: 'pro' });
    await syncReviews(deps, { plan: 'pro' }, NOW);
    expect(counted).toEqual(['skip:fresh']);
  });
  it('a missing provider token never asks the brake or logs', async () => {
    const allow = vi.fn(async () => ({ allowed: true, reason: 'ok' }));
    const { deps } = make({ providerReady: () => false, allow });
    expect((await syncReviews(deps, { plan: 'pro' }, NOW)).status).toBe('error');
    expect(allow).not.toHaveBeenCalled();
  });
});
