import type { APIRoute } from 'astro';
import { upgradeUrl } from '../../shared/config';
import { readFirst, readFresh } from '../../shared/instance';
import { limitsFor, planOf } from '../../shared/plan';
import { stripProFeatures, usesProFeatures } from '../../shared/settings';
import { loadPlace, loadSettings, saveSettings, siteData } from '../../shared/store';

/**
 * What the dashboard needs first, and small: the plan, the connected business and the saved customisations. The saved reviews are
 * a separate request (review-cache), so the page does not wait for them.
 * It also keeps the saved plan current: on a downgrade, Pro options are switched off here (the site cannot check the plan itself).
 */
export const GET: APIRoute = async () => {
  try {
    // One hop to learn the site, then everything else at the same time (the fresh plan read runs beside the data reads).
    const t0 = Date.now();
    const first = await readFirst();
    const tFirst = Date.now() - t0;
    if (!first.instanceId) return Response.json({ ok: true, plan: planOf(first), place: null, cache: null, settings: null });
    const data = siteData(first.instanceId);
    const [fresh, place, stored] = await Promise.all([readFresh(first.instanceId), loadPlace(data), loadSettings(data)]);
    const tData = Date.now() - t0 - tFirst;
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
      settings: stripProFeatures(settings, plan),
      settingsSaved: stored.saved,
      timings: { instanceMs: tFirst, dataMs: tData, totalMs: Date.now() - t0 },
    });
  } catch (error) {
    console.error('review-status failed', error);
    return Response.json({ ok: false, message: 'Could not read your reviews.' }, { status: 500 });
  }
};
