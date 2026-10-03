# (PRD) Planyoo — Household Card Spending Planner

## Overview

### Problem Statement
Currently planning household card spending in a Google Sheets spreadsheet with ~weekly check-ins:

- Per-card running totals written down manually (`cc guta`, `cc uv`, `cc ml` → total)
- Per-bucket "previsão" (remaining-spend estimates until month end) re-estimated by hand
- A `budget (sobra)` column computed manually: plan − spent so far − estimated remaining

While the sheet works, it has limitations:

- The sobra arithmetic is manual and repeated every check-in
- No paid-status tracking for monthly outflows
- No income view, so account-level net is invisible
- Savings pots (emergency, retirement) live outside the sheet, with no place to record their monthly balances
- Poor UX for the weekly control loop on mobile

### Solution
A React app using Google Sheets as the database (same foundation as Stayoo) that digitizes the control loop:

- Spending Plan: spending buckets with caps
- Weekly card check-ins: per-card running totals → Total Spent
- Remaining Estimates per bucket → live Projected Result (the sobra)
- Outflows with paid control, payer and bank, income entries, and the account net
- Savings pots with a hand-updated monthly balance each, a Total Saved, and a 12-month savings trend on the Dashboard

## Goals

### Primary Goals
1. Digitize the card-spending control loop — check-in, re-estimate, see the sobra
2. Show the Projected Result live: over-plan warnings mid-month, final Plan Result month-by-month
3. Track outflows (including card bills) with paid status, payer and bank, and see outflows by payer
4. Track expected income and the account net
5. Track savings pots month by month, so the household can see each one's balance move across months

### Secondary Goals
1. Keep Google Sheets as the single source of truth
2. Reuse Stayoo's proven foundation (OAuth, sync, onboarding, conventions) wholesale

## User Personas

### Primary User: Household Planner
- Runs multiple credit cards and centralizes all possible expenses on them
- Checks card apps ~weekly, writes down each card's running total
- Re-estimates remaining spend per bucket (mercado/farmácia, transporte, restaurante, compras, contas) until month end
- Wants to know: "will we stay inside the plan?" mid-month, and "did we?" at month end — month by month

## Features

### P0 Features (MVP)

#### 1. Onboarding & Configuration
- **Google Sheet Setup**: one-time onboarding identical to Stayoo's (sheet URL, OAuth, auto-create missing tabs with headers)
- **Settings**: manage the card, bank, payer and savings-pot registries (add / rename / remove) plus the connected sheet. Opened from the Dashboard top bar as a full-screen page. No other settings exist in V1.

#### 2. Google Sheets Integration
- **Authentication**: Google OAuth (same client-ID flow and `.env` as Stayoo)
- **Data Sync**: startup paints instantly from a per-sheet **Working Copy** cache (keyed by spreadsheet id, stamped with the sheet contract version) instead of gating behind the network; a background pull then reads every tab — headers and data — in one batched request, merging fresh rows and replaying local **Pending Changes**. A pull also runs on window focus (throttled ~30 s). When the cache is stamped against the current sheet contract the header checks are skipped; otherwise they run batched, and a cache stamped for another sheet or contract is never reused. A failed pull keeps the last-saved data and shows an "offline — showing last saved data" hint rather than an empty app; a first-ever connect (no cache) still shows the loading gate. Writes are **row-scoped by id** (ADR-0008): a save re-reads the affected tabs' id column in one request and updates only the changed rows in one batched request — new records append at the tab's end, deletes blank their row in place, and untouched rows are never rewritten. On a same-row collision the local Pending Change wins; a save whose write fails keeps its Pending Changes, which retry on the next save or pull. Every successful pull and push refreshes the cache, and writes go back through the same debounced sync middleware pattern (`useDataSync.ts` + `syncListener.ts` ported from Stayoo)

#### 3. Month Navigation
- Month-scoped routes (`/plan/:month`, `/outflows/:month`, `/income/:month`, `/savings/:month`) with prev/next navigation (Stayoo pattern)
- The browsed month is **shared across the four tabs**: navigating to a month on any one screen sets the month the others open on (browse September on Outflows, and Plan, Income and Savings open on September too). It is session navigation state only, reset to the current month on a fresh load; the Dashboard stays current-month only

#### 4. Income Management
**Route:** `/income/:month`
- Income entries: amount + optional source note. Receipt is not tracked.
- Add via the top-bar "+" and tap a row to edit both on a **full-screen editor** (`/income/new/:month`, `/income/edit/:id`); delete lives on the editor behind a confirmation modal, never inline in the list
- Total shown; replicate-last-month button for the recurring salary (it re-reads the target month first and refuses with a message when it is no longer empty, so two members cannot double-replicate — ADR-0008)
- Account net (income − outflows) is surfaced on the Outflows screen

#### 5. Outflows Management
**Route:** `/outflows/:month`
- Outflows: add (name, amount, payer, bank, final value), toggle paid, edit, delete — no auto-generation (the card bill is entered by hand). Add via the top-bar "+" and tap a row to edit both on a **full-screen editor** (`/outflows/new/:month`, `/outflows/edit/:id`); delete lives on the editor behind a confirmation modal, never inline in the list. The list reads **open outflows first, then paid**; among the open, **final values first, then outflows still awaiting one**, each group **alphabetical by name** — the paid group is a single tier sorted alphabetically, final status no longer mattering once settled. A **replicate-last-month button** seeds an empty month from last month's outflows; copies carry name, amount, payer and bank, but always arrive **unpaid and not final** (ADR-0003). The copy re-reads the target month from the sheet first and, if it is no longer empty, copies nothing and says so — so two members cannot double-replicate (ADR-0008)
- **Final value**: each outflow carries a **Final value** flag, set on the editor (unset by default). It marks the amount as confirmed for the month. Outflows whose value is not final are flagged with a ⚠️ before their name and, while open, follow the confirmed ones, so the variable amounts that still need updating after a replicate sit behind the confirmed open obligations and above nothing but paid rows. The flag is a workflow marker only — it never changes a total (ADR-0006)
- **Payer and bank are required**: every outflow records who pays it and which registered bank it is paid from; unset or since-removed references still render and still count. When the payer or bank registry is empty, the Outflows list and the editor show a highlighted callout with a shortcut straight to Settings instead of an unusable form
- **Card bill**: entered by hand as a regular outflow when the statement arrives; its amount is the real statement value (covers the previous month's card spending). Installments, fees and refunds are absorbed by the statement value — never modeled
- Shows: outflows total, a clickable **income total** that opens the same month on the Income screen, **account net** = income − outflows, and a **by-payer summary** (per payer, broken down by bank). The summary sits below the totals and above the outflows and is **collapsed by default**, expanding on tap — its expanded/collapsed state is remembered on the device. A small toggle inside the summary — remembered on the device — swaps each payer's and each bank's value from the full total to the **amount still to pay** (that payer's or bank's open outflows)
- **Filter by payer and bank (front-end only)**: a small filter icon sits between the by-payer summary and the outflows list and opens a **right-side drawer** of checkboxes — one per payer and per bank that has outflows in the browsed month. Selections are OR-ed within a facet and AND-ed across facets (e.g. Guta + Itaú, Nubank), so any combination is expressible. The filter narrows **only the outflow list**; the totals, account net and by-payer summary always keep the full month. The applied filters are spelled out in small stacked lines to the left of the icon (one per facet) so the list is never silently narrowed, with an active-count badge, a clear action, and an empty-match message. The selection is a device preference remembered on the device, so it is restored on the next visit (including after switching months); only an explicit clear removes it

#### 6. Spending Plan (the core)
**Route:** `/plan/:month`
- **Plan composition**: spending buckets (name + cap). User-defined names. Add via the top-bar "+" and tap a row's name/amount to edit both on a **full-screen editor** (`/plan/new/:month`, `/plan/edit/:id`); delete lives on the editor behind a confirmation modal, while the remaining-estimate check-in stays inline on the list
- **Copy-last-month button**: one tap seeds the new month's plan from last month's; then edit freely (does not copy remaining estimates or card totals — those start at zero). The copy re-reads the target month from the sheet first and, if it is no longer empty, copies nothing and says so — so two members cannot double-replicate (ADR-0008)
- **Card check-in**: one editable current total per card; Total Spent = sum. Totals are current-state — overwritten at each check-in, no snapshot history in V1
- **Remaining Estimates**: one editable estimate per bucket ("still expected until month end")
- **Projected Result**: plan total − Total Spent − Σ remaining estimates — the live sobra, green when positive, red when negative
- When the estimates are zero the projection **is** the final Plan Result; for past months the Plan Result is the headline

#### 7. Dashboard (home)
**Route:** `/`
- The **current month only**, with no month navigation — history review stays on the month-scoped screens. A month label (e.g. "Outubro 2026") makes this explicit.
- **Income/Outflows block**: Income Total and Outflows Total with a single bar filled to `Outflows Total / Income Total` (capped at 100%, never overshooting): green while income covers the outflows, **red** once outflows pass income (callout names the overage), with Account Net below. The Income and Outflows rows open `/income/:month` and `/outflows/:month`. Hidden when both totals are zero.
- **Spending Plan block**: Plan Total and Total Spent with a bar filled to `Total Spent / Plan Total` (capped at 100%, never overshooting) and a marker for how far through the month we are. Green normally; **yellow** when spend runs more than 25 percentage points ahead of the month (callout names the headroom still available before the ceiling); **red** once Total Spent passes Plan Total (callout names the overage). Both callouts and the block header open `/plan/:month`. Hidden when Plan Total is zero. It deliberately shows the raw Plan Result, not the Projected Result — see ADR-0009.
- **Open outflows block**: the month's **open** Outflows (unpaid) only, in the Outflows screen's order (final values first, then alphabetical), each with a paid toggle that removes the row immediately (no animation) and a tap that opens its editor; the block header opens `/outflows/:month`. Always shown; when nothing is open it celebrates ("Hooray! Nothing left to pay!").
- **Savings trend block**: a rolling 12-month stacked bar chart of the household's savings, ending on the current month with the newest column at the right edge; empty months are zero-filled. Each column stacks the active pots to that month's **Total Saved**, coloured by the pot's index in the active registry (a fixed palette), scaled zero-based against the tallest stacked total in the window — no y-axis, no gridlines, no separate legend. A month with no balance of its own plots the carried balance, so a column always equals the **Total Saved** the Savings screen would show for that month; retired pots never appear. Tapping a column reveals that month's Total Saved and a per-pot breakdown (colour swatch, name, carried balance) beneath the chart — display-only, it never navigates — while the block header opens `/savings/<current month>`. The whole block is hidden when there are no active pots or the window's tallest Total Saved is zero.
- Reuses the Outflows screen's wording and the control-loop derived numbers; everything is computed on the fly and nothing new is stored.

#### 8. Savings
**Route:** `/savings/:month`
- **Savings Pot registry**: pots (name only) are managed in Settings alongside cards, banks and payers (add / rename / remove). A pot keeps one identity across months, so renaming it flows through to every month's balance. Removing a pot **retires** it: it stops appearing and stops counting in every month, including history. Its balance rows are left in the sheet untouched; re-adding a pot with the same name is a fresh identity (ADR-0011)
- **Monthly balance check-in**: the screen lists every active pot with an inline editable **Savings Balance** for the browsed month, the same pattern as card totals and remaining estimates. Balances are hand-typed from the real account or statement — never derived from contributions or withdrawals, and never linked to an Outflow. Add buckets/pots via the top-bar "+" is **not** offered here; pots live in Settings. When the registry is empty the screen shows a highlighted callout with a shortcut straight to Settings
- **Carry-forward**: a pot with no balance recorded in the browsed month displays its most recent recorded balance, marked as updated in an earlier month. An empty field means "not checked yet", never zero; clearing a field removes that month's record so carry-forward resumes. An explicit `0` is a recorded zero. A newly created pot shows ready to fill but has no balance and never appears retroactively in earlier months
- **Total Saved**: Σ of the active pots' carried balances, shown as the screen's headline. No target and no goal. This screen shows a single month's numbers, with no month-over-month delta of its own — the Dashboard's savings trend is the read-only month-over-month view over these same balances, not a second set of numbers here. Savings is independent of the account ledger: the income/outflows totals and Account Net are untouched (ADR-0011)
- Month-scoped with prev/next, so the recorded history is browsable month by month

## Technical Requirements

### Tech Stack
Same as Stayoo: React 19, Vite, Redux Toolkit, react-router-dom, react-i18next (pt-BR primary, en-US), Tailwind CSS 4, Vitest + Testing Library. No chart library: the only chart, the Dashboard's 12-month savings trend, is stacked bars in plain CSS/flex like the Dashboard's other bars (Recharts still not needed).

### Architecture Principles
- Port `GoogleSheetsService.ts`, `useDataSync.ts`, `syncListener.ts`, onboarding, and month navigation from Stayoo — no new integration patterns
- Redux Toolkit slices: `incomeSlice`, `outflowsSlice`, `planSlice` (plan items + card spending), `cardsSlice`, `savingsSlice` (pot registry + monthly balances)
- All derived numbers are computed in pure utilities/selectors — **never stored**: Plan Total, Total Spent, Projected Result, Plan Result, Account Net live in `planCalculations.ts`-style pure functions, fully unit-tested
- No purchase entities anywhere in the data model (ADR-0002)

### Data Model

```ts
export interface Card {
  id: string;
  name: string;                 // e.g. "cc guta"
}

export interface Bank {
  id: string;
  name: string;                 // e.g. "Nubank"
}

export interface Payer {
  id: string;
  name: string;                 // e.g. "Marcelo"
}

export interface PlanItem {
  id: string;
  month: string;                // YYYY-MM
  name: string;                 // "Mercado/Farmácia", "Netflix"
  amount: number;               // bucket cap
  remainingEstimate: number;    // default 0
}

export interface CardSpending {
  id: string;
  month: string;                // YYYY-MM
  cardId: string;
  total: number;                // current total so far; overwritten at check-in
}

export interface Outflow {
  id: string;
  month: string;                // YYYY-MM
  name: string;                 // "Luz", "Cartão guta"
  amount: number;
  isPaid: boolean;
  isFinal: boolean;             // amount confirmed for the month; default false
  payerId: string;              // references a registered Payer
  bankId: string;               // references a registered Bank
}

export interface IncomeEntry {
  id: string;
  month: string;                // YYYY-MM
  amount: number;
  source?: string;
}

export interface SavingsPot {
  id: string;
  name: string;                 // e.g. "Emergency", "Retirement"
}

export interface SavingsBalance {
  id: string;
  month: string;                // YYYY-MM
  potId: string;                // references a registered SavingsPot
  balance: number;              // observed balance, typed in by hand
}
```

### Google Sheets Integration

#### Sheet Structure

| Tab | Columns |
| --- | --- |
| `cards` | id, name |
| `banks` | id, name |
| `payers` | id, name |
| `plan` | id, month, name, amount, remaining_estimate |
| `card_spending` | id, month, card_id, total |
| `outflows` | id, month, name, amount, is_paid, payer_id, bank_id, is_final |
| `income` | id, month, amount, source |
| `savings_pots` | id, name |
| `savings_balances` | id, month, pot_id, balance |

#### Sheet Initialization
Onboarding validates the connected sheet and creates any missing tabs with the headers above (Stayoo behavior). A tab created before a column existed has only its header row rewritten to the current contract; its data rows are never touched, so a newly added column reads back blank until the row is next written. No `settings` tab — the card, bank, payer and savings-pot registries live in `cards`, `banks`, `payers` and `savings_pots`. Adding the two savings tabs bumps the sheet contract version, so every device's cached Working Copy is invalidated as usual (ADR-0007).

## UI/UX Requirements

### Design Principles
- Mobile-first, Tailwind, same visual language as Stayoo
- The Projected Result is the plan screen's headline number (green/red)
- Check-in friction below 30 seconds: N card inputs + estimate tweaks

### Key Screens
1. **Dashboard** (`/`) — the app entry point and the household's current-month home: the income/outflows bars with Account Net, the Spending Plan's progress with its pace bar and over-plan callout, the Outflows still open to pay, and the 12-month savings trend chart you can tap for a per-pot breakdown. It is current-month only (no month navigation) — history lives on the month-scoped screens. Its top bar shows the title "Dashboard" and the Settings shortcut; every other screen's top bar shows a back button and that screen's name.
2. **Spending Plan** (`/plan/:month`) — spending buckets, check-in inputs, remaining estimates, Projected Result headline. Tap a bucket to edit on `/plan/edit/:id`; add via the top-bar "+" (`/plan/new/:month`)
3. **Outflows** (`/outflows/:month`) — outflow list with paid toggles, income total, account net, the by-payer summary, and the replicate-last-month button. Outflows awaiting a final value are flagged with a ⚠️ and follow the confirmed open ones; paid outflows sink to the end of the list. Tap a row to edit on `/outflows/edit/:id`; add via the top-bar "+" (`/outflows/new/:month`)
4. **Income** (`/income/:month`) — entries, total, replicate button. Tap a row to edit on `/income/edit/:id`; add via the top-bar "+" (`/income/new/:month`)
5. **Savings** (`/savings/:month`) — each active pot with its inline monthly balance, the Total Saved headline, and a Settings callout when the pot registry is empty. Balances carry forward from the most recent recorded month
6. **Settings** — card, bank, payer and savings-pot registries + connected sheet. Opened only from the Dashboard top bar; it is a full-screen page with a back button and no bottom navigation.
7. **Onboarding** — Stayoo flow

The app shell is a mobile-first Layout: a contextual top bar (with an optional screen-declared "+" for adding a record to the browsed month), the scrollable content column, and a fixed bottom navigation with four tabs (Plan, Outflows, Income, Savings). Creating and editing an outflow, spending bucket or income entry happens on a full-screen record editor with its own header and no bottom nav, like Settings; savings pots are managed in Settings and their balances are edited inline, so the Savings screen has no "+" and no editors. The shell and navigation conventions are recorded in ADR-0004.

## Control Loop Specification

```
Plan Total        = Σ bucket caps                            (month)
Total Spent       = Σ card totals                             (month)
Projected Result  = Plan Total − Total Spent − Σ remaining estimates
Plan Result       = Plan Total − Total Spent                  (final; estimates zeroed)
Account Net       = Σ income − Σ outflows                      (month)
Total Saved       = Σ active pots' balances, each carried forward from its
                    most recent recorded month                (month)
```

**Worked example** (June, from the current sheet):
- Plan Total = 10.750
- Check-in 25/06: cc guta 2.899 + cc uv 9.432 + cc ml 473 → Total Spent = 12.804
- Remaining Estimates: restaurante 250 → Σ = 250
- Projected Result = 10.750 − 12.804 − 250 = **−2.304** (over plan, red)
- June closes with estimates at 0 → Plan Result = 10.750 − June's final total spent

## Deployment

### Initial
- Local development only; `VITE_GOOGLE_CLIENT_ID` env var (same `.env.example` as Stayoo)

## Success Metrics

1. **Usability**: weekly check-in < 30 seconds
2. **Accuracy**: Projected Result reproduces the sheet's sobra on historical months
3. **Adoption**: full migration from direct sheet editing
4. **Reliability**: sync success rate > 99%

## Out of Scope (V1)

- Purchase-level tracking and per-bucket actuals (ADR-0002 — deliberate non-goal, not a missing feature)
- Other charts, YoY, and analytics beyond the Dashboard's 12-month savings trend
- Installment modeling (the card bill is the real statement value)
- Savings targets/goals, contribution or withdrawal tracking, and returns (a Savings Balance is observed and typed, never derived — ADR-0011)
- Outflow auto-generation (the card bill is entered by hand)
- Check-in snapshot history (totals are overwritten)
- Multi-currency, native mobile app, multiple users/roles

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Google Sheets API rate limits | Caching, batch operations, exponential backoff (Stayoo pattern) |
| Card totals go stale between check-ins | Check-in UX must stay under 30 s; Total Spent is labeled "so far" |
| Stale remaining estimates inflate the projection | Past months show the Plan Result as headline, not the projection |
| Concurrent edits from multiple devices | Row-scoped writes (ADR-0008): each save re-reads the affected tabs' id column and writes only the changed rows — appends for new records, blank-in-place for deletes — so another member's rows are never rewritten. Local Pending Changes always win and retry on the next pull or save (throttled ~30 s); two members editing the same row at the same moment can still lose one edit and coordinate verbally |
| Existing sheet with unexpected columns | Initialization only creates missing tabs; warn on unexpected columns |

## Future Considerations

1. Check-in snapshot history (the sheet keeps weekly rows; V1 overwrites)
2. Negative-projection alerts
3. Bucket reordering and plan templates
4. CSV export for month results
