# Planoo

Planoo plans and controls household card spending and tracks monthly payment obligations.

## Language

### Card spending control

**Spending Plan**:
A monthly plan of expected card purchases, assigning expected amounts to fixed charges and spending buckets. It is the control instrument for card spending, not a month-level income and outcome plan.
_Avoid_: Budget, CC budget, expense ledger

**Fixed Charge**:
A card charge with a known exact amount that recurs every month, such as a subscription. It is part of the Spending Plan.
_Avoid_: Fixed allocation, bill

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

**Bill**:
A payment obligation tracked for a particular month, including its amount and whether it has been paid. It includes the card bill, a single value originating from the previous month's card spending. It does not belong to a spending bucket.
_Avoid_: Spending bucket, fixed charge, expense
