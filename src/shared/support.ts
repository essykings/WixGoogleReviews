// What the dashboard's Support tab says and links to. Pure, so it is unit-tested.

import { SUPPORT_EMAIL } from './config';

/** The mail link for "Email support": the owner's support code and plan are filled in so we can find their site quickly. Empty when no support address is set. */
export function supportMailto(supportCode: string | undefined, planLabel: string, email = SUPPORT_EMAIL): string {
  if (!email) return '';
  const subject = 'Help with Google Reviews Carousel';
  const body = ['Hello,', '', 'I need help with: ', '', '', `Support code: ${supportCode || 'not available'}`, `Plan: ${planLabel}`].join('\n');
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export interface Answer {
  q: string;
  a: string;
}

/** Plain-English answers to what owners ask most. */
export const SUPPORT_ANSWERS: Answer[] = [
  { q: 'My reviews do not show on my site.', a: 'Open the Wix Editor, press Add, choose Apps, and drag Google Reviews Carousel onto your page. Then publish your site. In the Connection tab, make sure your business is saved and shows a green dot.' },
  { q: 'It is showing the wrong business.', a: 'Open the Connection tab, press Disconnect, then paste the Google Maps link for the right business. Open it on Google Maps, press Share, then Copy link.' },
  { q: 'My newest reviews are missing.', a: 'We check Google for new reviews about once a month on the Free plan and once a week on Pro. Pro can also press Refresh now. A review can take a day or two to appear on Google itself.' },
  { q: 'I cannot find a review I know exists.', a: 'We show public Google reviews. On the Free plan we keep 5 reviews and prefer ones with text. You may also have hidden it in the Settings tab, under Hide reviews.' },
  { q: 'It says it could not get my reviews.', a: 'This is usually a short problem on Google’s side. Your saved reviews keep showing on your site. We try again automatically; if it lasts more than a day, contact us with your support code.' },
];
