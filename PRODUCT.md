# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript + Tailwind v4, installable as a mobile web app (PWA manifest). Supabase (auth + Postgres) is the intended backend; it is not connected yet, so the shell runs on device-local storage behind a data layer that will be swapped for Supabase.

## Users

Three business partners of a small Indian tours & travels business. All three log trips and expenses themselves, on their phones, usually right after a trip or at the end of the day, often one-handed and on the move.

## Product Purpose

A "daily dropship" ledger: for each date, record the trip(s) the vehicle did (from → to, kilometres), what it cost (fuel, toll, parking, other), what the customer paid, and the resulting profit or loss. Alongside it, track what each partner has put into the business: capital, which can be added to over time, and expenses a partner paid out of pocket (maintenance etc.) with date, amount and description. Success: the partners can see at any time how much the business earned, what it spent, and who has contributed what.

## Operating Context

- Entry happens on phones, in the field; forms must be quick, numeric keypads, sensible defaults (today's date, last vehicle).
- Money is Indian rupees, formatted en-IN (₹1,00,000 / lakh grouping).
- Partners share one view of all data; there is no per-partner privacy.

## Capabilities and Constraints

- Trips: date, vehicle (optional; one vehicle today, more later), from, to, start/end odometer or distance in km, fuel, toll, parking, other expense, amount received, notes. Profit = received − expenses.
- Partner capital: dated entries per partner, added over time. Starting amounts are unequal/unknown: start at zero, partners enter their own.
- Partner-paid expenses: date, partner, amount, description (maintenance, repairs, etc.).
- Accounts: Supabase auth planned; until connected, login is a demo shell.
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
