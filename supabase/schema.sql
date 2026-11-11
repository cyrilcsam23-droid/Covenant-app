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

-- Helpers for trips' payment and expense lists (JSON arrays). Immutable, so the
-- database can use them in totals and checks.
create or replace function public.jsonb_amount_total(lines jsonb) returns numeric
language sql immutable set search_path = ''
as $$
  select coalesce(sum((e->>'amount')::numeric), 0)
  from jsonb_array_elements(case when jsonb_typeof(lines) = 'array' then lines else '[]'::jsonb end) e
$$;

create or replace function public.trip_lines_ok(payments jsonb, costs jsonb) returns boolean
language sql immutable set search_path = ''
as $$
  select jsonb_typeof(payments) = 'array' and jsonb_typeof(costs) = 'array'
    and jsonb_array_length(payments) <= 100 and jsonb_array_length(costs) <= 500
    and not exists (
      select 1 from jsonb_array_elements(payments) p
      where not (jsonb_typeof(p) = 'object'
        and coalesce(p->>'kind', '') in ('advance', 'balance')
        and jsonb_typeof(p->'amount') = 'number'
        and coalesce(p->>'date', '') ~ '^\d{4}-\d{2}-\d{2}$'))
    and not exists (
      select 1 from jsonb_array_elements(payments) p
      where jsonb_typeof(p->'amount') = 'number' and not ((p->>'amount')::numeric > 0 and (p->>'amount')::numeric < 100000000))
    and not exists (
      select 1 from jsonb_array_elements(costs) c
      where not (jsonb_typeof(c) = 'object'
        and coalesce(c->>'type', '') in ('Fuel', 'Toll', 'Parking', 'Driver bata', 'Food', 'Stay', 'Other')
        and jsonb_typeof(c->'amount') = 'number'
        and coalesce(c->>'date', '') ~ '^\d{4}-\d{2}-\d{2}$'))
    and not exists (
      select 1 from jsonb_array_elements(costs) c
      where jsonb_typeof(c->'amount') = 'number' and not ((c->>'amount')::numeric > 0 and (c->>'amount')::numeric < 100000000))
$$;

revoke all on function public.jsonb_amount_total(jsonb) from public, anon;
revoke all on function public.trip_lines_ok(jsonb, jsonb) from public, anon;
grant execute on function public.jsonb_amount_total(jsonb) to authenticated;
grant execute on function public.trip_lines_ok(jsonb, jsonb) to authenticated;

-- A trip: one day, several days, or several days with the end not known yet (end_date null).
-- Money: the agreed fare, a list of payments (advance / balance), and a day-by-day list of
-- expenses. Totals, profit and the amount still due are worked out by the database.
create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  trip_date date not null default current_date,   -- start date
  vehicle text not null default '',
  from_place text not null,
  to_place text not null,
  start_km numeric(10,1),
  end_km numeric(10,1),
  km numeric(10,1) not null default 0,
  notes text not null default '',
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
alter table trips
  add column if not exists end_date date,                                  -- null = end not known yet
  add column if not exists customer_name text not null default '',
  add column if not exists customer_phone text not null default '',
  add column if not exists fare numeric(12,2) not null default 0,          -- agreed total, incl. advance
  add column if not exists payments jsonb not null default '[]'::jsonb,    -- [{date, kind, amount}]
  add column if not exists costs jsonb not null default '[]'::jsonb;       -- [{date, type, amount}]

-- One-time conversion from the first version (fuel / toll / parking / other / received columns).
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'trips' and column_name = 'fuel') then
    alter table public.trips drop column if exists profit, drop column if exists total_expense;
    alter table public.trips drop constraint if exists trips_amounts_ok;
    update public.trips t set
      end_date = coalesce(t.end_date, t.trip_date),
      fare = t.received,
      payments = case when t.received > 0
        then jsonb_build_array(jsonb_build_object('date', t.trip_date, 'kind', 'balance', 'amount', t.received))
        else '[]'::jsonb end,
      costs = (
        select coalesce(jsonb_agg(jsonb_build_object('date', t.trip_date, 'type', x.type, 'amount', x.amount)), '[]'::jsonb)
        from (values ('Fuel', t.fuel), ('Toll', t.toll), ('Parking', t.parking), ('Other', t.other_expense)) as x(type, amount)
        where x.amount > 0);
    alter table public.trips drop column fuel, drop column toll, drop column parking, drop column other_expense, drop column received;
  end if;
end $$;

alter table trips
  add column if not exists total_expense numeric(12,2) generated always as (public.jsonb_amount_total(costs)) stored,
  add column if not exists received_total numeric(12,2) generated always as (public.jsonb_amount_total(payments)) stored,
  add column if not exists profit numeric(12,2) generated always as (fare - public.jsonb_amount_total(costs)) stored,
  add column if not exists due numeric(12,2) generated always as (greatest(fare - public.jsonb_amount_total(payments), 0)) stored;
create index if not exists trips_date_idx on trips (trip_date desc);

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

create index if not exists capital_entries_partner_idx on capital_entries (partner_id);
create index if not exists partner_expenses_partner_idx on partner_expenses (partner_id);

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
      ('trips', 'trips_money_ok', 'check (fare >= 0 and km >= 0)'),
      ('trips', 'trips_lines_ok', 'check (public.trip_lines_ok(payments, costs))'),
      ('trips', 'trips_end_ok', 'check (end_date is null or (end_date >= trip_date and end_date <= trip_date + 120))'),
      ('trips', 'trips_customer_ok', 'check (char_length(customer_name) <= 80 and customer_phone ~ ''^[0-9+() -]{0,20}$'')'),
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
