// Asking the owner for an App Market review: once per site, right after their business is saved and reviews were found.
// Pure, so it is unit-tested.

import { APP_ID } from './config';

/** Wix's own page for reviewing this app. It opens in a new tab (Wix pages refuse to be shown inside another page). */
export const REVIEW_URL = `https://www.wix.com/app-market/add-review/${APP_ID}`;

/** The id of the review modal (from its extension file; a test checks they match). */
export const REVIEW_MODAL_ID = '46c56845-6a25-4e7d-af10-187202b206eb';

/** Ask only when this save really found reviews, and never twice for the same site. */
export function shouldAskForReview(resultStatus: string | undefined, askedAt: number | null | undefined): boolean {
  return resultStatus === 'updated' && !askedAt;
}

/** Testing hook: opening the dashboard with ?reset-review-prompt in its address clears the "already asked" flag. */
export function wantsReviewReset(search: string): boolean {
  return /(^|[?&])reset-review-prompt(=|&|$)/.test(search);
}
