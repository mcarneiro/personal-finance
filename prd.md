# (PRD) Planoo — Household Card Spending Planner

## Overview

### Problem Statement
Currently planning household card spending in a Google Sheets spreadsheet with ~weekly check-ins:

- Per-card running totals written down manually (`cc guta`, `cc uv`, `cc ml` → total)
- Per-bucket "previsão" (remaining-spend estimates until month end) re-estimated by hand
- A `budget (sobra)` column computed manually: plan − spent so far − estimated remaining

While the sheet works, it has limitations:

- The sobra arithmetic is manual and repeated every check-in
- No paid-status tracking for monthly obligations (bills)
- No income view, so account-level net is invisible
- Poor UX for the weekly control loop on mobile

### Solution
A React app using Google Sheets as the database (same foundation as Stayoo) that digitizes the control loop:

- Spending Plan: spending buckets with caps
- Weekly card check-ins: per-card running totals → Total Spent
- Remaining Estimates per bucket → live Projected Result (the sobra)
- Bills with paid control, payer and bank, income entries, and the account net

## Goals

### Primary Goals
1. Digitize the card-spending control loop — check-in, re-estimate, see the sobra
2. Show the Projected Result live: over-plan warnings mid-month, final Plan Result month-by-month
3. Track bills (including card bills) with paid status, payer and bank, and see spending by payer
4. Track expected income and the account net

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
- **Settings**: manage the card, bank and payer registries (add / rename / remove) plus the connected sheet. Opened from the Dashboard top bar as a full-screen page. No other settings exist in V1.

#### 2. Google Sheets Integration
- **Authentication**: Google OAuth (same client-ID flow and `.env` as Stayoo)
- **Data Sync**: fetch all data on app load; write mutations back through the same debounced sync middleware pattern (`useDataSync.ts` + `syncListener.ts` ported from Stayoo)

#### 3. Month Navigation
- Month-scoped routes (`/plan/:month`, `/bills/:month`, `/income/:month`) with prev/next navigation (Stayoo pattern)

#### 4. Income Management
**Route:** `/income/:month`
- Income entries: amount + optional source note. Receipt is not tracked.
- Add via the top-bar "+" and tap a row to edit both on a **full-screen editor** (`/income/new/:month`, `/income/edit/:id`); delete lives on the editor behind a confirmation modal, never inline in the list
- Total shown; replicate-last-month button for the recurring salary
- Account net (income − bills) is surfaced on the Bills screen

#### 5. Bills Management
**Route:** `/bills/:month`
- Bills: add (name, amount, payer, bank), toggle paid, edit, delete — no auto-generation (the card bill is entered by hand). Add via the top-bar "+" and tap a row to edit both on a **full-screen editor** (`/bills/new/:month`, `/bills/edit/:id`); delete lives on the editor behind a confirmation modal, never inline in the list. The list reads **open bills first, then paid**, each group **alphabetical by name**. A **replicate-last-month button** seeds an empty month from last month's bills; copies carry name, amount, payer and bank, but always arrive **unpaid** (ADR-0003)
- **Payer and bank are required**: every bill records who pays it and which registered bank it is paid from; unset or since-removed references still render and still count. When the payer or bank registry is empty, the Bills list and the editor show a highlighted callout with a shortcut straight to Settings instead of an unusable form
- **Card bill**: entered by hand as a regular bill when the statement arrives; its amount is the real statement value (covers the previous month's card spending). Installments, fees and refunds are absorbed by the statement value — never modeled
- Shows: bills total, income total, **account net** = income − bills, and a **by-payer spending summary** (per payer, broken down by bank). The summary sits below the totals and above the bills and is **collapsed by default**, expanding on tap

#### 6. Spending Plan (the core)
**Route:** `/plan/:month`
- **Plan composition**: spending buckets (name + cap). User-defined names. Add via the top-bar "+" and tap a row's name/amount to edit both on a **full-screen editor** (`/plan/new/:month`, `/plan/edit/:id`); delete lives on the editor behind a confirmation modal, while the remaining-estimate check-in stays inline on the list
- **Copy-last-month button**: one tap seeds the new month's plan from last month's; then edit freely (does not copy remaining estimates or card totals — those start at zero)
- **Card check-in**: one editable current total per card; Total Spent = sum. Totals are current-state — overwritten at each check-in, no snapshot history in V1
- **Remaining Estimates**: one editable estimate per bucket ("still expected until month end")
- **Projected Result**: plan total − Total Spent − Σ remaining estimates — the live sobra, green when positive, red when negative
- When the estimates are zero the projection **is** the final Plan Result; for past months the Plan Result is the headline

## Technical Requirements

### Tech Stack
Same as Stayoo: React 19, Vite, Redux Toolkit, react-router-dom, react-i18next (pt-BR primary, en-US), Tailwind CSS 4, Recharts not needed (no charts), Vitest + Testing Library.

### Architecture Principles
- Port `GoogleSheetsService.ts`, `useDataSync.ts`, `syncListener.ts`, onboarding, and month navigation from Stayoo — no new integration patterns
- Redux Toolkit slices: `incomeSlice`, `billsSlice`, `planSlice` (plan items + card spending), `cardsSlice`
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

export interface Bill {
  id: string;
  month: string;                // YYYY-MM
  name: string;                 // "Luz", "Cartão guta"
  amount: number;
  isPaid: boolean;
  payerId: string;              // references a registered Payer
  bankId: string;               // references a registered Bank
}

export interface IncomeEntry {
  id: string;
  month: string;                // YYYY-MM
  amount: number;
  source?: string;
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
| `bills` | id, month, name, amount, is_paid, payer_id, bank_id |
| `income` | id, month, amount, source |

#### Sheet Initialization
Onboarding validates the connected sheet and creates any missing tabs with the headers above (Stayoo behavior). A tab created before a column existed has only its header row rewritten to the current contract; its data rows are never touched, so a newly added column reads back blank until the row is next written. No `settings` tab — the card, bank and payer registries live in `cards`, `banks` and `payers`.

## UI/UX Requirements

### Design Principles
- Mobile-first, Tailwind, same visual language as Stayoo
- The Projected Result is the plan screen's headline number (green/red)
- Check-in friction below 30 seconds: N card inputs + estimate tweaks

### Key Screens
1. **Dashboard** (`/`) — the app entry point and a placeholder shell for the household dashboard (still to be designed). Its top bar shows the title "Dashboard" and the Settings shortcut; every other screen's top bar shows a back button and that screen's name.
2. **Spending Plan** (`/plan/:month`) — spending buckets, check-in inputs, remaining estimates, Projected Result headline. Tap a bucket to edit on `/plan/edit/:id`; add via the top-bar "+" (`/plan/new/:month`)
3. **Bills** (`/bills/:month`) — bill list with paid toggles, income total, account net, the by-payer spending summary, and the replicate-last-month button. Tap a row to edit on `/bills/edit/:id`; add via the top-bar "+" (`/bills/new/:month`)
4. **Income** (`/income/:month`) — entries, total, replicate button. Tap a row to edit on `/income/edit/:id`; add via the top-bar "+" (`/income/new/:month`)
5. **Settings** — card, bank and payer registries + connected sheet. Opened only from the Dashboard top bar; it is a full-screen page with a back button and no bottom navigation.
6. **Onboarding** — Stayoo flow

The app shell is a mobile-first Layout: a contextual top bar (with an optional screen-declared "+" for adding a record to the browsed month), the scrollable content column, and a fixed bottom navigation with three tabs (Plan, Bills, Income). Creating and editing a bill, spending bucket or income entry happens on a full-screen record editor with its own header and no bottom nav, like Settings. The shell and navigation conventions are recorded in ADR-0004.

## Control Loop Specification

```
Plan Total        = Σ bucket caps                            (month)
Total Spent       = Σ card totals                             (month)
Projected Result  = Plan Total − Total Spent − Σ remaining estimates
Plan Result       = Plan Total − Total Spent                  (final; estimates zeroed)
Account Net       = Σ income − Σ bills                        (month)
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
- Charts, YoY, analytics of any kind
- Installment modeling (the card bill is the real statement value)
- Account balances, savings or investment tracking
- Bill auto-generation (the card bill is entered by hand)
- Check-in snapshot history (totals are overwritten)
- Multi-currency, native mobile app, multiple users/roles

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Google Sheets API rate limits | Caching, batch operations, exponential backoff (Stayoo pattern) |
| Card totals go stale between check-ins | Check-in UX must stay under 30 s; Total Spent is labeled "so far" |
| Stale remaining estimates inflate the projection | Past months show the Plan Result as headline, not the projection |
| Concurrent edits from multiple devices | Load on start; Refresh option (Stayoo behavior) |
| Existing sheet with unexpected columns | Initialization only creates missing tabs; warn on unexpected columns |

## Future Considerations

1. Check-in snapshot history (the sheet keeps weekly rows; V1 overwrites)
2. Negative-projection alerts
3. Bucket reordering and plan templates
4. CSV export for month results
