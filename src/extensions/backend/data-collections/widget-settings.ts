import type { DataCollection } from '@wix/astro/builders'

export const collectionIdSuffix = 'widget-settings';

// One item per site (id "main"): everything the owner customises in the dashboard (template, filters, colours, what to show),
// saved by our backend and read by the widget on the live site. Public to read, because the widget runs for any visitor.
// Holds no personal data. `plan` is the plan when it was saved, so the widget can hold the settings to it.
export default {
  idSuffix: collectionIdSuffix,
  displayName: 'Widget settings',
  fields: [
    { type: 'TEXT', displayName: 'Settings (JSON)', key: 'settingsJson' },
    { type: 'TEXT', displayName: 'Plan when saved', key: 'plan' },
    { type: 'DATETIME', displayName: 'Saved at', key: 'savedAt' },
  ],
  displayField: 'plan',
  dataPermissions: {
    itemInsert: 'PRIVILEGED',
    itemRead: 'ANYONE',
    itemRemove: 'PRIVILEGED',
    itemUpdate: 'PRIVILEGED',
  },
  indexes: [],
  initialData: [],
} satisfies DataCollection;
