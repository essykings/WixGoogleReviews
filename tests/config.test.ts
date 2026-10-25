import { describe, expect, it } from 'vitest';
import { REGISTERED_PLACES_COLLECTION, REVIEW_CACHE_COLLECTION } from '../src/shared/config';
import reviewCache from '../src/extensions/backend/data-collections/review-cache';
import registeredPlaces from '../src/extensions/backend/data-collections/registered-places';

describe('collection IDs', () => {
  it('use the full namespace from the Dev Center, account prefix included', () => {
    expect(REVIEW_CACHE_COLLECTION).toBe('@kaistudiocoo/google-reviews-plus/review-cache');
    expect(REGISTERED_PLACES_COLLECTION).toBe('@kaistudiocoo/google-reviews-plus/registered-places');
  });
});

describe('collection permissions', () => {
  it('lets visitors read the review cache but never write it', () => {
    expect(reviewCache.dataPermissions.itemRead).toBe('ANYONE');
    for (const k of ['itemInsert', 'itemUpdate', 'itemRemove'] as const) {
      expect(reviewCache.dataPermissions[k]).toBe('PRIVILEGED');
    }
  });

  it('keeps registered places fully private', () => {
    expect(Object.values(registeredPlaces.dataPermissions).every((v) => v === 'PRIVILEGED')).toBe(true);
  });

  it('never stores reviewer photos or profile links in the cache', () => {
    const keys = reviewCache.fields.map((f) => f.key);
    expect(keys.some((k) => /photo|profile|avatar/i.test(k))).toBe(false);
  });
});
