import { describe, expect, it } from 'vitest';
import { cleanSiteQuery } from '../supabase/functions/_shared/search';
import { describeSendFailure, emailSettings, renderAlertEmail } from '../supabase/functions/_shared/alerts';
import { ACTOR, mapRun, runsUrl } from '../supabase/functions/_shared/apify';
import { sameToken } from '../supabase/functions/_shared/auth';
import { parseControl } from '../supabase/functions/_shared/control';

describe('sameToken', () => {
  it('accepts only an identical, non-empty token', () => {
    expect(sameToken('abc123', 'abc123')).toBe(true);
    for (const [a, b] of [['abc123', 'abc124'], ['abc', 'abcd'], ['', ''], ['x', ''], ['', 'x']]) expect(sameToken(a, b)).toBe(false);
  });
});

describe('mapRun (Apify run to our row)', () => {
  const run = { id: 'r1', startedAt: '2026-10-25T10:00:00.000Z', finishedAt: '2026-10-25T10:00:09.000Z', status: 'SUCCEEDED', usageTotalUsd: 0.05405, chargedEventCounts: { 'review-scraped': 90, 'apify-actor-start': 1 } };
  it('reads the real cost and the reviews charged', () => {
    expect(mapRun(run)).toEqual({ run_id: 'r1', started_at: '2026-10-25T10:00:00.000Z', finished_at: '2026-10-25T10:00:09.000Z', status: 'SUCCEEDED', usage_usd: 0.05405, reviews_charged: 90 });
  });
  it('copes with a run still going, missing numbers and junk', () => {
    expect(mapRun({ id: 'r2', startedAt: run.startedAt, status: 'RUNNING' })).toMatchObject({ finished_at: null, usage_usd: 0, reviews_charged: 0 });
    expect(mapRun({ ...run, usageTotalUsd: 'lots', chargedEventCounts: {} })).toMatchObject({ usage_usd: 0, reviews_charged: 0 });
    expect(mapRun({ ...run, usageTotalUsd: -5 })!.usage_usd).toBe(0);
    for (const bad of [null, {}, { id: 'x' }, { startedAt: run.startedAt }, { id: 'x', startedAt: 'nope' }]) expect(mapRun(bad)).toBeNull();
  });
  it('asks for the newest runs of the review scraper', () => {
    expect(ACTOR).toBe('compass~Google-Maps-Reviews-Scraper');
    expect(runsUrl(100)).toBe('https://api.apify.com/v2/acts/compass~Google-Maps-Reviews-Scraper/runs?desc=1&limit=100&offset=100');
    expect(runsUrl(0)).not.toContain('token');
  });
});

describe('alert emails', () => {
  const alert = { alert_key: 'failure_spike', severity: 'high', subject: 'Review fetches are failing (4 of 8 in the last hour)', body: 'Open <b>Insights</b> & look.' };
  it('names the problem in the subject and escapes everything in the body', () => {
    const m = renderAlertEmail(alert);
    expect(m.subject).toBe('[Google Reviews Carousel] Review fetches are failing (4 of 8 in the last hour)');
    expect(m.html).toContain('Needs attention now');
    expect(m.html).toContain('&lt;b&gt;Insights&lt;/b&gt; &amp; look.');
    expect(m.html).not.toContain('<b>Insights</b>');
    expect(m.text).toContain('Open <b>Insights</b> & look.');
  });
  it('wording follows the severity', () => {
    expect(renderAlertEmail({ ...alert, severity: 'medium' }).html).toContain('Worth a look');
    expect(renderAlertEmail({ ...alert, severity: 'info' }).html).toContain('For your information');
  });
  it('is only configured when the key, the sender and a valid recipient are all there', () => {
    expect(emailSettings({ RESEND_API_KEY: 'k', ALERT_EMAIL_FROM: 'a@b.co', ALERT_EMAIL_TO: 'me@x.com, you@y.org' })).toEqual({ apiKey: 'k', from: 'a@b.co', to: ['me@x.com', 'you@y.org'] });
    expect(emailSettings({ RESEND_API_KEY: 'k', ALERT_EMAIL_FROM: 'a@b.co', ALERT_EMAIL_TO: 'not-an-email' })).toBeNull();
    expect(emailSettings({ ALERT_EMAIL_FROM: 'a@b.co', ALERT_EMAIL_TO: 'me@x.com' })).toBeNull();
    expect(emailSettings({ RESEND_API_KEY: 'k', ALERT_EMAIL_TO: 'me@x.com' })).toBeNull();
    expect(emailSettings({})).toBeNull();
  });
});

describe('parseControl (what the Insights page may change)', () => {
  it('accepts the kill switch and caps, rounding money to cents', () => {
    expect(parseControl({ fetch_enabled: false })).toEqual({ ok: true, change: { fetch_enabled: false } });
    expect(parseControl({ daily_cap_usd: 2.456, monthly_cap_usd: 20 })).toEqual({ ok: true, change: { daily_cap_usd: 2.46, monthly_cap_usd: 20 } });
    expect(parseControl({ daily_cap_usd: 0 })).toEqual({ ok: true, change: { daily_cap_usd: 0 } });
  });
  it('rejects bad values loudly instead of dropping them', () => {
    for (const body of [{ fetch_enabled: 'yes' }, { daily_cap_usd: -1 }, { daily_cap_usd: 'five' }, { monthly_cap_usd: 99999 }, { daily_cap_usd: NaN }, {}, null, { other: 1 }]) {
      expect(parseControl(body as any).ok).toBe(false);
    }
  });
  it('ignores fields it does not know', () => {
    expect(parseControl({ fetch_enabled: true, id: false, note: 'x' })).toEqual({ ok: true, change: { fetch_enabled: true } });
  });
});

describe('describeSendFailure (why an alert email was refused)', () => {
  it('passes on the reason Resend gave, and adds a hint for the usual causes', () => {
    const forbidden = describeSendFailure(403, JSON.stringify({ statusCode: 403, message: 'You can only send testing emails to your own email address.', name: 'validation_error' }));
    expect(forbidden.status).toBe(403);
    expect(forbidden.reason).toContain('only send testing emails to your own email address');
    expect(forbidden.reason).toContain('verified');
    expect(describeSendFailure(401, '{"message":"API key is invalid"}').reason).toContain('API key is invalid');
    expect(describeSendFailure(422, '{"message":"Invalid `to` field"}').reason).toContain('sender and recipient');
  });
  it('copes with non-JSON, empty and very long answers, and keeps it short', () => {
    expect(describeSendFailure(500, 'Bad gateway').reason).toBe('Bad gateway');
    expect(describeSendFailure(500, '').reason).toBe('no reason given');
    expect(describeSendFailure(500, 'x'.repeat(2000)).reason.length).toBeLessThanOrEqual(200);
  });
});

describe('cleanSiteQuery (the support search box)', () => {
  it('keeps emails, addresses and names searchable', () => {
    expect(cleanSiteQuery('  Owner@Example.com ')).toBe('Owner@Example.com');
    expect(cleanSiteQuery('https://shop.example.com/x-1')).toBe('https://shop.example.com/x-1');
  });
  it('removes characters that could change the database filter, and refuses very short searches', () => {
    expect(cleanSiteQuery('a,b)or(c.eq.1')).not.toMatch(/[,()]/);
    expect(cleanSiteQuery('100% "sure"_')).not.toMatch(/[%"_]/);
    expect(cleanSiteQuery('ab')).toBe('');
    expect(cleanSiteQuery('%%%')).toBe('');
    expect(cleanSiteQuery(42)).toBe('');
    expect(cleanSiteQuery('x'.repeat(500)).length).toBe(100);
  });
});
