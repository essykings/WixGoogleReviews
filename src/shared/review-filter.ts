// From the saved reviews to the ones shown: the owner's filters, sort and count, held to the plan. Pure, so it is unit-tested.

import { limitsFor, type Plan } from './plan';
import type { Review } from './reviews';
import { stripProFeatures, type Settings } from './settings';

const time = (r: Review) => Date.parse(r.publishedAt || '') || 0;

function hasAny(text: string, words: string[]): boolean {
  const t = text.toLocaleLowerCase();
  return words.some((w) => t.includes(w.toLocaleLowerCase()));
}

export function selectForDisplay(reviews: Review[], settings: Settings, plan: Plan): Review[] {
  const s = stripProFeatures(settings, plan);
  const hidden = new Set(s.hiddenIds);
  let list = reviews.filter((r) => !hidden.has(r.id) && s.stars.includes(r.rating));
  if (s.include.length) list = list.filter((r) => r.text && hasAny(r.text, s.include));
  if (s.exclude.length) list = list.filter((r) => !hasAny(r.text, s.exclude));
  if (s.onlyWithText) list = list.filter((r) => !!r.text);
  list = [...list].sort((a, b) => {
    if (s.sort === 'oldest') return time(a) - time(b);
    if (s.sort === 'highest') return b.rating - a.rating || time(b) - time(a);
    if (s.sort === 'lowest') return a.rating - b.rating || time(b) - time(a);
    return time(b) - time(a);
  });
  return list.slice(0, Math.min(s.count, limitsFor(plan).maxReviews));
}
