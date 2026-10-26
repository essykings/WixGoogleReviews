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

describe('support tab', () => {
  it('builds a mail link with the support code and plan, and nothing when no address is set', async () => {
    const { supportMailto } = await import('../src/shared/support');
    const link = supportMailto('abc-123', 'Pro plan', 'help@example.com');
    expect(link.startsWith('mailto:help@example.com?subject=')).toBe(true);
    expect(decodeURIComponent(link)).toContain('Support code: abc-123');
    expect(decodeURIComponent(link)).toContain('Plan: Pro plan');
    expect(supportMailto('abc', 'Free plan', '')).toBe('');
    expect(decodeURIComponent(supportMailto(undefined, 'Free plan', 'a@b.co'))).toContain('not available');
  });
  it('has plain answers with no jargon', async () => {
    const { SUPPORT_ANSWERS } = await import('../src/shared/support');
    expect(SUPPORT_ANSWERS.length).toBeGreaterThanOrEqual(4);
    for (const a of SUPPORT_ANSWERS) expect(`${a.q} ${a.a}`).not.toMatch(/API|JSON|token|instance|scrape|Apify|Supabase/i);
  });
});
