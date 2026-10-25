import type { DataCollection } from '@wix/astro/builders'

export const collectionIdSuffix = 'review-cache';

// One item per place this site has used (item id = the Place ID), at most 3 per site, so switching back to a
// place we already hold costs nothing. Exactly one item has `isActive` true: the one the widget shows.
// Saved so visitors never wait on the provider. Public to read (the widget reads it directly); only our backend can write.
// Holds only what is already public on Google: author name, stars, text, date, owner reply, review link.
// No reviewer photos or profile links.
export default {
  idSuffix: collectionIdSuffix,
  displayName: 'Review cache',
  fields: [
    { type: 'TEXT', displayName: 'Place ID', key: 'placeId' },
    { type: 'TEXT', displayName: 'Place name', key: 'placeName' },
    { type: 'TEXT', displayName: 'Business photo link', key: 'placeImageUrl' },
    { type: 'NUMBER', displayName: 'Average rating', key: 'rating' },
    { type: 'NUMBER', displayName: 'Total reviews on Google', key: 'totalReviews' },
    { type: 'TEXT', displayName: 'Reviews (JSON)', key: 'reviewsJson' },
    { type: 'DATETIME', displayName: 'Fetched at', key: 'fetchedAt' },
    { type: 'BOOLEAN', displayName: 'Shown on the site', key: 'isActive' },
  ],
  displayField: 'placeName',
  dataPermissions: {
    itemInsert: 'PRIVILEGED',
    itemRead: 'ANYONE',
    itemRemove: 'PRIVILEGED',
    itemUpdate: 'PRIVILEGED',
  },
  indexes: [],
  initialData: [],
} satisfies DataCollection;
