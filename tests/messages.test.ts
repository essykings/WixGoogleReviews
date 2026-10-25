import { describe, expect, it } from 'vitest';
import { formatWhen, noticeForResult, planLabel } from '../src/shared/messages';

describe('noticeForResult', () => {
  it('gives plain wording for every outcome', () => {
    expect(noticeForResult({ status: 'updated', reviews: 1 }).text).toContain('1 review ');
    expect(noticeForResult({ status: 'updated', reviews: 5 }).text).toContain('5 reviews');
    for (const status of ['empty', 'fresh', 'wait', 'limit', 'no_place'] as const) {
      expect(noticeForResult({ status } as any).text.length).toBeGreaterThan(10);
    }
    expect(noticeForResult({ status: 'error', message: 'Nope.' })).toEqual({ kind: 'danger', text: 'Nope.' });
    expect(noticeForResult(undefined).kind).toBe('danger');
  });
  it('uses no codes or jargon', () => {
    const all = ['empty', 'fresh', 'wait', 'limit', 'no_place'].map((status) => noticeForResult({ status } as any).text).join(' ');
    expect(all).not.toMatch(/WDE|API|JSON|provider|scrape|cache|\b\d{3}\b/i);
  });
});

describe('labels', () => {
  it('names the plan, and never calls an unknown plan Free', () => {
    expect(planLabel('free')).toBe('Free plan');
    expect(planLabel('pro')).toBe('Pro plan');
    expect(planLabel('unknown')).not.toMatch(/free/i);
  });
  it('says never for no date', () => expect(formatWhen(null)).toBe('never'));
});
