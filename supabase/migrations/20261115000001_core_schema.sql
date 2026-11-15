-- =====================================================================
-- Event Manager · core schema
-- Every business table carries event_id; access is decided by RLS
-- (see 20261115000002_access_control.sql).
-- =====================================================================

create schema if not exists private;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.member_role as enum ('event_manager', 'viewer', 'checkin');
create type public.event_type as enum (
  'wedding', 'bar_mitzvah', 'bat_mitzvah', 'brit', 'birthday', 'corporate', 'other'
);
create type public.event_status as enum ('draft', 'active', 'completed', 'archived');
create type public.invitation_status as enum ('not_sent', 'sent', 'viewed');
create type public.rsvp_status as enum ('pending', 'attending', 'declined', 'maybe');
create type public.payment_method as enum (
  'cash', 'check', 'bit', 'paybox', 'bank_transfer', 'credit_card', 'gift_item', 'other'
);
create type public.expense_category as enum (
  'venue', 'catering', 'photography', 'music', 'design', 'attractions', 'other'
);
create type public.table_shape as enum ('round', 'rectangle', 'knight');

-- ---------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- URL-safe random token (144 bits of entropy).
create or replace function private.generate_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
$$;

-- Seats a guest party occupies, used both for the generated column and
-- for capacity checks inside triggers (generated columns are not yet
-- computed in BEFORE triggers).
create or replace function public.guest_seats(
  p_status public.rsvp_status,
  p_reserved integer,
  p_confirmed_adults integer,
  p_confirmed_children integer
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'declined' then 0
    when 'attending' then coalesce(p_confirmed_adults, 0) + coalesce(p_confirmed_children, 0)
    else coalesce(p_reserved, 0)
  end;
$$;

-- ---------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  event_type public.event_type not null default 'wedding',
  host_names text check (char_length(host_names) <= 120),
  event_date timestamptz,
  venue_name text check (char_length(venue_name) <= 120),
  venue_address text check (char_length(venue_address) <= 200),
  rsvp_deadline timestamptz,
  invitation_message text check (char_length(invitation_message) <= 2000),
  cover_image_path text,
  budget_total numeric(12, 2) not null default 0 check (budget_total >= 0),
  status public.event_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_owner_id_idx on public.events (owner_id);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- event_members (staff and their role per event)
-- ---------------------------------------------------------------------
create table public.event_members (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_members_user_id_idx on public.event_members (user_id);
create index event_members_invited_by_idx on public.event_members (invited_by);

-- Staff invited by email before they have an account.
create table public.event_member_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.member_role not null,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index event_member_invites_event_email_key
  on public.event_member_invites (event_id, lower(email));
create index event_member_invites_email_idx
  on public.event_member_invites (lower(email)) where accepted_at is null;
create index event_member_invites_invited_by_idx on public.event_member_invites (invited_by);

-- ---------------------------------------------------------------------
-- guest_groups (family / friends / work / other, extendable per event)
-- ---------------------------------------------------------------------
create table public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  color text not null default '#1f3a93' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, name),
  unique (id, event_id)
);

-- ---------------------------------------------------------------------
-- seating_tables
-- ---------------------------------------------------------------------
create table public.seating_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  number integer not null check (number between 1 and 999),
  name text check (char_length(name) <= 60),
  capacity integer not null check (capacity between 1 and 100),
  shape public.table_shape not null default 'round',
  pos_x numeric(8, 2) not null default 0,
  pos_y numeric(8, 2) not null default 0,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, number),
  unique (id, event_id)
);

create trigger seating_tables_set_updated_at
  before update on public.seating_tables
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- guests: one row per invitation unit (a person or a whole family)
-- ---------------------------------------------------------------------
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 80),
  last_name text not null default '' check (char_length(last_name) <= 80),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  group_id uuid,
  inviter_name text check (char_length(inviter_name) <= 80),
  invited_adults integer not null default 1 check (invited_adults between 0 and 50),
  invited_children integer not null default 0 check (invited_children between 0 and 50),
  -- -1 = "not given": the trigger fills it with invited_adults + invited_children
  reserved_seats integer not null default -1 check (reserved_seats between 0 and 100),
  invitation_status public.invitation_status not null default 'not_sent',
  invitation_sent_at timestamptz,
  rsvp_status public.rsvp_status not null default 'pending',
  confirmed_adults integer not null default 0 check (confirmed_adults between 0 and 100),
  confirmed_children integer not null default 0 check (confirmed_children between 0 and 100),
  rsvp_note text check (char_length(rsvp_note) <= 500),
  rsvp_responded_at timestamptz,
  notes text check (char_length(notes) <= 1000),
  dietary_tags text[] not null default '{}',
  dietary_notes text check (char_length(dietary_notes) <= 500),
  table_id uuid,
  invite_token text not null unique default '', -- always replaced by the trigger
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles (id) on delete set null,
  arrived_count integer check (arrived_count between 0 and 100),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  seats_needed integer generated always as (
    public.guest_seats(rsvp_status, reserved_seats, confirmed_adults, confirmed_children)
  ) stored,
  -- group/table must belong to the same event; deleting them only clears the link
  foreign key (group_id, event_id)
    references public.guest_groups (id, event_id) on delete set null (group_id),
  foreign key (table_id, event_id)
    references public.seating_tables (id, event_id) on delete set null (table_id),
  constraint guests_attending_needs_people check (
    rsvp_status <> 'attending' or confirmed_adults + confirmed_children >= 1
  )
);

-- duplicate detection by phone inside an event
create unique index guests_event_phone_key on public.guests (event_id, phone) where phone is not null;
create index guests_event_id_idx on public.guests (event_id);
create index guests_event_rsvp_idx on public.guests (event_id, rsvp_status);
create index guests_group_id_idx on public.guests (group_id);
create index guests_table_id_idx on public.guests (table_id);
create index guests_checked_in_by_idx on public.guests (checked_in_by);
create index guests_created_by_idx on public.guests (created_by);

create trigger guests_set_updated_at
  before update on public.guests
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- gifts
-- ---------------------------------------------------------------------
create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  guest_id uuid references public.guests (id) on delete set null,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  payment_method public.payment_method not null default 'cash',
  received_at date not null default current_date,
  notes text check (char_length(notes) <= 500),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gifts_event_id_idx on public.gifts (event_id);
create index gifts_guest_id_idx on public.gifts (guest_id);
create index gifts_created_by_idx on public.gifts (created_by);

create trigger gifts_set_updated_at
  before update on public.gifts
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- expenses (budget lines)
-- ---------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  category public.expense_category not null,
  vendor_name text check (char_length(vendor_name) <= 120),
  description text check (char_length(description) <= 500),
  planned_amount numeric(12, 2) not null default 0 check (planned_amount >= 0),
  actual_amount numeric(12, 2) not null default 0 check (actual_amount >= 0),
  paid_amount numeric(12, 2) not null default 0 check (paid_amount >= 0),
  due_date date,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_event_id_idx on public.expenses (event_id);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- activity_log (written only by SECURITY DEFINER triggers/functions)
-- ---------------------------------------------------------------------
create table public.activity_log (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  guest_id uuid references public.guests (id) on delete set null,
  action text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index activity_log_event_created_idx on public.activity_log (event_id, created_at desc);
create index activity_log_actor_id_idx on public.activity_log (actor_id);
create index activity_log_guest_id_idx on public.activity_log (guest_id);
