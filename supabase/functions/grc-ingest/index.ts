// Supabase Edge Function: the back office's write door for the Google Reviews Carousel Wix app.
//
// POST with header x-insights-token. Body is one of:
//   { type: "fetch", ... }  one provider fetch attempt (see grc_fetches)
//   { type: "count", counter }  add one to today's counter (skips and pauses)
//   { type: "site", ... }   a site was seen (see grc_sites)
// Always answers { ok: true|false }. The Wix side treats any failure as "carry on", so this never blocks an owner.
//
// Secrets: INSIGHTS_TOKEN. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Deploy with --no-verify-jwt: callers present our own token, not a Supabase login.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const TOKEN = Deno.env.get("INSIGHTS_TOKEN") ?? ""
const MAX_BODY = 8000
const PLANS = ["free", "pro", "unknown"]
const ORIGINS = ["first_save", "owner_refresh", "dashboard", "visit"]
const OUTCOMES = ["updated", "empty", "failed"]

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })
}

// Compares without stopping at the first different character.
function sameToken(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "")
const int = (v: unknown, max = 100000): number => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v as number))) : 0)
const oneOf = (list: string[], v: unknown): string | null => (typeof v === "string" && list.includes(v) ? v : null)
const iso = (v: unknown): string | null => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null)

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405)
  if (!sameToken(req.headers.get("x-insights-token") ?? "", TOKEN)) return json({ ok: false }, 401)

  const raw = await req.text()
  if (raw.length > MAX_BODY) return json({ ok: false, error: "too_large" }, 413)
  let body: any
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ ok: false, error: "bad_json" }, 400)
  }

  try {
    if (body?.type === "count") {
      const counter = str(body.counter, 60).replace(/[^a-z0-9:_-]/gi, "")
      if (!counter) return json({ ok: false, error: "bad_counter" }, 400)
      const { error } = await supabase.rpc("grc_bump", { p_counter: counter, p_n: 1 })
      return json({ ok: !error })
    }

    if (body?.type === "site") {
      const instance = str(body.instance_id, 64)
      const plan = oneOf(PLANS, body.plan)
      if (!instance || !plan) return json({ ok: false, error: "bad_site" }, 400)
      const { error } = await supabase.rpc("grc_touch_site", {
        p_instance: instance,
        p_plan: plan,
        p_place: str(body.place_id, 100),
        p_saved: int(body.saved_places, 99),
        p_settings: body.settings_saved === true,
      })
      return json({ ok: !error })
    }

    if (body?.type === "fetch") {
      const plan = oneOf(PLANS, body.plan)
      const origin = oneOf(ORIGINS, body.origin)
      const outcome = oneOf(OUTCOMES, body.outcome)
      const started = iso(body.started_at)
      const finished = iso(body.finished_at)
      const instance = str(body.instance_id, 64)
      const place = str(body.place_id, 100)
      if (!plan || !origin || !outcome || !started || !finished || !instance || !place) return json({ ok: false, error: "bad_fetch" }, 400)
      const cost = Number.isFinite(body.est_cost_usd) ? Math.max(0, Math.min(1000, Number(body.est_cost_usd))) : 0
      const { error } = await supabase.from("grc_fetches").insert({
        started_at: started,
        finished_at: finished,
        duration_ms: int(body.duration_ms, 3_600_000),
        instance_id: instance,
        plan,
        place_id: place,
        place_name: str(body.place_name, 200),
        origin,
        outcome,
        requested: int(body.requested),
        returned: int(body.returned),
        kept: int(body.kept),
        est_cost_usd: cost,
        run_id: str(body.run_id, 64) || null,
        error_class: str(body.error_class, 40) || null,
        error_detail: str(body.error_detail, 300) || null,
      })
      return json({ ok: !error })
    }

    return json({ ok: false, error: "unknown_type" }, 400)
  } catch {
    return json({ ok: false }, 500)
  }
})
