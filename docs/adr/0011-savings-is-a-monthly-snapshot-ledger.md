# Savings is an independent, monthly-snapshot ledger

Planyoo tracks **Savings Pots** — named containers of money set aside, such as emergency or retirement — each holding one observed **Savings Balance** per month. Two things here deliberately break with the rest of the app.

First, **savings keeps monthly history**, where every other control total in Planyoo is current-state and overwritten (Card Spending is overwritten at each check-in; ADR-0002). A savings balance is *slow-moving*: the whole point of updating it once a month is to see that Emergency grew from R$ 10.000 to R$ 11.000 while Retirement filled more slowly. That comparison needs both values, so a month's balance is a distinct record (`savings_balances`: `id, month, pot_id, balance`) rather than a field on the pot. This also makes the recorded cadence honest: the sheet itself shows which months were updated and which were skipped.

Second, **savings is independent of Outflows and of Account Net**. An investment contribution is already an Outflow (ADR-0010) — a discrete payment with a payer, a bank, and a paid flag — and it stays exactly that. A Savings Balance is an *observed asset value*, not a payment: it is typed in from the real statement, never derived from contributions or withdrawals, and no pot is linked to an Outflow. So Account Net stays `income − outflows` (a cash-flow number) and savings gets its own derived **Total Saved**, computed as the sum of the active pots' balances carried forward from the most recent recorded month. The household's net worth is deliberately not a single number here.

Supporting decisions:

- **Carry-forward, not zero.** A pot with no balance recorded in a month displays its most recent recorded balance, marked as updated in an earlier month. A missing entry means "not checked yet", never "lost all the money". An explicit `0` is a recorded zero; emptying a field clears that month's record so carry-forward resumes.
- **Pots are a registry, balances are inline.** Pots are managed in Settings as a registry (add / rename / remove), exactly like Payers and Banks, so a pot keeps one stable identity across months and renaming it flows through by id. The Savings screen edits the browsed month's balances inline, the same check-in pattern as card totals and remaining estimates.
- **Removing a pot retires it.** A removed pot stops appearing and stops counting in every month, unlike a removed Payer or Bank, which still renders and still counts because removing it must not change past outflow totals. Here the pot *is* the record, so retiring it is the intent; its balance rows are left in the sheet but no longer shown, and re-adding a pot of the same name is a fresh identity.

## Considered options

- **One current balance per pot, overwritten** — rejected; it makes "monthly" incidental and discards the trend, which is the feature's motivation.
- **Deriving balances from contributions and withdrawals** — rejected; it doubles the monthly work, couples savings to the investment Outflow, and risks counting the same money as both a payment and an asset.
- **Folding certain Outflows into savings as internal transfers, excluded from Account Net** — rejected for now; it redefines Account Net and links outflows to pots for a household whose both savings vehicles are already recorded as ordinary outflows. Kept as a future direction, not a V2 one.
- **A target amount per pot** — rejected for now; it adds a field, a derived progress percentage, and warning states. The balance alone is the requested feature.
