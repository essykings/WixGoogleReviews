import { INSIGHTS_TOKEN, INSIGHTS_URL } from 'astro:env/server';
import { askBrake, buildCountPayload, buildFetchPayload, buildSitePayload, callInsights, type InsightsConfig, type SiteTouch } from './insights';
import type { SyncDeps } from './sync-core';

/** The back-office connection, or null when it is not set up (then nothing is logged and nothing is braked). */
export function insightsConfig(): InsightsConfig | null {
  return INSIGHTS_URL && INSIGHTS_TOKEN ? { url: INSIGHTS_URL, token: INSIGHTS_TOKEN } : null;
}

/** The logging, counting and brake parts of the sync dependencies. Empty when the back office is not set up. */
export function insightsDeps(): Pick<SyncDeps, 'allow' | 'log' | 'count'> {
  const cfg = insightsConfig();
  if (!cfg) return {};
  return {
    allow: (est, first) => askBrake(cfg, est, first),
    log: async (entry) => void (await callInsights(cfg, 'grc-ingest', buildFetchPayload(entry))),
    count: async (counter) => void (await callInsights(cfg, 'grc-ingest', buildCountPayload(counter))),
  };
}

/** Records that a site was seen, with its plan and place. Best effort. */
export async function touchSite(t: SiteTouch): Promise<void> {
  const cfg = insightsConfig();
  if (cfg) await callInsights(cfg, 'grc-ingest', buildSitePayload(t));
}
