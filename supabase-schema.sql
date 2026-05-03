create extension if not exists pgcrypto with schema extensions;

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  app_key_hash text not null,
  work_date date not null,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_key_hash, work_date)
);

alter table public.time_entries enable row level security;

drop policy if exists "No direct read access" on public.time_entries;
drop policy if exists "No direct write access" on public.time_entries;

create or replace function public.clock_in(p_app_key text, p_work_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.time_entries (app_key_hash, work_date, clock_in_at)
  values (encode(extensions.digest(p_app_key, 'sha256'), 'hex'), p_work_date, now())
  on conflict (app_key_hash, work_date)
  do update set
    clock_in_at = coalesce(public.time_entries.clock_in_at, excluded.clock_in_at),
    updated_at = now();
end;
$$;

create or replace function public.clock_out(p_app_key text, p_work_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.time_entries
  set
    clock_out_at = coalesce(clock_out_at, now()),
    updated_at = now()
  where app_key_hash = encode(extensions.digest(p_app_key, 'sha256'), 'hex')
    and work_date = p_work_date
    and clock_in_at is not null;
end;
$$;

create or replace function public.get_clock_month(
  p_app_key text,
  p_start_date date,
  p_end_date date
)
returns table (
  id uuid,
  work_date date,
  clock_in_at timestamptz,
  clock_out_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, work_date, clock_in_at, clock_out_at
  from public.time_entries
  where app_key_hash = encode(extensions.digest(p_app_key, 'sha256'), 'hex')
    and work_date between p_start_date and p_end_date
  order by work_date desc;
$$;

create or replace function public.set_clock_entry(
  p_app_key text,
  p_work_date date,
  p_clock_in_at timestamptz,
  p_clock_out_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_clock_out_at is not null and p_clock_out_at < p_clock_in_at then
    raise exception 'clock_out_at cannot be earlier than clock_in_at';
  end if;

  insert into public.time_entries (
    app_key_hash,
    work_date,
    clock_in_at,
    clock_out_at
  )
  values (
    encode(extensions.digest(p_app_key, 'sha256'), 'hex'),
    p_work_date,
    p_clock_in_at,
    p_clock_out_at
  )
  on conflict (app_key_hash, work_date)
  do update set
    clock_in_at = excluded.clock_in_at,
    clock_out_at = excluded.clock_out_at,
    updated_at = now();
end;
$$;

grant execute on function public.clock_in(text, date) to anon;
grant execute on function public.clock_out(text, date) to anon;
grant execute on function public.get_clock_month(text, date, date) to anon;
grant execute on function public.set_clock_entry(text, date, timestamptz, timestamptz) to anon;
