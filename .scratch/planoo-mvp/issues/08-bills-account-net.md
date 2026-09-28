# 08 — Bills + account net

**What to build:** The Bills screen: bills added fully manually (name, amount) — the card bill enters by hand as a regular bill with the real statement value — with paid toggles and edits/removals, plus the month's bills total, income total, and the account net (income − bills). Demo: the account-level picture in one glance.

**Blocked by:** 02 — Onboarding + Google Sheets foundation; 04 — Control-loop utilities; 07 — Income entries

**Status:** done

- [x] Bills are addable/editable/removable per month — fully manual, no replicate, no auto-generation
- [x] Paid toggles make open vs paid visible at a glance
- [x] The card bill enters as a regular bill with the statement value; nothing installment-specific is modeled
- [x] Bills total, income total, and account net are displayed, with the net computed by the control-loop utilities
- [x] Bills persist to the bills tab through the sync path

## Comments

- Implemented 2026-09-27. The Bills screen is now live:
  - `src/features/bills/BillsScreen.tsx`: the month summary (bills total, income total, account net — all derived, never stored), the bill list with a paid checkbox + "Pago"/"Em aberto" badge, strike-through for paid rows, in-place edit, remove, and the manual add form. No replicate, no auto-generation; the card bill is entered exactly like any other bill with its real statement value.
  - `src/utils/controlLoop.ts`: added pure `billsTotal(month, bills)` and refactored `accountNet` to call it, so Σ bills lives in one tested place (review finding).
  - `src/components/NameAmountForm.tsx`: extracted from the plan's `PlanItemForm` (identical name + amount + validation rules) and now shared by the plan and bills forms; `PlanItemForm.tsx` deleted. The cancel action is a `{ label, onClick }` pair so an add form can't carry a dead label.
  - Persistence was already wired (`billsSlice` actions → debounced `syncListener` → `writeBills`); the screen exercises it end to end.
- i18n: new pt-BR/en-US keys under `bills` (summary, totals, net, add/edit labels, paid/open, action labels). Paid checkboxes use action-oriented accessible names ("Marcar como paga/em aberto: {{name}}") so screen readers hear the action, not a state-blind label.
- Judgement calls: the account net is shown neutral (the spec's only colour rule is the red-negative Projected Result); the bills-tab add form is keyed by month so a half-typed draft can't leak across month navigation. The `PlanItemForm` → `NameAmountForm` extraction touches the plan feature; it was forced by sharing one form rather than duplicating ~100 lines, and its 22 existing tests still pass unchanged.
- Tests: `BillsScreen.test.tsx` (13) on Seam B — real store + real debounced middleware, mocked sheets boundary — list/status, summary numbers, month isolation, add (open by default), card bill as a regular bill, invalid input refused, paid toggle, edit, remove, net unchanged by paid status, empty state, month navigation, and add-to-browsed-month. Plus 5 `billsTotal` cases in `controlLoop.test.ts`. Suite is 146 green; `npx tsc --noEmit` and `npm run lint` clean. `App.test.tsx`'s app store now registers the bills reducer (the real app store always did).
- Browser verification (chrome-devtools): seeded auth + a stubbed Sheets boundary via `navigate_page`'s `initScript` (June: income Salário 12.000; bills Cartão guta 2.899 open, Luz 150 paid), then drove the real UI on a fresh dev server (the running one served a stale module). June showed bills total R$ 3.049,00, income R$ 12.000,00, net R$ 8.951,00. Toggling the card bill flipped its accessible name and badge to Pago with the net unchanged; adding Internet 110 → R$ 3.159,00 / R$ 8.841,00; editing to "Internet fibra" 120 → R$ 3.169,00 / R$ 8.831,00; removing it → back to R$ 3.049,00. Navigating to July reset the add form and showed the empty state with three R$ 0,00; adding Água 90 landed in 2026-07 (net **-R$ 90,00**, neutral). Every mutation wrote the full `bills` tab (clear A2:E + PUT `[id, month, name, amount, "TRUE"/"FALSE"]`); console clean.

