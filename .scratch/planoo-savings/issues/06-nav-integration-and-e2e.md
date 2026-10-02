# 06 — Bottom-nav integration and end-to-end verification

**What to build:** The Savings screen becomes reachable the way every other month-to-month ledger is: a fourth bottom-navigation tab in `src/components/Layout.tsx`, placed after Income, with the `/savings` prefix routing to the current month (`<Navigate to={/savings/${currentMonth}} replace />`) and `/savings/:month` rendering the screen inside the shell. This amends ADR-0004's three-tab shell to four (already recorded in `docs/adr/0004-app-shell-and-navigation.md`). The Savings screen must **not** appear in `SCREEN_TITLES` with an `addLabelKey` — it has no top-bar "+" and no record editors. This ticket also runs the end-to-end pass over the whole feature and reconciles any doc drift left by the earlier tickets.

**Blocked by:** 03 — Savings pot registry in Settings; 04 — Savings screen with inline monthly balance check-in; 05 — Total Saved headline and carry-forward display.

**Status:** done

- [x] `Layout.tsx`'s `NAV_ITEMS` includes a Savings tab (path `/savings`, `navigation.savings` key, a fitting icon) after Income; the active-tab highlight works on `/savings/:month`.
- [x] `App.tsx` routes `/savings` → current month and `/savings/:month` → `<Layout><SavingsScreen /></Layout>`; no `/savings/new` or `/savings/edit` routes exist.
- [x] `navigation.savings` and the screen title exist in both locales; the top bar shows the screen name and a back button, with no "+" action.
- [x] End-to-end via chrome-mcp against the running dev server: create two pots in Settings, record a balance in the current month, navigate back a month and confirm carry-forward, forward again, clear a balance, and retire a pot — confirming the sheet is the source of truth and the console stays clean.
- [x] `prd.md`, `README.md`, `CONTEXT.md`, ADR-0004 and ADR-0011 are re-read and reconciled against what was actually built; any drift is fixed in the same commit.
- [x] `npm run lint`, `npx tsc --noEmit`, and the full test suite pass.

## Comments

Integrated Savings into the bottom navigation and ran the end-to-end pass.

- `Layout.tsx`: added `NAV_ITEMS` entry `/savings` with `navigation.savings` and a banknotes icon, placed after Income; the existing prefix match highlights it on `/savings/:month`. `SCREEN_TITLES` already carried `/savings` with no `addLabelKey`, so there is no top-bar "+".
- `App.tsx`: added `/savings` → `<Navigate to={/savings/${currentMonth}} replace />`, alongside the existing `/savings/:month` route inside `Layout`. No `/savings/new` or `/savings/edit` route exists; an unknown subpath falls through the `:month` param and `MonthScaffold` redirects to the current month.
- Locales: `navigation.savings` added in pt-BR ("Poupanças") and en-US ("Savings"); `savings.title` already existed.
- Tests: `App.test.tsx` gains 6 (Given/When/Then): the nav lists the four tabs in order (Plan, Outflows, Income, Savings); the tab is active on `/savings/:month`; tapping it opens the current month's screen; the bare `/savings` path redirects to the current month; the tab is labelled in en-US; and `/savings/new` and `/savings/edit` both fall back to the current month (no editor route). The top-bar test now also asserts the back button. Full suite 416 pass; `tsc --noEmit` and `npm run lint` clean.
- End-to-end (chrome-mcp, page 1, app in en-US): created two pots (Emergency, Retirement) in Settings and confirmed them after a reload (sheet is the source of truth). Recorded October 2026 balances Emergency `11000` + Retirement `40000` → Total Saved `R$51,000.00`; September was empty, so recording Emergency `10000` there gave `R$10,000.00`; November showed both values carried from October, each marked "Updated in October 2026". Cleared October's Emergency → it fell back to the carried September `10000` with the "Updated in September 2026" marker and Total Saved `R$50,000.00`. Retired Retirement in Settings → Total Saved dropped to `R$10,000.00`; Account Net on `/outflows/2026-10` stayed `R$13,481.48`. Reloaded Savings and Settings — the retired pot stayed gone and the totals persisted. Console showed only the Vite/React dev messages, no errors or warnings. The household sheet was returned to its original savings state (no pots, no balances; the empty-registry callout is back).
- Docs: re-read `prd.md`, `README.md`, `CONTEXT.md`, ADR-0004 and ADR-0011 against what shipped — all already describe the four-tab shell, the `/savings/:month` route, the Total Saved headline and savings independence accurately. No drift needed fixing.
