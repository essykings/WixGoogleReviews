import type { APIRoute } from 'astro';
import { registeredPlaceFor } from '../../shared/cache-rules';
import { describeError } from '../../shared/errors';
import { readInstance } from '../../shared/instance';
import { resolveShortLink } from '../../shared/maps-url';
import { PLACE_HELP, parsePlaceInput } from '../../shared/place';
import { planOf } from '../../shared/plan';
import { shouldAskForReview } from '../../shared/review-prompt';
import { activateOnly, loadCacheFor, loadPlace, loadPlaceRecord, savePlace, siteData } from '../../shared/store';
import { syncSite } from '../../shared/sync';

/**
 * The owner saves their business: a Google Maps link (or a share link, which is followed to the full one) or a Place ID.
 * A business we already hold a copy for is reused; the scrape count always carries over so re-saving cannot dodge the cap.
 * A Maps link has no Place ID until its first fetch, when the provider reports it.
 */
export const POST: APIRoute = async ({ request }) => {
  let input: unknown;
  try {
    input = (await request.json())?.input;
  } catch {
    return Response.json({ ok: false, message: 'Paste your business’s Google Maps link first.' }, { status: 400 });
  }
  const parsed = parsePlaceInput(input);
  if (!parsed.ok) return Response.json({ ok: false, message: parsed.message }, { status: 400 });

  let target: { placeId: string } | { url: string };
  if (parsed.kind === 'id') target = { placeId: parsed.placeId };
  else if (parsed.kind === 'url') target = { url: parsed.url };
  else {
    const full = await resolveShortLink(parsed.url);
    if (!full) return Response.json({ ok: false, message: `We could not open that link. ${PLACE_HELP}` }, { status: 400 });
    target = { url: full };
  }

  try {
    const info = await readInstance();
    if (!info.instanceId) return Response.json({ ok: false, message: 'Could not tell which site this is.' }, { status: 401 });
    const data = siteData(info.instanceId);
    const existing = await loadPlaceRecord(data);
    const cached = 'placeId' in target ? await loadCacheFor(data, target.placeId) : null;
    const next = registeredPlaceFor({ existing, target, cached, now: Date.now() });
    if (next !== existing) {
      await savePlace(data, next);
      if (cached && 'placeId' in target) await activateOnly(data, target.placeId);
    }
    const result = await syncSite(info.instanceId, { plan: planOf(info), origin: 'first_save' });
    const saved = await loadPlace(data);
    // Ask for an App Market review once per site, right after reviews were found. The flag is saved before we answer, so a
    // second save (or a second tab) never asks again.
    const askForReview = !!saved && shouldAskForReview(result.status, saved.reviewAskedAt);
    if (askForReview && saved) await savePlace(data, { ...saved, reviewAskedAt: Date.now() });
    return Response.json({ ok: true, placeId: saved?.placeId ?? '', placeUrl: saved?.placeUrl ?? '', result, askForReview });
  } catch (error) {
    console.error('register-place failed', error);
    return Response.json({ ok: false, message: 'Could not save your business. Please try again.', detail: describeError(error) }, { status: 500 });
  }
};
