import type { Plan } from './plan';
import type { Review } from './reviews';

export type LastStatus = 'pending' | 'ok' | 'empty' | 'failed';

export interface RegisteredPlace {
  placeId: string;
  placeName: string;
  registeredAt: number;
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  lastStatus: LastStatus;
  scrapesThisPeriod: number;
  periodStart: number | null;
  /** The plan when the reviews were last fetched, so an upgrade can trigger one fresh, bigger fetch. */
  lastPlan: Plan | null;
}

export interface ReviewCache {
  /** The item id: the Place ID (older saves used "main"). */
  id: string;
  placeId: string;
  placeName: string;
  /** The business photo link, or ''. */
  placeImageUrl: string;
  rating: number | null;
  totalReviews: number | null;
  reviews: Review[];
  fetchedAt: number;
  /** The copy the widget shows. */
  isActive: boolean;
}
