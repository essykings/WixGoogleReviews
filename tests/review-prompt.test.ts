import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_ID } from '../src/shared/config';
import { REVIEW_MODAL_ID, REVIEW_URL, shouldAskForReview, wantsReviewReset } from '../src/shared/review-prompt';

const dir = 'src/extensions/dashboard/modals/rate-google-reviews-carousel';

describe('shouldAskForReview', () => {
  it('asks only when this save found reviews, and only if we have not asked before', () => {
    expect(shouldAskForReview('updated', null)).toBe(true);
    expect(shouldAskForReview('updated', undefined)).toBe(true);
    expect(shouldAskForReview('updated', 1_700_000_000_000)).toBe(false);
    for (const status of ['empty', 'fresh', 'wait', 'limit', 'paused', 'error', 'no_place', undefined]) expect(shouldAskForReview(status, null)).toBe(false);
  });
});

describe('the review link and test hook', () => {
  it('opens this app\'s own review page on the App Market', () => {
    expect(REVIEW_URL).toBe(`https://www.wix.com/app-market/add-review/${APP_ID}`);
  });
  it('the reset hook only reacts to its own query word', () => {
    expect(wantsReviewReset('?reset-review-prompt')).toBe(true);
    expect(wantsReviewReset('?a=1&reset-review-prompt=1')).toBe(true);
    expect(wantsReviewReset('?reset-review-prompt&b=2')).toBe(true);
    for (const q of ['', '?reset', '?xreset-review-prompt', '?reset-review-prompts=1']) expect(wantsReviewReset(q)).toBe(false);
  });
});

describe('the review modal', () => {
  const extension = readFileSync(`${dir}/rate-google-reviews-carousel.extension.ts`, 'utf8');
  const component = readFileSync(`${dir}/rate-google-reviews-carousel.tsx`, 'utf8');
  it('the id used to open it matches the id of its extension', () => {
    expect(extension).toContain(`id: '${REVIEW_MODAL_ID}'`);
  });
  it('uses no Wix Design System (it makes a modal load slowly) and paints its own white background', () => {
    expect(component).not.toContain('@wix/design-system');
    expect(component).toMatch(/background: #fff/);
  });
  it('opens the review page in a new tab, safely, and always offers "Maybe later"', () => {
    expect(component).toContain("window.open(REVIEW_URL, '_blank', 'noopener,noreferrer')");
    expect(component).toContain('Maybe later');
    expect(component).toContain('dashboard.closeModal');
  });
});
