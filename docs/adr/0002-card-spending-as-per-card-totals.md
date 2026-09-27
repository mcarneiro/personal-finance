# Card spending is tracked as running totals, not purchases

The app records card spending as manually updated running totals per card per month — not as individual purchases — and buckets are controlled through editable Remaining Estimates, never through recorded per-bucket actuals. Cards are payment vehicles and the input mechanism for gathering the month's Total Spent; they are not control objects.

We rejected individual purchase entries and bucket-level increments because this is a plan-control instrument, not a ledger or analytics tool: the questions it answers are "did the month stay inside the plan, and by how much" and "where is the month projected to land". The card statement remains the source of truth for what was charged, so installments, fees and refunds never need modeling. Purchase history, charts, and per-bucket actuals are deliberate non-goals — not missing features.
