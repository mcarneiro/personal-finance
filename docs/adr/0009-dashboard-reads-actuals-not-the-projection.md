# The Dashboard reads actuals, not the projection

The Dashboard at `/` is the current-month home screen. For the same month the Spending Plan screen (`/plan/:month`) headlines the **Projected Result** — Plan Total − Total Spent − Σ Remaining Estimates. The Dashboard deliberately does not: its plan block shows only Plan Total and Total Spent (the raw **Plan Result**, Plan Total − Total Spent) with a bar filled to spend-over-plan and coloured by pace. The home screen is a glance at money actually spent, not a forecast that depends on Remaining Estimates the household has not refreshed. The forward-looking signal is the pace instead: the bar turns yellow when spend runs more than a quarter of the plan ahead of how far through the month we are (naming the headroom that is still available), and red once Total Spent passes Plan Total (naming the overage).

## Considered alternatives

- **Headline the Projected Result like the Plan screen**: rejected — the Dashboard would inherit the stale-estimate risk the Plan screen already documents, and could read "under plan" while the household has in fact already overspent the plan. That is the opposite of a trustworthy home glance.
- **Show both the Projected Result and the raw Plan Result**: rejected — two similar-looking numbers with different meanings on one small screen is exactly the confusion the glossary warns about (Projected Result vs Plan Result).

## Consequences

- The Dashboard and `/plan/:month` can disagree for the current month: the Plan headlines the projection, the Dashboard the raw plan result. This is intentional, and this ADR is the explanation. Past months are unaffected — the Dashboard is current-month only, and past months already headline the final Plan Result on the Plan screen.
- The pace threshold is a quarter of the plan (25 percentage points ahead of the month). Check-ins happen roughly weekly, so a month's spend moves in ~25% steps and the two are always out of phase by up to a quarter; a tighter margin would flag every normal week.
