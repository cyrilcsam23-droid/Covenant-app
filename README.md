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

Without Supabase settings the app runs in **demo mode**: any email signs in, sample data is shown, and everything stays on the device.

## Supabase (connected)

Data lives in Supabase project `gsrjwxpbxrhngbkviend` and is shared by all partners.

- **Settings:** `.env.production` (committed) holds the project URL and the *publishable* key. Both are public by design; never put a secret or service_role key in any `VITE_` variable. `.env.local` (git-ignored) holds the same for `npm run dev`.
- **Schema:** [`supabase/schema.sql`](supabase/schema.sql) creates tables, value checks, audit stamps and access rules. It is safe to run again after changes.
- **Sync:** `src/lib/store.ts`. Changes show at once, are queued on the device and uploaded in order (so nothing is lost without signal); other partners' changes arrive live.

### Security

- Public sign-ups are **off**. Logins are created only under **Authentication → Users**.
- A login sees data only once it is **approved**. Run this in the SQL Editor:
  ```sql
  insert into app_members (user_id) select id from auth.users where email = 'partner@example.com';
  ```
- Signed-out visitors get no access to any table. Signed-in users can't delete partners or settings, can't approve logins, and can't fake who wrote an entry.
- The database rejects bad values: negative amounts, end km below start km, unknown categories.
- Built pages carry a Content-Security-Policy that only allows the app's own code and its own Supabase project.
- Passwords need at least 8 characters.

### Adding a partner

**In the app (admins):** **More → Manage logins → Add a login**. The same screen can also approve a login made in the dashboard, set a new password, or remove access. It works through the `admin-users` Edge Function ([`supabase/functions/admin-users`](supabase/functions/admin-users/index.ts)):
- The function holds the service-role key on the server.
- It checks every request against the caller's own sign-in and admin role.
- It refuses to remove the last admin or your own access.
- Removing access keeps the login (for the record of who entered what) but blocks it at once.

**In Supabase:** **Authentication → Users → Add user → Create new user**. Tick **Auto Confirm User**, then approve the login with the SQL above. The first admin has to be added this way:
```sql
insert into app_members (user_id, role) select id, 'admin' from auth.users where email = 'owner@example.com';
```

**Redeploying the function:** after editing it, deploy with the Supabase CLI (`supabase functions deploy admin-users --no-verify-jwt`) or the Management API. The function verifies sign-in tokens itself.

## Files

- `src/pages/`: Home, Trips, TripForm, Partners, EntryForm (capital / expense), More, Login
- `src/lib/calc.ts`: profit, totals, per-partner sums, CSV
- `PRODUCT.md` / `DESIGN.md`: product brief and design system
