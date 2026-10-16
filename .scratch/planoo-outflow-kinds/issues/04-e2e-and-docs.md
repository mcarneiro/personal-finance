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

**Status:** done

- [x] End-to-end via chrome-mcp against the running dev server, with a month holding an Investment and at least one unconfirmed outflow: the bar's slices are proportional and fill the tracked width, the Payment slices are green under income and red over, the Investment slice is teal, the unconfirmed slices are lighter; the row tags mark the right rows on both the Dashboard and the Outflows list; the Outflows page shows the same card with no heading and its Replicate button still works.
- [x] Privacy Mode masks amounts while the bar keeps its real proportions, and no new amount leaks (there is no legend).
- [x] Replicating a month carries an Investment as an Investment, and both paid and final reset on the copies.
- [x] `prd.md`, `README.md`, `CONTEXT.md` and `docs/adr/` are re-read against what shipped; any drift is fixed in this commit.
- [x] `npm run lint`, `npx tsc --noEmit`, and the full test suite pass.
- [x] The increment is committed with conventional commit messages and a short `## Comments` note records what changed and what was verified.

## Comments

Final verification pass plus doc reconciliation for the outflow-kinds increment.
No application code changed in this ticket.

Verified in the real browser (chrome-mcp, dev server on `localhost:5173`, the
real October ledger). Test data was clearly named and removed exactly:

- **Bar composition.** With a confirmed Payment, a confirmed Investment, an
  unconfirmed Investment plus the month's existing unconfirmed Payments, both
  `/` and `/outflows/2026-10` drew the four slices in the fixed order —
  confirmed Payments, unconfirmed Payments, confirmed Investments, unconfirmed
  Investments — each at its share of the Outflows Total (each R$ 2.000,00 of
  R$ 60.191,52 ≈ 3,3%, the unconfirmed Payments ≈ 90%), inside an 89% fill; the
  slices summed to the full drawn bar and the `aria-label` named the
  composition. No visible legend.
- **Colours.** Under income the Payments were `bg-green-500` / lighter
  `bg-green-300` and the Investments teal `bg-teal-500` / lighter `bg-teal-300`.
  Adding a R$ 25.000,00 Payment pushed the month over income: the same bar
  filled to 100%, the Payment slices turned `bg-red-600` / `bg-red-300`, the
  Investments stayed teal, and the Dashboard's over-income caption read
  "R$ 17.518,52 acima da renda".
- **Row tags.** The two Investment rows carried the teal Investment tag (the
  unconfirmed one also the ⚠️) on the Outflows list and the Dashboard's
  open-outflows list; the Payment rows carried none.
- **Shared card.** The Dashboard showed the "Renda e saídas" heading; the
  Outflows page rendered the identical card with no heading and no over-income
  caption, Income first then Outflows then Account Net.
- **Privacy Mode.** The eye replaced Income, Outflows and Account Net with
  `R$ ••••` while the fill and every slice width stayed byte-identical
  (proportions real); with no legend, no amount leaked.
- **Replicate.** From a controlled empty pair (2026-12 → 2027-01, chosen over
  flooding the household's November ledger with its 36 rows) the Replicate
  button on the empty month seeded both source rows; the Investment copy
  arrived as an Investment (tag) and both copies reset to unpaid and not final
  (⚠️, "Em aberto"), persisting across a reload.
- Console clean (only the Vite/React dev messages).

Test data added and removed exactly: four current-month outflows
("TEST payment final", "TEST investment final", "TEST investment open",
"TEST payment over") and the two-row replicate pair ("TEST replicate
investment", "TEST replicate paid"). After cleanup the ledger is back to its
original per-month counts (Jan–Oct 2026 unchanged, no TEST rows, no
Investments). Note: the debounced write-back is 1 s, so a navigation before it
flushes drops the in-memory Pending Change — a documented behaviour, not a
product bug; I waited out the debounce between edits.

Docs reconciled in this commit:

- `prd.md` — the Dashboard's Income/Outflows block now describes the composed
  bar (four confirmed/unconfirmed Payment/Investment slices, the colours, no
  legend); the Outflows section leads with the shared cash-flow card (income
  first, no heading, no over-income caption); the replicate bullet lists the
  carried kind; the Data Model entry and Key Screens already/matched. ADR-0013
  was already linked.
- `README.md` — the Dashboard summary now names the composed income-vs-outflows
  bar (Payments and Investments, confirmed and unconfirmed).
- `CONTEXT.md` — Payment and Investment read correctly against what shipped;
  Outflow already names its kind and has dropped `payment` from `_Avoid_`; no
  change needed.
- `docs/adr/` — ADR-0013 exists and is accurate; its "the kind feeds the …
  bar" sentence now says the shared bar (Dashboard and Outflows). ADR-0006
  (display-only marker + additive header-rewrite migration) and ADR-0010 (the
  hierarchy re-litigated and resolved by 0013) remain consistent; no other
  edits.

`npm run lint` and `npx tsc --noEmit` are clean; the full suite passes (536
tests). No tokens, secrets or spreadsheet ids recorded.

## Code review

Two-axis review of the `git diff b6b18ee` (docs-only) by two parallel
sub-agents:
- Standards: no hard violations; the doc claims match `CashFlowCard.tsx`. Left
  as judgement calls: "confirmed/unconfirmed" alongside the glossary's **Final
  Value** (the spec and the UI labels use "confirmado/não confirmado", so it is
  accepted style), the doc-level repetition of the bar description across
  README/prd, and "cash-flow card" staying out of `CONTEXT.md` (a UI component,
  not a domain concept).
- Spec: two accuracy fixes actioned — the Key Screens Outflows entry no longer
  places the Replicate button "below the card" (it is a child of the card, under
  the numbers), and "the Dashboard's cash-flow bar" became "the shared
  cash-flow bar" in `prd.md` and ADR-0013 since the card now renders on both
  screens. A capitalisation nit (`account net` → **Account Net**) fixed.
