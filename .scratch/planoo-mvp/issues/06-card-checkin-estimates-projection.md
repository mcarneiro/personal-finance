# 06 — Card check-in + remaining estimates + projection

**What to build:** The live control loop on the plan screen: one current-total input per registered card, overwritten at each check-in with no history kept; Total Spent displayed and labeled "so far"; one remaining-estimate input per bucket, editable anytime; and the Projected Result headline — green when positive, red when negative — which becomes the Plan Result headline for past months. Demo: the full sobra loop, live against real numbers.

**Blocked by:** 03 — Card registry (Settings); 05 — Plan composition

**Status:** done

- [x] Check-in: current total per card, overwritten at each update, no snapshot history
- [x] Total Spent displayed, labeled "so far"
- [x] Remaining estimate per spending bucket, editable anytime
- [x] Projected Result headline is green/red and updates live on any input
- [x] Past months show the Plan Result as the headline, not the projection
- [x] Card spending persists to the card_spending tab through the sync path

## Comments

- Implemented 2026-09-27. The Spending Plan screen is now the live control loop:
  - `src/features/plan/PlanScreen.tsx`: a headline card that shows the **Projected Result** for the current (and future) month and the final **Plan Result** for past months, green when ≥ 0 and red when negative — both from the existing `controlLoop` utilities, never stored. Below it, the plan summary, then the check-in block, then the fixed/bucket sections. Each bucket row now carries an editable Remaining Estimate field.
  - `src/features/plan/CardCheckIn.tsx`: one current-total input per registered card, each overwriting that card's `CardSpending` row in place via `setCardSpendingTotal` (no snapshot history, ADR-0002), plus Total Spent summed and labeled **"Total gasto até agora"** ("so far").
  - `src/features/plan/AmountInput.tsx`: small money field shared by check-ins and estimates. Holds a typed draft so pt-BR comma decimals survive mid-typing, commits every parseable keystroke so the projection moves as you type, formats adopted values in the active locale (no grouping), and treats a blank field left on blur as zero.
  - `src/utils/month.ts`: `isPastMonth(month, now?)` drives the headline switch (past months → Plan Result), replacing the inline comparison.
- Card spending already had a sync path (`setCardSpendingTotal` → `writeCardSpending` → `card_spending` A2:D, plus `readCardSpending` on load); this ticket wires the UI to it and proves it end to end.
- i18n: new pt-BR/en-US keys for the headline labels, check-in, Total Spent "so far", and remaining estimates.
- Tests: 15 new (`PlanScreen.test.tsx` +10, `AmountInput.test.tsx` 4, `month.test.ts` +1). Screen tests run on Seam B — real store + real debounced middleware, mocked sheets boundary — asserting rendered numbers and the write-back calls: per-card inputs, live Total Spent/projection, overwrite-without-history, the June trace (10.750 − 12.804 − 250 = −2.304, red), estimate edits, the past-month Plan Result (stale estimate ignored), and green/red headline. Suite is 106 green; `npm run lint` and `npx tsc --noEmit` clean.
- Browser verification (chrome-devtools): seeded auth + a stubbed Sheets boundary via `navigate_page`'s `initScript` (cards, a plan month, and card_spending), then drove the real UI. On the current month the headline read **−R$ 2.304,00** in red, Total Spent **R$ 12.804,00** labeled "até agora", and each card input showed its total. Changing cc guta to 3.000 moved the headline to −R$ 2.405,00 and Total Spent to 12.905,00 and wrote one `card_spending` row (total 3.000); editing restaurante's estimate to 400 moved the headline to −R$ 2.555,00 and wrote the plan row. Navigating to the previous month showed the **Plan Result** headline (R$ 200,00 green, the 250 estimate ignored), not the projection. Console clean.
- `/code-review` (two axes, fixed point `4cfffa1`) findings actioned: extracted the check-in block into `CardCheckIn.tsx` (Divergent Change) and `isPastMonth` into `month.ts` (Feature Envy); made `AmountInput` format adopted values in the active pt-BR locale with grouping off (the `String(value)` dot leaked); aligned the per-card label with the domain term (**Card Spending**) instead of the avoided "card total"; corrected the misleading "read-only history" comment; gave the money fields ids (cleared the Chrome a11y warning); hoisted the test `beforeEach` and renamed the `cardSpendingRow` helper. Judgement calls left as-is: future months headline the projection too (harmless, spending is zero); the `placeholder="0"` is a locale-neutral numeral; past-month inputs stay editable ("editable anytime") while the headline still ignores their estimates.
