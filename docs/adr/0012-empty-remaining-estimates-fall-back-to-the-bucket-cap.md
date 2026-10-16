# An empty Remaining Estimate falls back to a pro-rata of the bucket cap

The weekly check-in asked the household to re-estimate every bucket by hand, so the Projected Result depended on a number nobody had time to refresh — and an unestimated bucket silently counted as zero, which reads as "this bucket is done" rather than "not checked yet". Now a bucket whose Remaining Estimate field is left empty contributes a projected value instead of zero: **its cap spread over the days still to come in the current month** (`cap × remainingFraction`), where "today" counts as already elapsed, exactly as the Dashboard's pace does (ADR-0009). Any recorded non-zero value is the household's own and wins, so manual and projected buckets mix freely, and clearing a field hands the bucket back to the projection. This is the one control-loop input the household can stop typing; the card check-in remains the only manual step.

The projection is therefore `Plan Total × monthProgress − Total Spent` whenever nothing is estimated — the same arithmetic the Dashboard's pace bar already draws, which is why the two screens can no longer disagree in direction. Per-bucket actuals do not exist (ADR-0002), so the cap and the calendar are the only honest inputs a bucket's fallback can use; and because the fallback is a current-month assist, a past month (already elapsed) and a future month (not started) fall back to nothing rather than fabricating history or projecting a month that has not begun.

## Considered alternatives

- **Literal `cap / daysRemaining`** — rejected: the field holds a total still expected until month end, and a per-day rate fed into the projection would read as "we expect only R$ 133 more in this bucket".
- **A tri-state field (`null` = projected, `0` = a recorded zero)** — rejected: every existing bucket is already stored as `0`, so the fallback would do nothing until the household cleared each field once, and it would cost a type change, a sheet-parse change and a cache-contract decision to preserve a deliberate zero that the pro-rata value already subsumes at month end.
- **A per-bucket `auto` column** — rejected: it defaults to true anyway, so it lands in the same place with a column, a sheet-contract bump and a second source of truth to keep in step.
- **A backend/maintenance job writing the values into the sheet** — rejected: derived numbers are computed on the fly and never stored, and a written snapshot would go stale the moment the day rolled over.
- **Freezing the projection at each check-in (weekly)** — rejected: it would need a stored "last check-in" concept the domain has deliberately refused (totals are overwritten, there is no check-in history).

## Consequences

- The Projected Result drifts a little every day with no edit: it is a pure function of today's date. That is visible and intentional — the number that moved is the one the household stopped maintaining.
- A recorded `0` is no longer expressible for the current month; the field cannot be pinned at zero mid-month. The fallback draining to zero on the last day makes the two coincide at the boundary.
- The Dashboard is deliberately unchanged (ADR-0009): it still reads actuals plus pace, and the reasoning behind that ADR — never forecast from estimates the household has not refreshed — is stronger now that the Plan screen's forecast self-heals.
- A bucket with no cap projects nothing, and a month with no plan still hides the whole block.
