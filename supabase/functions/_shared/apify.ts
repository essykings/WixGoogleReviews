// Reading Apify's own list of runs, to check our cost estimates against what it really charged.
export const ACTOR = "compass~Google-Maps-Reviews-Scraper"

export interface RunRow {
  run_id: string
  started_at: string
  finished_at: string | null
  status: string
  usage_usd: number
  reviews_charged: number
}

const iso = (v: unknown): string | null => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null)

/** One run as Apify reports it, in our table's shape; null when it is unusable. */
export function mapRun(run: any): RunRow | null {
  const id = typeof run?.id === "string" ? run.id.slice(0, 64) : ""
  const started = iso(run?.startedAt)
  if (!id || !started) return null
  const usage = Number(run?.usageTotalUsd)
  const charged = Number(run?.chargedEventCounts?.["review-scraped"])
  return {
    run_id: id,
    started_at: started,
    finished_at: iso(run?.finishedAt),
    status: typeof run?.status === "string" ? run.status.slice(0, 20) : "UNKNOWN",
    usage_usd: Number.isFinite(usage) ? Math.max(0, Math.min(1000, usage)) : 0,
    reviews_charged: Number.isFinite(charged) ? Math.max(0, Math.floor(charged)) : 0,
  }
}

export function runsUrl(offset: number, limit = 100): string {
  return `https://api.apify.com/v2/acts/${ACTOR}/runs?desc=1&limit=${limit}&offset=${offset}`
}
