import { extensions } from '@wix/astro/builders';

export default extensions.dashboardPage({
  id: 'dca7bc01-dbeb-48e3-870e-87c78d25bc27',
  title: 'Google Reviews Carousel',
  routePath: '',
  component: './extensions/dashboard/pages/reviews/reviews.tsx',
  fullPage: false,
  metaData: {
    searchable: true,
    description: 'Show your Google reviews on your site.',
  },
});
