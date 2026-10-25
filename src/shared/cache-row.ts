// Reads Wix Data rows into our shapes. Pure (no Wix imports), so the site widget can use it too.

import { parsePlan, decodeSettings, type Settings } from './settings';
import type { Plan } from './plan';
import { decodeReviews } from './reviews';
import type { ReviewCache } from './store-types';

export function ms(v: unknown): number | null {
  const t = v instanceof Date ? v.getTime() : typeof v === 'string' ? Date.parse(v) : (v as any)?.$date ? Date.parse((v as any).$date) : NaN;
  return Number.isFinite(t) ? t : null;
}

export function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function rowToCache(row: any): ReviewCache {
  return {
    id: String(row._id),
    placeId: String(row.placeId || row._id),
    placeName: String(row.placeName ?? ''),
    placeImageUrl: typeof row.placeImageUrl === 'string' && row.placeImageUrl.startsWith('https://') ? row.placeImageUrl : '',
    rating: num(row.rating),
    totalReviews: num(row.totalReviews),
    reviews: decodeReviews(row.reviewsJson),
    fetchedAt: ms(row.fetchedAt) ?? 0,
    isActive: row.isActive === true,
  };
}

/** The widget's settings row, read the same way the dashboard saved it. No row means the defaults. */
export function settingsFromRow(row: any): { settings: Settings; plan: Plan } {
  return { settings: decodeSettings(row?.settingsJson), plan: parsePlan(row?.plan) };
}
