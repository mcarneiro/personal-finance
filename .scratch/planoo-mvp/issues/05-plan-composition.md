# 05 — Plan composition

**What to build:** The Spending Plan screen for a month: fixed charges and spending buckets with user-defined names and amounts, addable/editable/removable, the plan total displayed, and the one-tap copy-last-month button that seeds items (names, kinds, amounts) but never remaining estimates or card totals — those start at zero. Demo: build June's plan in the app and see the 10.750 total.

**Blocked by:** 02 — Onboarding + Google Sheets foundation; 04 — Control-loop utilities

**Status:** done

- [x] Plan items are addable/editable/removable per month, with kind (fixed charge / spending bucket) and user-defined names
- [x] Plan total is displayed, computed by the control-loop utilities
- [x] Copy-last-month button seeds items with zero remaining estimates and zero card totals; it is absent when last month has no plan
- [x] Items persist to the plan tab through the sync path
- [x] Month navigation shows each month's own composition

## Comments

- Implemented 2026-09-27. The Spending Plan screen at `/plan/:month` now composes a month's plan:
  - `src/features/plan/PlanScreen.tsx`: two sections (Cobranças fixas / Tetos de gastos), each listing that month's items with name + localized BRL amount and edit/remove actions, plus an add form for that kind; the Plan Total rendered from `planTotal()` (never stored); the copy-last-month button; month navigation via the existing `MonthScaffold`.
  - `src/features/plan/PlanItemForm.tsx`: shared name + amount form for add and inline edit; amount is loose text parsed by `parseAmount` (pt-BR comma or en-US dot), submit disabled until it parses.
  - `src/utils/currency.ts`: `formatCurrency` (localized BRL via `Intl.NumberFormat`) and `parseAmount`.
  - `src/utils/planCopy.ts`: `copyPlanItems` seeds target-month copies (names, kinds, amounts) with `remainingEstimate: 0` and fresh ids; Card Spending is never touched.
  - `src/store/planSlice.ts`: new bulk `addPlanItems` action so a whole seeded plan syncs in one debounced write; `src/store/middleware/syncListener.ts` listens to it.
  - i18n: all new strings in pt-BR (primary) and en-US.
- Copy-last-month is offered only when last month has a plan **and** the current month is still empty. This prevents duplication the first cut allowed (a second tap appended the whole plan again). Card totals are never seeded.
- Tests: 29 new (`currency.test.ts` 13, `planCopy.test.ts` 4, `PlanScreen.test.tsx` 11, plus the `plan` reducer added to `App.test.tsx`'s store so the screen renders there). Screen tests run on Seam B — real store + real debounced sync middleware, mocked sheets service — asserting rendered numbers and the write-back boundary. Suite is 91 green; `npm run lint` and `npx tsc --noEmit` clean.
- Browser verification (chrome-devtools): seeded auth + a stubbed Sheets boundary via `navigate_page`'s `initScript`, then drove the real UI. Built June 2026's plan by copying May's — the total showed **R$ 10.750,00**, and the `plan!A2` write carried June copies with `remaining_estimate` 0 (May's 250 did not leak) and wrote nothing to `card_spending`. Then added a fixed charge (`44,90` parsed from the pt-BR comma), edited an item, removed an item, and added a spending bucket, watching the plan total and the debounced `clear` + `PUT` after each. Month navigation showed each month's own composition; the copy button was absent where the previous month had no plan and disappeared once an empty month was seeded.
- `/code-review` (two axes, fixed point `49cbe95`) findings actioned: (1) both axes flagged that copy-last-month could duplicate an existing plan — now hidden unless the target month is empty, with a regression test; (2) missing Given/When/Then comments added; (3) the per-kind label ternaries replaced by one `SECTION_COPY` map. Judgement calls left as-is: the two sections share one `PlanItemForm` rather than a single parameterized form; the test item factory is duplicated across two test files because its shape differs.
