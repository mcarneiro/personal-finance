# 01 — App skeleton

**What to build:** The app boots to a working shell: a mobile-first, pt-BR (en-US switchable) interface with month-scoped routes for the Spending Plan, Bills, Income, and Settings screens as empty placeholders, month-by-month navigation on every screen, a loading state while data syncs, and the lint/typecheck/test workflow green from day one. Demo: open the dev server, navigate months, switch language.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] App boots with month-scoped routes for the plan, bills, income, and settings screens
- [x] Month navigation (prev/next) works on every screen
- [x] pt-BR is the default language; en-US is switchable
- [x] Mobile-first Tailwind UI matching Stayoo's visual language
- [x] Lint, typecheck, and tests run green; a first component test covers month navigation

## Comments

- Implemented 2026-09-27. Scaffolded the Vite + React 19 + TypeScript + Tailwind 4 + Redux Toolkit + react-router-dom + react-i18next shell.
  - Month-scoped routes: `/plan/:month`, `/bills/:month`, `/income/:month`, plus `/settings`; bare paths redirect to the current month.
  - `src/utils/month.ts` owns `getCurrentMonth`, `formatMonth`, `parseMonth`, `shiftMonth`, `getMonthName`, and `isValidMonth` (year-boundary safe); malformed `:month` params redirect to the current month.
  - `MonthScaffold` + `MonthNavigation` give every month screen prev/next navigation through the route.
  - pt-BR is the unconditional default (en-US opt-in via the Settings language selector, persisted in `localStorage`); `<html lang>` follows the active language.
  - `appSlice` + `LoadingScreen` implement the data-sync loading state, covered by a test; the gate stays inert until ticket 02 wires the sheets sync.
  - Scope note: Settings is deliberately **not** month-scoped (the PRD scopes month routes to plan/bills/income; Settings manages the card registry and connected sheet in ticket 03).
  - Scope note: the Content-Security-Policy meta was removed from `index.html` — it references Google OAuth/Sheets origins that don't exist until ticket 02, and blocked Vite's inline dev preamble. Re-add it in ticket 02.
  - Tests: `src/utils/__tests__/month.test.ts` (6), `src/config/__tests__/i18n.test.ts` (2), `src/App.test.tsx` (6, covering month navigation, year-boundary crossing, malformed-month fallback, the loading state, and the language switch). `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` are all green (14 tests).
  - Reviewed with `/code-review` (standards + spec); findings actioned: types moved to `src/types/index.ts`, unused `authInitialized`/translation keys removed, month validation added, loading state made reachable and tested, CSP deferred to ticket 02.


