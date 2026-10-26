-- An email as soon as a review fetch fails. One alert per kind of failure (timeout, provider_500, ...), repeated at most once an
-- hour while it keeps happening. Refusals (bad token, no credit) already have their own alert, so they are left out here.
-- "empty" results are not failures: they are mostly a wrong address or a business with no reviews, and stay visible in Insights.
create or replace function public.grc_failure_alerts()
returns table (alert_key text, severity text, subject text, body text)
language sql
security definer
set search_path = public
as $$
  with recent as (
    select f.*,
           coalesce(f.error_class, 'unknown') as kind,
           row_number() over (partition by coalesce(f.error_class, 'unknown') order by f.started_at desc) as rn,
           count(*)     over (partition by coalesce(f.error_class, 'unknown'))                            as n
      from public.grc_fetches f
     where f.outcome = 'failed'
       and f.started_at > now() - interval '1 hour'
       and coalesce(f.error_class, 'unknown') not in ('provider_401', 'provider_402', 'provider_403', 'missing_token')
  )
  select 'fetch_failed:' || left(r.kind, 40),
         'high',
         format('A review fetch failed (%s)', r.kind),
         format(E'%s fetch(es) of this kind failed in the last hour.\nLatest: %s plan, %s, place "%s".\nSite: %s, %s, %s (ID %s).\nWhy: %s\nIf it keeps happening, open the Insights page and look at the Fetches table.',
                r.n, r.plan, r.origin, coalesce(nullif(r.place_name, ''), r.place_id),
                coalesce(nullif(s.site_name, ''), 'no name'), coalesce(nullif(s.owner_email, ''), 'no email'), coalesce(nullif(s.site_url, ''), 'no address'), r.instance_id,
                coalesce(nullif(r.error_detail, ''), 'no detail'))
    from recent r
    left join public.grc_sites s on s.instance_id = r.instance_id
   where r.rn = 1;
$$;

-- The alerts to email now: the rules plus the failure alerts, each not already sent within its cool-down
-- (failure alerts: 1 hour; everything else: the given cool-down, 6 hours by default).
create or replace function public.grc_alerts_due(p_cooldown interval default interval '6 hours')
returns table (alert_key text, severity text, subject text, body text)
language sql
security definer
set search_path = public
as $$
  select cand.alert_key, cand.severity, cand.subject, cand.body
    from (select * from public.grc_alert_candidates() union all select * from public.grc_failure_alerts()) cand
    left join public.grc_alerts a on a.key = cand.alert_key
   where a.key is null
      or a.last_sent_at < now() - case when cand.alert_key like 'fetch_failed:%' then interval '1 hour' else p_cooldown end;
$$;

revoke execute on function public.grc_failure_alerts() from public, anon, authenticated;
grant  execute on function public.grc_failure_alerts() to service_role;
