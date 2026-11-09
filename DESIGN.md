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
- **Delete:** two-tap confirm ("Tap again to delete"), never a modal.
- **Inputs:** 48px tall. Money fields have a ₹ prefix, decimal keypad, and Barlow figures. Focus shows a charcoal border with a yellow halo.

## Do's and Don'ts

- Do show profit or loss as a plate wherever a result appears.
- Do keep yellow scarce, so a plate always reads as "the number that matters".
- Do label sample data as sample.
- Don't add gradients, glass, faux embossing, or hard offset shadows.
- Don't put a small uppercase label above a heading.
- Don't colour profit green; the yellow plate is profit.
