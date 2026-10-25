import { collectionIdSuffix as reviewCacheSuffix } from '../extensions/backend/data-collections/review-cache';
import { collectionIdSuffix as widgetSettingsSuffix } from '../extensions/backend/data-collections/widget-settings';
import { collectionIdSuffix as registeredPlacesSuffix } from '../extensions/backend/data-collections/registered-places';

/**
 * App namespace, copied exactly from the Dev Center (Data Collections > View ID & keys), account prefix
 * included. A shortened one gives WDE0025 "collection does not exist".
 */
export const APP_NAMESPACE = '@kaistudiocoo/google-reviews-plus';

export const REVIEW_CACHE_COLLECTION = `${APP_NAMESPACE}/${reviewCacheSuffix}`;
export const REGISTERED_PLACES_COLLECTION = `${APP_NAMESPACE}/${registeredPlacesSuffix}`;

export const WIDGET_SETTINGS_COLLECTION = `${APP_NAMESPACE}/${widgetSettingsSuffix}`;

/** Each site has its own collections, so each holds a single item. */
export const ITEM_ID = 'main';

export const APP_ID = 'dcbc5ea3-c937-49cc-84f4-c5a486d1478d';

/** Wix's pricing page for this app. Every upgrade button opens it in a new tab. */
export function upgradeUrl(instanceId: string | undefined): string {
  const base = `https://www.wix.com/apps/upgrade/${APP_ID}`;
  return instanceId ? `${base}?appInstanceId=${encodeURIComponent(instanceId)}` : base;
}
