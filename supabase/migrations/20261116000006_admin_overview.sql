-- =====================================================================
-- Platform admin panel (additive, read-only)
--
-- One round trip with every user and event for the admin screen. Sign-in
-- and email-confirmation times live in auth.users, which the app cannot
-- read, hence SECURITY DEFINER behind the platform-admin check.
-- =====================================================================

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not private.is_platform_admin() then
    raise exception 'רק מנהל מערכת יכול לצפות בנתוני המערכת' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'users', coalesce((
      select jsonb_agg(u order by u.created_at desc)
      from (
        select p.id, p.email, p.full_name, p.is_platform_admin, p.created_at,
               au.last_sign_in_at,
               au.email_confirmed_at is not null as email_confirmed,
               (select count(*) from public.events e where e.owner_id = p.id) as events_owned,
               (select count(*) from public.event_members m where m.user_id = p.id) as events_joined
        from public.profiles p
        join auth.users au on au.id = p.id
      ) u
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(e order by e.created_at desc)
      from (
        select ev.id, ev.name, ev.event_type, ev.event_date, ev.status, ev.created_at,
               ev.owner_id, op.email as owner_email, op.full_name as owner_name,
               (select count(*) from public.guests g where g.event_id = ev.id) as guests,
               (select count(*) from public.event_members m where m.event_id = ev.id) as members
        from public.events ev
        left join public.profiles op on op.id = ev.owner_id
      ) e
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
