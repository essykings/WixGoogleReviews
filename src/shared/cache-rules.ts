// Which saved copies to keep and when a registered place can reuse one. Pure, so it is unit-tested.
// A site keeps at most MAX_SAVED_PLACES copies, one per Place ID, so switching back to a place we already
// fetched does not call the provider again while the copy is still young enough for the plan.

import type { RegisteredPlace, ReviewCache } from './store-types';

export const MAX_SAVED_PLACES = 3;

/** Ids of the saved copies to delete so at most `max` remain, always keeping `keepId`. Oldest go first. */
export function idsToPrune(items: { id: string; fetchedAt: number }[], keepId: string, max = MAX_SAVED_PLACES): string[] {
  const others = items.filter((i) => i.id !== keepId).sort((a, b) => a.fetchedAt - b.fetchedAt);
  const total = others.length + 1;
  return others.slice(0, Math.max(0, total - max)).map((i) => i.id);
}

/**
 * The registered place to save when the owner enters `placeId`. Same place: unchanged. A new place starts fresh,
 * except that a saved copy counts as the last success (so the refresh rules decide whether it is still young
 * enough) and the scrape count carries over, so re-saving cannot dodge the monthly cap.
 */
export function registeredPlaceFor(args: {
  existing: RegisteredPlace | null;
  placeId: string;
  cached: { fetchedAt: number; placeName: string } | null;
  now: number;
}): RegisteredPlace {
  const { existing, placeId, cached, now } = args;
  if (existing && existing.placeId === placeId) return existing;
  return {
    placeId,
    placeName: cached?.placeName ?? '',
    registeredAt: now,
    lastAttemptAt: null,
    lastSuccessAt: cached ? cached.fetchedAt : null,
    lastStatus: cached ? 'ok' : 'pending',
    scrapesThisPeriod: existing?.scrapesThisPeriod ?? 0,
    periodStart: existing?.periodStart ?? null,
    lastPlan: cached ? (existing?.lastPlan ?? null) : null,
  };
}

/**
 * The saved copy to show: the one flagged active; otherwise the newest with reviews. The fallback covers copies saved
 * before the flag existed and any moment when the flag is out of step, so a visitor never sees nothing while a copy exists.
 */
export function pickActive(copies: ReviewCache[]): ReviewCache | null {
  const flagged = copies.find((c) => c.isActive && c.reviews.length > 0);
  if (flagged) return flagged;
  const withReviews = copies.filter((c) => c.reviews.length > 0).sort((a, b) => b.fetchedAt - a.fetchedAt);
  return withReviews[0] ?? null;
}
