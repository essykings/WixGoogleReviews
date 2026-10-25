// The Wix side of the Supabase back office: what we log about each provider fetch, and the spend brake.
// Everything here is best effort and FAILS OPEN: if Supabase is slow, down or not set up, nothing the owner or a
// visitor sees changes (the per-site monthly cap still applies). Pure apart from the fetch it is given, so it is unit-tested.
// Never logged: reviewer names, photos, review text, visitor details, tokens.

import { describeError } from './errors';
import type { Plan } from './plan';

/** Rough cost of a fetch: the provider's price per review, plus its start fee. */
export const COST_PER_REVIEW_USD = 0.0006;
export const START_FEE_USD = 0.00005;

/** Awaited with a race, because Wix may cancel a request that is not awaited. Kept short so it never slows an owner action noticeably. */
export const INSIGHTS_TIMEOUT_MS = 1500;

export const ORIGINS = ['first_save', 'owner_refresh', 'dashboard', 'visit'] as const;
export type Origin = (typeof ORIGINS)[number];

export function parseOrigin(v: unknown): Origin {
  return ORIGINS.includes(v as Origin) ? (v as Origin) : 'visit';
}

export function estimateCostUsd(reviews: number): number {
  const n = Math.max(0, Math.floor(reviews));
  return Math.round((n * COST_PER_REVIEW_USD + START_FEE_USD) * 100000) / 100000;
}

/** A short label for why a fetch failed, so failures can be grouped (never a message with secrets). */
export function classifyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const http = /answered (\d{3})/.exec(msg);
  if (http) return `provider_${http[1]}`;
  if (/missing token|not set up/i.test(msg)) return 'missing_token';
  if (/abort|timeout|timed out/i.test(msg)) return 'timeout';
  if (/could not read/i.test(msg)) return 'unreadable';
  return 'unknown';
}

export type FetchOutcome = 'updated' | 'empty' | 'failed';

export interface FetchLog {
  startedAt: number;
  finishedAt: number;
  instanceId: string;
  plan: Plan;
  placeId: string;
  placeName: string;
  origin: Origin;
  outcome: FetchOutcome;
  requested: number;
  returned: number;
  kept: number;
  error?: unknown;
}

/** The exact JSON sent to the back office. Only these fields, all trimmed. */
export function buildFetchPayload(l: FetchLog) {
  return {
    type: 'fetch' as const,
    started_at: new Date(l.startedAt).toISOString(),
    finished_at: new Date(l.finishedAt).toISOString(),
    duration_ms: Math.max(0, Math.round(l.finishedAt - l.startedAt)),
    instance_id: l.instanceId.slice(0, 64),
    plan: l.plan,
    place_id: l.placeId.slice(0, 100),
    place_name: l.placeName.slice(0, 200),
    origin: l.origin,
    outcome: l.outcome,
    requested: l.requested,
    returned: l.returned,
    kept: l.kept,
    est_cost_usd: l.outcome === 'failed' && l.returned === 0 ? estimateCostUsd(0) : estimateCostUsd(l.returned),
    error_class: l.outcome === 'failed' ? classifyError(l.error) : null,
    error_detail: l.outcome === 'failed' ? describeError(l.error).slice(0, 300) : null,
  };
}

export interface InsightsConfig {
  url: string;
  token: string;
  fetchImpl?: typeof fetch;
}

/** POST to one back-office function. Returns the parsed JSON, or null on any failure or timeout. Never throws. */
export async function callInsights(cfg: InsightsConfig, fn: 'grc-ingest' | 'grc-allow', body: unknown, timeoutMs = INSIGHTS_TIMEOUT_MS): Promise<any | null> {
  if (!cfg.url || !cfg.token) return null;
  const run = cfg.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await run(`${cfg.url.replace(/\/+$/, '')}/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-insights-token': cfg.token },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface BrakeAnswer {
  allowed: boolean;
  reason: string;
}

/** May we spend `estCostUsd` now? Yes whenever the back office cannot be reached. */
export async function askBrake(cfg: InsightsConfig, estCostUsd: number, firstFetch: boolean): Promise<BrakeAnswer> {
  const answer = await callInsights(cfg, 'grc-allow', { est_cost_usd: estCostUsd, first: firstFetch });
  if (answer && typeof answer.allowed === 'boolean') return { allowed: answer.allowed, reason: typeof answer.reason === 'string' ? answer.reason.slice(0, 40) : '' };
  return { allowed: true, reason: 'unreachable' };
}

export function buildCountPayload(counter: string) {
  return { type: 'count' as const, counter: counter.replace(/[^a-z0-9:_-]/gi, '').slice(0, 60) };
}

export interface SiteTouch {
  instanceId: string;
  plan: Plan;
  placeId: string;
  savedPlaces: number;
  settingsSaved: boolean;
}

export function buildSitePayload(t: SiteTouch) {
  return {
    type: 'site' as const,
    instance_id: t.instanceId.slice(0, 64),
    plan: t.plan,
    place_id: t.placeId.slice(0, 100),
    saved_places: Math.max(0, Math.min(99, Math.floor(t.savedPlaces))),
    settings_saved: t.settingsSaved,
  };
}
