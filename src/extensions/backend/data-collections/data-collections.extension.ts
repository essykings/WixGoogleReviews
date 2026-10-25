import { extensions } from '@wix/astro/builders'

import reviewCacheCollection from './review-cache';

import registeredPlacesCollection from './registered-places';

import widgetSettingsCollection from './widget-settings';

export default extensions.dataCollections({
  id: '4e0b6329-2122-4964-9473-87a839094147',
  name: 'Data Collections',
  collections: [
    reviewCacheCollection,
    registeredPlacesCollection,
    widgetSettingsCollection
  ],
});
