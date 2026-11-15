-- =====================================================================
-- Event Manager · TEST DATA ONLY
--
-- Creates one test user per role plus sample events. Never run this on a
-- production project that real customers use.
--
-- The password comes from a setting, so it is never committed. Run as:
--   set seed.password = '<E2E_PASSWORD from .env.local>';
--   \i supabase/seed.sql
-- or pass a bcrypt hash instead (keeps the plain password out of SQL logs):
--   set seed.password_hash = '$2a$10$...';
--
-- Test users (all share the password above):
--   admin@example.com     platform admin
--   manager@example.com   event manager (owns events 1 and 2)
--   viewer@example.com    viewer on event 1
--   checkin@example.com   check-in staff on event 1
--   outsider@example.com  owns event 3, no access to events 1–2
-- =====================================================================

do $$
declare
  v_password text := nullif(current_setting('seed.password', true), '');
  v_hash text := nullif(current_setting('seed.password_hash', true), '');
  u record;
begin
  if v_hash is null then
    if v_password is null or char_length(v_password) < 12 then
      raise exception 'set seed.password (12+ characters) or seed.password_hash before running the seed';
    end if;
    v_hash := extensions.crypt(v_password, extensions.gen_salt('bf'));
  end if;

  -- clean previous test data (events first: owner FK is RESTRICT)
  delete from public.events where owner_id in (
    '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002',
    '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000004',
    '00000000-0000-4000-a000-000000000005');
  delete from auth.users where id in (
    '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002',
    '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000004',
    '00000000-0000-4000-a000-000000000005');

  for u in
    select * from (values
      ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@example.com', 'מנהל מערכת'),
      ('00000000-0000-4000-a000-000000000002'::uuid, 'manager@example.com', 'נועה כהן'),
      ('00000000-0000-4000-a000-000000000003'::uuid, 'viewer@example.com', 'דנה צופה'),
      ('00000000-0000-4000-a000-000000000004'::uuid, 'checkin@example.com', 'יעל כניסה'),
      ('00000000-0000-4000-a000-000000000005'::uuid, 'outsider@example.com', 'משתמש חיצוני')
    ) as t(id, email, full_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      v_hash, now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;

  update public.profiles set is_platform_admin = true
  where id = '00000000-0000-4000-a000-000000000001';
end;
$$;

-- ---------------------------------------------------------------------
-- Events (the insert trigger adds the owner as manager + default groups)
-- ---------------------------------------------------------------------
insert into public.events (
  id, owner_id, name, event_type, host_names, event_date, venue_name, venue_address,
  rsvp_deadline, invitation_message, budget_total
) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002',
   'חתונת נועה ואיתי', 'wedding', 'נועה ואיתי',
   '2027-03-12 19:30:00+02', 'אולמי הגן', 'שדרות הגן 10, ראשון לציון',
   '2027-02-20 23:59:00+02',
   'שלום {שם}, נשמח לראותכם בחתונה שלנו! לאישור הגעה: {קישור}', 184500),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000002',
   'בר המצווה של יונתן', 'bar_mitzvah', 'משפחת כהן',
   '2027-05-20 18:00:00+03', 'גן אירועים הדקל', 'רחוב הדקל 5, חולון',
   null, null, 60000),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000005',
   'כנס לקוחות שנתי', 'corporate', 'חברת דוגמה',
   '2027-01-25 09:00:00+02', 'מרכז הכנסים', 'תל אביב',
   null, null, 25000);

insert into public.event_members (event_id, user_id, role, invited_by) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000003', 'viewer',
   '00000000-0000-4000-a000-000000000002'),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000004', 'checkin',
   '00000000-0000-4000-a000-000000000002');

-- ---------------------------------------------------------------------
-- Event 1: tables, ~150 invitation units, seating, gifts, expenses
-- ---------------------------------------------------------------------
insert into public.seating_tables (event_id, number, name, capacity, shape, pos_x, pos_y)
select '00000000-0000-4000-b000-000000000001', n,
  case n when 1 then 'משפחת הכלה' when 2 then 'משפחת החתן' when 3 then 'דודים'
         when 4 then 'בני דודים' when 5 then 'חברי הכלה' when 6 then 'חברי החתן'
         when 7 then 'עבודה' else null end,
  case when n <= 2 then 12 else 10 end,
  case when n = 1 then 'knight'::public.table_shape else 'round'::public.table_shape end,
  ((n - 1) % 5) * 220, ((n - 1) / 5) * 220
from generate_series(1, 15) n;

do $$
declare
  v_event uuid := '00000000-0000-4000-b000-000000000001';
  first_names text[] := array['אבי','מיכל','יוסי','שירה','דני','רונית','עומר','הילה','איתן','נועה',
                              'גיל','תמר','אלון','מאיה','רון','ליאת','עידו','יעל','בני','אורית'];
  last_names text[] := array['כהן','לוי','מזרחי','פרץ','ביטון','אברהם','פרידמן','אזולאי','דהן','אוחיון',
                             'שלום','גולן','ברק','רז','חדד','מלכה','סויסה','קליין','שטרן','נחום'];
  inviters text[] := array['צד הכלה','צד החתן','משותף'];
  diets text[] := array['צמחוני','טבעוני','ללא גלוטן','כשר למהדרין','אלרגיה לאגוזים'];
  v_groups uuid[];
  i integer;
  v_adults integer;
  v_children integer;
  v_status public.rsvp_status;
  v_family boolean;
begin
  select array_agg(id order by sort_order) into v_groups
  from public.guest_groups where event_id = v_event;

  for i in 1..150 loop
    v_family := i % 3 = 0;
    v_adults := case when v_family then 2 + (i % 2) else 1 + (i % 2) end;
    v_children := case when v_family then i % 4 else 0 end;
    v_status := case
      when i % 10 < 6 then 'attending'
      when i % 10 < 8 then 'pending'
      when i % 10 = 8 then 'declined'
      else 'maybe' end;

    insert into public.guests (
      event_id, first_name, last_name, phone, email, group_id, inviter_name,
      invited_adults, invited_children, invitation_status, rsvp_status,
      confirmed_adults, confirmed_children, rsvp_responded_at, dietary_tags, notes
    ) values (
      v_event,
      case when v_family then 'משפחת' else first_names[1 + (i % 20)] end,
      last_names[1 + ((i * 7) % 20)],
      '+9725' || (i % 5 + 0)::text || lpad((1000000 + i * 37)::text, 7, '0'),
      case when i % 5 = 0 then 'guest' || i || '@example.com' end,
      v_groups[1 + (i % 4)],
      inviters[1 + (i % 3)],
      v_adults, v_children,
      case when i % 10 = 7 then 'not_sent'::public.invitation_status
           when v_status = 'pending' then 'sent'::public.invitation_status
           else 'viewed'::public.invitation_status end,
      v_status,
      case when v_status = 'attending' then v_adults else 0 end,
      case when v_status = 'attending' then greatest(v_children - (i % 2), 0) else 0 end,
      case when v_status <> 'pending' then now() - ((i % 56) || ' days')::interval end,
      case when i % 9 = 0 then array[diets[1 + (i % 5)]] else '{}' end,
      case when i % 25 = 0 then 'מגיעים מחו"ל' end
    );
  end loop;
end;
$$;

-- Seat attending guests table by table without exceeding capacity
do $$
declare
  v_event uuid := '00000000-0000-4000-b000-000000000001';
  g record;
  t record;
begin
  for g in
    select id, seats_needed from public.guests
    where event_id = v_event and rsvp_status = 'attending'
    order by group_id, last_name
    limit 70
  loop
    select st.id into t
    from public.seating_tables st
    where st.event_id = v_event
      and st.capacity - coalesce((select sum(x.seats_needed) from public.guests x where x.table_id = st.id), 0)
          >= g.seats_needed
    order by st.number
    limit 1;
    if found then
      update public.guests set table_id = t.id where id = g.id;
    end if;
  end loop;
end;
$$;

insert into public.gifts (event_id, guest_id, amount, payment_method, received_at, notes)
select g.event_id, g.id,
  (array[360, 500, 720, 1000, 1500])[1 + (row_number() over (order by g.id))::int % 5],
  (array['bit', 'bank_transfer', 'check', 'cash', 'paybox'])[1 + (row_number() over (order by g.id))::int % 5]::public.payment_method,
  current_date - ((row_number() over (order by g.id))::int % 20),
  null
from public.guests g
where g.event_id = '00000000-0000-4000-b000-000000000001' and g.rsvp_status = 'attending'
limit 12;

insert into public.expenses (event_id, category, vendor_name, planned_amount, actual_amount, paid_amount, due_date) values
  ('00000000-0000-4000-b000-000000000001', 'venue', 'אולמי הגן', 60000, 60000, 20000, '2027-03-01'),
  ('00000000-0000-4000-b000-000000000001', 'catering', 'קייטרינג טעמים', 72000, 48000, 10000, '2027-03-05'),
  ('00000000-0000-4000-b000-000000000001', 'photography', 'סטודיו אור', 14000, 14000, 4000, '2027-03-12'),
  ('00000000-0000-4000-b000-000000000001', 'music', 'DJ רועי', 9500, 8000, 2000, '2027-03-12'),
  ('00000000-0000-4000-b000-000000000001', 'design', 'פרחי השרון', 18000, 9300, 3000, '2027-03-10'),
  ('00000000-0000-4000-b000-000000000001', 'attractions', 'עמדת צילום', 6000, 3000, 0, '2027-03-12'),
  ('00000000-0000-4000-b000-000000000001', 'other', 'הסעות', 5000, 0, 0, null);

-- ---------------------------------------------------------------------
-- Events 2 and 3: a few guests each (used to test isolation)
-- ---------------------------------------------------------------------
insert into public.guests (event_id, first_name, last_name, phone, invited_adults, invited_children)
select '00000000-0000-4000-b000-000000000002', 'אורח', 'בר מצווה ' || i,
  '+97252' || lpad((2000000 + i)::text, 7, '0'), 2, i % 3
from generate_series(1, 20) i;

insert into public.guests (event_id, first_name, last_name, phone, invited_adults)
select '00000000-0000-4000-b000-000000000003', 'משתתף', 'כנס ' || i,
  '+97253' || lpad((3000000 + i)::text, 7, '0'), 1
from generate_series(1, 5) i;

-- seeding is not a user action: drop the audit noise it created
delete from public.activity_log
where event_id in ('00000000-0000-4000-b000-000000000001',
                   '00000000-0000-4000-b000-000000000002',
                   '00000000-0000-4000-b000-000000000003');
