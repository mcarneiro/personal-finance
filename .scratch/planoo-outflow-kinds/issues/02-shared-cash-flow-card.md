# 02 — Extract the shared cash-flow card and adopt it on the Outflows page

**What to build:** One card component, rendered unchanged on the Dashboard and
adopted (the same numbers and the same bar) on the Outflows page. This is a pure
restructure — the bar itself is still the single-colour one it is today.

- New component, e.g. `src/features/dashboard/CashFlowCard.tsx` (pick the name
  and location that best fit; the Outflows page will import it). It renders
  today's Dashboard block: Income Total, Outflows Total, the bar, and the
  Account Net row. It:
  - takes the month, the income and outflow totals and the account net, and the
    computed bar from the caller (it computes nothing beyond the bar
    percentages, exactly as `DashboardScreen` does today);
  - accepts an optional heading — shown on the Dashboard ("Income and
    outflows"), omitted on the Outflows page;
  - accepts a children/slot area so the Outflows page can sit the Replicate
    button and the copy notices just below the numbers.
- `src/features/dashboard/DashboardScreen.tsx` renders the shared card with its
  heading, keeps its over-income caption below the bar, and keeps its
  open-outflows block unchanged.
- `src/features/outflows/OutflowsScreen.tsx` replaces its hand-rolled summary
  block with the shared card: **no heading**, Income first then Outflows (the
  Dashboard's order), the **Replicate last month** button and the `copyBlocked`
  / `copyCheckFailed` notices below the card. The over-income caption is dropped
  there (it links to the page you are already on). Every downstream section —
  the filter, the list, the by-payer summary, the registry notice — and the
  month totals and Account Net value are unchanged.
- Update both screens' doc comments, and any test that asserted the old order or
  labels.

**Blocked by:** None.

**Status:** done

- [x] A single `CashFlowCard` renders the block on both screens; the Dashboard shows the heading and the over-income caption, the Outflows page shows the same card with no heading.
- [x] The Outflows page still shows Outflows Total, Income Total (the shortcut to `/income/<month>`), Account Net, the bar, and the Replicate-last-month button with both copy notices; nothing else in the screen's behaviour changes.
- [x] The bar is identical to today's (one colour, green under income / red over); no Dashboard behaviour changes apart from the code moving.
- [x] Existing Dashboard and Outflows screen tests pass (updated where they asserted the old structure), with the totals, net and list assertions unchanged.
- [x] Verified in the browser via chrome-mcp on `/` and `/outflows/<month>`: the card reads the same on both, the bar matches the numbers, the income shortcut works, and Replicate still appears only on an empty month.
- [x] `npm run lint`, `npx tsc --noEmit`, and the tests pass.

## Comments

Extracted the shared income-and-outflows card (`src/features/dashboard/CashFlowCard.tsx`)
and adopted it on the Outflows page. Pure restructure — the bar is still the
single-colour one it is today.

- `CashFlowCard` renders Income Total, Outflows Total, the bar and Account Net,
  in the Dashboard's order on both screens. It takes the month, income, outflows,
  account net and the caller-computed bar, derives only the fill percentage and
  colour, and formats its own amounts (reading Privacy Mode itself). Props:
  `label` (accessible name), `showHeading` (the Dashboard draws it, the Outflows
  page omits it), `showOverCaption` (Dashboard-only; the Outflows page drops it
  since it would link to the screen it is on) and a `children` slot for content
  under the numbers. The bar's colour map moved here from `DashboardScreen`.
- `DashboardScreen` now renders the card with its heading and over-income
  caption; its behaviour is otherwise unchanged (the block still shows only when
  income or outflows are non-zero, and the plan/open-outflows/savings blocks are
  untouched).
- `OutflowsScreen` replaces its hand-rolled summary with the card: no heading,
  income first then outflows, the bar and Account Net; the Replicate-last-month
  button and the `copyBlocked` / `copyCheckFailed` notices moved into the card's
  children. The filter, list, by-payer summary, registry notice, month totals and
  Account Net value are unchanged. Its now-unused screen-level `money` helper and
  the dead `outflows.viewIncome` locale key (both locales) were removed.
- Both screen doc comments updated.
- Tests: new `CashFlowCard.test.tsx` (totals/bar/net, heading shown and omitted,
  the caption gated on `showOverCaption` and over-income, children below the
  numbers, the income shortcut); four new Outflows-screen tests pinning the card
  adoption — income leads outflows, the Dashboard bar, no heading, the caption
  dropped, and the Replicate button and copy notice inside the card. Full suite
  519 passing, `npx tsc --noEmit` and `npm run lint` clean.
- Browser (chrome-mcp, real October ledger, dev server on 5173): `/` showed the
  card with heading "Renda e saídas", income R$ 67.673,00 then outflows
  R$ 54.191,52, the bar at 80% green and Account Net R$ 13.481,48;
  `/outflows/2026-10` showed the identical numbers and bar with no heading. The
  income row on the Outflows card navigated to `/income/2026-10`; November 2026
  (empty, last month has outflows) showed the Replicate button inside the card,
  while October did not. Console clean (only the Vite/React dev messages). The
  ledger was not modified: the month already carried enough data to exercise the
  card, so no test outflows were added and nothing was removed.
- prd.md / README reconciliation for the shared card is ticket 04's scope (the
  ticket set 02's doc scope to the two screen doc comments).

## Code review

Two-axis review against the ticket (fixed point `d013284`, staged diff):
- Standards: no hard violations after action. Actioned: removed the duplicated
  `t('home.cashFlow')` literal by replacing the `heading` prop with
  `label` + `showHeading`; extracted the repeated bar-fill lookup in the Outflows
  test into a `cardFill()` helper; removed the dead `outflows.viewIncome` locale
  key. Left as-is (judgement calls): `net` and `bar` are passed by the caller
  exactly as the ticket specifies; the card stays in `src/features/dashboard/` as
  the ticket's example names, and it uses the `home.*` shortcut labels, matching
  the Dashboard block it is extracted from.
- Spec: all ticket requirements covered. Two accepted deltas from "the same
  card": the Outflows Totals row is now a button that links to the screen it is
  already on, and the income row loses the Outflows-only blue link styling — both
  follow from rendering the identical card, as the ticket asks.
