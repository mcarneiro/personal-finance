# Plan items are spending buckets, not fixed charges

The Spending Plan no longer distinguishes two kinds of item. A plan item is always a **spending bucket**: a name, a cap, and an editable Remaining Estimate. `PlanItem.kind` is gone from the domain model, and the `plan` sheet tab loses its `kind` column (now `id, month, name, amount, remaining_estimate`).

Fixed charges — subscriptions, utilities and other recurring known amounts — are payment obligations, which the app already tracks as **Bills** (with payer, bank and paid status). Keeping a second, plan-side copy added a kind distinction that carried no control value and let the same obligation count twice against a plan that is meant to be a *card-spending* instrument. With the split removed, Plan Total is simply Σ bucket caps, and the control loop is otherwise unchanged: Projected Result = Plan Total − Total Spent − Σ remaining estimates.

Because the `plan` tab is rewritten wholesale on every mutation, dropping a column would normally shift every existing row one cell left and corrupt the read. Initialization therefore detects the legacy six-column header and, once, rewrites each row without its `kind` cell before the header is re-headed; the former fixed charges survive as ordinary buckets, so historical plan totals and the June 2026 worked example are preserved rather than re-seeded.
