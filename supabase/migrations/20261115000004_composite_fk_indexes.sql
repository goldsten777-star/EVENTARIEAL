-- Covering indexes for the composite (id, event_id) foreign keys on guests,
-- replacing the single-column ones (flagged by the Supabase performance advisor).
drop index if exists public.guests_group_id_idx;
drop index if exists public.guests_table_id_idx;
create index guests_group_id_event_id_idx on public.guests (group_id, event_id);
create index guests_table_id_event_id_idx on public.guests (table_id, event_id);
