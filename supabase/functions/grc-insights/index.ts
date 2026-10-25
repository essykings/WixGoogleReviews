// Supabase Edge Function: the data for the private Insights page (supabase/insights/index.html), and the controls on it.
//
// POST with header x-admin-token (a separate secret from the app's token; only you have it). Body:
//   { action: "summary", filters?: { outcome?, plan?, instance? } }  everything the page shows
//   { action: "set_control", fetch_enabled?, daily_cap_usd?, monthly_cap_usd? }  the kill switch and the spend caps
//
// Secrets: ADMIN_TOKEN. Deploy with --no-verify-jwt. (Supabase does not serve web pages from functions, so the page itself
// is a file you open from your computer; it only ever talks to this function.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { CORS_HEADERS, sameToken } from "../_shared/auth.ts"
import { parseControl } from "../_shared/control.ts"

const ADMIN_TOKEN = Deno.env.get("ADMIN_TOKEN") ?? ""
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" } })

const OUTCOMES = ["updated", "empty", "failed"]
const PLANS = ["free", "pro", "unknown"]

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== "POST") return json({ ok: false }, 405)
  if (!sameToken(req.headers.get("x-admin-token") ?? "", ADMIN_TOKEN)) return json({ ok: false, error: "wrong token" }, 401)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: "bad request" }, 400)
  }

  try {
    if (body?.action === "set_control") {
      const parsed = parseControl(body)
      if (!parsed.ok) return json({ ok: false, error: parsed.message }, 400)
      const { error } = await supabase.from("grc_control").update({ ...parsed.change, updated_at: new Date().toISOString() }).eq("id", true)
      return json({ ok: !error })
    }

    if (body?.action === "summary") {
      const f = body.filters ?? {}
      let fetches = supabase.from("grc_fetches").select("id,started_at,duration_ms,instance_id,plan,place_id,place_name,origin,outcome,requested,returned,kept,est_cost_usd,error_class,error_detail").order("started_at", { ascending: false }).limit(100)
      if (typeof f.outcome === "string" && OUTCOMES.includes(f.outcome)) fetches = fetches.eq("outcome", f.outcome)
      if (typeof f.plan === "string" && PLANS.includes(f.plan)) fetches = fetches.eq("plan", f.plan)
      if (typeof f.instance === "string" && f.instance.trim()) fetches = fetches.eq("instance_id", f.instance.trim().slice(0, 64))
      const [today, daily, bySite, failures, shared, cost, control, alerts, due, skips, sites] = await Promise.all([
        supabase.from("grc_today").select("*").maybeSingle(),
        supabase.from("grc_spend_daily").select("*").limit(30),
        supabase.from("grc_spend_by_site").select("*").limit(20),
        supabase.from("grc_failures").select("*"),
        supabase.from("grc_shared_places").select("*").limit(20),
        supabase.from("grc_cost_check").select("*").limit(14),
        supabase.from("grc_control").select("*").maybeSingle(),
        supabase.from("grc_alerts").select("*").order("last_sent_at", { ascending: false }).limit(10),
        supabase.rpc("grc_alert_candidates"),
        supabase.from("grc_daily").select("day,counter,count").gte("day", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)),
        supabase.from("grc_sites").select("plan"),
      ])
      const list = await fetches
      const siteCounts = { free: 0, pro: 0, unknown: 0 } as Record<string, number>
      for (const s of sites.data ?? []) siteCounts[s.plan] = (siteCounts[s.plan] ?? 0) + 1
      return json({
        ok: true,
        today: today.data,
        daily: daily.data ?? [],
        bySite: bySite.data ?? [],
        failures: failures.data ?? [],
        shared: shared.data ?? [],
        costCheck: cost.data ?? [],
        control: control.data,
        alertsSent: alerts.data ?? [],
        alertsNow: due.data ?? [],
        skips: skips.data ?? [],
        siteCounts,
        fetches: list.data ?? [],
      })
    }

    return json({ ok: false, error: "unknown action" }, 400)
  } catch {
    return json({ ok: false, error: "something went wrong" }, 500)
  }
})
