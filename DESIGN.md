---
name: Covenant
description: Trip, expense and partner-money log for a small tours & travels business, styled after the yellow commercial number plate.
colors:
  shell: "#16171a"
  shell-raised: "#222429"
  shell-line: "#363940"
  shell-muted: "#a7aab2"
  ground: "#f2f2ee"
  surface: "#ffffff"
  line: "#dcdcd5"
  ink: "#16171a"
  ink-secondary: "#45484f"
  ink-tertiary: "#5f626a"
  plate-yellow: "#f5c518"
  plate-ink: "#111111"
  loss-red: "#c23b2e"
  loss-soft: "#f6e1de"
  gain-green: "#1d7348"
  track-grey: "#e4e4de"
  readonly-grey: "#ebebe6"
  placeholder: "#8b8d86"
  placeholder-on-shell: "#8c8f97"
typography:
  plate-lg:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(2.6rem, 13vw, 3.6rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.02em"
    fontFeature: "tnum, lnum"
  figure-xl:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 600
    fontFeature: "tnum, lnum"
  figure-lg:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 600
    fontFeature: "tnum, lnum"
  figure:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    fontFeature: "tnum, lnum"
  figure-md:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 600
    fontFeature: "tnum, lnum"
  figure-sm:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 600
    fontFeature: "tnum, lnum"
  figure-inline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    fontFeature: "tnum, lnum"
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 600
  section:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 600
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
  meta:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "0.83rem"
    fontWeight: 400
  caption:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
  micro:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
  tab:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 600
    letterSpacing: "0.025em"
rounded:
  plate-sm: "5px"
  plate: "6px"
  plate-lg: "9px"
  control: "10px"
  container: "12px"
  pill: "9999px"
spacing:
  gutter: "16px"
  stack: "12px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.plate-yellow}"
    textColor: "{colors.plate-ink}"
    rounded: "{rounded.container}"
    height: "48px"
  button-dark:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.surface}"
    rounded: "{rounded.container}"
    height: "48px"
  plate-profit:
    backgroundColor: "{colors.plate-yellow}"
    textColor: "{colors.plate-ink}"
    typography: "{typography.figure}"
    rounded: "{rounded.plate}"
  plate-loss:
    backgroundColor: "{colors.loss-red}"
    textColor: "{colors.surface}"
    typography: "{typography.figure}"
    rounded: "{rounded.plate}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
  list-group:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.container}"
---

# Design System: Covenant

## Overview

**North star: the Commercial Plate.** The yellow-and-black commercial number plate every taxi in India carries is the identity. The numbers that matter (trip profit, a day's result, the vehicle) are set as plates. Everything else is a quiet, fast, phone-first working tool. It is used outdoors in daylight, one-handed, right after a trip.

## Colors

- **Shell charcoal** (`shell`) owns the header and tab bar of every screen, so you always know where you are. Secondary text on charcoal is `shell-muted`, never plain grey.
- **Cool work ground** (`ground`) under white `surface` list groups. It is not cream.
- **Plate yellow** carries exactly three jobs: result plates, the primary action, and the active state (segmented control and tab mark). Do not use it for decoration.
- **Loss red** turns a result plate red and marks negative figures. Green appears only as small cloud/status hints; profit is yellow, not green.

## Typography

Barlow Condensed (self-hosted via @fontsource, weights 500–700, tabular lining numerals) is used for every figure: money, km, odometer, plate lettering. The system sans is used for all words. Headings use weight, not size jumps: screen title 1.35rem, section 1.05rem, both semibold. No eyebrows or kickers above headings.

## Layout

Single column, `max-w-xl` (36rem) centred, 16px gutters at every width. The charcoal header spans full width and its content aligns to the same column as the page body. The bottom tab bar is fixed (Home, Trips, Partners, More). Form screens drop the tab bar and use a sticky charcoal top bar with a close button. The trip form has a sticky footer that shows the live result plate and the Save button.

## Elevation & Depth

Flat and tonal. Depth comes from the charcoal shell against the light ground, and from white groups with 1px `line` borders. The only shadows are a soft 1–2px drop under plates and primary buttons (offset plus blur, never a hard block shadow).

## Shapes

- **Plate:** rounded 5–9px with a thin rim inset 2px inside the edge (black on yellow, white on red). The rim is a flat printed line; there is no faux embossing or bevel.
- **Controls:** 10–12px.
- **Category chips:** pills.

## Components

- **Result plate:** yellow with a `+₹` value for profit, red with a `−₹` value for a loss, grey for zero. It always carries a sign and an aria-label ("Profit ₹2,690"), so colour is never the only cue. The value rolls to its new number over 0.6s whenever it changes; with reduced motion it jumps.
- **Trip row:** route `From → To` in semibold, then km (Barlow) · only the non-zero expenses, optional notes, and a small result plate on the right. The whole row is the edit link. A just-saved row enters with a yellow wash that fades out.
- **Segmented control:** sliding indicator (yellow on charcoal, white on the light ground).
- **Trip status:** a trip that isn't finished has no result yet, so it never shows a plate. A grey pill reads "Upcoming" and a charcoal pill reads "On trip · Day 2". A finished trip with money owed adds "₹4,000 to collect" in semibold ink. A due is not a loss, so it is never red.
- **Trip form footer:** for a booking or a trip still on the road, the footer says "Expected profit" and "Balance due". It switches to "Profit / Loss" and "To collect" once the trip ends. With no fare yet it says "Profit shows once the fare is in", never a misleading red plate.
- **Day-by-day expenses:** one white group with a row per day ("Day 2 · Wed, 13 Nov", day total in Barlow, chevron). Only one day is open at a time: today while on the trip, Day 1 of a booking, or the last day of a finished trip.
- **Add chips:** pill buttons with a + icon, for optional expense types (Driver bata, Food, Stay, Other), "Add a payment", "Add day 3" and "Fully paid · ₹7,000". Fuel, Toll and Parking are always shown.
- **Switch:** a 40×28 track that is plate yellow with an ink rim when on (active state) and grey when off, with an ink knob. It is used for "End date not known yet" and "Add to my phone calendar".
- **Calendar:** a 7-column month grid starting on Sunday, with Barlow day numbers. Dots mark the days with trips: filled for a trip, a ring for a booking. The selected day is a yellow plate tile, and today has an ink ring. The day's trips are listed below the grid.
- **To collect row:** route, dates and customer, "Received ₹X of ₹Y", and the due in Barlow on the right. Underneath are actions: "Call Rajesh" (a tel: link) and "Mark ₹4,000 received" (two-tap confirm).
- **Tab bar:** five tabs: Home, Trips, Vehicle, Expenses, More. Partners lives under More.
- **Vehicle dashboard:**
  - **Charcoal header:** the registration number as a plate (KL 39 Y 0770 layout), the model, and "Default for trips". A summary line reads "1 overdue · 2 due soon".
  - **Odometer:** a tappable panel ("50,063 km · From the trip on 13 Nov"), plus a 3-column strip: km this month, fares, spent on it.
  - **Body:** **Papers** and **Service** groups, each sorted most urgent first, then **Recent costs**.
- **Reminder row:** the name with a state tag, the due line ("Valid until 22 Nov 2026 · 9 days left", "Next at 50,369 km · 306 km to go"), and the schedule ("Every 5,000 km or 6 months").
  - The right-hand button reads **Done** (service) or **Renewed** (paper). It is charcoal when the reminder is overdue or due soon, and outlined otherwise.
  - **State tags:**
    - **Overdue:** red with white text. This is the only place outside losses where red appears, because it is a real problem state.
    - **Due soon:** ink outline on white. Yellow stays reserved.
    - **Not set:** grey.
- **Choice chips:** pills where the chosen one is charcoal, or plate yellow on the charcoal header. Used for expense type, vehicle, partner and "Does it complete a reminder?".
- **Vehicle dropdown:** a native select in Barlow with plate letter-spacing. A number that is no longer saved stays selectable as "(not saved)", so editing an old trip never changes its vehicle.
- **Checklist rows (Add vehicle):** a 24px square tick that is charcoal when on, the name, and a "Paper · renew every 1 yr" line.
- **Delete:** two-tap confirm ("Tap again to delete"), never a modal.
- **Inputs:** 48px tall. Money fields have a ₹ prefix, decimal keypad, and Barlow figures. Focus shows a charcoal border with a yellow halo.

## Do's and Don'ts

- Do show profit or loss as a plate wherever a result appears.
- Do keep yellow scarce, so a plate always reads as "the number that matters".
- Do label sample data as sample.
- Don't add gradients, glass, faux embossing, or hard offset shadows.
- Don't put a small uppercase label above a heading.
- Don't colour profit green; the yellow plate is profit.
