---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface: Daily Dropship app shell (all screens)

Mode: Operate. Partners log trips and partner money on phones, mostly outdoors in daylight, right after a trip.

Task: log a trip in under a minute; see profit or loss for today / this month / all time; record partner capital and partner-paid expenses; see each partner's total contribution.

Constraints: sample data must be labelled; Supabase not connected yet (local storage); app name is a placeholder.

## Direction contract

THESIS: The vehicle's yellow commercial number plate is the identity. The numbers that matter (profit, the vehicle, each trip's result) are set as plates. It refuses the white-card fintech dashboard with a blue accent.

OWN-WORLD: Charcoal shell (#16171A header and tab bar), cool pale-grey work ground (#F2F2EE), plate yellow (#F5C518) with black lettering and a thin inset black rim, loss red (#C23B2E) plate with white lettering, profit-green text only in small deltas. Numbers in Barlow Condensed semibold, tabular; UI in the system sans.

STORY: Partners open the app and know at a glance whether today and this month made money, tap Log trip, fill a short form with a live result plate, and see it land in the day's list.

FIRST VIEWPORT: Charcoal header: business name left, vehicle plate chip right; segmented Today / Month / All; the profit plate large and centred; received, expenses and km in a three-column row beneath. On grey: a full-width yellow "Log trip" button, then the period's trips as rows with route, km, expense breakdown, and a small result plate at the right. Bottom tabs: Home, Trips, Partners, More.

FORM: Commercial Plate, my top-ranked grounded candidate (user chose the pick over roll index 4). seed:38dc284b1fe91c07

Signature move: result plates. Profit is a yellow plate, loss turns the plate red, everywhere a result is shown.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
