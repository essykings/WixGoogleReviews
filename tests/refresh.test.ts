import { describe, expect, it } from 'vitest';
import { DAY_MS, HOUR_MS } from '../src/shared/plan';
import { decideRefresh, type RefreshState } from '../src/shared/refresh';

const NOW = Date.UTC(2026, 9, 25);
const base: RefreshState = {
  plan: 'pro', hasPlace: true, lastSuccessAt: NOW - 8 * DAY_MS, lastAttemptAt: NOW - 8 * DAY_MS, lastAttemptFailed: false,
  periodStart: NOW - 5 * DAY_MS, scrapesThisPeriod: 1, now: NOW, force: false,
};
const act = (o: Partial<RefreshState>) => decideRefresh({ ...base, ...o }).action;

describe('decideRefresh', () => {
  it('needs a registered place', () => expect(act({ hasPlace: false })).toBe('no_place'));
  it('fetches the first time', () => expect(act({ lastSuccessAt: null, lastAttemptAt: null })).toBe('fetch'));
  it('Pro: weekly. Fresh before 7 days, fetch after', () => {
    expect(act({ lastSuccessAt: NOW - 6 * DAY_MS })).toBe('fresh');
    expect(act({ lastSuccessAt: NOW - 7 * DAY_MS })).toBe('fetch');
  });
  it('Free: monthly', () => {
    expect(act({ plan: 'free', lastSuccessAt: NOW - 20 * DAY_MS })).toBe('fresh');
    expect(act({ plan: 'free', lastSuccessAt: NOW - 31 * DAY_MS })).toBe('fetch');
  });
  it('unknown plan gets Pro rules, not Free rules', () => {
    expect(act({ plan: 'unknown', lastSuccessAt: NOW - 8 * DAY_MS })).toBe('fetch');
  });
  it('refresh now works on Pro, is ignored on Free', () => {
    expect(act({ force: true, lastSuccessAt: NOW - DAY_MS, lastAttemptAt: NOW - DAY_MS })).toBe('fetch');
    expect(act({ plan: 'free', force: true, lastSuccessAt: NOW - DAY_MS })).toBe('fresh');
  });
  it('upgrading from Free fetches the bigger Pro copy now, even though the Free copy is young', () => {
    expect(act({ fetchedPlan: 'free', lastSuccessAt: NOW - DAY_MS, lastAttemptAt: NOW - DAY_MS })).toBe('fetch');
    expect(act({ fetchedPlan: 'pro', lastSuccessAt: NOW - DAY_MS })).toBe('fresh');
    expect(act({ plan: 'free', fetchedPlan: 'free', lastSuccessAt: NOW - DAY_MS })).toBe('fresh');
    expect(act({ fetchedPlan: 'free', lastSuccessAt: NOW - DAY_MS, scrapesThisPeriod: 12 })).toBe('limit');
  });
  it('waits an hour after a failed run, and after a refresh now', () => {
    expect(act({ lastAttemptAt: NOW - 10 * 60_000, lastAttemptFailed: true })).toBe('wait');
    expect(act({ lastAttemptAt: NOW - HOUR_MS, lastAttemptFailed: true })).toBe('fetch');
    expect(act({ force: true, lastSuccessAt: NOW - DAY_MS, lastAttemptAt: NOW - 10 * 60_000 })).toBe('wait');
  });
  it('stops at the period cap: 3 on Free, 12 on Pro', () => {
    expect(act({ plan: 'free', lastSuccessAt: null, scrapesThisPeriod: 3 })).toBe('limit');
    expect(act({ lastSuccessAt: null, scrapesThisPeriod: 11 })).toBe('fetch');
    expect(act({ lastSuccessAt: null, scrapesThisPeriod: 12 })).toBe('limit');
  });
  it('starts a new period after 30 days and resets the count', () => {
    const d = decideRefresh({ ...base, lastSuccessAt: null, scrapesThisPeriod: 99, periodStart: NOW - 31 * DAY_MS });
    expect(d).toEqual({ action: 'fetch', periodStart: NOW, scrapesThisPeriod: 0 });
  });
});
