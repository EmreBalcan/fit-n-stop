-- FİT N STOP Antrenman Asistanı: yalnızca üyeye özel, değişken veriler.
-- Mevcut members / reservations / attendances tablolarına dokunmaz.

create table if not exists public.training_programs (
  id uuid primary key default gen_random_uuid(),
  member_id bigint not null,
  name text not null check (char_length(name) between 1 and 80),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_programs_member_id_idx
  on public.training_programs (member_id, updated_at desc);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id bigint not null,
  client_session_id uuid not null unique,
  program_id uuid references public.training_programs(id) on delete set null,
  program_name text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds between 0 and 86400),
  sets jsonb not null check (jsonb_typeof(sets) = 'array'),
  created_at timestamptz not null default now()
);

create index if not exists training_sessions_member_date_idx
  on public.training_sessions (member_id, finished_at desc);

create or replace function public.training_member_owned(target_member_id bigint)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.id = target_member_id and m.auth_user_id = (select auth.uid())
  );
$$;

revoke all on function public.training_member_owned(bigint) from public;
grant execute on function public.training_member_owned(bigint) to authenticated;

alter table public.training_programs enable row level security;
alter table public.training_sessions enable row level security;

drop policy if exists training_programs_own_select on public.training_programs;
drop policy if exists training_programs_own_insert on public.training_programs;
drop policy if exists training_programs_own_update on public.training_programs;
drop policy if exists training_programs_own_delete on public.training_programs;
create policy training_programs_own_select on public.training_programs
  for select to authenticated using (public.training_member_owned(member_id));
create policy training_programs_own_insert on public.training_programs
  for insert to authenticated with check (public.training_member_owned(member_id));
create policy training_programs_own_update on public.training_programs
  for update to authenticated using (public.training_member_owned(member_id)) with check (public.training_member_owned(member_id));
create policy training_programs_own_delete on public.training_programs
  for delete to authenticated using (public.training_member_owned(member_id));

drop policy if exists training_sessions_own_select on public.training_sessions;
drop policy if exists training_sessions_own_insert on public.training_sessions;
drop policy if exists training_sessions_own_update on public.training_sessions;
drop policy if exists training_sessions_own_delete on public.training_sessions;
create policy training_sessions_own_select on public.training_sessions
  for select to authenticated using (public.training_member_owned(member_id));
create policy training_sessions_own_insert on public.training_sessions
  for insert to authenticated with check (public.training_member_owned(member_id));
create policy training_sessions_own_update on public.training_sessions
  for update to authenticated using (public.training_member_owned(member_id)) with check (public.training_member_owned(member_id));
create policy training_sessions_own_delete on public.training_sessions
  for delete to authenticated using (public.training_member_owned(member_id));

grant select, insert, update, delete on public.training_programs to authenticated;
grant select, insert, update, delete on public.training_sessions to authenticated;
