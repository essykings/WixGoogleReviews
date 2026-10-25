import { extensions } from '@wix/astro/builders'

export default extensions.customElement({
  id: '5da0ba4f-2b2f-47be-a3e9-1f9334b27d6c',
  name: 'Google Reviews Carousel',
  width: {
    defaultWidth: 900,
    allowStretch: true
  },
  height: {
    defaultHeight: 520
  },
  installation: {
    autoAdd: false
  },
  presets: [
    {
      id: '1976dfcb-5d9c-48b9-bb7e-02e4839717dd',
      name: 'default',
      thumbnailUrl: '{{BASE_URL}}/google-reviews-carousel-thumbnail.png',
    },
  ],
  tagName: 'google-reviews-carousel',
  element: './extensions/site/widgets/google-reviews-carousel/google-reviews-carousel.tsx',
  settings: './extensions/site/widgets/google-reviews-carousel/google-reviews-carousel.panel.tsx',
});
