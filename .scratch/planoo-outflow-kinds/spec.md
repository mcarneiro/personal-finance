# Planyoo outflow kinds — spec

A domain-and-visualisation increment on the shipped Outflows ledger and the
Dashboard cash-flow card. Tickets live in `issues/`, numbered in dependency
order. Each is `ready-for-agent`.

## Problem

The household's Outflows ledger mixes two different things: money that leaves
the house, and an investment contribution that moves money into an asset they
keep. On the Dashboard, the cash-flow bar shows only a single "Outflows Total",
so a month that was mostly invested looks the same as a month that was spent.
The bar also cannot tell a confirmed amount from one still awaiting this month's
real value. The household wants to see, at a glance, how much of the month's
money was a Payment versus an Investment, and how much of it is still
unconfirmed.

## Decisions (agreed in a `/grill-with-docs` session)

| Decision | Choice |
| --- | --- |
| Concept | An Outflow carries a kind: **Payment** (default) or **Investment** |
| Storage | A boolean `isInvestment` on `Outflow`; sheet column `is_investment` (TRUE/FALSE); a blank / legacy cell reads as Payment |
| Effect on totals | None — display only. Outflows Total, Account Net and the by-payer summary are unchanged; the flag is a marker, like `isFinal` (ADR-0006) |
| Replication | Copies with the outflow (a recurring contribution stays an Investment); unlike `isFinal`, which resets |
| Where it is set | An **Investment** checkbox in `OutflowForm`, on both add and edit |
| Row marker | A small **Investment** tag on each row, on both the Outflows list and the Dashboard's open-outflows list, beside the ⚠️ not-final flag |
| Bar composition | The fill's width stays `min(1, Outflows / Income)`; within it, up to four aggregated slices in a fixed order: confirmed Payments, unconfirmed Payments, confirmed Investments, unconfirmed Investments |
| Bar colours | Payments green, red when the month is over income; Investments teal; an unconfirmed slice is a lighter tint of its colour |
| Bar legend | None — the row tags and the accessible label carry the meaning |
| Shared card | One `CashFlowCard` renders the block on both the Dashboard and the Outflows page; the heading shows only on the Dashboard |
| Outflows page | Adopts the card (Income first, then Outflows, bar, Account Net); the Replicate-last-month button and copy notices sit below it; the over-income caption is dropped there |
| Migration | An additive column via the established header-rewrite (ADR-0006; prd.md "Sheet Initialization"); the sheet contract version bumps and every cached Working Copy is invalidated — no manual step |
| Domain language | New `CONTEXT.md` terms **Payment** and **Investment**; the Outflow entry names its kind; `payment` leaves Outflow's `_Avoid_` list (it now names a kind) |
| ADR | ADR-0013 — the kind, its display-only rule, its replication, and why a category is allowed where ADR-0010 rejected a hierarchy |

## Accepted residuals (documented, not bugs)

- There is no legend: a first-time reader infers teal = Investment from the row
  tags and the accessible label.
- "Unconfirmed" rides on a lighter tint alone, so a very short slice can read as
  a shade difference rather than a state.
- Investments still count in Outflows Total and Account Net, so the bar can
  reach red on money that was moved, not consumed.
- The Outflows page's lead number changes from Outflows Total to Income,
  adopting the Dashboard's order.
- A legacy row, and every row in an existing sheet until it is written again,
  reads as a Payment.
- The by-payer summary and the list filter are untouched by the kind.

## Rejected (do not re-litigate)

Excluding investments from Outflows Total / Account Net (the bar would stop
being the account's cash flow and the ledger maths would fork); naming the pair
Spend/Expense (collides with Card Spending — the exact seam ADR-0010 warns
about); a Bill/Investment/Maintenance hierarchy (ADR-0010 — only two kinds, and
only because behaviour now differs); an enum `kind` column instead of the
boolean; filtering the list by kind; splitting the by-payer summary by kind; a
visible legend; one bar slice per outflow; a separate "outflow mix" element
beside an unchanged cash-flow bar; colour = under/over income (superseded —
colour now means kind); linking an Investment to a Savings Pot (ADR-0011 keeps
savings independent).

## Domain language

Payment, Investment, Outflow, Final Value, Account Net — see `CONTEXT.md`. The
kind never changes a derived number, so no control-loop term moves.

## Tickets

01 Outflows carry a Payment/Investment kind (domain, sheet, form, rows) → 02
extract the shared cash-flow card and adopt it on the Outflows page (prefactor)
→ 03 compose the bar from Payments and Investments → 04 end-to-end verification
and doc reconciliation. 01 and 02 are independent and can run in parallel; 03
needs both; 04 is last.
