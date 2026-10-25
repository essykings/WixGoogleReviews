// The kill switch and spend caps the Insights page may change.
export interface ControlChange {
  fetch_enabled?: boolean
  daily_cap_usd?: number
  monthly_cap_usd?: number
}

const cap = (v: unknown): number | null => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 10000) return null
  return Math.round(v * 100) / 100
}

/** Validates what the page sent. Anything not listed is ignored; a bad value is an error, never silently dropped. */
export function parseControl(body: any): { ok: true; change: ControlChange } | { ok: false; message: string } {
  const change: ControlChange = {}
  if ("fetch_enabled" in (body ?? {})) {
    if (typeof body.fetch_enabled !== "boolean") return { ok: false, message: "fetch_enabled must be true or false" }
    change.fetch_enabled = body.fetch_enabled
  }
  for (const key of ["daily_cap_usd", "monthly_cap_usd"] as const) {
    if (key in (body ?? {})) {
      const v = cap(body[key])
      if (v === null) return { ok: false, message: `${key} must be a number between 0 and 10000` }
      change[key] = v
    }
  }
  if (Object.keys(change).length === 0) return { ok: false, message: "nothing to change" }
  return { ok: true, change }
}
