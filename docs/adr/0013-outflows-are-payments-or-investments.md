# Outflows are Payments or Investments

An Outflow carries a kind: a **Payment** (the default — money that leaves the household) or an **Investment** (money moved into an asset the household keeps). The kind is a boolean `isInvestment` on the record and an `is_investment` column (TRUE/FALSE) in the `outflows` tab, set by an **Investment** checkbox in the outflow form on both add and edit, and shown as a small **Investment** tag on each row — on the Outflows list and on the Dashboard's open-outflows list alike. It is display-only: Outflows Total, Account Net and the by-payer summary are unchanged, exactly as ADR-0006's final-value flag changes no total. A replicated outflow carries its kind, unlike `isFinal`, which resets: a recurring contribution stays an Investment because the kind says what the outflow is, not last month's workflow state.

This is a category the ledger was previously denied. ADR-0010 rejected a Bill/Investment/Maintenance hierarchy on the grounds that "no behaviour differs between them". That reasoning no longer holds: the kind feeds the Dashboard's cash-flow bar, which aggregates the month's money into Payments and Investments so a month that was mostly moved can be told apart from a month that was spent. The category is admitted at the smallest scope that makes the behaviour differ — two kinds, one boolean, no enum column, no hierarchy.

Extending the `outflows` tab is additive and uses the established header-rewrite migration (prd.md "Sheet Initialization"): an existing sheet gains the column on its header row, the sheet-contract version bumps so every cached Working Copy is invalidated, and rows read back as Payments until written again.

## Considered options

- **Excluding Investments from Outflows Total and Account Net** — rejected: the bar is the account's cash flow, and forking the ledger maths would make the Outflows screen disagree with the sheet.
- **An enum `kind` column instead of a boolean** — rejected: two values need a boolean, and a boolean keeps the migration, the parse and the blank-is-Payment default trivial.
- **Naming the pair Spend/Expense** — rejected: "spending" is reserved for Card Spending (ADR-0002), the exact seam ADR-0010 warns about.
- **A Bill/Investment/Maintenance hierarchy** — rejected again (ADR-0010): only two kinds, and only because behaviour now differs.
- **Linking an Investment to a Savings Pot** — rejected (ADR-0011): a Savings Balance is an observed value, deliberately independent of the ledger.
- **A visible legend for the kind colours** — rejected: the row tags and the bar's accessible label carry the meaning without another element.

## Consequences

- Investments still count in Outflows Total and Account Net, so the cash-flow bar can reach red on money that was moved, not consumed. Accepted.
- The list filter and the by-payer summary are untouched by the kind — nothing is filtered or grouped by it in V1.
- A legacy row, and every row in an existing sheet until it is written again, reads as a Payment.
