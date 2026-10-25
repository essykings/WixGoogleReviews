// Supabase Edge Function: the spend brake. Called by the Wix backend before every review fetch.
//
// POST with header x-insights-token and body { est_cost_usd: number, first: boolean }.
// Answers { allowed: boolean, reason: "ok" | "kill_switch" | "daily_cap" | "monthly_cap" | ... }.
// If anything inside goes wrong it answers allowed: true, because an outage here must never stop owners
// (the per-site monthly cap in the app still applies).
//
// Secrets: INSIGHTS_TOKEN. Deploy with --no-verify-jwt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const TOKEN = Deno.env.get("INSIGHTS_TOKEN") ?? ""
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })
}

function sameToken(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ allowed: true, reason: "bad_method" }, 405)
  if (!sameToken(req.headers.get("x-insights-token") ?? "", TOKEN)) return json({ allowed: true, reason: "unauthorized" }, 401)
  try {
    const body = await req.json()
    const est = Number.isFinite(body?.est_cost_usd) ? Math.max(0, Math.min(1000, Number(body.est_cost_usd))) : 0
    const { data, error } = await supabase.rpc("grc_allow", { p_est: est, p_first: body?.first === true })
    if (error || !data || typeof data.allowed !== "boolean") return json({ allowed: true, reason: "error" })
    return json({ allowed: data.allowed, reason: String(data.reason ?? "").slice(0, 40) })
  } catch {
    return json({ allowed: true, reason: "error" })
  }
})
