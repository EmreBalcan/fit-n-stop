-- Preserve the missed first slot while the one-row-per-member-per-day rule remains intact.
alter table public.reservations
  add column if not exists missed_time_slot text,
  add column if not exists second_chance_used boolean not null default false;
