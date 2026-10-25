// The refresh rules, in one pure function so repeated calls cost nothing extra. Unit-tested.
// Order: a place must be registered; then how old the saved reviews are; then the retry wait; then the
// per-period scrape cap. The provider is only asked when this says "fetch".

import { DAY_MS, HOUR_MS, limitsFor, type Plan } from './plan';

export const PERIOD_MS = 30 * DAY_MS;
/** After a failed run, or a "refresh now", wait this long before asking the provider again. */
export const RETRY_WAIT_MS = HOUR_MS;

export interface RefreshState {
  plan: Plan;
  hasPlace: boolean;
  lastSuccessAt: number | null;
  lastAttemptAt: number | null;
  lastAttemptFailed: boolean;
  periodStart: number | null;
  scrapesThisPeriod: number;
  now: number;
  force: boolean;
  /** The plan the saved reviews were fetched under, if known. */
  fetchedPlan?: Plan | null;
}

export type RefreshAction = 'fetch' | 'fresh' | 'no_place' | 'wait' | 'limit';

export interface RefreshDecision {
  action: RefreshAction;
  /** The period to save if we fetch: rolled over when 30 days have passed. */
  periodStart: number;
  scrapesThisPeriod: number;
}

export function decideRefresh(s: RefreshState): RefreshDecision {
  const limits = limitsFor(s.plan);
  const rolled = s.periodStart == null || s.now - s.periodStart >= PERIOD_MS;
  const periodStart = rolled ? s.now : (s.periodStart as number);
  const count = rolled ? 0 : s.scrapesThisPeriod;
  const decide = (action: RefreshAction): RefreshDecision => ({ action, periodStart, scrapesThisPeriod: count });

  if (!s.hasPlace) return decide('no_place');

  const forced = s.force && limits.canRefreshNow;
  // Upgrading from Free: the saved copy is the small Free one, so fetch the bigger one now (the cap and retry wait still apply).
  const upgraded = s.fetchedPlan === 'free' && s.plan !== 'free';
  const stale = s.lastSuccessAt == null || s.now - s.lastSuccessAt >= limits.maxAgeMs || upgraded;
  if (!stale && !forced) return decide('fresh');

  const recentAttempt = s.lastAttemptAt != null && s.now - s.lastAttemptAt < RETRY_WAIT_MS;
  if (recentAttempt && (s.lastAttemptFailed || forced)) return decide('wait');

  if (count >= limits.scrapesPerPeriod) return decide('limit');
  return decide('fetch');
}
