# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript + Tailwind v4, installable as a mobile web app (PWA manifest), hosted on GitHub Pages. Supabase (auth + Postgres + an Edge Function for login management) holds the shared data; changes queue on the phone when offline. `npm run dev:demo` runs a local demo with sample data.

## Users

Three business partners of a small Indian tours & travels business. All three log trips and expenses themselves, on their phones, usually right after a trip or at the end of the day, often one-handed and on the move.

## Product Purpose

A "daily dropship" ledger: for each date, record the trip(s) the vehicle did (from → to, kilometres), what it cost (fuel, toll, parking, other), what the customer paid, and the resulting profit or loss. Alongside it, track what each partner has put into the business: capital, which can be added to over time, and expenses a partner paid out of pocket (maintenance etc.) with date, amount and description. Success: the partners can see at any time how much the business earned, what it spent, and who has contributed what.

## Operating Context

- Entry happens on phones, in the field; forms must be quick, numeric keypads, sensible defaults (today's date, last vehicle).
- Money is Indian rupees, formatted en-IN (₹1,00,000 / lakh grouping).
- Partners share one view of all data; there is no per-partner privacy.

## Capabilities and Constraints

- **Trips:** one day or several days. The end date may be unknown while on the trip; "Finish trip" sets it. Each trip records:
  - customer name and phone (optional)
  - vehicle, from, to, odometer or km
  - **agreed fare**, an **advance** (amount and date) and later payments
  - **day-by-day expenses**: fuel, toll, parking, driver bata, food, stay, other
- **Money rules:** profit = fare − expenses, counted on the full fare, so money owed still counts. Due = fare − payments, shown as "To collect".
- **Status and totals:** a trip is Upcoming, On trip or Completed, worked out from its dates. Totals count completed trips only, under their **start date**.
- **Bookings:** future trips are listed under Upcoming and in a calendar. "Add to phone calendar" downloads an .ics event that reminds at 6 pm the evening before and 7 am on the day.
- **Partner capital** (under More): dated entries per partner, added over time. Starting amounts are unequal or unknown, so each starts at zero and partners enter their own. Partners record capital only.
- **Company expenses** (Expenses tab): costs outside trips, such as service, repairs, tyres, fuel, insurance, pollution test, tax and permit, driver salary, loan EMI and cleaning. Each has an optional vehicle and odometer reading. There is no "paid by": every expense is a company cost. Net = trip profit − company expenses.
- **Vehicles** (Vehicle tab):
  - One record per vehicle: registration number, model and odometer. A trip's end km updates the odometer automatically.
  - **Default vehicle:** chosen from a dropdown of saved vehicles and pre-selected on new trips.
  - **Papers** (insurance, pollution test, road tax, permit, fitness) have a valid-until date and a renewal period.
  - **Service reminders** repeat every N km and/or N months, whichever comes first.
  - **Done** or **Renewed** records the expense and restarts the reminder. Overdue and due-soon reminders also show on Home.
  - A paper's expiry can be added to the phone calendar.
- Accounts: Supabase email and password. Public sign-up is off. Logins must be approved, and admins manage them from More → Manage logins. Forgot password is available on the sign-in screen.
- App name: Covenant (editable in More). Open: whether partner-paid expenses are reimbursed or treated as extra capital.

## Brand Commitments

None yet. App name: Covenant.

## Evidence on Hand

No real trip data, logo, or brand assets yet. Demo data in the app is sample data and must be labelled as such.

## Product Principles

1. Logging a trip should take under a minute on a phone.
2. Profit or loss is the headline of every trip and every period.
3. Every rupee a partner puts in is attributable to that partner.
4. Nothing is lost: data entry is forgiving, edits and deletes are confirmed.
