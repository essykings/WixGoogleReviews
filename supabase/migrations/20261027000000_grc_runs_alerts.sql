-- Phase 2 and 3 of the back office: the real cost from Apify (to check our estimates), alert rules with a send log so the
-- same alert is not emailed over and over, and the views the Insights page reads.

-- ---------------------------------------------------------------------------------------------------------------
-- Runs as Apify reports them (filled each night by the grc-reconcile function). usage_usd is what Apify actually charged.
create table if not exists public.grc_apify_runs (
  run_id           text primary key,
  started_at       timestamptz not null,
  finished_at      timestamptz,
  status           text not null,
  usage_usd        numeric(10, 5) not null default 0,
  reviews_charged  integer not null default 0,
  fetched_at       timestamptz not null default now()
);
create index if not exists grc_apify_runs_started_idx on public.grc_apify_runs (started_at desc);
alter table public.grc_apify_runs enable row level security;

-- Which alerts were emailed and when (an alert is repeated only after its cool-down).
create table if not exists public.grc_alerts (
  key            text primary key,
  last_sent_at   timestamptz not null default now(),
  last_subject   text not null default ''
);
alter table public.grc_alerts enable row level security;

-- ---------------------------------------------------------------------------------------------------------------
-- Estimated against actual cost, per day. Runs that did not come from the app (for example your own tests with the same
-- Apify token) are in the actual column too, so a gap is a reason to look, not proof of a bug.
create or replace view public.grc_cost_check with (security_invoker = true) as
  with est as (
    select (started_at at time zone 'utc')::date as d, sum(est_cost_usd) as estimated
      from public.grc_fetches group by 1
  ), act as (
    select (started_at at time zone 'utc')::date as d, sum(usage_usd) as actual, count(*) as runs
      from public.grc_apify_runs where status in ('SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED') group by 1
  )
  select coalesce(est.d, act.d)                       as day,
         round(coalesce(est.estimated, 0), 4)         as estimated_usd,
         round(coalesce(act.actual, 0), 4)            as actual_usd,
         coalesce(act.runs, 0)                        as apify_runs,
         case when coalesce(est.estimated, 0) > 0
              then round((coalesce(act.actual, 0) - est.estimated) / est.estimated * 100, 1) end as drift_percent
    from est full join act on est.d = act.d
   order by 1 desc;

-- ---------------------------------------------------------------------------------------------------------------
-- What is worth an email right now. Rules:
--   failure_spike     5 or more fetches in the last hour and more than 30 percent of them failed
--   provider_refusing a fetch in the last hour failed because the provider said no (bad token, no credit, not allowed)
--   daily_cap_80 / monthly_cap_80   estimated spend has reached 80 percent of a cap
--   kill_switch_on    fetching is switched off
--   cost_drift        yesterday's real cost differs from our estimate by more than 20 percent (and was at least 5 cents)
create or replace function public.grc_alert_candidates()
returns table (alert_key text, severity text, subject text, body text)
language plpgsql
security definer
set search_path = public
as $$
declare
  c            public.grc_control%rowtype;
  attempts     integer;
  failed       integer;
  refused      integer;
  spent_day    numeric;
  spent_month  numeric;
  est          numeric;
  act          numeric;
  drift        numeric;
begin
  select * into c from public.grc_control limit 1;

  select count(*), count(*) filter (where outcome = 'failed') into attempts, failed
    from public.grc_fetches where started_at > now() - interval '1 hour';
  if attempts >= 5 and failed::numeric / attempts > 0.3 then
    alert_key := 'failure_spike'; severity := 'high';
    subject := format('Review fetches are failing (%s of %s in the last hour)', failed, attempts);
    body := format('%s of the last %s fetches failed. Open the Insights page and look at "Failures by reason" to see why.', failed, attempts);
    return next;
  end if;

  select count(*) into refused from public.grc_fetches
   where started_at > now() - interval '1 hour' and outcome = 'failed'
     and error_class in ('provider_401', 'provider_402', 'provider_403', 'missing_token');
  if refused > 0 then
    alert_key := 'provider_refusing'; severity := 'high';
    subject := 'The review provider is refusing requests';
    body := format('%s fetch(es) in the last hour were refused (401 or 403: the Apify token is wrong or expired; 402: out of credit or over a spend limit; missing token: the secret is not set). Check the Apify account.', refused);
    return next;
  end if;

  select coalesce(sum(est_cost_usd), 0) into spent_day   from public.grc_fetches where started_at >= date_trunc('day',   now() at time zone 'utc') at time zone 'utc';
  select coalesce(sum(est_cost_usd), 0) into spent_month from public.grc_fetches where started_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  if c.daily_cap_usd > 0 and spent_day >= c.daily_cap_usd * 0.8 then
    alert_key := 'daily_cap_80'; severity := 'medium';
    subject := format('Daily spend is at %s%% of the cap', round(spent_day / c.daily_cap_usd * 100));
    body := format('Estimated spend today is $%s of the $%s daily cap. At the cap, routine refreshes pause (a new site''s first fetch still goes through up to %sx the cap).', round(spent_day, 4), c.daily_cap_usd, c.first_fetch_multiplier);
    return next;
  end if;
  if c.monthly_cap_usd > 0 and spent_month >= c.monthly_cap_usd * 0.8 then
    alert_key := 'monthly_cap_80'; severity := 'medium';
    subject := format('Monthly spend is at %s%% of the cap', round(spent_month / c.monthly_cap_usd * 100));
    body := format('Estimated spend this month is $%s of the $%s monthly cap.', round(spent_month, 4), c.monthly_cap_usd);
    return next;
  end if;

  if not c.fetch_enabled then
    alert_key := 'kill_switch_on'; severity := 'info';
    subject := 'Fetching is switched off (kill switch)';
    body := 'No new reviews are being fetched. Saved reviews still show on sites. Switch it back on in the Insights page or in the grc_control table.';
    return next;
  end if;

  select estimated_usd, actual_usd, drift_percent into est, act, drift
    from public.grc_cost_check where day = (now() at time zone 'utc')::date - 1 and apify_runs > 0;
  if est is not null and est >= 0.05 and abs(coalesce(drift, 0)) > 20 then
    alert_key := 'cost_drift'; severity := 'medium';
    subject := format('Yesterday''s real cost differs from our estimate by %s%%', round(drift));
    body := format('We estimated $%s and Apify charged $%s. If you ran your own tests with the same Apify token, that explains it; otherwise the price per review may have changed.', est, act);
    return next;
  end if;
end;
$$;

-- The candidates that have not been emailed within the cool-down.
create or replace function public.grc_alerts_due(p_cooldown interval default interval '6 hours')
returns table (alert_key text, severity text, subject text, body text)
language sql
security definer
set search_path = public
as $$
  select cand.alert_key, cand.severity, cand.subject, cand.body
    from public.grc_alert_candidates() cand
    left join public.grc_alerts a on a.key = cand.alert_key
   where a.key is null or a.last_sent_at < now() - p_cooldown;
$$;

create or replace function public.grc_alert_mark_sent(p_key text, p_subject text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.grc_alerts (key, last_sent_at, last_subject) values (left(p_key, 60), now(), left(p_subject, 200))
  on conflict (key) do update set last_sent_at = now(), last_subject = excluded.last_subject;
$$;

-- Keep the run list to 90 days too.
create or replace function public.grc_prune()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.grc_fetches   where started_at < now() - interval '90 days';
  delete from public.grc_sites     where last_seen  < now() - interval '90 days';
  delete from public.grc_apify_runs where started_at < now() - interval '90 days';
  delete from public.grc_daily     where day < (now() at time zone 'utc')::date - 730;
$$;

-- ---------------------------------------------------------------------------------------------------------------
revoke all on public.grc_apify_runs, public.grc_alerts from anon, authenticated;
revoke all on public.grc_cost_check from anon, authenticated;
revoke execute on function public.grc_alert_candidates(), public.grc_alerts_due(interval), public.grc_alert_mark_sent(text, text), public.grc_prune()
  from public, anon, authenticated;
grant  execute on function public.grc_alert_candidates(), public.grc_alerts_due(interval), public.grc_alert_mark_sent(text, text), public.grc_prune()
  to service_role;
