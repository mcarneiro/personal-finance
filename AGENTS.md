# Planyoo Development Guide

## Product

Planyoo is a household card-spending planner. It plans card spending in spending buckets, tracks weekly card check-ins and per-bucket remaining estimates, projects the month result live, and tracks income and outflows. Data lives in Google Sheets.

## Domain

- `CONTEXT.md` is the domain glossary — the source of truth for what words mean. Keep it in sync when terms change.
- Monthly payment obligations (a bill, an investment contribution, a maintenance cost) are named **Outflows** — see ADR-0010 (`docs/adr/0010-monthly-payments-are-outflows.md`).
- Money set aside in named containers (emergency, retirement) is tracked as **Savings Pots** with a hand-updated monthly **Savings Balance** each — see ADR-0011 (`docs/adr/0011-savings-is-a-monthly-snapshot-ledger.md`). Savings is deliberately independent of Outflows and Account Net.
- `docs/adr/` records the hard decisions. Notably: card spending is tracked as per-card running totals, never as purchases (ADR-0002).

## Architecture

- Google Sheets is the persistent source of truth. Port `GoogleSheetsService.ts` from `../airbnb-organizer` (Stayoo) — same OAuth flow, same debounced sync middleware pattern (`useDataSync.ts` + `syncListener.ts`).
- Redux Toolkit slices own feature state (`incomeSlice`, `outflowsSlice`, `planSlice`, `cardsSlice`, `savingsSlice`).
- All derived numbers (Plan Total, Total Spent, Projected Result, Plan Result, Account Net) are computed in pure, fully tested utilities — never stored in state or the sheet.
- Use `react-i18next` for all user-facing text (pt-BR primary, en-US) and Tailwind CSS for styling. Preserve the mobile-first UI.
- Types live in `src/types/index.ts`. Do not use `any`. There are no purchase entities in this app — do not add them.
- The app shell and navigation conventions are fixed in ADR-0004 (`docs/adr/0004-app-shell-and-navigation.md`) — keep every new screen on the same shell.

## Development Workflow

- Start with a failing Vitest test for a feature or bug fix. Use Given/When/Then comments in tests.
- Add a reproduction test for every bug fix. Prioritize tests for the control-loop calculations (Projected Result, Plan Result, Account Net).
- Run `npm run lint`, `npx tsc --noEmit`, and relevant `npm test` tests after changes.
- Verify every implementation in the browser using the Chrome DevTools MCP (chrome-mcp) before calling it done — drive the real UI, not just unit tests. If chrome-mcp is not connected, stop and ask the user to connect it manually (they run WSL, so they must open it themselves); do not silently skip the check. The first connection of a session reports `failed: Connection closed` and then self-heals — see `docs/agents/chrome-devtools-mcp.md`.

## Documentation

- Treat docs as part of the change, never a follow-up: whenever you change behavior, terminology, or structure, update every affected doc in the same change and commit it together with the code. Never leave a doc to be synced by a later session.
- Keep these in sync: `README.md` (product summary), `prd.md` (spec and key screens), `CONTEXT.md` (domain glossary), `docs/adr/` (hard decisions), and this `AGENTS.md` (working rules).
- Record a hard-to-reverse decision as a new numbered ADR in `docs/adr/` and link it from here or `prd.md`.

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

### Browser verification

Every change is verified in a real browser through the Chrome DevTools MCP (chrome-mcp). The first connection of a session reports `failed: Connection closed` before it self-heals. Read the notes before driving the browser: `docs/agents/chrome-devtools-mcp.md`.
