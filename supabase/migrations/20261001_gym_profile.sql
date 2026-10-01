alter table public.gym_settings
  add column if not exists about text not null default '',
  add column if not exists address text not null default '',
  add column if not exists trainer_name text not null default '',
  add column if not exists phone text not null default '';
