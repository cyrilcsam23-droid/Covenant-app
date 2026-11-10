-- Covenant: Supabase schema
-- Safe to run more than once (Dashboard -> SQL Editor, or the Management API).
--
-- Security model
--  * Public sign-ups are switched off (Authentication settings), so accounts exist
--    only if they were added under Authentication -> Users.
--  * On top of that, data is readable and writable only by accounts listed in
--    app_members. A login that is not on that list sees nothing, even if
--    sign-ups are ever switched back on by mistake.
--  * Signed-out visitors (the public "anon" key in the web app) get no access at all.
--  * The database itself checks every value (no negative fuel, sane lengths...),
--    and records who created and who last changed each entry.
--
--  * Admins (app_members.role = 'admin') can add, approve and remove logins from the
--    app's More -> Logins screen, via the admin-users Edge Function.
--
-- The first admin has to be approved here, once:
--   insert into app_members (user_id, role) select id, 'admin' from auth.users where email = 'owner@example.com';

-- ---------------------------------------------------------------- tables

create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null default 0,         -- display order in the app
  user_id uuid references auth.users(id),   -- optional link to a login
  created_at timestamptz not null default now()
);

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  trip_date date not null default current_date,
  vehicle text not null default '',
  from_place text not null,
  to_place text not null,
  start_km numeric(10,1),
  end_km numeric(10,1),
  km numeric(10,1) not null default 0,
  fuel numeric(12,2) not null default 0,
  toll numeric(12,2) not null default 0,
  parking numeric(12,2) not null default 0,
  other_expense numeric(12,2) not null default 0,
  received numeric(12,2) not null default 0,
  total_expense numeric(12,2) generated always as (fuel + toll + parking + other_expense) stored,
  profit numeric(12,2) generated always as (received - (fuel + toll + parking + other_expense)) stored,
  notes text not null default '',
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists trips_date_idx on trips (trip_date desc);
create index if not exists capital_entries_partner_idx on capital_entries (partner_id);
create index if not exists partner_expenses_partner_idx on partner_expenses (partner_id);

create table if not exists capital_entries (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete restrict,
  entry_date date not null default current_date,
  amount numeric(12,2) not null check (amount <> 0),
  note text not null default '',
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists partner_expenses (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete restrict,
  expense_date date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  category text not null default 'Other',
  description text not null default '',
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'Covenant',
  default_vehicle text not null default ''
);
insert into app_settings (id) values (1) on conflict do nothing;

-- Approved partner logins. Admins can also manage logins from the app
-- (through the admin-users Edge Function; nobody can change this table directly).
create table if not exists app_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table app_members add column if not exists role text not null default 'partner';

-- Audit columns: who last changed an entry, and when.
alter table trips            add column if not exists updated_at timestamptz, add column if not exists updated_by uuid references auth.users(id);
alter table capital_entries  add column if not exists updated_at timestamptz, add column if not exists updated_by uuid references auth.users(id);
alter table partner_expenses add column if not exists updated_at timestamptz, add column if not exists updated_by uuid references auth.users(id);

-- ---------------------------------------------------------------- value checks

do $$
declare c record;
begin
  for c in
    select * from (values
      ('trips', 'trips_amounts_ok', 'check (fuel >= 0 and toll >= 0 and parking >= 0 and other_expense >= 0 and received >= 0 and km >= 0)'),
      ('trips', 'trips_odometer_ok', 'check ((start_km is null or start_km >= 0) and (end_km is null or end_km >= 0) and (start_km is null or end_km is null or end_km >= start_km))'),
      ('trips', 'trips_text_ok', 'check (char_length(btrim(from_place)) between 1 and 120 and char_length(btrim(to_place)) between 1 and 120 and char_length(vehicle) <= 30 and char_length(notes) <= 1000)'),
      ('trips', 'trips_date_ok', 'check (trip_date >= date ''2000-01-01'')'),
      ('capital_entries', 'capital_text_ok', 'check (char_length(note) <= 500 and entry_date >= date ''2000-01-01'')'),
      ('partner_expenses', 'expense_text_ok', 'check (char_length(btrim(description)) between 1 and 500 and expense_date >= date ''2000-01-01'')'),
      ('partner_expenses', 'expense_category_ok', 'check (category in (''Maintenance'', ''Repair'', ''Tyres'', ''Insurance'', ''Tax / permit'', ''Other''))'),
      ('partners', 'partner_name_ok', 'check (char_length(btrim(name)) between 1 and 60)'),
      ('app_settings', 'settings_text_ok', 'check (char_length(btrim(business_name)) between 1 and 60 and char_length(default_vehicle) <= 30)'),
      ('app_members', 'member_role_ok', 'check (role in (''admin'', ''partner''))')
    ) as t(tbl, name, def)
  loop
    if not exists (select 1 from pg_constraint where conname = c.name) then
      execute format('alter table public.%I add constraint %I %s', c.tbl, c.name, c.def);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- functions

-- True when the signed-in user is an approved partner. Runs with the caller's own
-- rights: app_members lets each user read only their own row, which is all it needs.
create or replace function public.is_member() returns boolean
language sql stable security invoker set search_path = ''
as $$ select exists (select 1 from public.app_members where user_id = (select auth.uid())) $$;
revoke all on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

-- Stamps who created / changed a row. Clients cannot fake these values.
create or replace function public.stamp_row() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    new.updated_by := null;
    new.updated_at := null;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end $$;
revoke all on function public.stamp_row() from public, anon, authenticated;

drop trigger if exists stamp_row on trips;
drop trigger if exists stamp_row on capital_entries;
drop trigger if exists stamp_row on partner_expenses;
create trigger stamp_row before insert or update on trips            for each row execute function public.stamp_row();
create trigger stamp_row before insert or update on capital_entries  for each row execute function public.stamp_row();
create trigger stamp_row before insert or update on partner_expenses for each row execute function public.stamp_row();

-- Per-partner totals
create or replace view partner_summary with (security_invoker = true) as
select
  p.id,
  p.name,
  coalesce((select sum(amount) from capital_entries c where c.partner_id = p.id), 0) as capital,
  coalesce((select sum(amount) from partner_expenses e where e.partner_id = p.id), 0) as expenses_paid
from partners p;

-- ---------------------------------------------------------------- access rules

alter table partners enable row level security;
alter table trips enable row level security;
alter table capital_entries enable row level security;
alter table partner_expenses enable row level security;
alter table app_settings enable row level security;
alter table app_members enable row level security;

-- Older, looser policies from earlier versions of this file.
drop policy if exists "partners: signed in" on partners;
drop policy if exists "trips: signed in" on trips;
drop policy if exists "capital: signed in" on capital_entries;
drop policy if exists "expenses: signed in" on partner_expenses;
drop policy if exists "settings: signed in" on app_settings;

drop policy if exists "partners: members" on partners;
drop policy if exists "trips: members" on trips;
drop policy if exists "capital: members" on capital_entries;
drop policy if exists "expenses: members" on partner_expenses;
drop policy if exists "settings: members" on app_settings;
drop policy if exists "members: see own row" on app_members;

create policy "partners: members" on partners for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
create policy "trips: members" on trips for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
create policy "capital: members" on capital_entries for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
create policy "expenses: members" on partner_expenses for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
-- Settings: one fixed row that can be read and changed, never deleted or added to.
create policy "settings: members" on app_settings for select to authenticated using ((select public.is_member()));
drop policy if exists "settings: members update" on app_settings;
create policy "settings: members update" on app_settings for update to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
-- Members can see only their own membership row; nobody can add themselves.
create policy "members: see own row" on app_members for select to authenticated using (user_id = (select auth.uid()));

-- Table privileges: signed-out visitors get nothing; signed-in users get only what
-- the app needs (RLS above still decides which rows).
revoke all on partners, trips, capital_entries, partner_expenses, app_settings, app_members, partner_summary from anon;
revoke all on partners, trips, capital_entries, partner_expenses, app_settings, app_members, partner_summary from authenticated;
grant usage on schema public to authenticated;
grant select, insert, update on partners to authenticated;
grant select, insert, update, delete on trips, capital_entries, partner_expenses to authenticated;
grant select, update on app_settings to authenticated;
grant select on app_members, partner_summary to authenticated;

-- ---------------------------------------------------------------- live updates

-- When one partner saves, the others' screens refresh (RLS applies to these events too).
do $$
declare t text;
begin
  foreach t in array array['partners', 'trips', 'capital_entries', 'partner_expenses', 'app_settings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- seed

-- The three partners, once (rename them in the app under More).
insert into partners (name, position)
select v.name, v.position
from (values ('Partner 1', 1), ('Partner 2', 2), ('Partner 3', 3)) as v(name, position)
where not exists (select 1 from partners);
