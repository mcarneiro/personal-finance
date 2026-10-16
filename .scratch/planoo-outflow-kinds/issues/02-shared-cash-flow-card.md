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

**Status:** ready-for-agent

- [ ] A single `CashFlowCard` renders the block on both screens; the Dashboard shows the heading and the over-income caption, the Outflows page shows the same card with no heading.
- [ ] The Outflows page still shows Outflows Total, Income Total (the shortcut to `/income/<month>`), Account Net, the bar, and the Replicate-last-month button with both copy notices; nothing else in the screen's behaviour changes.
- [ ] The bar is identical to today's (one colour, green under income / red over); no Dashboard behaviour changes apart from the code moving.
- [ ] Existing Dashboard and Outflows screen tests pass (updated where they asserted the old structure), with the totals, net and list assertions unchanged.
- [ ] Verified in the browser via chrome-mcp on `/` and `/outflows/<month>`: the card reads the same on both, the bar matches the numbers, the income shortcut works, and Replicate still appears only on an empty month.
- [ ] `npm run lint`, `npx tsc --noEmit`, and the tests pass.

## Comments
