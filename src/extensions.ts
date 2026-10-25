import { app } from '@wix/astro/builders';
import myPage from './extensions/dashboard/pages/reviews/reviews.extension.ts';

import dataCollections from './extensions/backend/data-collections/data-collections.extension.ts';

import googleReviewsCarousel from './extensions/site/widgets/google-reviews-carousel/google-reviews-carousel.extension.ts';

import appRemoved from './extensions/backend/events/app-removed/app-removed.extension.ts';

import rateGoogleReviewsCarousel from './extensions/dashboard/modals/rate-google-reviews-carousel/rate-google-reviews-carousel.extension.ts';

export default app().use(myPage).use(dataCollections).use(googleReviewsCarousel).use(appRemoved).use(rateGoogleReviewsCarousel);
