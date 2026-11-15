-- =====================================================================
-- Event Manager · access control (RLS)
--
-- Roles:
--   platform admin  profiles.is_platform_admin = true → everything
--   event_manager   full read/write on their event
--   viewer          read-only on their event
--   checkin         no direct table access to guest data; uses the
--                   check-in RPCs only (see business_logic migration)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper predicates (private schema: not exposed through the Data API)
-- ---------------------------------------------------------------------
grant usage on schema private to authenticated;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_platform_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create or replace function private.event_role(p_event_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.event_members m
  where m.event_id = p_event_id and m.user_id = (select auth.uid());
$$;

-- any staff member (manager, viewer, check-in)
create or replace function private.is_event_member(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
    or exists (
      select 1 from public.event_members m
      where m.event_id = p_event_id and m.user_id = (select auth.uid())
    );
$$;

-- managers and viewers may read business data
create or replace function private.can_read_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
    or exists (
      select 1 from public.event_members m
      where m.event_id = p_event_id
        and m.user_id = (select auth.uid())
        and m.role in ('event_manager', 'viewer')
    );
$$;

create or replace function private.can_manage_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
    or exists (
      select 1 from public.event_members m
      where m.event_id = p_event_id
        and m.user_id = (select auth.uid())
        and m.role = 'event_manager'
    );
$$;

-- managers and check-in staff may run the door
create or replace function private.can_check_in(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
    or exists (
      select 1 from public.event_members m
      where m.event_id = p_event_id
        and m.user_id = (select auth.uid())
        and m.role in ('event_manager', 'checkin')
    );
$$;

-- whether the current user works on any event with p_user_id
create or replace function private.shares_event_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_members mine
    join public.event_members theirs on theirs.event_id = mine.event_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  );
$$;

revoke all on function
  private.is_platform_admin(), private.event_role(uuid), private.is_event_member(uuid),
  private.can_read_event(uuid), private.can_manage_event(uuid), private.can_check_in(uuid),
  private.shares_event_with(uuid)
from public, anon;
grant execute on function
  private.is_platform_admin(), private.event_role(uuid), private.is_event_member(uuid),
  private.can_read_event(uuid), private.can_manage_event(uuid), private.can_check_in(uuid),
  private.shares_event_with(uuid)
to authenticated;

-- ---------------------------------------------------------------------
-- Table privileges: anon gets nothing; authenticated is narrowed by RLS
-- (and by column grants where users must not touch some columns).
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- profiles: users may only edit their name and phone
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- activity_log is append-only through definer code
revoke insert, update, delete on public.activity_log from authenticated;

-- ---------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.event_member_invites enable row level security;
alter table public.guest_groups enable row level security;
alter table public.seating_tables enable row level security;
alter table public.guests enable row level security;
alter table public.gifts enable row level security;
alter table public.expenses enable row level security;
alter table public.activity_log enable row level security;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create policy "profiles: read self, teammates, or as admin"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_platform_admin())
    or private.shares_event_with(id)
  );

create policy "profiles: update self"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------
create policy "events: members read"
  on public.events for select to authenticated
  using (owner_id = (select auth.uid()) or private.is_event_member(id));

create policy "events: any user creates own"
  on public.events for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "events: managers update"
  on public.events for update to authenticated
  using (private.can_manage_event(id))
  with check (private.can_manage_event(id));

create policy "events: owner or admin deletes"
  on public.events for delete to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_platform_admin()));

-- ---------------------------------------------------------------------
-- event_members / invites
-- ---------------------------------------------------------------------
create policy "event_members: members read team"
  on public.event_members for select to authenticated
  using (private.is_event_member(event_id));

create policy "event_members: managers add"
  on public.event_members for insert to authenticated
  with check (private.can_manage_event(event_id));

create policy "event_members: managers change role"
  on public.event_members for update to authenticated
  using (private.can_manage_event(event_id))
  with check (private.can_manage_event(event_id));

create policy "event_members: managers remove, users leave"
  on public.event_members for delete to authenticated
  using (private.can_manage_event(event_id) or user_id = (select auth.uid()));

create policy "event_member_invites: managers read"
  on public.event_member_invites for select to authenticated
  using (private.can_manage_event(event_id));

create policy "event_member_invites: managers create"
  on public.event_member_invites for insert to authenticated
  with check (private.can_manage_event(event_id));

create policy "event_member_invites: managers delete"
  on public.event_member_invites for delete to authenticated
  using (private.can_manage_event(event_id));

-- ---------------------------------------------------------------------
-- Business tables: managers & viewers read, managers write.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['guest_groups', 'seating_tables', 'guests', 'gifts', 'expenses'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.can_read_event(event_id))',
      t || ': staff read', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.can_manage_event(event_id))',
      t || ': managers insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.can_manage_event(event_id)) with check (private.can_manage_event(event_id))',
      t || ': managers update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.can_manage_event(event_id))',
      t || ': managers delete', t);
  end loop;
end;
$$;

create policy "activity_log: staff read"
  on public.activity_log for select to authenticated
  using (private.can_read_event(event_id));
