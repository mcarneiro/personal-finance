# 04 — End-to-end verification and doc reconciliation

**What to build:** The final pass over the whole increment: drive the finished
chart in a real browser end to end, and reconcile every document the decisions
touched. Docs are part of the change, not a follow-up (AGENTS.md).

The specific drift this increment creates and must fix in the same commit:

- `prd.md` line ~109 still says *"Recharts not needed (no charts — the
  Dashboard's bars are plain CSS)"*. The trend is a chart (plain CSS, still no
  library), so the sentence must be rewritten to say so rather than left false.
- `prd.md`'s Dashboard section (~line 90) lists three blocks; add the savings
  trend as the fourth and last block with its window, carry-forward, hidden
  states and tap readout.
- `prd.md`'s Savings section (~line 103) says *"No target, no goal, no
  month-over-month delta"* — still true of the screen's numbers, but the
  Dashboard now shows a month-over-month view, so the sentence needs a pointer
  so it is not read as a contradiction.
- `README.md` product summary: mention the 12-month savings trend on the
  Dashboard if the summary enumerates Dashboard features.
- `CONTEXT.md`: confirmed **no new term** — verify nothing was accidentally
  added and leave the glossary alone.
- No ADR (agreed): confirm none is warranted and do not add one.

Seed the sheet by hand if needed (the household's operating note from the
grilling: no in-app backfill).

**Blocked by:** 03 — Tap a column for the month readout.

**Status:** done

- [x] End-to-end via chrome-mcp against the running dev server, seeded with several months of balances across two pots: the 12-month window renders newest on the right; bar heights are proportional and the tallest is full height; a pot's colour is constant across months; a carried month matches its source month; tapping a column shows the right total and breakdown; the section hides when the registry is emptied; the header opens `/savings/<current month>`; the console stays clean.
- [x] A retired pot leaves the chart and the current month's stack still equals the Savings screen's Total Saved for that month.
- [x] `prd.md`, `README.md`, `CONTEXT.md` and ADR-0011 are re-read against what actually shipped; any drift (including the four items above) is fixed in this commit.
- [x] Confirmed no ADR was added and `CONTEXT.md` gained no term.
- [x] `npm run lint`, `npx tsc --noEmit`, and the full test suite pass.
- [x] The whole increment is committed with conventional commit messages and a short `## Comments` note records what changed and what was verified.

## Comments

Doc reconciliation for the savings-trend increment, plus the end-to-end browser pass over the finished chart. No code changed.

Docs updated (drift fixed in this commit):
- `prd.md` Tech Stack line: the "Recharts not needed (no charts …)" sentence is rewritten — the Dashboard's 12-month savings trend is a chart, but plain CSS/flex stacked bars, still no library.
- `prd.md` Dashboard section: added the **Savings trend block** as the fourth and last block, with window (rolling 12 months, newest at the right, zero-filled), carry-forward, retired pots excluded, zero-based scaling, hidden states, the tap readout (total + per-pot breakdown, display-only), and the header link to `/savings/<current month>`.
- `prd.md` Savings section: the "no month-over-month delta" line now points at the Dashboard's trend as the read-only month-over-month view, so the two sections no longer read as a contradiction.
- `prd.md` Solution summary, Key Screens (Dashboard) and Out of Scope ("Charts, YoY, analytics of any kind" → "Other charts, YoY, and analytics beyond the Dashboard's 12-month savings trend") reconciled with what shipped.
- `README.md` product summary: the Dashboard sentence now names the rolling 12-month savings trend chart and its tap breakdown.
- `CONTEXT.md`: re-read; no new term was added (the chart is a view over Savings Pot, Savings Balance, Total Saved, Month) — left as-is.
- `docs/adr/`: re-read; no ADR added (a cheaply reversible presentation choice over data ADR-0011 already defines), as agreed.

End-to-end via chrome-mcp against `http://localhost:5173/` with the sheet seeded by hand (July 30.000, August 34.000, September 35.000 carried, October 40.000; Emergency/Retirement):
- 12 columns oldest-first Nov 2025 → Oct 2026, newest at the right; heights 0/…/75%, 85%, 87.5%, 100% — proportional, tallest full height.
- Pot colour constant across months (index 0 `bg-sky-500` Emergency, index 1 `bg-emerald-500` Retirement), computed backgrounds identical to the readout swatches.
- Carry-forward: September's Retirement read "Updated in August 2026" carrying 22.000; the Sept column (35.000) equalled the Savings screen's Total Saved for 2026-09; the Oct column (40.000) equalled the screen for 2026-10.
- Tap readout: July showed total R$ 30.000 with Emergency 10.000 + Retirement 20.000; tapping October swapped to 40.000 (15.000 + 25.000) without navigating (`location` stayed `/`); a zero month listed both pots muted at R$ 0,00; re-tap closed the readout (`aria-expanded` false).
- Header navigated to `/savings/2026-10`.
- Retired-pot check: removed Retirement in Settings — its segment vanished and the current-month stack dropped to the active pot only (15.000), equal to the Savings screen's Total Saved for October; re-added both pots and re-recorded the four months afterwards.
- Hidden state: emptied the registry in Settings — the whole "Savings trend" region disappeared from the Dashboard.
- Console clean throughout (only Vite connect and the React DevTools notice).

Note: the sheet was restored to its pre-grilling shape by re-adding both pots (new ids) and re-recording 2026-07..2026-10, because a removed pot is retired by design and its orphaned rows are not reconnected. `npm run lint`, `npx tsc --noEmit`, and the full suite (40 files, 451 tests) all pass.
