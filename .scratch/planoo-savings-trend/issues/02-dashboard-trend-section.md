# 02 — Dashboard savings trend section

**What to build:** The chart itself, as the last section on the Dashboard,
driven entirely by ticket 01's utility. A new component
`src/features/dashboard/SavingsTrend.tsx` (with a `SavingsTrend.test.tsx`),
rendered by `DashboardScreen.tsx` below the open-outflows block.

Shape, matching the existing Dashboard blocks exactly:

- A `bg-white p-4 shadow-sm` section with a `BlockHeader`-style heading whose
  label is `home.savingsTrend` and whose tap navigates to
  `/savings/<current month>` — the same header pattern as the cash-flow and plan
  blocks. The Dashboard stays current-month-only; the header is the only link.
- A row of 12 stacked vertical bars, one per `trendWindow(currentMonth)` month,
  oldest first, using plain CSS/flex like the existing progress bars. **No chart
  library** — this deliberately sharpens `prd.md`'s "no charts" line rather than
  reversing it.
- Each bar's total height is `trendTotal(month)` over `trendMaxTotals(window)`,
  zero-based; segments are `potTrendSeries(month)` stacked in registry order and
  coloured from a fixed 8-colour palette by registry index (cycling). Give each
  `role="img"`-style bar an accessible label naming the month and the total.
- A short month label under each column (e.g. `nov`, `dez`), localized with
  `Intl`/`toLocaleDateString` short-month + `i18n.language`, matching the
  locale style of `getMonthName`. No y-axis, no gridlines, no legend yet.
- The whole section is **hidden** when there are no active pots or
  `trendMaxTotals(window) === 0`, the way the plan block hides when Plan Total
  is zero. Nothing is fabricated for an empty household.

Extract the fixed palette as a module constant with a short comment (it is the
colour contract ticket 03's breakdown reuses).

**Blocked by:** 01 — Savings trend window and series utility.

**Status:** ready-for-agent

- [ ] `SavingsTrend.tsx` renders 12 stacked columns from `trendWindow` / `trendTotal` / `potTrendSeries` / `trendMaxTotals`; it computes nothing itself beyond bar percentages.
- [ ] Segments use the fixed palette by active-registry index, cycling past 8 pods, so a pot keeps its colour across columns and months.
- [ ] Column heights are zero-based against `trendMaxTotals`; the tallest column is 100% and no segment overflows its column.
- [ ] Short month labels are localized (pt-BR and en-US) and read oldest-to-newest left-to-right.
- [ ] The header label navigates to `/savings/<current month>`; the section is inert otherwise (no per-column navigation).
- [ ] The section is absent when there are no active pots or no recorded balance anywhere in the window; it is present once any month has a record.
- [ ] The section is the last one on the Dashboard, below open outflows.
- [ ] `home.savingsTrend` (and any label/short-month keys) exist in both `locales/pt-BR/translation.json` and `locales/en-US/translation.json`.
- [ ] Tests (Given/When/Then, Testing Library) cover: 12 columns render for a filled window; the section hides with no pots and with pots but no records; a carried-forward month renders the same height as its source month; a retired pot's segment is absent and the stack height matches `totalSaved` for the current month; the header navigates to `/savings/<current month>`.
- [ ] Verified in the browser via chrome-mcp against the running dev server: the chart renders on `/` for seeded data, heights are proportional, colours are stable, the console stays clean.
- [ ] `npm run lint`, `npx tsc --noEmit`, and the tests pass.

## Comments
