import type { InstanceInfo } from './instance';
import { touchSite } from './insights-server';
import type { Plan } from './plan';
import { listCaches, loadPlace, loadSettings, siteData } from './store';

/** Tells the back office this site is alive, with its plan, place and support details. Best effort: never throws, never blocks an owner. */
export async function recordSiteSeen(info: InstanceInfo, plan: Plan): Promise<void> {
  if (!info.instanceId) return;
  try {
    const data = siteData(info.instanceId);
    const [place, caches, settings] = await Promise.all([loadPlace(data), listCaches(data), loadSettings(data)]).catch(() => [null, [], { saved: false }] as const);
    await touchSite({ instanceId: info.instanceId, plan, placeId: place?.placeId ?? '', savedPlaces: caches.length, settingsSaved: settings.saved, ownerEmail: info.ownerEmail, siteUrl: info.siteUrl, siteName: info.siteName });
  } catch (e) {
    console.error('recordSiteSeen failed', e);
  }
}
