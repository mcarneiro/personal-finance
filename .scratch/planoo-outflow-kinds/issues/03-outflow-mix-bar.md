# 03 — Compose the cash-flow bar from Payments and Investments

**What to build:** The shared card's bar stops being one colour and becomes the
month's outflow composition, using ticket 01's kind and the existing final flag.

Arithmetic (pure, tested, no UI):

- Extend `src/utils/cashFlowBar.ts` (or add a sibling pure module) with the slice
  breakdown: given the month's outflows, return the four amounts — confirmed
  Payments, unconfirmed Payments, confirmed Investments, unconfirmed Investments
  — and their shares of the Outflows Total, alongside the existing `ratio` and
  `level`. Keep `cashFlowBar`'s under/over rule exactly as it is (over the
  moment outflows strictly pass income).
- The fill's width stays `min(1, Outflows / Income)`; within the fill, each
  slice's width is its share of the Outflows Total, so the four slices always
  fill the drawn bar whether the month is under or over income.

Rendering (in the shared card from ticket 02):

- Render up to four slices left to right in the fixed order — confirmed
  Payments, unconfirmed Payments, confirmed Investments, unconfirmed
  Investments — omitting a zero slice.
- Colours: Payments use the green/red the bar uses today (red when the level is
  over); Investments use a teal tone; an unconfirmed slice uses a lighter tint
  of its own colour. Hold the colours in one named constant in the card module
  with a short comment, the way `src/features/dashboard/potPalette.ts` holds the
  savings palette.
- The bar's accessible label describes the composition (kind and confirmation
  state); the `role="progressbar"` values keep the same shape as today. No
  visible legend.
- The over-income caption and the Account Net row are unchanged. Privacy Mode
  still leaves the bar's proportions real and the change adds no new on-screen
  amount (there is no legend).

**Blocked by:** 01 — Outflows carry a Payment or Investment kind; 02 — Extract
the shared cash-flow card and adopt it on the Outflows page.

**Status:** done

- [x] The pure utility returns the four amounts and their shares; an all-zero month yields no slices; a month of only Payments still splits into confirmed and unconfirmed.
- [x] The bar shows the slices in the fixed order, omitting empty ones; Payments are green/red by over-income, Investments teal, unconfirmed slices lighter.
- [x] Over income, the fill is full width (as today) and the Payment slices are red; the over-income caption is unchanged.
- [x] Colours come from one named constant with a short comment.
- [x] The accessible label names the composition; there is no visible legend.
- [x] Given/When/Then tests cover: the utility's splits; the card rendering the right slices and widths; the over-income red state; an all-Payment month; an all-Investment month; an unconfirmed-only month; and the accessible label.
- [x] Verified in the browser via chrome-mcp on `/` and `/outflows/<month>`: a month with an Investment and an unconfirmed outflow shows the teal and lighter slices in the right proportions, the caption and Account Net are unchanged, and the console stays clean.
- [x] `npm run lint`, `npx tsc --noEmit`, and the tests pass.

## Comments

Composed the shared cash-flow bar from the month's Payments and Investments.

- `src/utils/cashFlowBar.ts`: added `CashFlowSlice` (`kind`, `confirmed`, `amount`, `share`) and `cashFlowSlices(month, outflows)`, which buckets the month's outflows into confirmed Payments, unconfirmed Payments, confirmed Investments, unconfirmed Investments in that fixed order, sums each, and shares it by the month's Outflows Total; a zero slice is dropped, so an all-zero month returns none. Pure and display-only; `cashFlowBar`'s under/over rule is untouched.
- `src/features/dashboard/CashFlowCard.tsx`: takes a required `slices` prop (computed by the caller, as the bar already is) and draws them left to right inside the fill — whose width stays `min(1, Outflows / Income)` — each at `share * 100%`, so the slices fill the drawn bar under or over income. One named constant `CASH_FLOW_SLICE_COLOR` with a short comment (plus a `sliceColor` helper, the way `potPalette` pairs a constant with a helper) holds the colours: Payments keep the bar's green/red by level, Investments are teal, an unconfirmed slice is the lighter tint. No visible legend; the `role="progressbar"` values are unchanged; the over-income caption and Account Net row are untouched. The bar's `aria-label` now names the composition (e.g. "Total das saídas: pagamentos confirmados 2%, pagamentos não confirmados 95%, investimentos confirmados 3%"), falling back to the plain total when there is no composition.
- `DashboardScreen` and `OutflowsScreen` pass `cashFlowSlices(...)` alongside the bar; their doc comments were updated.
- i18n: `outflows.barComposition` and the four slice-name keys added to both `pt-BR` and `en-US`.
- Tests: `cashFlowBar.test.ts` gains a `cashFlowSlices` block (fixed order whatever the input order, four shares, all-zero, no-outflows, all-Payment split, all-Investment split, unconfirmed-only); `CashFlowCard.test.tsx` covers slice order/widths, the fill staying `Outflows / Income`, an all-Payment month, an all-Investment month, an unconfirmed-only month, the over-income red Payment beside a teal Investment, the composition label, the no-composition fallback, and the absence of a legend; `DashboardScreen.test.tsx` and `OutflowsScreen.test.tsx` each gain a composition test and their bar helpers were updated. Full suite 536 passing, `npx tsc --noEmit` and `npm run lint` clean.
- Browser (chrome-mcp, real October ledger, dev server on 5173): `/outflows/2026-10` and `/` both drew the composition — a confirmed Payment dark-green slice, the unconfirmed Payments light-green, and a confirmed Investment teal, in the fixed order, over a 86% fill — with the Dashboard heading and the Outflows page's lack of it, no legend, and a clean console (only the Vite/React dev messages). Added three clearly-named test outflows to the current month ("TEST payment" final Payment, "TEST unconfirmed" non-final Payment, "TEST investment" final Investment), checked the slices and label, then removed exactly those three; the ledger is back to its original income/outflows/net and no test rows remain after a reload from the sheet.
- Doc reconciliation (prd.md and README wording of the bar) is ticket 04's scope; ticket 03's doc scope is the three component/utility doc comments, which are updated.

## Code review

Two-axis review of the uncommitted diff against `HEAD`:
- Standards: no hard violations. Flagged as judgement calls: the `kind × confirmed` cascades in `sliceColor`/`sliceLabelKey`/the render key could collapse to one map; the bar-walk is repeated across the three screen tests; and `prd.md`'s bar wording is not yet updated (deferred to ticket 04 by the feature plan). `CashFlowSlice.amount` is unused in production but spec-mandated ("the four amounts").
- Spec: all ticket requirements covered. Noted deltas: the utility drops zero slices internally rather than returning four amounts (the ticket's own "all-zero month yields no slices" checkbox asks for this), and float slice widths are clipped/filled by the track's `overflow-hidden` rather than enforced arithmetically — cosmetic.
