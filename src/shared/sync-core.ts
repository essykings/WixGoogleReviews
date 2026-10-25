// Keeps one site's saved reviews up to date. The storage and the provider are passed in, so the rules can be
// unit-tested without Wix or Apify. src/shared/sync.ts wires in the real ones.

import { describeError } from './errors';
import { estimateCostUsd, type FetchLog, type Origin } from './insights';
import { limitsFor, type Plan } from './plan';
import { decideRefresh, type RefreshAction } from './refresh';
import { selectReviews, type PlaceSummary, type Review } from './reviews';
import type { RegisteredPlace, ReviewCache } from './store-types';

export interface SyncDeps {
  loadPlace(): Promise<RegisteredPlace | null>;
  savePlace(p: RegisteredPlace): Promise<void>;
  saveCache(c: ReviewCache): Promise<void>;
  fetchReviews(target: { placeId: string } | { url: string }, maxReviews: number): Promise<{ reviews: Review[]; place: PlaceSummary }>;
  /** False when the provider cannot be called at all (no token). Checked first, so a setup problem never uses up an attempt. */
  providerReady?(): boolean;
  /** The spend brake: false pauses routine refreshes (back office kill switch or cap). Fails open. */
  allow?(estCostUsd: number, firstFetch: boolean): Promise<{ allowed: boolean; reason: string }>;
  /** Records one fetch in the back office. Best effort, never throws. */
  log?(entry: FetchLog): Promise<void>;
  /** Counts something that did not fetch (a skip), for the daily totals. Best effort. */
  count?(counter: string): Promise<void>;
}

export type SyncResult =
  | { status: Exclude<RefreshAction, 'fetch'> }
  | { status: 'paused'; reason: string }
  | { status: 'updated'; reviews: number }
  | { status: 'empty' }
  // TEST BUILD: `detail` says which step failed. Remove it (and its use in the dashboard) before the App Market launch.
  | { status: 'error'; message: string; detail?: string };

export async function syncReviews(
  deps: SyncDeps,
  opts: { plan: Plan; force?: boolean; origin?: Origin; instanceId?: string },
  now = Date.now(),
): Promise<SyncResult> {
  const place = await deps.loadPlace();
  const decision = decideRefresh({
    plan: opts.plan,
    hasPlace: !!place,
    lastSuccessAt: place?.lastSuccessAt ?? null,
    lastAttemptAt: place?.lastAttemptAt ?? null,
    lastAttemptFailed: place?.lastStatus === 'failed' || place?.lastStatus === 'pending',
    periodStart: place?.periodStart ?? null,
    scrapesThisPeriod: place?.scrapesThisPeriod ?? 0,
    now,
    force: !!opts.force,
    fetchedPlan: place?.lastPlan ?? null,
  });
  if (decision.action !== 'fetch' || !place) {
    const status = decision.action === 'fetch' ? 'no_place' : decision.action;
    await deps.count?.(`skip:${status}`);
    return { status };
  }
  if (deps.providerReady && !deps.providerReady()) {
    return { status: 'error', message: 'Reviews are not set up yet on our side. Please try again later.', detail: 'The review provider token is missing.' };
  }

  // The spend brake. A first fetch for a new site is let through up to 1.5 times the cap (decided in the back office).
  const limits = limitsFor(opts.plan);
  const count = limits.fetchCount;
  if (deps.allow) {
    const verdict = await deps.allow(estimateCostUsd(count), place.lastSuccessAt == null);
    if (!verdict.allowed) {
      await deps.count?.(`skip:paused:${verdict.reason}`);
      return { status: 'paused', reason: verdict.reason };
    }
  }

  // Count the attempt before calling the provider, so a crash mid-run still counts against the cap.
  let current: RegisteredPlace = {
    ...place,
    lastAttemptAt: now,
    lastStatus: 'pending',
    periodStart: decision.periodStart,
    scrapesThisPeriod: decision.scrapesThisPeriod + 1,
  };
  await deps.savePlace(current);

  const log = (outcome: FetchLog['outcome'], returned: number, kept: number, error?: unknown) =>
    deps.log?.({ startedAt: now, finishedAt: Date.now(), instanceId: opts.instanceId ?? '', plan: opts.plan, placeId: place.placeId || place.placeUrl, placeName: current.placeName, origin: opts.origin ?? 'visit', outcome, requested: count, returned, kept, error });

  try {
    const target = place.placeId ? { placeId: place.placeId } : { url: place.placeUrl };
    const got = await deps.fetchReviews(target, count);
    // A pasted Maps link becomes a Place ID here, from what the provider reports.
    const placeId = got.place.placeId || place.placeId;
    const kept = selectReviews(got.reviews, opts.plan);
    if (kept.length === 0) {
      current = { ...current, placeId, lastStatus: 'empty', lastSuccessAt: now, lastPlan: opts.plan, lastRequested: count, placeName: got.place.placeName || current.placeName };
      await deps.savePlace(current);
      await log('empty', got.reviews.length, 0);
      return { status: 'empty' };
    }
    if (!placeId) throw new Error('Could not tell which business that link is.');
    const placeName = got.place.placeName || current.placeName;
    await deps.saveCache({
      id: placeId,
      isActive: true,
      placeId,
      placeName,
      placeImageUrl: got.place.imageUrl,
      rating: got.place.rating,
      totalReviews: got.place.totalReviews,
      reviews: kept,
      fetchedAt: now,
    });
    await deps.savePlace({ ...current, placeId, placeName, lastStatus: 'ok', lastSuccessAt: now, lastPlan: opts.plan, lastRequested: count });
    await log('updated', got.reviews.length, kept.length);
    return { status: 'updated', reviews: kept.length };
  } catch (e) {
    console.error('syncReviews failed', e);
    await deps.savePlace({ ...current, lastStatus: 'failed' }).catch(() => {});
    await log('failed', 0, 0, e);
    return { status: 'error', message: 'Could not get your reviews right now. We will try again in a little while.', detail: describeError(e) };
  }
}
