// Plain-English wording for the dashboard. Pure, so it is unit-tested. Owners are not developers: no codes, no jargon.

import type { SyncResult } from './sync-core';
import type { Plan } from './plan';

export interface Notice {
  kind: 'success' | 'warning' | 'danger' | 'standard';
  text: string;
}

export function noticeForResult(result: SyncResult | undefined): Notice {
  switch (result?.status) {
    case 'updated':
      return { kind: 'success', text: `Done. We found ${result.reviews} review${result.reviews === 1 ? '' : 's'} for your business.` };
    case 'empty':
      return { kind: 'warning', text: 'We saved your place, but we could not find any reviews for it. If this is not your business, disconnect it and paste the right link.' };
    case 'fresh':
      return { kind: 'standard', text: 'Your reviews are already up to date.' };
    case 'wait':
      return { kind: 'warning', text: 'We just tried a moment ago. Please wait about an hour before trying again.' };
    case 'limit':
      return { kind: 'warning', text: 'Your plan allows only so many review checks a month, and you have used them all. They come back automatically, and your saved reviews keep showing.' };
    case 'paused':
      return { kind: 'warning', text: 'We have paused collecting new reviews for a little while. Your saved reviews keep showing. Please try again later.' };
    case 'no_place':
      return { kind: 'warning', text: 'Add your Place ID first.' };
    case 'error':
      return { kind: 'danger', text: result.message };
    default:
      return { kind: 'danger', text: 'Something went wrong. Please try again.' };
  }
}

export function planLabel(plan: Plan | undefined): string {
  return plan === 'free' ? 'Free plan' : plan === 'pro' ? 'Pro plan' : 'Plan not checked';
}

export function formatWhen(ms: number | null | undefined): string {
  if (!ms) return 'never';
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
