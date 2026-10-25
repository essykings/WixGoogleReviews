import type { APIRoute } from 'astro';
import { describeError } from '../../shared/errors';
import { readInstance } from '../../shared/instance';
import { parseOrigin } from '../../shared/insights';
import { touchSite } from '../../shared/insights-server';
import { planOf } from '../../shared/plan';
import { listCaches, loadPlace, loadSettings, siteData } from '../../shared/store';
import { syncSite } from '../../shared/sync';

/** Asks for fresh reviews. The rules (age, retry wait, plan, monthly cap) decide whether the provider is really called. */
export const POST: APIRoute = async ({ request }) => {
  let force = false;
  let origin = parseOrigin(undefined);
  try {
    const body = await request.json();
    force = body?.force === true;
    origin = parseOrigin(body?.origin);
  } catch {
    // no body is fine
  }
  try {
    const info = await readInstance();
    if (!info.instanceId) return Response.json({ ok: false, message: 'Could not tell which site this is.' }, { status: 401 });
    const plan = planOf(info);
    const result = await syncSite(info.instanceId, { plan, force, origin: force ? 'owner_refresh' : origin });
    if (origin === 'dashboard') {
      // The dashboard calls this once per visit: a good moment to note that the site is alive. Best effort.
      const data = siteData(info.instanceId);
      const [place, caches, settings] = await Promise.all([loadPlace(data), listCaches(data), loadSettings(data)]).catch(() => [null, [], { saved: false }] as const);
      await touchSite({ instanceId: info.instanceId, plan, placeId: place?.placeId ?? '', savedPlaces: caches.length, settingsSaved: settings.saved });
    }
    return Response.json({ ok: true, result });
  } catch (error) {
    console.error('refresh-reviews failed', error);
    return Response.json({ ok: false, message: 'Could not refresh right now.', detail: describeError(error) }, { status: 500 });
  }
};
