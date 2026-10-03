# Planyoo

Planyoo plans and controls household card spending and tracks monthly income and outflows.

## Language

### Card spending control

**Spending Plan**:
A monthly plan of expected card purchases, assigning expected amounts to spending buckets. It is the control instrument for card spending, not a month-level income and outcome plan.
_Avoid_: Budget, CC budget, expense ledger

**Spending Bucket**:
A named cap for variable card spending, such as market and pharmacy. Buckets are the control objects of the plan; cards are not.
_Avoid_: Envelope, category

**Card**:
A named credit card used to pay for spending. Cards are the input mechanism for gathering what was spent, not control objects.
_Avoid_: Account, statement

**Card Spending**:
The current total charged to one card so far this month, updated at each check-in.
_Avoid_: Purchase list, credit-card bill, statement balance

**Total Spent**:
The sum of all Card Spending totals in a month. It is the actual side compared against the Spending Plan.
_Avoid_: Gastos, card total

**Remaining Estimate**:
An editable estimate of what is still expected to be spent in a spending bucket until the end of the month.
_Avoid_: Previsão, forecast, prediction

**Projected Result**:
The Spending Plan total minus Total Spent minus all Remaining Estimates. It is the live expectation of the Plan Result.
_Avoid_: Sobra, projection, forecast

**Plan Result**:
The signed difference between the Spending Plan total and the Total Spent of a month. Positive means the month stayed inside the plan.
_Avoid_: Variance, balance, forecast

### Account ledger

**Income Entry**:
An amount of money expected to arrive during a month, recorded with an optional source note. It represents expectation, not receipt.
_Avoid_: Salary, revenue, income record

**Outflow**:
A single expected payment out of a household account during a month — a utility bill, an investment contribution or a maintenance cost — including its amount, whether its value is **Final Value**, who pays it (**Payer**), which **Bank** it is paid from, and whether it has been paid. It includes the card bill, a single value originating from the previous month's card spending. It does not belong to a spending bucket, and it is never **Card Spending**.
_Avoid_: Bill, expense, payment, obligation, spending bucket

**Final Value**:
The flag marking an Outflow's amount as confirmed for the month. An Outflow starts — and every replicated copy arrives — without it, so variable amounts are flagged for review until someone confirms them. Outflows without it are shown with a warning and, while open, follow the confirmed ones; paid outflows sink to the end of the list. It is a workflow marker only and never changes a total.
_Avoid_: Confirmed value, locked, settled, paid

**Payer**:
A named household member responsible for paying an Outflow. Payers form a registry the household maintains in Settings; an Outflow references one by id, so renaming a payer flows through to its outflows.
_Avoid_: Owner, user, cardholder, responsible

**Bank**:
A named account an Outflow is paid from. Banks form a registry the household maintains in Settings; an Outflow references one by id, so renaming a bank flows through to its outflows.
_Avoid_: Account, card, credit card

**Remaining to Pay**:
The part of a month's Outflows that is still open (not paid), shown per Payer and Bank in the by-payer summary. It is a display view only — a device-remembered toggle that swaps the summary's values between the full total and this remainder — and never changes an Outflow or a total.
_Avoid_: Outstanding balance, amount due, debt

### Savings

**Savings Pot**:
A named container of money a household sets aside, such as emergency or retirement. Its balance is observed and recorded once a month.
_Avoid_: Category, envelope, fund, account, bucket

**Savings Balance**:
The observed balance of one Savings Pot in one month, typed in by hand from the real account or statement. It is never derived from contributions or withdrawals, and it is not linked to an Outflow.
_Avoid_: Deposit, contribution, transfer, amount saved

### Months

**Month**:
The YYYY-MM period every Spending Plan, Card Spending, Outflow, Income Entry, and Savings Balance belongs to. It is the unit of navigation and the period a Plan Result is computed over. The month being browsed is **shared** across the Plan, Outflows, Income and Savings screens, so switching tabs keeps it; going back to the current-month Dashboard resets it.
_Avoid_: Billing cycle, period, month key

### Household collaboration

**Working Copy**:
The snapshot of the household's data one device holds between refreshes, together with its Pending Changes. The sheet remains the source of truth; a Working Copy is only ever a cache.
_Avoid_: Session, local state, offline copy

**Pending Change**:
A member's edit not yet written to the sheet. It survives a failed write and is retried on the next save or refresh, always winning over the sheet's value.
_Avoid_: Draft, unsaved edit, dirty row

**Lost Update**:
A member's written change silently overwritten by a save made from a stale Working Copy. The save protocol exists to prevent this.
_Avoid_: Overwrite, conflict, race
