// Supabase Edge Function: the nightly check of our cost estimates against what Apify really charged.
//
// POST with header x-insights-token (called by the nightly schedule, or by hand). Reads the latest runs of the review
// scraper from Apify and stores them in grc_apify_runs; the view grc_cost_check then compares them with our estimates.
//
// Secrets: INSIGHTS_TOKEN, APIFY_TOKEN. Deploy with --no-verify-jwt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { runsUrl, mapRun } from "../_shared/apify.ts"
import { sameToken } from "../_shared/auth.ts"

const TOKEN = Deno.env.get("INSIGHTS_TOKEN") ?? ""
const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN") ?? ""
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405)
  if (!sameToken(req.headers.get("x-insights-token") ?? "", TOKEN)) return json({ ok: false }, 401)
  if (!APIFY_TOKEN) return json({ ok: false, error: "APIFY_TOKEN is not set as a secret" }, 503)
  try {
    const rows = []
    for (let offset = 0; offset < 300; offset += 100) {
      const res = await fetch(runsUrl(offset), { headers: { Authorization: `Bearer ${APIFY_TOKEN}` } })
      if (!res.ok) return json({ ok: false, error: `Apify answered ${res.status}` }, 502)
      const items = (await res.json())?.data?.items ?? []
      for (const run of items) {
        const row = mapRun(run)
        if (row) rows.push(row)
      }
      if (items.length < 100) break
    }
    if (rows.length) {
      const { error } = await supabase.from("grc_apify_runs").upsert(rows, { onConflict: "run_id" })
      if (error) return json({ ok: false, error: "could not save the runs" }, 500)
    }
    return json({ ok: true, runs: rows.length })
  } catch {
    return json({ ok: false }, 500)
  }
})
