// The one place that knows which review provider we use. Everything else calls fetchReviews(), so the
// provider can be swapped (see docs/decisions.md). Today: Apify "compass/Google-Maps-Reviews-Scraper".

import { mapProviderItems, type PlaceSummary, type Review } from './reviews';

export const ACTOR = 'compass~Google-Maps-Reviews-Scraper';

export class ProviderError extends Error {}

export interface FetchedReviews {
  reviews: Review[];
  place: PlaceSummary;
}

/** The provider's input. personalData must be true or reviews arrive without author names; we never store the photo or profile link. */
export function buildProviderInput(placeId: string, maxReviews: number) {
  return {
    placeIds: [placeId],
    maxReviews,
    reviewsSort: 'newest',
    language: 'en',
    reviewsOrigin: 'google',
    personalData: true,
  };
}

export async function fetchReviews(
  placeId: string,
  opts: { maxReviews: number; token: string; fetchImpl?: typeof fetch },
): Promise<FetchedReviews> {
  if (!opts.token) throw new ProviderError('The review provider is not set up (missing token).');
  const run = opts.fetchImpl ?? fetch;
  const url = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=120`;
  const res = await run(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.token}` },
    body: JSON.stringify(buildProviderInput(placeId, opts.maxReviews)),
  });
  if (!res.ok) throw new ProviderError(`The review provider answered ${res.status}.`);
  let items: unknown;
  try {
    items = await res.json();
  } catch {
    throw new ProviderError('The review provider sent something we could not read.');
  }
  return mapProviderItems(items);
}
