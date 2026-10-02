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

**Status:** done

- [x] `SavingsTrend.tsx` renders 12 stacked columns from `trendWindow` / `trendTotal` / `potTrendSeries` / `trendMaxTotals`; it computes nothing itself beyond bar percentages.
- [x] Segments use the fixed palette by active-registry index, cycling past 8 pods, so a pot keeps its colour across columns and months.
- [x] Column heights are zero-based against `trendMaxTotals`; the tallest column is 100% and no segment overflows its column.
- [x] Short month labels are localized (pt-BR and en-US) and read oldest-to-newest left-to-right.
- [x] The header label navigates to `/savings/<current month>`; the section is inert otherwise (no per-column navigation).
- [x] The section is absent when there are no active pots or no recorded balance anywhere in the window; it is present once any month has a record.
- [x] The section is the last one on the Dashboard, below open outflows.
- [x] `home.savingsTrend` (and any label/short-month keys) exist in both `locales/pt-BR/translation.json` and `locales/en-US/translation.json`.
- [x] Tests (Given/When/Then, Testing Library) cover: 12 columns render for a filled window; the section hides with no pots and with pots but no records; a carried-forward month renders the same height as its source month; a retired pot's segment is absent and the stack height matches `totalSaved` for the current month; the header navigates to `/savings/<current month>`.
- [x] Verified in the browser via chrome-mcp against the running dev server: the chart renders on `/` for seeded data, heights are proportional, colours are stable, the console stays clean.
- [x] `npm run lint`, `npx tsc --noEmit`, and the tests pass.

## Comments

Landed the trend chart as the last Dashboard block, driven entirely by ticket 01's `utils/savingsTrend`.

- New `src/features/dashboard/SavingsTrend.tsx`: a `mt-4 rounded-lg bg-white p-4 shadow-sm` section with a shared `BlockHeader` whose label is `home.savingsTrend` and whose tap opens `/savings/<current month>`. It renders 12 zero-based stacked columns (`h-24` track, plain CSS/flex) from `trendWindow` / `trendTotal` / `potTrendSeries` / `trendMaxTotals`, with localized short month labels (`getShortMonthName`) under each column. It hides when there are no active pots or `trendMaxTotals(window) === 0`. No chart library, y-axis, gridlines or legend; columns are inert (`role="img"` with an accessible month + total label), so the Dashboard stays current-month-only.
- New `src/features/dashboard/potPalette.ts`: the fixed 8-colour `POT_PALETTE`, assigned by active-registry index and cycling, so a pot keeps its colour across columns and months. This is the colour contract ticket 03's readout reuses.
- `src/components/BlockHeader.tsx`: extracted the private `BlockHeader` out of `DashboardScreen.tsx` so the plan, open-outflows and savings-trend headers stay identical (the cash-flow block keeps its own two-row navigation).
- Rendered `<SavingsTrend now={now} />` last in `DashboardScreen.tsx`, below open outflows, and updated its doc comment to the four blocks.
- `src/utils/month.ts` gained `getShortMonthName(month, locale)` beside `getMonthName`, using the same parser and locale source.
- i18n: added `home.savingsTrend` and `home.savingsColumn` to both locales.
- Tests: new `SavingsTrend.test.tsx` (12 columns, proportional zero-based heights, palette stability, carry-forward equal height, retired pot omitted, label localization, header navigation, both hidden states); added a Dashboard savings-trend block (absent with no pots, last section, header navigation) and a `getShortMonthName` locale test.

Verification: browser-checked via chrome-mcp against `http://localhost:5173/` with four months seeded by hand across two pots (July 30.000, August 34.000, September 35.000 carried, October 40.000). Observed the 12 columns oldest-first (Nov 2025 → Oct 2026), heights 0/…/75/85/87.5/100% (October the full-height tallest), stable segment colours (`bg-sky-500` Emergency, `bg-emerald-500` Retirement across months), localized short labels in both en-US (`Nov`…`Oct`) and pt-BR (`nov.`…`out.`), the aria label `outubro de 2026: R$ 40.000,00 guardados`, the header opening `/savings/2026-10`, and a clean console. `npm run lint`, `npx tsc --noEmit`, and the full suite (40 files, 442 tests) pass.

## Comments
