# Planyoo savings — spec

Tickets live in `issues/`, numbered in dependency order. Each is `ready-for-agent`.

## Problem

The household tracks money set aside (emergency, retirement) outside Planyoo. There is no place to record the balances, so the household cannot see whether a pot is growing month over month. Savings is not spending: a balance is an observed value typed in once a month, not a payment, and it is deliberately independent of the account ledger.

## Decisions

| Decision | Choice | ADR |
| --- | --- | --- |
| Balance shape | One recorded balance per pot per month (history kept), unlike every other overwritten control total | 0011 |
| Balance source | Observed, typed by hand from the real statement — never derived from contributions or withdrawals | 0011 |
| Ledger relationship | Independent of Outflows and Account Net; an investment contribution stays an ordinary Outflow (ADR-0010) | 0011 |
| Missing month | Carry the most recent recorded balance forward, marked as updated in an earlier month; empty means "not checked", never zero | 0011 |
| Registry | Pots are a Settings registry with stable identity; balances are edited inline on the month screen | 0011 |
| Removal | Removing a pot retires it — it stops counting in every month, unlike a removed Payer or Bank | 0011 |
| Navigation | A fourth bottom-nav tab (`/savings/:month`); no top-bar "+" and no record editors | 0004 |
| Derived numbers | Total Saved, and the month-over-month delta shown beneath it — no target, no goal | 0011 |

## Accepted residuals (documented, not bugs)

- Carry-forward can show a stale balance if a pot is never updated; the "last updated <month>" marker is the only signal, deliberately.
- Removing a pot orphans its balance rows in the sheet (blank-in-place is not used, since the rows are the pot's history). Re-adding a pot of the same name gets a fresh id and does not reconnect the old rows.
- A recorded `0` and "no record" are distinct: clearing a field removes that month's record so carry-forward resumes; entering `0` is a real zero.

## Rejected (do not re-litigate)

One overwritten current balance per pot (discards the trend, which is the point); deriving balances from contributions and withdrawals (doubles the work and risks double-counting the same money as both an Outflow and an asset); folding certain Outflows in as internal transfers excluded from Account Net (redefines Account Net for a household whose savings vehicles are already ordinary Outflows); a target amount per pot (adds a field, a progress percentage and warning states beyond the request); a per-month pot list created like Spending Buckets (no stable identity, so carry-forward has nothing to hang on). The month-over-month delta *was* rejected here originally, but is now in scope as a request: it is shown under Total Saved (ADR-0011).

## Domain language

Savings Pot, Savings Balance — see `CONTEXT.md`. A Savings Balance is never an Outflow (ADR-0010) and never touches Account Net.

## Tickets

01 sheet contract + types → 02 savings slice + pure utilities → 03 Settings pot registry; 04 Savings screen and inline check-in → 05 Total Saved + carry-forward display, all branching off 02. 06 tab integration and end-to-end verification depends on 03, 04 and 05.
