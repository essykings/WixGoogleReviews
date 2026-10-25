import type { DataCollection } from '@wix/astro/builders'

export const collectionIdSuffix = 'registered-places';

// One item per site (id "main"): the place this site registered and when we last asked the provider.
// The refresh rules read it (age check, per-period scrape count). Private: only our backend
// (elevated) can read or write it, never a visitor or the widget.
export default {
  idSuffix: collectionIdSuffix,
  displayName: 'Registered places',
  fields: [
    { type: 'TEXT', displayName: 'Place ID', key: 'placeId' },
    { type: 'TEXT', displayName: 'Place name', key: 'placeName' },
    { type: 'DATETIME', displayName: 'Registered at', key: 'registeredAt' },
    { type: 'DATETIME', displayName: 'Last refresh attempt', key: 'lastAttemptAt' },
    { type: 'DATETIME', displayName: 'Last successful refresh', key: 'lastSuccessAt' },
    { type: 'TEXT', displayName: 'Last status', key: 'lastStatus' },
    { type: 'NUMBER', displayName: 'Scrapes this period', key: 'scrapesThisPeriod' },
    { type: 'TEXT', displayName: 'Period start', key: 'periodStart' },
    { type: 'TEXT', displayName: 'Plan at last refresh', key: 'lastPlan' },
  ],
  displayField: 'placeName',
  dataPermissions: {
    itemInsert: 'PRIVILEGED',
    itemRead: 'PRIVILEGED',
    itemRemove: 'PRIVILEGED',
    itemUpdate: 'PRIVILEGED',
  },
  indexes: [],
  initialData: [],
} satisfies DataCollection;
