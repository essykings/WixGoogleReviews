// Supabase Edge Function: checks the alert rules and emails what is due. Run every 15 minutes by the schedule.
//
// POST with header x-insights-token. Asks the database which alerts are due (grc_alerts_due: rules plus a 6-hour cool-down), sends
// each by email through Resend, and marks it sent only when the email was accepted. If email is not set up it just lists them.
//
// Secrets: INSIGHTS_TOKEN, RESEND_API_KEY, ALERT_EMAIL_FROM, ALERT_EMAIL_TO (comma-separated). Deploy with --no-verify-jwt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { emailSettings, renderAlertEmail, type Alert } from "../_shared/alerts.ts"
import { sameToken } from "../_shared/auth.ts"

const TOKEN = Deno.env.get("INSIGHTS_TOKEN") ?? ""
const settings = emailSettings({
  RESEND_API_KEY: Deno.env.get("RESEND_API_KEY") ?? undefined,
  ALERT_EMAIL_FROM: Deno.env.get("ALERT_EMAIL_FROM") ?? undefined,
  ALERT_EMAIL_TO: Deno.env.get("ALERT_EMAIL_TO") ?? undefined,
})
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405)
  if (!sameToken(req.headers.get("x-insights-token") ?? "", TOKEN)) return json({ ok: false }, 401)
  try {
    const { data, error } = await supabase.rpc("grc_alerts_due")
    if (error) return json({ ok: false, error: "could not check the alert rules" }, 500)
    const due = (data ?? []) as Alert[]
    if (!settings) return json({ ok: true, emailConfigured: false, due: due.map((a) => a.alert_key) })
    const sent: string[] = []
    const failed: string[] = []
    for (const alert of due) {
      const mail = renderAlertEmail(alert)
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${settings.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: settings.from, to: settings.to, subject: mail.subject, html: mail.html, text: mail.text }),
      })
      if (res.ok) {
        await supabase.rpc("grc_alert_mark_sent", { p_key: alert.alert_key, p_subject: alert.subject })
        sent.push(alert.alert_key)
      } else failed.push(alert.alert_key) // not marked, so the next run tries again
    }
    return json({ ok: true, emailConfigured: true, sent, failed })
  } catch {
    return json({ ok: false }, 500)
  }
})
