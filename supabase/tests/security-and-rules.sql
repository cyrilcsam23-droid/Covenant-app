-- Covenant: database security + rules test.
-- Simulates an approved partner and an outsider (a login that isn't approved), tries
-- allowed and forbidden things, then reports. Everything is undone: the last statement
-- raises an error carrying the results, which rolls the whole transaction back.
-- Run with: node scripts/test-db.mjs   (needs SUPABASE_ACCESS_TOKEN in .env.local)
-- Each line of the report ends in PASS or FAIL.

create temp table r (n serial, step text, ok boolean, detail text);
grant all on r to authenticated;
grant usage on sequence r_n_seq to authenticated;

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-member@invalid.test'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-outsider@invalid.test');
insert into app_members (user_id) values ('11111111-1111-4111-8111-111111111111');

set local role authenticated;

-- ------------------------------------------------------------ outsider
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
insert into r (step, ok, detail) select 'outsider sees no partners', count(*) = 0, count(*)::text from partners;
insert into r (step, ok, detail) select 'outsider sees no trips', count(*) = 0, count(*)::text from trips;
insert into r (step, ok, detail) select 'outsider is not a member', not public.is_member(), '';
do $$ begin
  insert into trips (from_place, to_place) values ('a', 'b');
  insert into r (step, ok, detail) values ('outsider cannot add a trip', false, 'was allowed');
exception when others then insert into r (step, ok, detail) values ('outsider cannot add a trip', true, sqlerrm); end $$;
do $$ begin
  insert into app_members (user_id) values ('22222222-2222-4222-8222-222222222222');
  insert into r (step, ok, detail) values ('outsider cannot approve itself', false, 'was allowed');
exception when others then insert into r (step, ok, detail) values ('outsider cannot approve itself', true, sqlerrm); end $$;
do $$ declare k int; begin
  update app_settings set business_name = 'hacked';
  get diagnostics k = row_count;
  insert into r (step, ok, detail) values ('outsider cannot rename business', k = 0, k || ' rows');
end $$;

-- ------------------------------------------------------------ approved partner
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
insert into r (step, ok, detail) select 'partner sees the 3 partners', count(*) >= 3, count(*)::text from partners;

-- Multi-day trip: fare 12000, advance 3000, balance 5000, costs over two days.
do $$ declare t record; begin
  insert into trips (trip_date, end_date, from_place, to_place, customer_name, customer_phone, fare, payments, costs, created_by)
  values ('2026-11-12', '2026-11-14', 'Kochi', 'Munnar', 'Rajesh', '+91 98470 12345', 12000,
    '[{"date":"2026-11-01","kind":"advance","amount":3000},{"date":"2026-11-14","kind":"balance","amount":5000}]',
    '[{"date":"2026-11-12","type":"Fuel","amount":1450},{"date":"2026-11-13","type":"Stay","amount":1200},{"date":"2026-11-13","type":"Driver bata","amount":500}]',
    '22222222-2222-4222-8222-222222222222')
  returning * into t;
  insert into r (step, ok, detail) values ('multi-day trip saved', true, '');
  insert into r (step, ok, detail) values ('expenses total worked out (3150)', t.total_expense = 3150, t.total_expense::text);
  insert into r (step, ok, detail) values ('received total worked out (8000)', t.received_total = 8000, t.received_total::text);
  insert into r (step, ok, detail) values ('profit on full fare (8850)', t.profit = 8850, t.profit::text);
  insert into r (step, ok, detail) values ('amount due worked out (4000)', t.due = 4000, t.due::text);
  insert into r (step, ok, detail) values ('author is the real user, not the faked one', t.created_by = '11111111-1111-4111-8111-111111111111', t.created_by::text);
exception when others then insert into r (step, ok, detail) values ('multi-day trip saved', false, sqlerrm); end $$;

-- Trip with end date not known yet.
do $$ begin
  insert into trips (trip_date, end_date, from_place, to_place, fare, payments)
  values ('2026-11-12', null, 'Kochi', 'Thekkady', 0, '[{"date":"2026-11-10","kind":"advance","amount":2000}]');
  insert into r (step, ok, detail) values ('trip with unknown end date allowed', true, '');
exception when others then insert into r (step, ok, detail) values ('trip with unknown end date allowed', false, sqlerrm); end $$;

-- Overpaid: due never goes negative.
do $$ declare d numeric; begin
  insert into trips (from_place, to_place, fare, payments) values ('a', 'b', 1000, '[{"date":"2026-11-10","kind":"balance","amount":1500}]') returning due into d;
  insert into r (step, ok, detail) values ('due never negative', d = 0, d::text);
exception when others then insert into r (step, ok, detail) values ('due never negative', false, sqlerrm); end $$;

-- Things the database must refuse.
create function pg_temp.refuses(label text, sql text) returns void language plpgsql as $f$
begin
  execute sql;
  insert into r (step, ok, detail) values ('refuses: ' || label, false, 'was allowed');
exception when others then insert into r (step, ok, detail) values ('refuses: ' || label, true, sqlerrm);
end $f$;
select pg_temp.refuses('end date before start', $q$insert into trips (trip_date, end_date, from_place, to_place) values ('2026-11-12', '2026-11-10', 'a', 'b')$q$);
select pg_temp.refuses('trip longer than 120 days', $q$insert into trips (trip_date, end_date, from_place, to_place) values ('2026-01-01', '2026-12-01', 'a', 'b')$q$);
select pg_temp.refuses('negative fare', $q$insert into trips (from_place, to_place, fare) values ('a', 'b', -5)$q$);
select pg_temp.refuses('negative expense', $q$insert into trips (from_place, to_place, costs) values ('a', 'b', '[{"date":"2026-11-10","type":"Fuel","amount":-5}]')$q$);
select pg_temp.refuses('unknown expense type', $q$insert into trips (from_place, to_place, costs) values ('a', 'b', '[{"date":"2026-11-10","type":"Party","amount":5}]')$q$);
select pg_temp.refuses('expense with a bad date', $q$insert into trips (from_place, to_place, costs) values ('a', 'b', '[{"date":"tomorrow","type":"Fuel","amount":5}]')$q$);
select pg_temp.refuses('amount given as text', $q$insert into trips (from_place, to_place, costs) values ('a', 'b', '[{"date":"2026-11-10","type":"Fuel","amount":"5"}]')$q$);
select pg_temp.refuses('unknown payment kind', $q$insert into trips (from_place, to_place, payments) values ('a', 'b', '[{"date":"2026-11-10","kind":"tip","amount":5}]')$q$);
select pg_temp.refuses('zero payment', $q$insert into trips (from_place, to_place, payments) values ('a', 'b', '[{"date":"2026-11-10","kind":"balance","amount":0}]')$q$);
select pg_temp.refuses('payments not a list', $q$insert into trips (from_place, to_place, payments) values ('a', 'b', '{"amount":5}')$q$);
select pg_temp.refuses('letters in the phone number', $q$insert into trips (from_place, to_place, customer_phone) values ('a', 'b', 'call me')$q$);
select pg_temp.refuses('end km below start km', $q$insert into trips (from_place, to_place, start_km, end_km) values ('a', 'b', 500, 400)$q$);
select pg_temp.refuses('empty From place', $q$insert into trips (from_place, to_place) values ('  ', 'b')$q$);
select pg_temp.refuses('unknown partner-expense category', $q$insert into partner_expenses (partner_id, amount, category, description) select id, 100, 'Party', 'x' from partners limit 1$q$);
select pg_temp.refuses('partner approving another login', $q$insert into app_members (user_id) values ('22222222-2222-4222-8222-222222222222')$q$);
select pg_temp.refuses('deleting the settings row', $q$delete from app_settings$q$);
select pg_temp.refuses('deleting partners', $q$delete from partners$q$);

do $$ begin
  insert into partner_expenses (partner_id, amount, category, description) select id, 4800, 'Maintenance', 'Oil change' from partners limit 1;
  insert into r (step, ok, detail) values ('valid partner expense saved', true, '');
exception when others then insert into r (step, ok, detail) values ('valid partner expense saved', false, sqlerrm); end $$;

reset role;
do $$ begin
  raise exception 'RESULTS:%', (
    select string_agg(chr(10) || case when ok then 'PASS ' else 'FAIL ' end || step || case when ok then '' else ' (' || left(detail, 140) || ')' end, '' order by n)
    from r);
end $$;
