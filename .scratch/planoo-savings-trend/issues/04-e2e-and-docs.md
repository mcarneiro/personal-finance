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

**Status:** ready-for-agent

- [ ] End-to-end via chrome-mcp against the running dev server, seeded with several months of balances across two pots: the 12-month window renders newest on the right; bar heights are proportional and the tallest is full height; a pot's colour is constant across months; a carried month matches its source month; tapping a column shows the right total and breakdown; the section hides when the registry is emptied; the header opens `/savings/<current month>`; the console stays clean.
- [ ] A retired pot leaves the chart and the current month's stack still equals the Savings screen's Total Saved for that month.
- [ ] `prd.md`, `README.md`, `CONTEXT.md` and ADR-0011 are re-read against what actually shipped; any drift (including the four items above) is fixed in this commit.
- [ ] Confirmed no ADR was added and `CONTEXT.md` gained no term.
- [ ] `npm run lint`, `npx tsc --noEmit`, and the full test suite pass.
- [ ] The whole increment is committed with conventional commit messages and a short `## Comments` note records what changed and what was verified.

## Comments
