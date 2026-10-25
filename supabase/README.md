# Back office (Supabase) for Google Reviews Carousel

A log of every review fetch, a spend brake with a kill switch, a nightly check of our cost estimates against Apify, alert emails,
and a private Insights page. Design: `../../google-reviews-wall/docs/insights-design.md`.
**The Wix app works without any of this** (it just does not log or brake).

Everything is prefixed `grc_`. The tables are only reachable through the edge functions; the API roles have no access.

| Piece | What it does |
|---|---|
| `grc-ingest` | The Wix app writes fetch logs, counters and site visits here |
| `grc-allow` | The Wix app asks "may I spend this much?" before every fetch (the kill switch and caps) |
| `grc-reconcile` | Every night, reads Apify's real run costs into `grc_apify_runs` |
| `grc-alerts` | Every 15 minutes, checks the alert rules and emails what is due |
| `grc-insights` | The data and controls behind the Insights page |
| `insights/index.html` | The Insights page: a file you open from your computer |

## One-time setup (you run these; never paste keys or tokens into chat)

Use Node 24 (`nvm use`), in this app's folder.

### 1. Link the project and create the tables
```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```
`db push` asks for the database password you chose for the project. It applies three migrations (log and brake, forget a site, runs and alerts).

### 2. Make the two private tokens (kept in shell variables only)
```bash
export INSIGHTS_TOKEN=$(openssl rand -hex 32)
export ADMIN_TOKEN=$(openssl rand -hex 32)
echo "Save the admin token in your password manager now: $ADMIN_TOKEN"
```
`INSIGHTS_TOKEN` is shared by the Wix app and the schedules. `ADMIN_TOKEN` is only for you, to open the Insights page.

### 3. Give the secrets to Supabase and deploy the functions
```bash
npx supabase secrets set INSIGHTS_TOKEN="$INSIGHTS_TOKEN" ADMIN_TOKEN="$ADMIN_TOKEN"
npx supabase secrets set APIFY_TOKEN="your Apify token"
for fn in grc-ingest grc-allow grc-reconcile grc-alerts grc-insights; do npx supabase functions deploy $fn --no-verify-jwt; done
```
(`--no-verify-jwt` because callers present these tokens, not a Supabase login. Run the deploy again whenever a function changes.)

### 4. Alert emails (through Resend)
1. Create a free account at resend.com and an API key.
2. For a first test you can send from `onboarding@resend.dev`, but only to the email address of your Resend account. To send from your own address, verify your domain in Resend.
```bash
npx supabase secrets set RESEND_API_KEY="your Resend key" ALERT_EMAIL_FROM="Reviews alerts <alerts@yourdomain.com>" ALERT_EMAIL_TO="you@example.com"
```
Without these, `grc-alerts` still runs but only lists what is due; the Insights page shows it under "Needs attention".

### 5. Connect the Wix app
```bash
npx wix env set --key INSIGHTS_TOKEN --value "$INSIGHTS_TOKEN"
npx wix env set --key INSIGHTS_URL --value "https://YOUR_PROJECT_REF.supabase.co/functions/v1"
npx wix env pull
```
Then tell Claude to rebuild and release (a secret set after the last build is picked up reliably by a new release).

### 6. Check it works
```bash
curl -s -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/grc-allow" -H "x-insights-token: $INSIGHTS_TOKEN" -H "Content-Type: application/json" -d '{"est_cost_usd":0.06,"first":false}'
```
It should print `{"allowed":true,"reason":"ok"}`.

### 7. The schedules
In the Supabase dashboard open Database, then Extensions, and enable **pg_cron** and **pg_net**. Then run this in the SQL editor, replacing the two placeholders (the token is stored in the job, readable only by project admins):
```sql
select cron.schedule('grc-alerts', '*/15 * * * *', $$
  select net.http_post(url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/grc-alerts',
    headers := jsonb_build_object('x-insights-token', 'YOUR_INSIGHTS_TOKEN', 'Content-Type', 'application/json'), body := '{}'::jsonb) $$);
select cron.schedule('grc-reconcile', '30 2 * * *', $$
  select net.http_post(url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/grc-reconcile',
    headers := jsonb_build_object('x-insights-token', 'YOUR_INSIGHTS_TOKEN', 'Content-Type', 'application/json'), body := '{}'::jsonb) $$);
select cron.schedule('grc-prune', '17 3 * * *', $$ select public.grc_prune() $$);
```
That is the 15-minute alert check, the nightly cost check (02:30 UTC), and the nightly clean-up (fetch rows, sites not seen, and Apify runs older than 90 days).

### 8. Open the Insights page
Double-click `supabase/insights/index.html`. Enter `https://YOUR_PROJECT_REF.supabase.co/functions/v1/grc-insights` and your `ADMIN_TOKEN`. The token stays in that browser tab only.

## Using it
- **Insights page:** spend against the caps, fetches, failures by reason, spend per site, estimated against real cost, alerts. The kill switch and the caps can be changed there (they apply to the next fetch).
- **Table editor** (Supabase dashboard): `grc_fetches`, `grc_daily`, `grc_sites`, `grc_control`, and the views `grc_today`, `grc_spend_daily`, `grc_spend_by_site`, `grc_failures`, `grc_shared_places`, `grc_cost_check`.
- **Caps** start at $2 a day and $20 a month of estimated spend; a brand-new site's first fetch may go through up to 1.5 times the cap.
- **Alerts** (emailed at most once every 6 hours each): failure spike, provider refusing requests (bad token or no credit), spend at 80 percent of a cap, kill switch on, and cost drift of more than 20 percent.
- **"Delete my data" request for one site:** run `select public.grc_forget_site('THE-SITE-ID');` in the SQL editor.
- The estimated cost is reviews returned x $0.0006 plus $0.00005 per run. The nightly check compares it with Apify's real figure; runs you make yourself with the same Apify token also appear in the real figure.
