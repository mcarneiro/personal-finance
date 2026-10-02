# 03 — Tap a column for the month readout

**What to build:** The interaction agreed in grilling: tapping a column reveals
that month's **Total Saved plus a per-pot breakdown**. This is the payoff for
choosing a stacked-by-pot chart — the breakdown is what the stack is made of,
and it doubles as the legend (which is why no legend is drawn).

In `SavingsTrend.tsx`:

- A column becomes a `<button>` (keyboard-focusable, `aria-expanded`) that
  toggles a readout beneath the chart for the tapped month. Tapping the same
  column again, or tapping another, updates/replaces the readout. Default state
  is nothing selected, so the chart renders exactly as ticket 02 left it.
- The readout shows the selected month's name (the full `getMonthName`, not the
  short label) as a heading, its Total Saved (`trendTotal`) as the headline, and
  one row per active pot in registry order: a colour swatch from the **same
  palette and index** as the segment, the pot name, and its carried balance
  (`potTrendSeries`). A pot contributing `0` that month still lists, showing
  `R$ 0,00` in muted styling — the registry is the household's list of pots, and
  silently dropping one is confusing.
- A month with no record of its own may be carried forward indistinguishably (an
  accepted residual of the spec); do not add a "carried" marker here.
- The readout is inert beyond display: it does **not** navigate to
  `/savings/<month>`. The Dashboard stays current-month-only; the header remains
  the only link.
- Reuse `formatCurrency` and `useTranslation` for every string; no hard-coded
  copy or currency formatting.

**Blocked by:** 02 — Dashboard savings trend section.

**Status:** done

- [x] Tapping a column shows a readout with the full month name, the month's Total Saved, and one row per active pot with swatch, name and carried balance.
- [x] The swatch colour for a pot matches its stacked segment in every column (same palette, same registry index).
- [x] Tapping the same column again closes the readout; tapping another column replaces it; the default render matches ticket 02's inert chart.
- [x] A pot with a `0` carried balance that month is listed with a muted `R$ 0,00`, not omitted.
- [x] The readout never navigates; the section header remains the only navigation affordance.
- [x] Columns are real buttons: focusable, with an `aria-expanded` state and an accessible name naming the month and its total, so the interaction is reachable by keyboard and screen reader.
- [x] New i18n keys exist in both locales (e.g. the readout's "Total Saved" line reuses `savings.total`, pot balance rows are self-labelling).
- [x] Tests (Given/When/Then) cover: a column tap opens the readout with the right month and total; the per-pot rows match the series and the segment colours; re-tapping closes; tapping a second column swaps the readout; a `0`-balance pot shows muted; no navigation occurs on tap.
- [x] Verified via chrome-mcp: tapping each of a seeded window's columns shows correct totals and breakdowns, colours match the bars, and the readout closes cleanly; console stays clean.
- [x] `npm run lint`, `npx tsc --noEmit`, and the tests pass.

## Comments

Landed the tap-for-readout interaction on the Dashboard's savings trend, entirely in `src/features/dashboard/SavingsTrend.tsx`.

- Each of the 12 columns is now a `<button type="button">` (focusable, `aria-expanded`, `aria-controls` on the expanded one) whose accessible name is the existing `home.savingsColumn` copy (full month + total). Tapping toggles a readout for that month; tapping the same column closes it, tapping another swaps it; the untapped default is unchanged. The segments moved from `div` to `span` to keep a `<button>`'s content model valid.
- The readout is rendered beneath the chart: the full `getMonthName` heading, the month's `trendTotal` headline (labelled with the reused `savings.total`), then one row per active pot from `potTrendSeries` in registry order — a palette swatch, the pot name, and its carried balance. A pot contributing `0` still lists, with the amount in muted `text-gray-400`; a carried month is shown indistinguishably (no marker). The readout is display-only and never navigates — the header stays the only link — so the Dashboard remains current-month-only.
- `src/features/dashboard/potPalette.ts` gained `potPaletteClass(index)`, the one place the palette's modulo indexing lives, now shared by the stacked segment and the readout swatch so they cannot drift.
- i18n: added `home.savingsReadout` (`Detalhes de {{month}}` / `{{month}} breakdown`) to both locales as the readout group's accessible name; all other strings reuse `home.savingsColumn` / `savings.total` and `formatCurrency` / `getMonthName` / `getShortMonthName`.
- Tests: extended `SavingsTrend.test.tsx` (19 tests) with column-button/aria coverage and six readout cases (open with month + total, registry-order rows with swatch colours matching the segments, muted zero, re-tap close, swap, keyboard open, pointer no-navigation). Two review findings were actioned: the shared palette helper and a pointer-click no-navigation test; the readout's accessible name now includes the month as well. The one Standards finding — `prd.md`/`README.md` not yet updated — is deliberately deferred to ticket 04 ("doc reconciliation"), which `spec.md` assigns that job and blocks on this ticket.
- Verification: browser-driven via chrome-mcp against the running dev server with the seeded two-pot window (Emergency/Retirement; July 30.000, August 34.000, September 35.000, October 40.000). Confirmed each month's readout total equals its column label and its pot rows sum to it (Jul 10+20, Aug 12+22, Sep 13+22, Oct 15+25); a zero month shows both pots muted at `R$ 0,00`; swatch computed colours equal the segment colours (index 0 sky, index 1 emerald); re-tap closes and a second column swaps without navigating (`location` stayed on `/`); the console held only Vite/React-DevTools info. `npm run lint`, `npx tsc --noEmit`, and the full suite (40 files, 451 tests) pass.

