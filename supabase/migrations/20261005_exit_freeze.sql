alter table public.gym_settings
  add column if not exists exit_qr_token text not null default gen_random_uuid()::text;

alter table public.members
  add column if not exists freeze_start_date date;

alter table public.attendances
  add column if not exists exit_time timestamptz,
  add column if not exists exit_method text;

alter table public.attendances
  drop constraint if exists attendances_exit_method_check;

alter table public.attendances
  add constraint attendances_exit_method_check
  check (exit_method is null or exit_method in ('qr', 'automatic'));

create or replace function public.fitnstop_auto_checkout()
returns void
language sql
security definer
set search_path = public
as $$
  update public.attendances
  set exit_time = ((entry_date::text || ' 22:00:00 Europe/Istanbul')::timestamptz),
      exit_method = 'automatic'
  where exit_time is null
    and now() >= ((entry_date::text || ' 22:00:00 Europe/Istanbul')::timestamptz);
$$;

do $$
begin
  create extension if not exists pg_cron;
  if not exists (select 1 from cron.job where jobname = 'fitnstop-auto-checkout') then
    perform cron.schedule('fitnstop-auto-checkout', '0 19 * * *', 'select public.fitnstop_auto_checkout()');
  end if;
end $$;
