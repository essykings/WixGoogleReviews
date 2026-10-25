import type { APIRoute } from 'astro';
import { describeError } from '../../shared/errors';
import { readInstance } from '../../shared/instance';
import { planOf } from '../../shared/plan';
import { parsePlaceInput } from '../../shared/place';
import { registeredPlaceFor } from '../../shared/cache-rules';
import { activateOnly, loadCacheFor, loadPlace, savePlace, siteData } from '../../shared/store';
import { syncSite } from '../../shared/sync';

/** The owner saves their place. A place we already hold a copy for is reused; the scrape count always carries over so re-saving cannot dodge the cap. */
export const POST: APIRoute = async ({ request }) => {
  let input: unknown;
  try {
    input = (await request.json())?.input;
  } catch {
    return Response.json({ ok: false, message: 'Paste your Place ID first.' }, { status: 400 });
  }
  const parsed = parsePlaceInput(input);
  if (!parsed.ok) return Response.json({ ok: false, message: parsed.message }, { status: 400 });

  try {
    const info = await readInstance();
    if (!info.instanceId) return Response.json({ ok: false, message: 'Could not tell which site this is.' }, { status: 401 });
    const data = siteData(info.instanceId);
    const existing = await loadPlace(data);
    if (!existing || existing.placeId !== parsed.placeId) {
      // A copy we already hold for this place is reused (the refresh rules decide if it is still young enough).
      const cached = await loadCacheFor(data, parsed.placeId);
      await savePlace(data, registeredPlaceFor({ existing, placeId: parsed.placeId, cached, now: Date.now() }));
      if (cached) await activateOnly(data, parsed.placeId);
    }
    const result = await syncSite(info.instanceId, { plan: planOf(info), origin: 'first_save' });
    return Response.json({ ok: true, placeId: parsed.placeId, result });
  } catch (error) {
    console.error('register-place failed', error);
    return Response.json({ ok: false, message: 'Could not save your place. Please try again.', detail: describeError(error) }, { status: 500 });
  }
};
