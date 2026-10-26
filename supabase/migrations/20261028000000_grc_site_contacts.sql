-- Support details for each site: the owner's email, the site address and its name, so a complaint can be matched to the logs
-- without opening the Wix Dev Center. Personal data: only the back office can read it (no public access), the Insights page shows
-- it only behind its token, and it is cleared 30 days after the site was last seen.
alter table public.grc_sites
  add column if not exists owner_email text not null default '',
  add column if not exists site_url    text not null default '',
  add column if not exists site_name   text not null default '';

drop function if exists public.grc_touch_site(text, text, text, integer, boolean);

-- A detail Wix did not send this time (empty) never blanks one we already have.
create or replace function public.grc_touch_site(
  p_instance text, p_plan text, p_place text, p_saved integer, p_settings boolean,
  p_owner_email text default '', p_site_url text default '', p_site_name text default '')
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.grc_sites (instance_id, plan, place_id, saved_places, settings_saved, owner_email, site_url, site_name)
  values (left(p_instance, 64), p_plan, left(p_place, 100), greatest(0, least(99, p_saved)), p_settings,
          left(coalesce(p_owner_email, ''), 200), left(coalesce(p_site_url, ''), 300), left(coalesce(p_site_name, ''), 120))
  on conflict (instance_id) do update set
    last_seen       = now(),
    plan_changed_at = case when public.grc_sites.plan <> excluded.plan then now() else public.grc_sites.plan_changed_at end,
    plan            = excluded.plan,
    place_id        = excluded.place_id,
    saved_places    = excluded.saved_places,
    settings_saved  = excluded.settings_saved,
    owner_email     = case when excluded.owner_email <> '' then excluded.owner_email else public.grc_sites.owner_email end,
    site_url        = case when excluded.site_url    <> '' then excluded.site_url    else public.grc_sites.site_url    end,
    site_name       = case when excluded.site_name   <> '' then excluded.site_name   else public.grc_sites.site_name   end;
$$;

-- The nightly clean-up also clears the contact details of sites not seen for 30 days (the rest of the row goes at 90).
create or replace function public.grc_prune()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.grc_fetches where started_at < now() - interval '90 days';
  delete from public.grc_sites   where last_seen  < now() - interval '90 days';
  update public.grc_sites set owner_email = '', site_url = '', site_name = ''
   where last_seen < now() - interval '30 days' and (owner_email <> '' or site_url <> '' or site_name <> '');
  delete from public.grc_daily   where day < (now() at time zone 'utc')::date - 730;
$$;

revoke execute on function public.grc_touch_site(text, text, text, integer, boolean, text, text, text), public.grc_prune() from public, anon, authenticated;
grant  execute on function public.grc_touch_site(text, text, text, integer, boolean, text, text, text), public.grc_prune() to service_role;
