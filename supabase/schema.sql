-- Run in Supabase SQL Editor

create table if not exists public.sc3_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb,
  logs jsonb not null default '{}'::jsonb,
  weekly jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.sc3_user_state enable row level security;

-- Users can only access their own state row
create policy "Users can read own state"
  on public.sc3_user_state
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own state"
  on public.sc3_user_state
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own state"
  on public.sc3_user_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at current on updates
create or replace function public.sc3_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sc3_set_updated_at on public.sc3_user_state;

create trigger sc3_set_updated_at
before update on public.sc3_user_state
for each row
execute function public.sc3_set_updated_at();
