# 06 — Bottom-nav integration and end-to-end verification

**What to build:** The Savings screen becomes reachable the way every other month-to-month ledger is: a fourth bottom-navigation tab in `src/components/Layout.tsx`, placed after Income, with the `/savings` prefix routing to the current month (`<Navigate to={/savings/${currentMonth}} replace />`) and `/savings/:month` rendering the screen inside the shell. This amends ADR-0004's three-tab shell to four (already recorded in `docs/adr/0004-app-shell-and-navigation.md`). The Savings screen must **not** appear in `SCREEN_TITLES` with an `addLabelKey` — it has no top-bar "+" and no record editors. This ticket also runs the end-to-end pass over the whole feature and reconciles any doc drift left by the earlier tickets.

**Blocked by:** 03 — Savings pot registry in Settings; 04 — Savings screen with inline monthly balance check-in; 05 — Total Saved headline and carry-forward display.

**Status:** todo

- [ ] `Layout.tsx`'s `NAV_ITEMS` includes a Savings tab (path `/savings`, `navigation.savings` key, a fitting icon) after Income; the active-tab highlight works on `/savings/:month`.
- [ ] `App.tsx` routes `/savings` → current month and `/savings/:month` → `<Layout><SavingsScreen /></Layout>`; no `/savings/new` or `/savings/edit` routes exist.
- [ ] `navigation.savings` and the screen title exist in both locales; the top bar shows the screen name and a back button, with no "+" action.
- [ ] End-to-end via chrome-mcp against the running dev server: create two pots in Settings, record a balance in the current month, navigate back a month and confirm carry-forward, forward again, clear a balance, and retire a pot — confirming the sheet is the source of truth and the console stays clean.
- [ ] `prd.md`, `README.md`, `CONTEXT.md`, ADR-0004 and ADR-0011 are re-read and reconciled against what was actually built; any drift is fixed in the same commit.
- [ ] `npm run lint`, `npx tsc --noEmit`, and the full test suite pass.

## Comments
