-- Covenant: Supabase schema
-- Run in Supabase Dashboard -> SQL Editor once the project is created.
-- All three partners share the same data, so any signed-in user can read and write.

create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
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

-- Per-partner totals
create or replace view partner_summary with (security_invoker = true) as
select
  p.id,
  p.name,
  coalesce((select sum(amount) from capital_entries c where c.partner_id = p.id), 0) as capital,
  coalesce((select sum(amount) from partner_expenses e where e.partner_id = p.id), 0) as expenses_paid
from partners p;

-- Row Level Security: signed-in partners can do everything; anonymous visitors nothing.
alter table partners enable row level security;
alter table trips enable row level security;
alter table capital_entries enable row level security;
alter table partner_expenses enable row level security;
alter table app_settings enable row level security;

create policy "partners: signed in" on partners for all to authenticated using (true) with check (true);
create policy "trips: signed in" on trips for all to authenticated using (true) with check (true);
create policy "capital: signed in" on capital_entries for all to authenticated using (true) with check (true);
create policy "expenses: signed in" on partner_expenses for all to authenticated using (true) with check (true);
create policy "settings: signed in" on app_settings for all to authenticated using (true) with check (true);

-- Seed the three partners (rename later in the app)
insert into partners (name) values ('Partner 1'), ('Partner 2'), ('Partner 3');
