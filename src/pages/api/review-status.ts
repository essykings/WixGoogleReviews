import type { APIRoute } from 'astro';
import { pickActive } from '../../shared/cache-rules';
import { upgradeUrl } from '../../shared/config';
import { describeError } from '../../shared/errors';
import { readFirst, readFresh } from '../../shared/instance';
import { limitsFor, planOf } from '../../shared/plan';
import { stripProFeatures, usesProFeatures } from '../../shared/settings';
import { listCaches, loadPlace, loadSettings, saveSettings, siteData } from '../../shared/store';

/**
 * What the dashboard needs: the plan, the saved place, the saved reviews and the saved customisations.
 * It also keeps the saved plan current: on a downgrade, Pro options are switched off here (the site cannot check the plan itself).
 */
export const GET: APIRoute = async () => {
  try {
    // One hop to learn the site, then everything else at the same time (the fresh plan read runs beside the data reads).
    const first = await readFirst();
    if (!first.instanceId) return Response.json({ ok: true, plan: planOf(first), place: null, cache: null, settings: null });
    const data = siteData(first.instanceId);
    const [fresh, place, caches, stored] = await Promise.all([readFresh(first.instanceId), loadPlace(data), listCaches(data), loadSettings(data)]);
    const info = fresh ? { ...first, ...fresh, instanceId: first.instanceId } : first;
    const plan = planOf(info);
    let settings = stored.settings;
    if (stored.saved && plan !== 'unknown' && (stored.plan !== plan || (plan === 'free' && usesProFeatures(settings)))) {
      settings = stripProFeatures(settings, plan);
      await saveSettings(data, settings, plan);
    }
    return Response.json({
      ok: true,
      plan,
      siteLanguage: info.siteLanguage ?? 'en',
      limits: limitsFor(plan),
      upgradeUrl: upgradeUrl(info.instanceId),
      place,
      cache: pickActive(caches),
      savedPlaces: caches.map((c) => ({ placeId: c.placeId, placeName: c.placeName, fetchedAt: c.fetchedAt, active: c.isActive })),
      settings: stripProFeatures(settings, plan),
      settingsSaved: stored.saved,
    });
  } catch (error) {
    console.error('review-status failed', error);
    return Response.json({ ok: false, message: 'Could not read your reviews.', detail: describeError(error) }, { status: 500 });
  }
};
