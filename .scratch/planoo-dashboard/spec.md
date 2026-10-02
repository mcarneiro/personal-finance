# Planyoo Dashboard — spec

Synthesised from the grilling session. This is the source the implementation
ticket is cut from. Domain vocabulary follows `CONTEXT.md`; all Dashboard numbers
are existing derived numbers, computed by pure utilities and never stored.

## Goal

Replace the placeholder Dashboard at `/` with the real household Dashboard: a
current-month-only summary of the household's cash picture, its Spending Plan
control, and the Bills still open to pay.

## Scope

- **Current month only, no month navigation.** The Dashboard renders
  `getCurrentMonth()` and a month label (e.g. "Outubro 2026"). History review
  stays on the month-scoped screens.
- Reached via the back button; **no app-shell / bottom-nav change** (ADR-0004
  untouched).
- Block order: **(1) income/outcome → (2) Spending Plan → (3) open Bills.**

## Block 1 — income / outcome

- Reuses the Bills screen's wording: **Income Total** vs **Bills Total**, plus
  **Account Net** (`Σ income − Σ bills`).
- Rendered as two **horizontal bars** on a shared scale (the larger value fills
  the width) with the net figure.
- Income bar links to `/income/:month`; Bills bar links to `/bills/:month`.
- **Hidden** when Income Total = 0 *and* Bills Total = 0.

## Block 2 — Spending Plan

- Shows **Plan Total** and **Total Spent** (current spend). **No Projected
  Result** here — unlike `/plan/:month`, which headlines it.
- Filled bar = `Total Spent / Plan Total`, capped at 100% (never overshoots).
- `monthProgress` = elapsed days / days in month, **counting today**, capped at
  1 (day 1 of 30 ≈ 3.3%, last day = 100%).
- Colour and callout by pace:
  - **green** normally;
  - **yellow** when `spend% − month% > 25` percentage points → callout
    "{{amount}} left before the plan ceiling" (headroom = `Plan Total − Total Spent`);
  - **red** when `Total Spent > Plan Total` → callout "{{amount}} over the plan"
    (overage = `Total Spent − Plan Total`).
- Both callouts link to `/plan/:month`; the block header also links there.
- **Hidden entirely when Plan Total = 0.**

## Block 3 — open Bills

- Only **open** Bills (`isPaid === false`, current month). Row content matches
  `/bills/:month`: ⚠️ when not final, name, amount, `payer · bank`, paid
  checkbox. No filter, summary, or totals.
- Checkbox dispatches `toggleBillPaid`; the row **leaves the Dashboard
  immediately, no animation**. Tapping the row opens the bill editor.
- Order: `isFinal` first, then alphabetical by name (the Bills screen's order on
  the open subset).
- Header links to `/bills/:month`.
- **Always shown**; empty state "Hooray! No more bills to pay! 🎉".

## Method

- Test-first: a pure, fully tested `planPace` utility (injectable `now`) plus
  Dashboard component tests.
- Docs are part of the change: `prd.md`, `README.md`, and an ADR recording that
  the Dashboard reads actuals (Plan Result), not the projection.
- Verified in the real browser via chrome-mcp before done.

## Decisions recorded

- **ADR-0009 — the Dashboard reads actuals, not the projection.** `/plan/:month`
  headlines the Projected Result for the current month (estimates included);
  the Dashboard deliberately shows the raw Plan Result (Plan Total − Total
  Spent) so the home screen reflects money actually spent. The pace colouring
  is the forward-looking signal instead.
