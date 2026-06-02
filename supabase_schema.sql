
-- ADMM Team Planner Complete - Supabase Schema
-- In Supabase öffnen: SQL Editor -> New Query -> alles einfügen -> Run

create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'Member',
  area text not null default 'ME',
  is_pm boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text default '',
  owner_id uuid references public.profiles(id) on delete set null,
  area text not null default 'PM',
  priority text not null default 'Mittel',
  deadline date,
  points integer not null default 3,
  status text not null default 'Backlog',
  done_definition text default '',
  evidence text default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text default '',
  shop text default '',
  order_number text default '',
  quantity text default '1',
  price text default '',
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'Benötigt',
  created_at timestamptz not null default now()
);

create table if not exists public.blockers (
  id uuid primary key default uuid_generate_v4(),
  question text not null,
  tried text default '',
  needed_from text default '',
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'Offen',
  answer text default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.orders enable row level security;
alter table public.blockers enable row level security;

drop policy if exists "profiles read all" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "tasks read all" on public.tasks;
drop policy if exists "tasks insert authenticated" on public.tasks;
drop policy if exists "tasks update authenticated" on public.tasks;
drop policy if exists "tasks delete authenticated" on public.tasks;
drop policy if exists "orders read all" on public.orders;
drop policy if exists "orders insert authenticated" on public.orders;
drop policy if exists "orders update authenticated" on public.orders;
drop policy if exists "orders delete authenticated" on public.orders;
drop policy if exists "blockers read all" on public.blockers;
drop policy if exists "blockers insert authenticated" on public.blockers;
drop policy if exists "blockers update authenticated" on public.blockers;
drop policy if exists "blockers delete authenticated" on public.blockers;

create policy "profiles read all" on public.profiles for select to authenticated using (true);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id);

create policy "tasks read all" on public.tasks for select to authenticated using (true);
create policy "tasks insert authenticated" on public.tasks for insert to authenticated with check (auth.uid() is not null);
create policy "tasks update authenticated" on public.tasks for update to authenticated using (auth.uid() is not null);
create policy "tasks delete authenticated" on public.tasks for delete to authenticated using (auth.uid() is not null);

create policy "orders read all" on public.orders for select to authenticated using (true);
create policy "orders insert authenticated" on public.orders for insert to authenticated with check (auth.uid() is not null);
create policy "orders update authenticated" on public.orders for update to authenticated using (auth.uid() is not null);
create policy "orders delete authenticated" on public.orders for delete to authenticated using (auth.uid() is not null);

create policy "blockers read all" on public.blockers for select to authenticated using (true);
create policy "blockers insert authenticated" on public.blockers for insert to authenticated with check (auth.uid() is not null);
create policy "blockers update authenticated" on public.blockers for update to authenticated using (auth.uid() is not null);
create policy "blockers delete authenticated" on public.blockers for delete to authenticated using (auth.uid() is not null);

-- Nach dem Registrieren kannst du Kassy zur PM machen:
-- update public.profiles set is_pm = true, role = 'PM / Product Owner', area = 'PM' where display_name = 'Kassy';
