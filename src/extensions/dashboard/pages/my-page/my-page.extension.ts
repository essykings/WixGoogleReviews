import { extensions } from '@wix/astro/builders';

export default extensions.dashboardPage({
  id: 'dca7bc01-dbeb-48e3-870e-87c78d25bc27',
  title: 'My Page',
  routePath: '',
  component: './extensions/dashboard/pages/my-page/my-page.tsx',
  fullPage: false,
  metaData: {
    searchable: true,
    description: 'Manage My Page in your dashboard.',
  },
});
