# Planyoo savings trend — spec

A visualisation increment on top of the shipped savings feature. Tickets live in
`issues/`, numbered in dependency order. Each is `ready-for-agent`.

## Problem

Savings keeps monthly history (`savings_balances`, ADR-0011) precisely so the
household can see a pot grow month over month — but the app only ever shows the
browsed month. There is no view of the evolution, so the reason the history is
kept is invisible. The Dashboard, the household's home, should show the savings
trend without becoming a month browser.

## Decisions (agreed in a `/grill-with-docs` session)

| Decision | Choice |
| --- | --- |
| What each month plots | Stacked by pot: total height = Total Saved, each segment a pot |
| Visual form | Stacked vertical bars, plain CSS/flex like the existing Dashboard bars — no chart library |
| Window | Rolling 12 months ending with the current month; newest column at the right edge; empty columns zero-filled |
| Missing month | Plot the carried balance (`potBalance`), so the chart shows the same number the Savings screen shows. No cadence/shading marker |
| Retired pots | Active registry only, exactly like `totalSaved` — the stack height always equals the Total Saved headline |
| Scale | Zero-based, bar height = value / tallest stacked total across the window; no y-axis, no gridlines |
| Labels & interaction | Short month labels only; tapping a column reveals that month's Total Saved plus a per-pot breakdown |
| Pot colours | Fixed palette assigned by the pot's index in the active registry, cycling. Stable month to month while the registry order holds |
| Empty state | Hide the whole section when there are no active pots, or no recorded balance anywhere in the window |
| Placement | Last section on the Dashboard, header chevron navigates to `/savings/<current month>` |
| History seeding | No in-app backfill; the household seeds past months into the sheet by hand |
| Domain language | No new `CONTEXT.md` term — the chart is a view over Savings Pot, Savings Balance, Total Saved, Month |
| ADR | None — a cheaply reversible presentation choice over data ADR-0011 already defines |

## Accepted residuals (documented, not bugs)

- An existing household sees a mostly-empty chart until it seeds the sheet or
  records months; the window fills in over time.
- Segments plot carried values, so a month nobody checked still shows a bar; the
  chart cannot tell a checked month from a carried one, deliberately.
- Colours are by registry index, so adding or removing a pot can recolour other
  pots' segments. Renaming a pot does not.
- A retired pot's history disappears from the chart immediately, consistent with
  ADR-0011's "stop counting in every month".
- A past column is a readout only: tapping reveals its numbers but does not
  navigate, and the header always opens the current month.

## Rejected (do not re-litigate)

One aggregate Total Saved line only (hides which pot moved — the ADR-0011
motivation); one line per pot unstacked (busier and still hides the total);
stacked area / inline SVG (needs hand-rolled axis maths for no readability gain
at this size); a zoomed min–max y-axis (visually misleading for money); showing
12 always-empty columns (a new household sees nothing meaningful); a per-pot
colour stored in Settings (a new registry field, UI and sheet column for a
cosmetic choice); an in-app past-month balance editor (a new interaction
ticket 04 deliberately did not build); tapping a column to navigate months
(turns the Dashboard into a month browser, against its current-month-only rule).

## Domain language

Savings Pot, Savings Balance, Total Saved, Month — see `CONTEXT.md`. No new
term. The chart never touches Outflows or Account Net and introduces no purchase
or derived-balance concept (ADR-0002, ADR-0011).

## Tickets

01 trend window + series utility → 02 Dashboard savings trend section (bars +
short labels) → 03 tap for the month readout (total + per-pot breakdown) → 04
end-to-end verification and doc reconciliation. Building on the pure utility
(01) first keeps the arithmetic — the only place a bug here is silent — fully
tested before any pixels exist.
