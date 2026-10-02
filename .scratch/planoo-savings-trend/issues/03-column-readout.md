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

**Status:** ready-for-agent

- [ ] Tapping a column shows a readout with the full month name, the month's Total Saved, and one row per active pot with swatch, name and carried balance.
- [ ] The swatch colour for a pot matches its stacked segment in every column (same palette, same registry index).
- [ ] Tapping the same column again closes the readout; tapping another column replaces it; the default render matches ticket 02's inert chart.
- [ ] A pot with a `0` carried balance that month is listed with a muted `R$ 0,00`, not omitted.
- [ ] The readout never navigates; the section header remains the only navigation affordance.
- [ ] Columns are real buttons: focusable, with an `aria-expanded` state and an accessible name naming the month and its total, so the interaction is reachable by keyboard and screen reader.
- [ ] New i18n keys exist in both locales (e.g. the readout's "Total Saved" line reuses `savings.total`, pot balance rows are self-labelling).
- [ ] Tests (Given/When/Then) cover: a column tap opens the readout with the right month and total; the per-pot rows match the series and the segment colours; re-tapping closes; tapping a second column swaps the readout; a `0`-balance pot shows muted; no navigation occurs on tap.
- [ ] Verified via chrome-mcp: tapping each of a seeded window's columns shows correct totals and breakdowns, colours match the bars, and the readout closes cleanly; console stays clean.
- [ ] `npm run lint`, `npx tsc --noEmit`, and the tests pass.

## Comments
