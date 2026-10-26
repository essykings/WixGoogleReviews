import type { APIRoute } from 'astro';
import { readFirst } from '../../shared/instance';
import { loadActiveCache, siteData } from '../../shared/store';

/** The saved reviews the preview shows (only the active copy). Separate from review-status so the dashboard can show the rest first. */
export const GET: APIRoute = async () => {
  try {
    const t0 = Date.now();
    const first = await readFirst();
    if (!first.instanceId) return Response.json({ ok: true, cache: null });
    const instanceMs = Date.now() - t0;
    const cache = await loadActiveCache(siteData(first.instanceId));
    return Response.json({ ok: true, cache, timings: { instanceMs, dataMs: Date.now() - t0 - instanceMs, totalMs: Date.now() - t0, reviews: cache?.reviews.length ?? 0 } });
  } catch (error) {
    console.error('review-cache failed', error);
    return Response.json({ ok: false, message: 'Could not read your reviews.' }, { status: 500 });
  }
};
