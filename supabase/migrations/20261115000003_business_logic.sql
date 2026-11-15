-- =====================================================================
-- Event Manager · business logic: triggers and RPC functions
-- All SECURITY DEFINER functions pin search_path='' and authorize the
-- caller explicitly.
-- =====================================================================

-- ---------------------------------------------------------------------
-- New auth user → profile + accept pending staff invites
-- ---------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), '')
  )
  on conflict (id) do nothing;

  insert into public.event_members (event_id, user_id, role, invited_by)
  select i.event_id, new.id, i.role, i.invited_by
  from public.event_member_invites i
  where lower(i.email) = lower(new.email) and i.accepted_at is null
  on conflict (event_id, user_id) do nothing;

  update public.event_member_invites
  set accepted_at = now()
  where lower(email) = lower(new.email) and accepted_at is null;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- keep profiles.email in sync when the user changes it
create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------
-- New event → owner becomes manager, default guest groups
-- ---------------------------------------------------------------------
create or replace function private.handle_new_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.event_members (event_id, user_id, role)
  values (new.id, new.owner_id, 'event_manager')
  on conflict (event_id, user_id) do update set role = 'event_manager';

  insert into public.guest_groups (event_id, name, color, sort_order) values
    (new.id, 'משפחה', '#1f3a93', 1),
    (new.id, 'חברים', '#0e6e52', 2),
    (new.id, 'עבודה', '#c2554a', 3),
    (new.id, 'אחרים', '#8a8f99', 4);

  return new;
end;
$$;

create trigger events_after_insert
  after insert on public.events
  for each row execute function private.handle_new_event();

-- Ownership can only move through an admin.
create or replace function private.protect_event_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id and not private.is_platform_admin() then
    raise exception 'רק מנהל מערכת יכול להעביר בעלות על אירוע'
      using errcode = '42501', hint = 'owner_change_forbidden';
  end if;
  return new;
end;
$$;

create trigger events_protect_owner
  before update of owner_id on public.events
  for each row execute function private.protect_event_owner();

-- The owner always stays an event manager.
create or replace function private.protect_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select e.owner_id into v_owner from public.events e where e.id = old.event_id;
  -- event already gone (cascade delete) → allow
  if v_owner is null or v_owner <> old.user_id then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' or new.role <> 'event_manager' or new.user_id <> old.user_id then
    raise exception 'לא ניתן להסיר או לשנות את התפקיד של בעל האירוע'
      using errcode = '42501', hint = 'owner_membership_protected';
  end if;
  return new;
end;
$$;

create trigger event_members_protect_owner
  before update or delete on public.event_members
  for each row execute function private.protect_owner_membership();

-- ---------------------------------------------------------------------
-- Guests: defaults, protected columns, table capacity
-- ---------------------------------------------------------------------
create or replace function private.guests_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- tokens are always generated server-side
    new.invite_token := private.generate_token();
    new.checked_in_at := null;
    new.checked_in_by := null;
    new.arrived_count := null;
    if new.reserved_seats is null or new.reserved_seats < 0 then
      new.reserved_seats := new.invited_adults + new.invited_children;
    end if;
  else
    new.event_id := old.event_id; -- guests never move between events
    if coalesce(current_setting('app.allow_token_change', true), '') <> 'on' then
      new.invite_token := old.invite_token;
    end if;
    if coalesce(current_setting('app.checkin_rpc', true), '') <> 'on' then
      new.checked_in_at := old.checked_in_at;
      new.checked_in_by := old.checked_in_by;
      new.arrived_count := old.arrived_count;
    end if;
  end if;

  if new.rsvp_status in ('pending', 'declined') then
    new.confirmed_adults := 0;
    new.confirmed_children := 0;
  end if;

  if tg_op = 'INSERT' and new.rsvp_status <> 'pending' and new.rsvp_responded_at is null then
    new.rsvp_responded_at := now();
  elsif tg_op = 'UPDATE' and new.rsvp_status is distinct from old.rsvp_status then
    new.rsvp_responded_at := case when new.rsvp_status = 'pending' then null else now() end;
  end if;

  if new.invitation_status <> 'not_sent' and new.invitation_sent_at is null then
    new.invitation_sent_at := now();
  end if;

  return new;
end;
$$;

create trigger guests_before_write
  before insert or update on public.guests
  for each row execute function private.guests_before_write();

-- Rejects assigning more seats to a table than it holds.
-- Guest self-service RSVP sets app.skip_capacity_check so a growing party
-- never blocks the guest; managers then see the overflow in the seating UI.
create or replace function private.enforce_table_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity integer;
  v_number integer;
  v_used integer;
  v_needed integer;
begin
  if new.table_id is null then
    return new;
  end if;
  if coalesce(current_setting('app.skip_capacity_check', true), '') = 'on' then
    return new;
  end if;

  v_needed := public.guest_seats(new.rsvp_status, new.reserved_seats, new.confirmed_adults, new.confirmed_children);

  if tg_op = 'UPDATE'
     and new.table_id = old.table_id
     and v_needed <= public.guest_seats(old.rsvp_status, old.reserved_seats, old.confirmed_adults, old.confirmed_children)
  then
    return new; -- same table and not growing
  end if;

  select t.capacity, t.number into v_capacity, v_number
  from public.seating_tables t
  where t.id = new.table_id
  for update; -- serialize concurrent assignments to the same table

  select coalesce(sum(g.seats_needed), 0) into v_used
  from public.guests g
  where g.table_id = new.table_id and g.id <> new.id;

  if v_used + v_needed > v_capacity then
    raise exception 'אין מספיק מקום בשולחן %: נותרו % מקומות, נדרשים %',
      v_number, greatest(v_capacity - v_used, 0), v_needed
      using errcode = 'P0001', hint = 'table_capacity_exceeded';
  end if;

  return new;
end;
$$;

create trigger guests_enforce_table_capacity
  before insert or update of table_id, rsvp_status, reserved_seats, confirmed_adults, confirmed_children
  on public.guests
  for each row execute function private.enforce_table_capacity();

create or replace function private.enforce_table_shrink()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used integer;
begin
  if new.capacity < old.capacity then
    select coalesce(sum(g.seats_needed), 0) into v_used
    from public.guests g where g.table_id = new.id;
    if v_used > new.capacity then
      raise exception 'בשולחן % כבר משובצים % אורחים, לא ניתן להקטין ל-%',
        new.number, v_used, new.capacity
        using errcode = 'P0001', hint = 'table_capacity_exceeded';
    end if;
  end if;
  return new;
end;
$$;

create trigger seating_tables_enforce_shrink
  before update of capacity on public.seating_tables
  for each row execute function private.enforce_table_shrink();

-- Audit trail of RSVP and check-in changes, whoever made them.
create or replace function private.log_guest_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.rsvp_status is distinct from old.rsvp_status
     or new.confirmed_adults is distinct from old.confirmed_adults
     or new.confirmed_children is distinct from old.confirmed_children then
    insert into public.activity_log (event_id, actor_id, guest_id, action, payload)
    values (new.event_id, auth.uid(), new.id, 'rsvp_updated', jsonb_build_object(
      'from', old.rsvp_status, 'to', new.rsvp_status,
      'adults', new.confirmed_adults, 'children', new.confirmed_children,
      'by_guest', auth.uid() is null));
  end if;

  if new.checked_in_at is distinct from old.checked_in_at then
    insert into public.activity_log (event_id, actor_id, guest_id, action, payload)
    values (new.event_id, auth.uid(), new.id,
      case when new.checked_in_at is null then 'check_in_undone' else 'checked_in' end,
      jsonb_build_object('arrived_count', new.arrived_count));
  end if;

  if new.invitation_status = 'viewed' and old.invitation_status <> 'viewed' then
    insert into public.activity_log (event_id, actor_id, guest_id, action)
    values (new.event_id, auth.uid(), new.id, 'invitation_viewed');
  end if;

  return null;
end;
$$;

create trigger guests_log_changes
  after update on public.guests
  for each row execute function private.log_guest_changes();

-- ---------------------------------------------------------------------
-- Public RSVP (anon) – reachable only with the unguessable invite token
-- ---------------------------------------------------------------------
create or replace function public.get_rsvp(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.guests;
  e public.events;
begin
  if p_token is null or char_length(p_token) < 16 or char_length(p_token) > 64 then
    return null;
  end if;

  select * into g from public.guests where invite_token = p_token;
  if not found then
    return null;
  end if;
  select * into e from public.events where id = g.event_id;

  if g.invitation_status <> 'viewed' then
    update public.guests set invitation_status = 'viewed' where id = g.id;
  end if;

  return jsonb_build_object(
    'guest', jsonb_build_object(
      'first_name', g.first_name,
      'last_name', g.last_name,
      'invited_adults', g.invited_adults,
      'invited_children', g.invited_children,
      'reserved_seats', g.reserved_seats,
      'rsvp_status', g.rsvp_status,
      'confirmed_adults', g.confirmed_adults,
      'confirmed_children', g.confirmed_children,
      'rsvp_note', g.rsvp_note,
      'responded_at', g.rsvp_responded_at
    ),
    'event', jsonb_build_object(
      'name', e.name,
      'event_type', e.event_type,
      'host_names', e.host_names,
      'event_date', e.event_date,
      'venue_name', e.venue_name,
      'venue_address', e.venue_address,
      'rsvp_deadline', e.rsvp_deadline,
      'invitation_message', e.invitation_message
    ),
    'is_open', e.status in ('draft', 'active')
      and (e.rsvp_deadline is null or now() <= e.rsvp_deadline)
  );
end;
$$;

create or replace function public.submit_rsvp(
  p_token text,
  p_status public.rsvp_status,
  p_adults integer default 0,
  p_children integer default 0,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.guests;
  e public.events;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_token is null or char_length(p_token) < 16 or char_length(p_token) > 64 then
    raise exception 'קישור לא תקין' using errcode = 'P0001', hint = 'invalid_token';
  end if;

  select * into g from public.guests where invite_token = p_token for update;
  if not found then
    raise exception 'קישור לא תקין' using errcode = 'P0001', hint = 'invalid_token';
  end if;
  select * into e from public.events where id = g.event_id;

  if e.status not in ('draft', 'active') or (e.rsvp_deadline is not null and now() > e.rsvp_deadline) then
    raise exception 'מועד אישור ההגעה הסתיים. לשינויים פנו למארחים.'
      using errcode = 'P0001', hint = 'rsvp_closed';
  end if;
  if p_status not in ('attending', 'declined') then
    raise exception 'יש לבחור אם תגיעו' using errcode = 'P0001', hint = 'invalid_status';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'ההערה ארוכה מדי (עד 500 תווים)' using errcode = 'P0001', hint = 'note_too_long';
  end if;

  if p_status = 'attending' then
    p_adults := coalesce(p_adults, 0);
    p_children := coalesce(p_children, 0);
    if p_adults < 1 or p_children < 0 then
      raise exception 'יש לציין לפחות מבוגר אחד' using errcode = 'P0001', hint = 'invalid_counts';
    end if;
    if p_adults + p_children > g.reserved_seats then
      raise exception 'שמרנו עבורכם % מקומות בלבד. לתוספת מקומות פנו למארחים.', g.reserved_seats
        using errcode = 'P0001', hint = 'too_many_people';
    end if;
  else
    p_adults := 0;
    p_children := 0;
  end if;

  perform set_config('app.skip_capacity_check', 'on', true);

  update public.guests set
    rsvp_status = p_status,
    confirmed_adults = p_adults,
    confirmed_children = p_children,
    rsvp_note = v_note,
    rsvp_responded_at = now(),
    invitation_status = 'viewed'
  where id = g.id;

  perform set_config('app.skip_capacity_check', 'off', true);

  return jsonb_build_object('status', p_status, 'adults', p_adults, 'children', p_children);
end;
$$;

revoke all on function public.get_rsvp(text) from public;
revoke all on function public.submit_rsvp(text, public.rsvp_status, integer, integer, text) from public;
grant execute on function public.get_rsvp(text) to anon, authenticated;
grant execute on function public.submit_rsvp(text, public.rsvp_status, integer, integer, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Check-in (event managers and check-in staff)
-- Returns only the fields the door needs.
-- ---------------------------------------------------------------------
create or replace function public.checkin_search(p_event_id uuid, p_query text default '')
returns table (
  id uuid,
  first_name text,
  last_name text,
  phone text,
  group_name text,
  table_number integer,
  table_name text,
  rsvp_status public.rsvp_status,
  expected integer,
  dietary_tags text[],
  checked_in_at timestamptz,
  arrived_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := btrim(coalesce(p_query, ''));
  v_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
begin
  if not private.can_check_in(p_event_id) then
    raise exception 'אין הרשאה לבצע Check-in באירוע זה' using errcode = '42501';
  end if;

  -- Israeli local numbers (05x...) are stored as +9725x...
  if v_digits like '0%' then
    v_digits := '972' || substr(v_digits, 2);
  end if;

  return query
  select g.id, g.first_name, g.last_name, g.phone, gr.name, t.number, t.name,
         g.rsvp_status, g.seats_needed, g.dietary_tags, g.checked_in_at, g.arrived_count
  from public.guests g
  left join public.guest_groups gr on gr.id = g.group_id
  left join public.seating_tables t on t.id = g.table_id
  where g.event_id = p_event_id
    and (
      v_q = ''
      or (g.first_name || ' ' || g.last_name) ilike '%' || v_q || '%'
      or (g.last_name || ' ' || g.first_name) ilike '%' || v_q || '%'
      or (char_length(v_digits) >= 3 and g.phone like '%' || v_digits || '%')
    )
  order by (g.rsvp_status = 'attending') desc, g.last_name, g.first_name
  limit 50;
end;
$$;

create or replace function public.checkin_find_by_token(p_event_id uuid, p_token text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.can_check_in(p_event_id) then
    raise exception 'אין הרשאה לבצע Check-in באירוע זה' using errcode = '42501';
  end if;
  select g.id into v_id from public.guests g
  where g.event_id = p_event_id and g.invite_token = p_token;
  return v_id;
end;
$$;

create or replace function public.check_in_guest(
  p_event_id uuid,
  p_guest_id uuid,
  p_arrived_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.guests;
begin
  if not private.can_check_in(p_event_id) then
    raise exception 'אין הרשאה לבצע Check-in באירוע זה' using errcode = '42501';
  end if;
  if p_arrived_count is null or p_arrived_count < 1 or p_arrived_count > 100 then
    raise exception 'מספר המגיעים חייב להיות בין 1 ל-100' using errcode = 'P0001', hint = 'invalid_count';
  end if;

  perform set_config('app.checkin_rpc', 'on', true);
  perform set_config('app.skip_capacity_check', 'on', true);

  -- atomic: only the first check-in wins
  update public.guests set
    checked_in_at = now(),
    checked_in_by = auth.uid(),
    arrived_count = p_arrived_count
  where id = p_guest_id and event_id = p_event_id and checked_in_at is null
  returning * into v_row;

  perform set_config('app.checkin_rpc', 'off', true);
  perform set_config('app.skip_capacity_check', 'off', true);

  if v_row.id is not null then
    return jsonb_build_object('status', 'checked_in', 'checked_in_at', v_row.checked_in_at,
      'arrived_count', v_row.arrived_count);
  end if;

  select * into v_row from public.guests where id = p_guest_id and event_id = p_event_id;
  if not found then
    raise exception 'האורח לא נמצא באירוע זה' using errcode = 'P0001', hint = 'guest_not_found';
  end if;

  return jsonb_build_object('status', 'already_checked_in', 'checked_in_at', v_row.checked_in_at,
    'arrived_count', v_row.arrived_count);
end;
$$;

create or replace function public.undo_check_in(p_event_id uuid, p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_event(p_event_id) then
    raise exception 'רק מנהל אירוע יכול לבטל כניסה' using errcode = '42501';
  end if;
  perform set_config('app.checkin_rpc', 'on', true);
  update public.guests
  set checked_in_at = null, checked_in_by = null, arrived_count = null
  where id = p_guest_id and event_id = p_event_id;
  perform set_config('app.checkin_rpc', 'off', true);
end;
$$;

create or replace function public.regenerate_invite_token(p_event_id uuid, p_guest_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not private.can_manage_event(p_event_id) then
    raise exception 'אין הרשאה' using errcode = '42501';
  end if;
  perform set_config('app.allow_token_change', 'on', true);
  update public.guests set invite_token = private.generate_token()
  where id = p_guest_id and event_id = p_event_id
  returning invite_token into v_token;
  perform set_config('app.allow_token_change', 'off', true);
  return v_token;
end;
$$;

-- ---------------------------------------------------------------------
-- Dashboard statistics in one round trip
-- ---------------------------------------------------------------------
create or replace function public.event_stats(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not private.can_read_event(p_event_id) then
    raise exception 'אין הרשאה לצפות באירוע זה' using errcode = '42501';
  end if;

  with g as (
    select * from public.guests where event_id = p_event_id
  ),
  totals as (
    select
      count(*) as parties,
      coalesce(sum(reserved_seats), 0) as people_invited,
      coalesce(sum(invited_adults), 0) as adults_invited,
      coalesce(sum(invited_children), 0) as children_invited,
      count(*) filter (where rsvp_status = 'attending') as attending_parties,
      coalesce(sum(confirmed_adults + confirmed_children) filter (where rsvp_status = 'attending'), 0) as attending_people,
      coalesce(sum(confirmed_adults) filter (where rsvp_status = 'attending'), 0) as attending_adults,
      coalesce(sum(confirmed_children) filter (where rsvp_status = 'attending'), 0) as attending_children,
      count(*) filter (where rsvp_status = 'declined') as declined_parties,
      coalesce(sum(reserved_seats) filter (where rsvp_status = 'declined'), 0) as declined_people,
      count(*) filter (where rsvp_status in ('pending', 'maybe')) as pending_parties,
      coalesce(sum(reserved_seats) filter (where rsvp_status in ('pending', 'maybe')), 0) as pending_people,
      count(*) filter (where checked_in_at is not null) as arrived_parties,
      coalesce(sum(arrived_count), 0) as arrived_people,
      count(*) filter (where invitation_status = 'not_sent') as invitations_not_sent,
      count(*) filter (where invitation_status = 'sent') as invitations_sent,
      count(*) filter (where invitation_status = 'viewed') as invitations_viewed,
      coalesce(sum(seats_needed) filter (where table_id is not null), 0) as seated_people,
      coalesce(sum(seats_needed) filter (where table_id is null and rsvp_status <> 'declined'), 0) as unseated_people
    from g
  ),
  tables as (
    select count(*) as tables_count, coalesce(sum(capacity), 0) as total_capacity
    from public.seating_tables where event_id = p_event_id
  ),
  money as (
    select
      e.budget_total,
      coalesce(sum(x.planned_amount), 0) as planned_total,
      coalesce(sum(x.actual_amount), 0) as actual_total,
      coalesce(sum(x.paid_amount), 0) as paid_total
    from public.events e
    left join public.expenses x on x.event_id = e.id
    where e.id = p_event_id
    group by e.id, e.budget_total
  ),
  gifts as (
    select count(*) as gifts_count, coalesce(sum(amount), 0) as gifts_total
    from public.gifts where event_id = p_event_id
  ),
  by_group as (
    select coalesce(jsonb_agg(row_to_json(x) order by x.sort_order, x.name), '[]'::jsonb) as data
    from (
      select gr.name, gr.color, gr.sort_order,
        coalesce(sum(g.reserved_seats), 0) as invited,
        coalesce(sum(g.confirmed_adults + g.confirmed_children) filter (where g.rsvp_status = 'attending'), 0) as attending,
        coalesce(sum(g.reserved_seats) filter (where g.rsvp_status = 'declined'), 0) as declined
      from public.guest_groups gr
      left join g on g.group_id = gr.id
      where gr.event_id = p_event_id
      group by gr.id
      union all
      select 'ללא קבוצה', '#8a8f99', 999,
        coalesce(sum(g.reserved_seats), 0),
        coalesce(sum(g.confirmed_adults + g.confirmed_children) filter (where g.rsvp_status = 'attending'), 0),
        coalesce(sum(g.reserved_seats) filter (where g.rsvp_status = 'declined'), 0)
      from g where g.group_id is null
      having count(*) > 0
    ) x
  ),
  by_category as (
    select coalesce(jsonb_agg(row_to_json(c) order by c.category), '[]'::jsonb) as data
    from (
      select category, sum(planned_amount) as planned, sum(actual_amount) as actual, sum(paid_amount) as paid
      from public.expenses where event_id = p_event_id
      group by category
    ) c
  ),
  timeline as (
    select coalesce(jsonb_agg(row_to_json(d) order by d.day), '[]'::jsonb) as data
    from (
      select (rsvp_responded_at at time zone 'Asia/Jerusalem')::date as day,
        count(*) filter (where rsvp_status = 'attending') as attending,
        count(*) filter (where rsvp_status = 'declined') as declined
      from g
      where rsvp_responded_at is not null
      group by 1
    ) d
  )
  select jsonb_build_object(
    'totals', to_jsonb(totals.*),
    'tables', to_jsonb(tables.*),
    'money', to_jsonb(money.*),
    'gifts', to_jsonb(gifts.*),
    'by_group', by_group.data,
    'by_category', by_category.data,
    'timeline', timeline.data
  ) into v_result
  from totals, tables, money, gifts, by_group, by_category, timeline;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- Team management
-- ---------------------------------------------------------------------
create or replace function public.invite_member(
  p_event_id uuid,
  p_email text,
  p_role public.member_role
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user uuid;
begin
  if not private.can_manage_event(p_event_id) then
    raise exception 'רק מנהל אירוע יכול להוסיף אנשי צוות' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'כתובת אימייל לא תקינה' using errcode = 'P0001', hint = 'invalid_email';
  end if;

  select p.id into v_user from public.profiles p where lower(p.email) = v_email;

  if v_user is not null then
    insert into public.event_members (event_id, user_id, role, invited_by)
    values (p_event_id, v_user, p_role, auth.uid())
    on conflict (event_id, user_id) do update set role = excluded.role;
    return jsonb_build_object('status', 'added', 'user_id', v_user);
  end if;

  insert into public.event_member_invites (event_id, email, role, invited_by)
  values (p_event_id, v_email, p_role, auth.uid())
  on conflict (event_id, lower(email)) do update set role = excluded.role, accepted_at = null;
  return jsonb_build_object('status', 'invited');
end;
$$;

create or replace function public.set_platform_admin(p_user_id uuid, p_is_admin boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'רק מנהל מערכת יכול לשנות הרשאות מערכת' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() and not p_is_admin then
    raise exception 'לא ניתן להסיר את הרשאת המנהל מעצמך' using errcode = 'P0001';
  end if;
  update public.profiles set is_platform_admin = p_is_admin where id = p_user_id;
end;
$$;

-- Authenticated-only RPCs (each one also checks the event role itself)
revoke all on function
  public.checkin_search(uuid, text),
  public.checkin_find_by_token(uuid, text),
  public.check_in_guest(uuid, uuid, integer),
  public.undo_check_in(uuid, uuid),
  public.regenerate_invite_token(uuid, uuid),
  public.event_stats(uuid),
  public.invite_member(uuid, text, public.member_role),
  public.set_platform_admin(uuid, boolean)
from public, anon;
grant execute on function
  public.checkin_search(uuid, text),
  public.checkin_find_by_token(uuid, text),
  public.check_in_guest(uuid, uuid, integer),
  public.undo_check_in(uuid, uuid),
  public.regenerate_invite_token(uuid, uuid),
  public.event_stats(uuid),
  public.invite_member(uuid, text, public.member_role),
  public.set_platform_admin(uuid, boolean)
to authenticated;

-- private trigger functions are never callable directly
revoke all on all functions in schema private from public, anon;

-- ---------------------------------------------------------------------
-- Realtime: dashboard and seating screens subscribe to these
-- (postgres_changes respects RLS, so only readers get rows)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.guests, public.seating_tables;
