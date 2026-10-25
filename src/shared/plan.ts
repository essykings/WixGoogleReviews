// What each plan allows. Pure, so it is unit-tested. "Unknown" (the plan check failed) is never treated as Free:
// a failed check must not take features away from a paying customer.

export type Plan = 'free' | 'pro' | 'unknown';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

export interface PlanLimits {
  /** Reviews kept and shown. */
  maxReviews: number;
  /** Reviews asked from the provider (Free asks for a few extra so it can prefer ones with text). */
  fetchCount: number;
  /** Saved reviews older than this are refreshed. */
  maxAgeMs: number;
  /** Provider runs allowed per 30-day period, whatever the owner presses. */
  scrapesPerPeriod: number;
  /** Whether "refresh now" works. */
  canRefreshNow: boolean;
}

export const FREE_LIMITS: PlanLimits = {
  maxReviews: 5,
  fetchCount: 10,
  maxAgeMs: 30 * DAY_MS,
  scrapesPerPeriod: 3,
  canRefreshNow: false,
};

export const PRO_LIMITS: PlanLimits = {
  maxReviews: 100,
  fetchCount: 100,
  maxAgeMs: 7 * DAY_MS,
  scrapesPerPeriod: 12,
  canRefreshNow: true,
};

export function planOf(info: { isFree?: boolean }): Plan {
  if (info.isFree === true) return 'free';
  if (info.isFree === false) return 'pro';
  return 'unknown';
}

export function limitsFor(plan: Plan): PlanLimits {
  return plan === 'free' ? FREE_LIMITS : PRO_LIMITS;
}
