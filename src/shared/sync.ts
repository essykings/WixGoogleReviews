import { APIFY_TOKEN } from 'astro:env/server';
import type { Plan } from './plan';
import { insightsDeps } from './insights-server';
import type { Origin } from './insights';
import { fetchReviews } from './provider';
import { activateAndPrune, loadPlace, savePlace, saveCache, siteData } from './store';
import { syncReviews, type SyncResult } from './sync-core';

export type { SyncResult };

/** Keeps one site's saved reviews up to date. Safe to call often: it does nothing unless the rules say to fetch. */
export function syncSite(instanceId: string, opts: { plan: Plan; force?: boolean; origin?: Origin }): Promise<SyncResult> {
  const data = siteData(instanceId);
  return syncReviews(
    {
      loadPlace: () => loadPlace(data),
      savePlace: (p) => savePlace(data, p),
      // Save this place's copy, make it the one shown, and drop the oldest copies beyond the limit.
      saveCache: async (c) => {
        await saveCache(data, c);
        await activateAndPrune(data, c.placeId);
      },
      providerReady: () => !!APIFY_TOKEN,
      ...insightsDeps(),
      fetchReviews: (target, maxReviews) => fetchReviews(target, { maxReviews, token: APIFY_TOKEN ?? '' }),
    },
    { ...opts, instanceId },
  );
}
