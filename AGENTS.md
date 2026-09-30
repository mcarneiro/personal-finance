# Planoo Development Guide

## Product

Planoo is a household card-spending planner. It plans card spending in fixed charges and spending buckets, tracks weekly card check-ins and per-bucket remaining estimates, projects the month result live, and tracks income and bills. Data lives in Google Sheets.

## Domain

- `CONTEXT.md` is the domain glossary — the source of truth for what words mean. Keep it in sync when terms change.
- `docs/adr/` records the hard decisions. Notably: card spending is tracked as per-card running totals, never as purchases (ADR-0002).

## Architecture

- Google Sheets is the persistent source of truth. Port `GoogleSheetsService.ts` from `../airbnb-organizer` (Stayoo) — same OAuth flow, same debounced sync middleware pattern (`useDataSync.ts` + `syncListener.ts`).
- Redux Toolkit slices own feature state (`incomeSlice`, `billsSlice`, `planSlice`, `cardsSlice`).
- All derived numbers (Plan Total, Total Spent, Projected Result, Plan Result, Account Net) are computed in pure, fully tested utilities — never stored in state or the sheet.
- Use `react-i18next` for all user-facing text (pt-BR primary, en-US) and Tailwind CSS for styling. Preserve the mobile-first UI.
- Types live in `src/types/index.ts`. Do not use `any`. There are no purchase entities in this app — do not add them.

## UI & navigation

Keep every new screen on the same shell so the visual language stays consistent (mirroring Stayoo):

- The shell is `src/components/Layout.tsx`: a contextual top bar, the `max-w-md` content column, and a fixed bottom navigation. Screen components are named `<Feature>Screen` and live under `src/features/<feature>/` (e.g. `features/dashboard/DashboardScreen.tsx`).
- The **Dashboard** (`/`) is the app entry point. Its top bar shows the title "Dashboard" plus the Settings shortcut.
- Every other screen's top bar shows a back button (to `/`) and that screen's name. Keep the name in the top bar; do not duplicate it in the content (month screens own only the month switcher — `MonthScaffold`).
- **Settings** is reached only from the Dashboard top bar. It is a full-screen page with its own header and back button, and no bottom navigation.
- The bottom navigation has exactly three tabs: Plan, Bills, Income. Settings is never a tab.
- Cards use `rounded-lg bg-white shadow-sm` (drop shadow, no border). The top bar, bottom nav, and content share the same `mx-auto max-w-md px-4` column, and the scrollable content reserves space for the fixed bottom nav (`pb-24`).

## Development Workflow

- Start with a failing Vitest test for a feature or bug fix. Use Given/When/Then comments in tests.
- Add a reproduction test for every bug fix. Prioritize tests for the control-loop calculations (Projected Result, Plan Result, Account Net).
- Run `npm run lint`, `npx tsc --noEmit`, and relevant `npm test` tests after changes.
- Verify every implementation in the browser using the Chrome DevTools MCP (chrome-mcp) before calling it done — drive the real UI, not just unit tests. If chrome-mcp is not connected, stop and ask the user to connect it manually (they run WSL, so they must open it themselves); do not silently skip the check.
- Keep `README.md` and `prd.md` accurate when product behavior changes.

## Security

- Never log, commit, or expose OAuth tokens, client secrets, spreadsheet IDs, or `.env` values.
- Keep Google OAuth scopes and Sheets access limited to what the feature requires.

## Git

- Use clear conventional commit messages such as `feat:`, `fix:`, and `refactor:`.

## Agent skills

### Issue tracker

Issues are tracked as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary — the five canonical triage roles used as-is. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
