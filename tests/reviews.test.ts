import { describe, expect, it } from 'vitest';
import { decodeReviews, encodeReviews, mapProviderItem, mapProviderItems, selectReviews, type Review } from '../src/shared/reviews';

const item = (o: any = {}) => ({
  reviewId: 'r1', name: 'Ann Lee', stars: 5, text: 'Great', publishedAtDate: '2026-10-24T13:35:40.173Z',
  originalLanguage: 'en', responseFromOwnerText: 'Thanks', responseFromOwnerDate: '2026-10-25T09:00:00.000Z',
  reviewUrl: 'https://www.google.com/maps/reviews/data=x', reviewerPhotoUrl: 'https://photo', reviewerUrl: 'https://profile',
  title: 'The Ritz', imageUrl: 'https://place.photo/x', totalScore: 4.6, reviewsCount: 7927, ...o,
});

describe('mapProviderItem', () => {
  it('keeps the public review fields and the photo link, but never the reviewer profile link', () => {
    const r = mapProviderItem(item())!;
    expect(r).toMatchObject({ id: 'r1', author: 'Ann Lee', rating: 5, text: 'Great', replyText: 'Thanks', photoUrl: 'https://photo' });
    expect(JSON.stringify(r)).not.toContain('https://profile');
    expect(mapProviderItem(item({ reviewerPhotoUrl: 'http://insecure' }))!.photoUrl).toBe('');
    expect(mapProviderItem(item({ reviewerPhotoUrl: null }))!.photoUrl).toBe('');
  });
  it('skips ads and items without an ID or a valid star rating', () => {
    expect(mapProviderItem(item({ isAdvertisement: true }))).toBeNull();
    expect(mapProviderItem(item({ reviewId: '' }))).toBeNull();
    expect(mapProviderItem(item({ stars: 0 }))).toBeNull();
    expect(mapProviderItem(null)).toBeNull();
  });
  it('handles star-only reviews, missing replies and missing names', () => {
    const r = mapProviderItem(item({ text: null, responseFromOwnerText: null, responseFromOwnerDate: null, name: null }))!;
    expect(r.text).toBe('');
    expect(r.replyText).toBe('');
    expect(r.replyAt).toBe('');
    expect(r.author).toBe('');
  });
  it('only keeps https review links', () => {
    expect(mapProviderItem(item({ reviewUrl: 'javascript:alert(1)' }))!.url).toBe('');
  });
});

describe('mapProviderItems', () => {
  it('reads the place summary and drops duplicates', () => {
    const { reviews, place } = mapProviderItems([item(), item(), item({ reviewId: 'r2' })]);
    expect(reviews).toHaveLength(2);
    expect(place).toEqual({ placeName: 'The Ritz', imageUrl: 'https://place.photo/x', rating: 4.6, totalReviews: 7927 });
  });
  it('copes with nothing at all', () => {
    expect(mapProviderItems(undefined).reviews).toEqual([]);
    expect(mapProviderItems([]).place).toEqual({ placeName: '', imageUrl: '', rating: null, totalReviews: null });
  });
});

const rv = (id: string, date: string, text: string): Review => ({
  id, author: 'A', rating: 5, text, publishedAt: date, language: 'en', photoUrl: '', replyText: '', replyAt: '', url: '',
});

describe('selectReviews', () => {
  const many = Array.from({ length: 8 }, (_, i) => rv(`r${i}`, `2026-10-${10 + i}T00:00:00.000Z`, i % 2 ? 'text' : ''));
  it('Free keeps 5, newest first, preferring reviews with text', () => {
    const out = selectReviews(many, 'free');
    expect(out).toHaveLength(5);
    expect(out.slice(0, 4).every((r) => r.text)).toBe(true);
    expect(out[0].id).toBe('r7');
  });
  it('Pro and unknown keep everything up to 100, newest first', () => {
    expect(selectReviews(many, 'pro').map((r) => r.id)[0]).toBe('r7');
    expect(selectReviews(many, 'unknown')).toHaveLength(8);
    const lots = Array.from({ length: 150 }, (_, i) => rv(`x${i}`, '2026-01-01T00:00:00.000Z', 't'));
    expect(selectReviews(lots, 'pro')).toHaveLength(100);
  });
});

describe('encode/decode', () => {
  it('round-trips and never throws on bad data', () => {
    const list = [rv('a', '2026-10-01T00:00:00.000Z', 'hi')];
    expect(decodeReviews(encodeReviews(list))).toEqual(list);
    for (const bad of [undefined, '', 'nope', '{"v":1}', '{"reviews":[1,null,{"id":"x"}]}']) {
      expect(decodeReviews(bad)).toEqual([]);
    }
  });
});
