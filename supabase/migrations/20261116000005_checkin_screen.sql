-- =====================================================================
-- Check-in screen helpers (additive, read-only)
--
-- Door staff cannot read the guests table directly, so the check-in
-- screen needs its live counter and the guest card behind a QR code
-- through RPCs gated by the same can_check_in rule as check_in_guest.
-- =====================================================================

-- Arrival counter for the door: expected vs. arrived, parties and people.
create or replace function public.checkin_stats(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not private.can_check_in(p_event_id) then
    raise exception 'אין הרשאה לבצע Check-in באירוע זה' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'expected_parties', count(*) filter (where g.rsvp_status = 'attending'),
    'expected_people', coalesce(sum(g.confirmed_adults + g.confirmed_children)
                                  filter (where g.rsvp_status = 'attending'), 0),
    'arrived_parties', count(*) filter (where g.checked_in_at is not null),
    'arrived_people', coalesce(sum(g.arrived_count), 0),
    'last_check_in_at', max(g.checked_in_at)
  ) into v_result
  from public.guests g
  where g.event_id = p_event_id;

  return v_result;
end;
$$;

-- One guest card with the same door-only fields as checkin_search.
create or replace function public.checkin_get_guest(p_event_id uuid, p_guest_id uuid)
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
begin
  if not private.can_check_in(p_event_id) then
    raise exception 'אין הרשאה לבצע Check-in באירוע זה' using errcode = '42501';
  end if;

  return query
  select g.id, g.first_name, g.last_name, g.phone, gr.name, t.number, t.name,
         g.rsvp_status, g.seats_needed, g.dietary_tags, g.checked_in_at, g.arrived_count
  from public.guests g
  left join public.guest_groups gr on gr.id = g.group_id
  left join public.seating_tables t on t.id = g.table_id
  where g.event_id = p_event_id and g.id = p_guest_id;
end;
$$;

revoke all on function
  public.checkin_stats(uuid),
  public.checkin_get_guest(uuid, uuid)
from public, anon;
grant execute on function
  public.checkin_stats(uuid),
  public.checkin_get_guest(uuid, uuid)
to authenticated;
