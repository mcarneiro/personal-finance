# 04 — End-to-end verification and doc reconciliation

**What to build:** The final pass over the increment: drive the finished bar and
tag in a real browser end to end, and reconcile every document the decisions
touched. Docs are part of the change, not a follow-up (AGENTS.md).

The specific drift this increment creates and must fix in the same commit:

- `prd.md`: the Dashboard description gains the composed bar (Payment vs
  Investment, confirmed vs unconfirmed) and the Outflows screen description
  gains the shared card, the row tag and the kind; the ADR-0013 link is present.
- `README.md`: the product summary mentions the outflow kind and the composed
  bar if it enumerates the Dashboard or Outflows.
- `CONTEXT.md`: confirm the Payment and Investment terms landed in ticket 01 and
  read correctly against what shipped.
- `docs/adr/`: confirm ADR-0013 exists and is accurate, and that ADR-0006 and
  ADR-0010 remain consistent with it.

**Blocked by:** 03 — Compose the cash-flow bar from Payments and Investments.

**Status:** ready-for-agent

- [ ] End-to-end via chrome-mcp against the running dev server, with a month holding an Investment and at least one unconfirmed outflow: the bar's slices are proportional and fill the tracked width, the Payment slices are green under income and red over, the Investment slice is teal, the unconfirmed slices are lighter; the row tags mark the right rows on both the Dashboard and the Outflows list; the Outflows page shows the same card with no heading and its Replicate button still works.
- [ ] Privacy Mode masks amounts while the bar keeps its real proportions, and no new amount leaks (there is no legend).
- [ ] Replicating a month carries an Investment as an Investment, and both paid and final reset on the copies.
- [ ] `prd.md`, `README.md`, `CONTEXT.md` and `docs/adr/` are re-read against what shipped; any drift is fixed in this commit.
- [ ] `npm run lint`, `npx tsc --noEmit`, and the full test suite pass.
- [ ] The increment is committed with conventional commit messages and a short `## Comments` note records what changed and what was verified.

## Comments
