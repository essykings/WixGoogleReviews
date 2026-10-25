/**
 * Runs when the app is removed from a site: delete what we stored on that site (reviews with reviewers' names and photo
 * links, the saved settings, the chosen business). Wix says to use this event to clean up data. It may be delivered more
 * than once or late, and the site's data may already be out of reach, so every step is safe to repeat and never throws.
 *
 * This file is its own bundle, where Astro's secrets are not available, so it uses the event's own identity (auth.elevate)
 * and nothing from the back office. Site records there are cleared by the 90-day clean-up (a removed site is never seen again).
 */
import { appInstances } from '@wix/app-management';
import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import { cleanupSite } from '../../../../shared/cleanup';
import { ITEM_ID, REGISTERED_PLACES_COLLECTION, REVIEW_CACHE_COLLECTION, WIDGET_SETTINGS_COLLECTION } from '../../../../shared/config';

export default appInstances.onAppInstanceRemoved(async () => {
  const query = auth.elevate(items.query);
  const remove = auth.elevate(items.remove);
  const result = await cleanupSite({
    removeSiteData: async () => {
      const copies = await query(REVIEW_CACHE_COLLECTION).limit(100).find();
      for (const copy of copies.items) await remove(REVIEW_CACHE_COLLECTION, copy._id);
      for (const collection of [WIDGET_SETTINGS_COLLECTION, REGISTERED_PLACES_COLLECTION]) {
        await remove(collection, ITEM_ID).catch(() => {}); // already gone is fine
      }
    },
  });
  console.log('app removed: cleanup', result);
});
