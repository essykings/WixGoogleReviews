-- Forget a site, by hand (for a "delete my data" request): deletes its fetch rows and its site row.
-- (Daily counters hold no site identifier, so they stay.)
create or replace function public.grc_forget_site(p_instance text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.grc_fetches where instance_id = left(p_instance, 64);
  delete from public.grc_sites   where instance_id = left(p_instance, 64);
$$;

-- The nightly clean-up now also drops sites not seen for 90 days. A site that removed the app is never seen again, so its
-- record goes the same way as its fetch rows.
create or replace function public.grc_prune()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.grc_fetches where started_at < now() - interval '90 days';
  delete from public.grc_sites   where last_seen  < now() - interval '90 days';
  delete from public.grc_daily   where day < (now() at time zone 'utc')::date - 730;
$$;

revoke execute on function public.grc_forget_site(text), public.grc_prune() from public, anon, authenticated;
grant  execute on function public.grc_forget_site(text), public.grc_prune() to service_role;
