import { createClient, AppStrategy } from '@wix/sdk';
import { items } from '@wix/data';
import { WIX_CLIENT_ID } from 'astro:env/client';
import { WIX_CLIENT_SECRET } from 'astro:env/server';
import { ITEM_ID, REGISTERED_PLACES_COLLECTION, REVIEW_CACHE_COLLECTION, WIDGET_SETTINGS_COLLECTION } from './config';
import { isMissingCollection } from './errors';
import { idsToPrune, pickActive } from './cache-rules';
import { ms, num, rowToCache } from './cache-row';
import type { Plan } from './plan';
import { encodeReviews } from './reviews';
import { decodeSettings, encodeSettings, parsePlan, type Settings } from './settings';
import type { LastStatus, RegisteredPlace, ReviewCache } from './store-types';

export type { LastStatus, RegisteredPlace, ReviewCache };

/** Wix Data as this app, for one site. */
export function siteData(instanceId: string) {
  return createClient({
    auth: AppStrategy({ appId: WIX_CLIENT_ID, appSecret: WIX_CLIENT_SECRET, instanceId }),
    modules: { items },
  }).items;
}
export type SiteData = ReturnType<typeof siteData>;


/** A collection that was never created on this site holds nothing, so reading it is the same as an empty read. */
async function getOrNull(data: SiteData, collection: string, id: string = ITEM_ID) {
  try {
    return await data.get(collection, id);
  } catch (e) {
    if (isMissingCollection(e)) return null;
    throw e;
  }
}

function toStatus(v: unknown): LastStatus {
  return v === 'ok' || v === 'empty' || v === 'failed' ? v : 'pending';
}

export async function loadPlace(data: SiteData): Promise<RegisteredPlace | null> {
  const row = await getOrNull(data, REGISTERED_PLACES_COLLECTION);
  if (!row || !row.placeId) return null;
  return {
    placeId: String(row.placeId),
    placeName: String(row.placeName ?? ''),
    registeredAt: ms(row.registeredAt) ?? 0,
    lastAttemptAt: ms(row.lastAttemptAt),
    lastSuccessAt: ms(row.lastSuccessAt),
    lastStatus: toStatus(row.lastStatus),
    scrapesThisPeriod: num(row.scrapesThisPeriod) ?? 0,
    periodStart: ms(row.periodStart),
    lastPlan: row.lastPlan === 'free' || row.lastPlan === 'pro' ? row.lastPlan : null,
  };
}

export async function savePlace(data: SiteData, p: RegisteredPlace): Promise<void> {
  await data.save(REGISTERED_PLACES_COLLECTION, {
    _id: ITEM_ID,
    placeId: p.placeId,
    placeName: p.placeName,
    registeredAt: new Date(p.registeredAt),
    lastAttemptAt: p.lastAttemptAt == null ? null : new Date(p.lastAttemptAt),
    lastSuccessAt: p.lastSuccessAt == null ? null : new Date(p.lastSuccessAt),
    lastStatus: p.lastStatus,
    scrapesThisPeriod: p.scrapesThisPeriod,
    periodStart: p.periodStart == null ? '' : new Date(p.periodStart).toISOString(),
    lastPlan: p.lastPlan ?? '',
  });
}

/** The saved copy for one place, or null. */
export async function loadCacheFor(data: SiteData, placeId: string): Promise<ReviewCache | null> {
  const row = await getOrNull(data, REVIEW_CACHE_COLLECTION, placeId);
  return row ? rowToCache(row) : null;
}

/** Every saved copy on this site (a handful at most). */
export async function listCaches(data: SiteData): Promise<ReviewCache[]> {
  try {
    const res = await data.query(REVIEW_CACHE_COLLECTION).limit(50).find();
    return res.items.map(rowToCache);
  } catch (e) {
    if (isMissingCollection(e)) return [];
    throw e;
  }
}

/** The copy the widget shows, or null. */
export async function loadActiveCache(data: SiteData): Promise<ReviewCache | null> {
  return pickActive(await listCaches(data));
}

export async function saveCache(data: SiteData, c: ReviewCache): Promise<void> {
  await data.save(REVIEW_CACHE_COLLECTION, {
    _id: c.placeId,
    placeId: c.placeId,
    placeName: c.placeName,
    placeImageUrl: c.placeImageUrl,
    rating: c.rating,
    totalReviews: c.totalReviews,
    reviewsJson: encodeReviews(c.reviews),
    fetchedAt: new Date(c.fetchedAt),
    isActive: c.isActive,
  });
}

/** Makes `placeId` the copy the widget shows and every other copy hidden. */
export async function activateOnly(data: SiteData, placeId: string): Promise<void> {
  for (const c of await listCaches(data)) {
    const shouldBeActive = c.placeId === placeId;
    if (c.isActive !== shouldBeActive) await saveCache(data, { ...c, isActive: shouldBeActive });
  }
}

/** Deletes the oldest copies so at most MAX_SAVED_PLACES remain. */
export async function pruneCaches(data: SiteData, keepPlaceId: string): Promise<void> {
  const all = await listCaches(data);
  const doomed = idsToPrune(all.map((c) => ({ id: c.id, fetchedAt: c.fetchedAt })), keepPlaceId);
  for (const id of doomed) await data.remove(REVIEW_CACHE_COLLECTION, id);
}

export interface SavedSettings {
  settings: Settings;
  plan: Plan;
  /** False until the owner saves once; then `settings` are the defaults. */
  saved: boolean;
}

export async function loadSettings(data: SiteData): Promise<SavedSettings> {
  const row = await getOrNull(data, WIDGET_SETTINGS_COLLECTION);
  if (!row || !row.settingsJson) return { settings: decodeSettings(''), plan: 'unknown', saved: false };
  return { settings: decodeSettings(row.settingsJson), plan: parsePlan(row.plan), saved: true };
}

export async function saveSettings(data: SiteData, settings: Settings, plan: Plan): Promise<void> {
  await data.save(WIDGET_SETTINGS_COLLECTION, { _id: ITEM_ID, settingsJson: encodeSettings(settings), plan, savedAt: new Date() });
}
