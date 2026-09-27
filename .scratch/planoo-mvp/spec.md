# Planoo MVP

Status: ready-for-agent

## Problem Statement

I plan my household's card spending in a spreadsheet with weekly check-ins: I write down each credit card's running total, re-estimate what's still coming per spending bucket until month end, and hand-compute the "sobra" (projected month-end result) every single time. The arithmetic is manual and repeated, my monthly obligations (bills — including the card bills that land a month after the spending) have no paid-status tracking anywhere, expected income isn't recorded at all so the account-level picture is invisible, and doing all this on a phone in a spreadsheet is miserable.

## Solution

Planoo digitizes the control loop. A monthly Spending Plan holds fixed charges (known exact amounts) and spending buckets (caps) — my categories, my names. Weekly check-ins: I enter each card's current total (the app sums Total Spent for me), and re-estimate remaining spend per bucket. The app shows the live Projected Result — plan total minus spent minus remaining estimates — green when inside, red when over, which becomes the final Plan Result at month end and stays browsable month-by-month. Bills are tracked with paid toggles (card bills entered by hand with the real statement value), income entries are recorded with a replicate-last-month affordance, and the account net (income − bills) is one glance. All data stays in my Google Sheet — the source of truth — with the same OAuth flow and sync behavior I already trust from Stayoo.

## User Stories

1. As a household planner, I want to connect my Google Sheet once during onboarding, so that my data lives where I already keep it.
2. As a household planner, I want missing sheet tabs auto-created with the right columns, so that setup never requires manual sheet surgery.
3. As a household planner, I want to change the connected sheet in Settings, so that I can start over or migrate to a new sheet.
4. As a household planner, I want to register my credit cards by name, so that check-ins match how I read my card apps.
5. As a household planner, I want to rename or remove a registered card, so that the card list reflects the cards I actually carry.
6. As a household planner, I want to open the current month's Spending Plan, so that I see fixed charges and bucket caps at a glance.
7. As a household planner, I want to add a fixed charge with a name and exact amount, so that known recurring charges are planned precisely.
8. As a household planner, I want to add a spending bucket with my own name and a cap, so that variable spending is capped in categories I choose.
9. As a household planner, I want to edit any plan item, so that the plan reflects this month's reality.
10. As a household planner, I want to remove a plan item, so that dead categories don't clutter the plan.
11. As a household planner, I want to copy last month's plan with one tap, so that I don't retype the bucket list every month.
12. As a household planner, I want the copy to start estimates and card totals at zero, so that last month's forecasts never leak into this month.
13. As a household planner, I want to see the plan total, so that I know the month's overall cap.
14. As a household planner, I want to record each card's current total at check-in, so that the app sums Total Spent for me.
15. As a household planner, I want to overwrite a card total at every check-in, so that the number always reflects the latest state without history clutter.
16. As a household planner, I want Total Spent labeled as "so far", so that I never mistake it for the month's final result.
17. As a household planner, I want to enter a remaining estimate per bucket, so that the projection reflects what is still coming.
18. As a household planner, I want to re-estimate remaining spend weekly, so that the projection stays honest as the month unfolds.
19. As a household planner, I want to see the Projected Result live, so that I always know where the month is landing.
20. As a household planner, I want the Projected Result red when negative, so that an over-plan month is impossible to miss.
21. As a household planner, I want estimates to zero out at month end, so that the projection becomes the final Plan Result.
22. As a household planner, I want to browse past months, so that I can check each month's Plan Result month-by-month.
23. As a household planner, I want past months to show the Plan Result as the headline, so that stale estimates never distort history.
24. As a household planner, I want to add a bill with a name and amount, so that this month's obligations are listed.
25. As a household planner, I want to mark a bill paid, so that I know at a glance what is still open.
26. As a household planner, I want to edit or delete a bill, so that corrections are quick.
27. As a household planner, I want to enter the card bill as a regular bill with the real statement value, so that installments, fees and refunds never need modeling.
28. As a household planner, I want to see the income total and the account net on the Bills screen, so that the account-level picture is one glance.
29. As a household planner, I want to add an income entry with an amount and optional source note, so that expected income is recorded without ceremony.
30. As a household planner, I want to replicate last month's income entries with one tap, so that the recurring salary needs no retyping.
31. As a household planner, I want to edit or delete an income entry, so that corrections are quick.
32. As a household planner, I want month-by-month navigation on every screen, so that history and future months are one tap away.
33. As a household planner, I want a mobile-first interface, so that weekly check-ins happen comfortably from my phone.
34. As a household planner, I want the interface in pt-BR (with en-US available), so that it reads naturally.
35. As a household planner, I want all data stored in my Google Sheet, so that it stays inspectable, backup-able, and usable outside the app.
36. As a household planner, I want changes written back to the sheet automatically, so that the sheet remains the source of truth without manual export.
37. As a household planner, I want a loading state while data syncs, so that I never see a flash of empty data.

## Implementation Decisions

- Port Stayoo's Google Sheets foundation wholesale — OAuth client-ID flow, sheets service, debounced sync middleware, onboarding, month navigation. No new integration patterns (ADR-0001).
- Redux Toolkit slices own feature state for the four entities: card registry, plan items (fixed charges, buckets, card-spending totals), bills, income entries.
- All derived numbers are computed in pure utilities/selectors and never stored. The control-loop formulas (from the grilling session's worked example, recorded in the PRD) encode the decision precisely:

  ```
  Plan Total        = Σ fixed charges + Σ bucket caps
  Total Spent       = Σ card totals
  Projected Result  = Plan Total − Total Spent − Σ remaining estimates
  Plan Result       = Plan Total − Total Spent
  Account Net       = Σ income − Σ bills
  ```

- Card-spending records are current-state: one total per card per month, overwritten at each check-in. No snapshot history in V1.
- Copy-last-month seeds plan items (names, kinds, amounts) only — remaining estimates and card totals start at zero.
- The card bill is a regular Bill entered by hand with the statement's real value; installments, fees and refunds are absorbed by that number — never modeled (ADR-0002).
- Bills are fully manual: no replicate, no auto-generation. Income keeps its replicate-last-month affordance.
- Past months display the Plan Result as the headline; the current month displays the Projected Result.
- Sheet tabs: `cards`, `plan`, `card_spending`, `bills`, `income` — column schema as specified in the PRD. No settings tab; the card registry lives in `cards`.
- Settings manages only the card registry and the connected sheet.
- i18n: pt-BR primary, en-US secondary; BRL currency formatting.
- No purchase entities anywhere in the data model — do not add them (ADR-0002).

## Testing Decisions

- A good test asserts external behavior only — rendered numbers and user-visible states — never slice shapes, store internals, or implementation details.
- **Seam A — control-loop utilities.** Table-driven pure-function tests for the five derived numbers, including the June trace from the real sheet (plan 10.750; card totals 2.899 + 9.432 + 473 = 12.804; remaining 250 → Projected Result −2.304). Edge cases: empty month, zero estimates, missing card totals, negative results.
- **Seam B — feature screens.** Testing Library + jsdom with a real Redux store and a mocked sheets service: check-in flow (enter card total → Total Spent and projection update), estimate edits, copy-last-month behavior, paid toggles with account net, income replicate, month navigation, green/red headline, loading state before data loads.
- Slices and selectors are not a seam — they are covered through the screens. The ported sheets service and sync middleware are not a seam — they are mocked at the screen boundary; their behavior is Stayoo-proven.
- Prior art: Stayoo's component tests (month feature screens) and its pure util/service tests. Given/When/Then comments in every test; a reproduction test for every bug fix.

## Out of Scope

- Purchase-level tracking and per-bucket actuals (ADR-0002 — deliberate non-goal, not a missing feature).
- Charts, year-over-year, or analytics of any kind.
- Installment modeling.
- Account balances, savings, or investment tracking.
- Bill auto-generation or replicate.
- Check-in snapshot history (totals are overwritten).
- Forecast dashboard beyond the plan screen's headline.
- Multi-currency, native mobile app, multiple users/roles.

## Further Notes

- The fuller product spec is `prd.md`; the domain glossary is `CONTEXT.md`; the hard decisions are in `docs/adr/` (0001 — Sheets foundation; 0002 — per-card totals, no purchases).
- The June worked example grounds the arithmetic in real data from the user's current sheet.
- Tracker conventions are mirrored from Stayoo: this spec lives at `.scratch/planoo-mvp/spec.md`; implementation tickets will be one file per ticket under `.scratch/planoo-mvp/issues/`. This repo has not yet run the engineering-skills setup (`/setup-matt-pocock-skills`), which would formalize `docs/agents/` tracker and triage files.
