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

**Status:** ready-for-agent

- [ ] The pure utility returns the four amounts and their shares; an all-zero month yields no slices; a month of only Payments still splits into confirmed and unconfirmed.
- [ ] The bar shows the slices in the fixed order, omitting empty ones; Payments are green/red by over-income, Investments teal, unconfirmed slices lighter.
- [ ] Over income, the fill is full width (as today) and the Payment slices are red; the over-income caption is unchanged.
- [ ] Colours come from one named constant with a short comment.
- [ ] The accessible label names the composition; there is no visible legend.
- [ ] Given/When/Then tests cover: the utility's splits; the card rendering the right slices and widths; the over-income red state; an all-Payment month; an all-Investment month; an unconfirmed-only month; and the accessible label.
- [ ] Verified in the browser via chrome-mcp on `/` and `/outflows/<month>`: a month with an Investment and an unconfirmed outflow shows the teal and lighter slices in the right proportions, the caption and Account Net are unchanged, and the console stays clean.
- [ ] `npm run lint`, `npx tsc --noEmit`, and the tests pass.

## Comments
