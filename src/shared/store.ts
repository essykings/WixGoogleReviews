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

/** The registered business, or null when none is connected (a disconnected record only keeps the usage counter). */
export async function loadPlace(data: SiteData): Promise<RegisteredPlace | null> {
  const record = await loadPlaceRecord(data);
  return record && (record.placeId || record.placeUrl) ? record : null;
}

/** The stored record even when disconnected, for its usage counter. */
export async function loadPlaceRecord(data: SiteData): Promise<RegisteredPlace | null> {
  const row = await getOrNull(data, REGISTERED_PLACES_COLLECTION);
  if (!row) return null;
  return {
    placeId: String(row.placeId ?? ''),
    placeUrl: String(row.placeUrl ?? ''),
    placeName: String(row.placeName ?? ''),
    registeredAt: ms(row.registeredAt) ?? 0,
    lastAttemptAt: ms(row.lastAttemptAt),
    lastSuccessAt: ms(row.lastSuccessAt),
    lastStatus: toStatus(row.lastStatus),
    scrapesThisPeriod: num(row.scrapesThisPeriod) ?? 0,
    periodStart: ms(row.periodStart),
    lastPlan: row.lastPlan === 'free' || row.lastPlan === 'pro' ? row.lastPlan : null,
    reviewAskedAt: ms(row.reviewAskedAt),
    lastRequested: num(row.lastRequested),
  };
}

export async function savePlace(data: SiteData, p: RegisteredPlace): Promise<void> {
  await data.save(REGISTERED_PLACES_COLLECTION, {
    _id: ITEM_ID,
    placeId: p.placeId,
    placeUrl: p.placeUrl,
    placeName: p.placeName,
    registeredAt: new Date(p.registeredAt),
    lastAttemptAt: p.lastAttemptAt == null ? null : new Date(p.lastAttemptAt),
    lastSuccessAt: p.lastSuccessAt == null ? null : new Date(p.lastSuccessAt),
    lastStatus: p.lastStatus,
    scrapesThisPeriod: p.scrapesThisPeriod,
    periodStart: p.periodStart == null ? '' : new Date(p.periodStart).toISOString(),
    lastPlan: p.lastPlan ?? '',
    reviewAskedAt: p.reviewAskedAt == null ? null : new Date(p.reviewAskedAt),
    lastRequested: p.lastRequested,
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

/**
 * The copy the widget shows, or null. Reads only the one flagged active (a copy can hold 100 reviews, so reading all three
 * is slow); if none is flagged (an older save), it falls back to looking at all of them.
 */
export async function loadActiveCache(data: SiteData): Promise<ReviewCache | null> {
  try {
    const res = await data.query(REVIEW_CACHE_COLLECTION).eq('isActive', true).limit(1).find();
    const flagged = res.items[0] ? rowToCache(res.items[0]) : null;
    if (flagged && flagged.reviews.length > 0) return flagged;
  } catch (e) {
    if (!isMissingCollection(e)) throw e;
    return null;
  }
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

/** Deletes everything we stored on one site: every saved copy, the settings and the chosen business. Missing collections are fine. */
export async function deleteAllSiteData(data: SiteData): Promise<void> {
  for (const c of await listCaches(data)) await data.remove(REVIEW_CACHE_COLLECTION, c.id);
  for (const collection of [WIDGET_SETTINGS_COLLECTION, REGISTERED_PLACES_COLLECTION]) {
    try {
      await data.remove(collection, ITEM_ID);
    } catch (e) {
      if (!isMissingCollection(e) && !/not.?found/i.test(String((e as Error)?.message))) throw e;
    }
  }
}

/** Deletes every saved copy of reviews on this site (used when the owner disconnects). */
export async function deleteAllCaches(data: SiteData): Promise<void> {
  for (const c of await listCaches(data)) await data.remove(REVIEW_CACHE_COLLECTION, c.id);
}

/** After saving a copy: makes it the one shown and drops the oldest beyond the limit, reading the saved copies once (not twice). */
export async function activateAndPrune(data: SiteData, placeId: string): Promise<void> {
  const all = await listCaches(data);
  for (const c of all) {
    const shouldBeActive = c.placeId === placeId;
    if (c.isActive !== shouldBeActive) await saveCache(data, { ...c, isActive: shouldBeActive });
  }
  for (const id of idsToPrune(all.map((c) => ({ id: c.id, fetchedAt: c.fetchedAt })), placeId)) await data.remove(REVIEW_CACHE_COLLECTION, id);
}
