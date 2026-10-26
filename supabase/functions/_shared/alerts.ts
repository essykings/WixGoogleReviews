// Turning an alert into an email.
export interface Alert {
  alert_key: string
  severity: string
  subject: string
  body: string
}

export interface EmailSettings {
  apiKey: string
  from: string
  to: string[]
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** Email settings from the environment, or null when anything needed is missing (then alerts are listed but not sent). */
export function emailSettings(env: { RESEND_API_KEY?: string; ALERT_EMAIL_FROM?: string; ALERT_EMAIL_TO?: string }): EmailSettings | null {
  const to = (env.ALERT_EMAIL_TO ?? "").split(",").map((s) => s.trim()).filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
  if (!env.RESEND_API_KEY || !env.ALERT_EMAIL_FROM || to.length === 0) return null
  return { apiKey: env.RESEND_API_KEY, from: env.ALERT_EMAIL_FROM, to }
}

export function renderAlertEmail(a: Alert, insightsHint = "Open your Insights page for details."): { subject: string; html: string; text: string } {
  const label = a.severity === "high" ? "Needs attention now" : a.severity === "medium" ? "Worth a look" : "For your information"
  const subject = `[Google Reviews Carousel] ${a.subject}`.slice(0, 200)
  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;color:#212121"><p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.04em">${esc(label)}</p><h2 style="margin:0 0 12px;font-size:18px">${esc(a.subject)}</h2><p style="margin:0 0 16px;line-height:1.55">${esc(a.body)}</p><p style="margin:0;font-size:13px;color:#71717a">${esc(insightsHint)}</p></div>`
  const text = `${label}\n\n${a.subject}\n\n${a.body}\n\n${insightsHint}`
  return { subject, html, text }
}

/** Why Resend refused an email, short and safe to return (never includes the API key). */
export function describeSendFailure(status: number, bodyText: string): { status: number; reason: string } {
  let reason = ""
  try {
    const j = JSON.parse(bodyText)
    reason = typeof j?.message === "string" ? j.message : typeof j?.error === "string" ? j.error : ""
  } catch {
    reason = bodyText
  }
  const hint =
    status === 401 || status === 403
      ? " (check the Resend API key, and that the sender address is on a domain verified in Resend; the test sender onboarding@resend.dev only delivers to your own Resend account email)"
      : status === 422
        ? " (check the sender and recipient addresses)"
        : ""
  return { status, reason: (reason.replace(/\s+/g, " ").trim().slice(0, 200) || "no reason given") + hint }
}
