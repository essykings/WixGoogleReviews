import { extensions } from '@wix/astro/builders'
import config from './rate-google-reviews-carousel.config.ts';

export default extensions.dashboardModal({
  id: '46c56845-6a25-4e7d-af10-187202b206eb',
  title: config.title,
  width: config.width,
  height: config.height,
  component: './extensions/dashboard/modals/rate-google-reviews-carousel/rate-google-reviews-carousel.tsx',
});
