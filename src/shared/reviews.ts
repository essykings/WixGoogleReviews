// The reviews we keep, and how provider output becomes them. Pure, so it is unit-tested.
// We keep only what is already public on Google: author name, stars, text, date, owner reply, review link.
// The reviewer's photo link is kept (owner decision 2026-10-25); the reviewer's profile page link is dropped here, so it can never reach storage.

import type { Plan } from './plan';
import { limitsFor } from './plan';

export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  /** ISO date-time. */
  publishedAt: string;
  language: string;
  /** Link to the reviewer's Google profile picture (Google's server, not a copy). Empty when there is none. */
  photoUrl: string;
  replyText: string;
  replyAt: string;
  url: string;
}

export interface PlaceSummary {
  placeName: string;
  /** The business photo link (Google's server). Empty when there is none. */
  imageUrl: string;
  rating: number | null;
  totalReviews: number | null;
}

const MAX_TEXT = 2000;

function str(v: unknown, max = 500): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function isoDate(v: unknown): string {
  if (typeof v !== 'string') return '';
  return Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : '';
}

/** One provider item (Apify Compass output) to our shape, or null when it is unusable. */
export function mapProviderItem(item: any): Review | null {
  if (!item || typeof item !== 'object' || item.isAdvertisement === true) return null;
  const id = str(item.reviewId, 200);
  const rating = Number(item.stars ?? item.rating);
  if (!id || !Number.isFinite(rating) || rating < 1 || rating > 5) return null;
  return {
    id,
    author: str(item.name, 100),
    rating: Math.round(rating),
    text: str(item.text, MAX_TEXT),
    publishedAt: isoDate(item.publishedAtDate),
    language: str(item.originalLanguage, 20),
    photoUrl: typeof item.reviewerPhotoUrl === 'string' && item.reviewerPhotoUrl.startsWith('https://') ? item.reviewerPhotoUrl.slice(0, 500) : '',
    replyText: str(item.responseFromOwnerText, MAX_TEXT),
    replyAt: isoDate(item.responseFromOwnerDate),
    url: typeof item.reviewUrl === 'string' && item.reviewUrl.startsWith('https://') ? item.reviewUrl.slice(0, 1000) : '',
  };
}

export function mapProviderItems(items: unknown): { reviews: Review[]; place: PlaceSummary } {
  const list = Array.isArray(items) ? items : [];
  const first = list.find((i) => i && typeof i === 'object') as any;
  const rating = Number(first?.totalScore);
  const total = Number(first?.reviewsCount);
  const seen = new Set<string>();
  const reviews: Review[] = [];
  for (const item of list) {
    const r = mapProviderItem(item);
    if (r && !seen.has(r.id)) {
      seen.add(r.id);
      reviews.push(r);
    }
  }
  return {
    reviews,
    place: {
      placeName: str(first?.title, 200),
      imageUrl: typeof first?.imageUrl === 'string' && first.imageUrl.startsWith('https://') ? first.imageUrl.slice(0, 500) : '',
      rating: Number.isFinite(rating) ? rating : null,
      totalReviews: Number.isFinite(total) ? total : null,
    },
  };
}

/** Newest first. Free keeps the newest ones that have text (a wall of bare stars shows little); Pro keeps all, up to its cap. */
export function selectReviews(reviews: Review[], plan: Plan): Review[] {
  const { maxReviews } = limitsFor(plan);
  const sorted = [...reviews].sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || '') || 0);
  if (plan !== 'free') return sorted.slice(0, maxReviews);
  const withText = sorted.filter((r) => r.text);
  const rest = sorted.filter((r) => !r.text);
  return [...withText, ...rest].slice(0, maxReviews);
}

export function encodeReviews(reviews: Review[]): string {
  return JSON.stringify({ v: 1, reviews });
}

/** Tolerant: anything that is not our format reads as "no reviews", never as a crash. */
export function decodeReviews(json: unknown): Review[] {
  if (typeof json !== 'string' || !json) return [];
  try {
    const data = JSON.parse(json);
    if (!data || !Array.isArray(data.reviews)) return [];
    return data.reviews
      .filter((r: any) => r && typeof r.id === 'string' && typeof r.rating === 'number')
      .map((r: any) => ({ ...r, photoUrl: typeof r.photoUrl === 'string' ? r.photoUrl : '' }));
  } catch {
    return [];
  }
}
