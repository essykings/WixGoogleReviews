# Back office (Supabase) for Google Reviews Carousel

A log of every review fetch, daily counters, the site list, and a spend brake with a kill switch. Design:
`../../google-reviews-wall/docs/insights-design.md`. The Wix app works without any of this (it just does not log or brake).

Tables are all prefixed `grc_`. Only the two edge functions read or write them; the API roles have no access.

## One-time setup (you run these; never paste keys or tokens into chat)

Use Node 24 (`nvm use`), in this app's folder.

1. **Log in and link the new project** (the project ref is the part of its URL before `.supabase.co`):
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```
2. **Create the tables and functions** (asks for the database password you chose for the project):
   ```bash
   npx supabase db push
   ```
3. **Make a private token** that the app and the functions share, and keep it in a shell variable only:
   ```bash
   export INSIGHTS_TOKEN=$(openssl rand -hex 32)
   ```
4. **Give the token to Supabase and deploy the two functions** (`--no-verify-jwt` because callers present this token, not a Supabase login):
   ```bash
   npx supabase secrets set INSIGHTS_TOKEN="$INSIGHTS_TOKEN"
   npx supabase functions deploy grc-ingest --no-verify-jwt
   npx supabase functions deploy grc-allow --no-verify-jwt
   ```
5. **Give the same token, and the functions' address, to the Wix app** (as secrets, stored on Wix's servers):
   ```bash
   npx wix env set --key INSIGHTS_TOKEN --value "$INSIGHTS_TOKEN"
   npx wix env set --key INSIGHTS_URL --value "https://YOUR_PROJECT_REF.supabase.co/functions/v1"
   npx wix env pull
   ```
   Then tell Claude to rebuild and release (a secret set after the last build is only picked up reliably by a new release).
6. **Check it works** (should print `{"allowed":true,"reason":"ok"}`):
   ```bash
   curl -s -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/grc-allow" -H "x-insights-token: $INSIGHTS_TOKEN" -H "Content-Type: application/json" -d '{"est_cost_usd":0.06,"first":false}'
   ```
7. **Optional: nightly clean-up of rows older than 90 days.** In the Supabase dashboard open Database, then Extensions, enable `pg_cron`, then run this once in the SQL editor:
   ```sql
   select cron.schedule('grc-prune', '17 3 * * *', $$select public.grc_prune()$$);
   ```

## Using it
- **Table editor**: `grc_fetches` (every fetch), `grc_daily` (skips and pauses), `grc_sites`, and the views `grc_today`, `grc_spend_daily`,
  `grc_spend_by_site`, `grc_failures`, `grc_shared_places`.
- **Kill switch and caps**: edit the single row in `grc_control` (`fetch_enabled`, `daily_cap_usd` = 2, `monthly_cap_usd` = 20,
  `first_fetch_multiplier` = 1.5). Changes apply at once; no release needed.
- The estimated spend is reviews returned x $0.0006 plus $0.00005 per run. Compare with Apify's real usage until the nightly
  reconcile exists (phase 2).
