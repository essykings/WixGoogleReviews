-- Back office for the Google Reviews Carousel Wix app: a log of every review fetch, daily counters, the site list,
-- and a spend brake with a kill switch. Written to only by our Wix backend through two edge functions
-- (grc-ingest and grc-allow). Nothing here is reachable from a visitor's or an owner's browser.
--
-- Stored: site (app instance) ID, public place ID and name, counts, estimated cost, timings, a sanitised error text.
-- Never stored: reviewer names, photos, review text, visitor details, tokens.

-- ---------------------------------------------------------------------------------------------------------------
-- One row per provider fetch attempt (like a row on Apify's "Runs" page). Kept 90 days (grc_prune).
create table if not exists public.grc_fetches (
  id            bigint generated always as identity primary key,
  started_at    timestamptz not null,
  finished_at   timestamptz not null,
  duration_ms   integer     not null default 0,
  instance_id   text        not null,
  plan          text        not null check (plan in ('free', 'pro', 'unknown')),
  place_id      text        not null,
  place_name    text        not null default '',
  origin        text        not null check (origin in ('first_save', 'top_up', 'owner_refresh', 'dashboard', 'visit')),
  outcome       text        not null check (outcome in ('updated', 'empty', 'failed')),
  requested     integer     not null default 0,
  returned      integer     not null default 0,
  kept          integer     not null default 0,
  est_cost_usd  numeric(10, 5) not null default 0,
  run_id        text,
  error_class   text,
  error_detail  text,
  created_at    timestamptz not null default now()
);
create index if not exists grc_fetches_started_idx  on public.grc_fetches (started_at desc);
create index if not exists grc_fetches_instance_idx on public.grc_fetches (instance_id, started_at desc);
create index if not exists grc_fetches_place_idx    on public.grc_fetches (place_id);
alter table public.grc_fetches enable row level security;

-- ---------------------------------------------------------------------------------------------------------------
-- Daily counters: skipped fetches are far too frequent to store as rows, so they are counted.
-- Counters: skip:fresh, skip:wait, skip:limit, skip:no_place, skip:paused:<reason>
create table if not exists public.grc_daily (
  day      date    not null,
  counter  text    not null,
  count    integer not null default 0,
  primary key (day, counter)
);
alter table public.grc_daily enable row level security;

create or replace function public.grc_bump(p_counter text, p_n integer default 1)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.grc_daily (day, counter, count)
  values ((now() at time zone 'utc')::date, left(p_counter, 60), p_n)
  on conflict (day, counter) do update set count = public.grc_daily.count + p_n
  returning count;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Installed sites, refreshed whenever an owner opens the dashboard.
create table if not exists public.grc_sites (
  instance_id      text primary key,
  first_seen       timestamptz not null default now(),
  last_seen        timestamptz not null default now(),
  plan             text        not null default 'unknown' check (plan in ('free', 'pro', 'unknown')),
  plan_changed_at  timestamptz not null default now(),
  place_id         text        not null default '',
  saved_places     integer     not null default 0,
  settings_saved   boolean     not null default false
);
alter table public.grc_sites enable row level security;

create or replace function public.grc_touch_site(p_instance text, p_plan text, p_place text, p_saved integer, p_settings boolean)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.grc_sites (instance_id, plan, place_id, saved_places, settings_saved)
  values (left(p_instance, 64), p_plan, left(p_place, 100), greatest(0, least(99, p_saved)), p_settings)
  on conflict (instance_id) do update set
    last_seen       = now(),
    plan_changed_at = case when public.grc_sites.plan <> excluded.plan then now() else public.grc_sites.plan_changed_at end,
    plan            = excluded.plan,
    place_id        = excluded.place_id,
    saved_places    = excluded.saved_places,
    settings_saved  = excluded.settings_saved;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- The control row: the kill switch and the spend caps (estimated spend, in US dollars). Change it in the table editor.
create table if not exists public.grc_control (
  id                      boolean primary key default true check (id),
  fetch_enabled           boolean       not null default true,
  daily_cap_usd           numeric(10, 2) not null default 2,
  monthly_cap_usd         numeric(10, 2) not null default 20,
  -- A brand-new site's first fetch may go through up to this many times the cap, so new customers are not turned away.
  first_fetch_multiplier  numeric(4, 2) not null default 1.5,
  note                    text          not null default '',
  updated_at              timestamptz   not null default now()
);
alter table public.grc_control enable row level security;
insert into public.grc_control (id) values (true) on conflict (id) do nothing;

-- The brake. Called before every provider fetch with the estimated cost of that fetch.
-- Returns {"allowed": true|false, "reason": "ok" | "kill_switch" | "daily_cap" | "monthly_cap"}.
create or replace function public.grc_allow(p_est numeric, p_first boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c            public.grc_control%rowtype;
  day_start    timestamptz := date_trunc('day',   now() at time zone 'utc') at time zone 'utc';
  month_start  timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  day_spend    numeric;
  month_spend  numeric;
  mult         numeric;
begin
  select * into c from public.grc_control limit 1;
  if not found then
    return jsonb_build_object('allowed', true, 'reason', 'no_control');
  end if;
  if not c.fetch_enabled then
    return jsonb_build_object('allowed', false, 'reason', 'kill_switch');
  end if;
  select coalesce(sum(est_cost_usd), 0) into day_spend   from public.grc_fetches where started_at >= day_start;
  select coalesce(sum(est_cost_usd), 0) into month_spend from public.grc_fetches where started_at >= month_start;
  mult := case when p_first then c.first_fetch_multiplier else 1 end;
  if day_spend + coalesce(p_est, 0) > c.daily_cap_usd * mult then
    return jsonb_build_object('allowed', false, 'reason', 'daily_cap');
  end if;
  if month_spend + coalesce(p_est, 0) > c.monthly_cap_usd * mult then
    return jsonb_build_object('allowed', false, 'reason', 'monthly_cap');
  end if;
  return jsonb_build_object('allowed', true, 'reason', 'ok');
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Retention: fetch detail is kept 90 days, daily counters two years.
create or replace function public.grc_prune()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.grc_fetches where started_at < now() - interval '90 days';
  delete from public.grc_daily   where day < (now() at time zone 'utc')::date - 730;
$$;

-- Read-only views for the table editor (and the Insights page later). Not exposed to the API roles.
create or replace view public.grc_spend_daily with (security_invoker = true) as
  select (started_at at time zone 'utc')::date as day,
         count(*)                                         as fetches,
         count(*) filter (where outcome = 'failed')       as failed,
         round(sum(est_cost_usd), 4)                      as est_cost_usd,
         round(avg(duration_ms))                          as avg_duration_ms
    from public.grc_fetches
   group by 1
   order by 1 desc;

create or replace view public.grc_spend_by_site with (security_invoker = true) as
  select f.instance_id,
         max(s.plan)                  as plan,
         count(*)                     as fetches,
         count(*) filter (where f.outcome = 'failed') as failed,
         round(sum(f.est_cost_usd), 4) as est_cost_usd,
         max(f.started_at)            as last_fetch
    from public.grc_fetches f
    left join public.grc_sites s using (instance_id)
   group by f.instance_id
   order by sum(f.est_cost_usd) desc;

create or replace view public.grc_failures with (security_invoker = true) as
  select error_class, count(*) as times, max(started_at) as last_seen
    from public.grc_fetches
   where outcome = 'failed' and started_at > now() - interval '7 days'
   group by error_class
   order by times desc;

create or replace view public.grc_shared_places with (security_invoker = true) as
  select place_id, max(place_name) as place_name, count(distinct instance_id) as sites, count(*) as fetches
    from public.grc_fetches
   group by place_id
  having count(distinct instance_id) > 1
   order by sites desc;

create or replace view public.grc_today with (security_invoker = true) as
  select c.daily_cap_usd, c.monthly_cap_usd, c.fetch_enabled,
         coalesce((select sum(est_cost_usd) from public.grc_fetches where started_at >= date_trunc('day',   now() at time zone 'utc') at time zone 'utc'), 0) as spent_today_usd,
         coalesce((select sum(est_cost_usd) from public.grc_fetches where started_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'), 0) as spent_month_usd,
         coalesce((select sum(count) from public.grc_daily where day = (now() at time zone 'utc')::date and counter like 'skip:%'), 0) as skipped_today
    from public.grc_control c;

-- ---------------------------------------------------------------------------------------------------------------
-- Lock everything to the service role (the edge functions). The API roles get nothing.
revoke all on public.grc_fetches, public.grc_daily, public.grc_sites, public.grc_control from anon, authenticated;
revoke all on public.grc_spend_daily, public.grc_spend_by_site, public.grc_failures, public.grc_shared_places, public.grc_today from anon, authenticated;
revoke execute on function public.grc_bump(text, integer), public.grc_touch_site(text, text, text, integer, boolean),
                           public.grc_allow(numeric, boolean), public.grc_prune() from public, anon, authenticated;
grant  execute on function public.grc_bump(text, integer), public.grc_touch_site(text, text, text, integer, boolean),
                           public.grc_allow(numeric, boolean), public.grc_prune() to service_role;
