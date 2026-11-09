# Covenant

A phone-first app for a tours & travels business with three partners:

- **Trips:** date, vehicle, from → to, odometer / km, fuel, toll, parking, other, amount received. Profit or loss is worked out automatically.
- **Dashboard:** profit for today, this month or all time; profit by day; net after partner-paid expenses.
- **Partners:** capital each partner has put in (add more any time), and expenses a partner paid out of pocket (maintenance, tyres, repairs…).
- CSV export of trips; installable on a phone home screen.

## Run it

```bash
npm install
npm run dev        # http://localhost:5180 (also reachable from a phone on the same Wi-Fi)
```

It starts with **sample data** (marked "Sample"). Clear it from **More → Clear sample data**.

## Status: shell

- Data is stored **on the device** (localStorage) through `src/lib/store.ts`.
- Login is a **demo** until Supabase is connected.

## Connecting Supabase (later)

1. Create a project at supabase.com.
2. SQL Editor → paste and run [`supabase/schema.sql`](supabase/schema.sql).
3. Authentication → Users → add one user per partner (email + password).
4. Copy `.env.example` to `.env.local` and fill in the Project URL and anon key.
5. Restart `npm run dev`. Sign-in now uses Supabase.
6. Switch the data layer: replace the function bodies in `src/lib/store.ts` (`saveTrip`, `deleteTrip`, `saveCapital`, …) with Supabase queries. The screens only call those functions.

## Files

- `src/pages/`: Home, Trips, TripForm, Partners, EntryForm (capital / expense), More, Login
- `src/lib/calc.ts`: profit, totals, per-partner sums, CSV
- `PRODUCT.md` / `DESIGN.md`: product brief and design system
