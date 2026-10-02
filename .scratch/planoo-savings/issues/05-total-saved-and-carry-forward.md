# 05 — Total Saved headline and carry-forward display

**What to build:** The Savings screen's headline — **Total Saved** — computed live by ticket 02's `totalSaved` from the active pots' carried balances, and the surrounding display rules that make carry-forward legible. Total Saved is a derived number: it is never stored in state or the sheet, in line with every other Planyoo total (Plan Total, Account Net). The screen must present the whole-month arithmetic honestly: the total reflects carried values, and the individual rows already mark which values were carried (ticket 04). There is deliberately no target, no goal progress, and no month-over-month delta (ADR-0011) — do not add them. The screen must also make clear that savings is independent of the account ledger, so a member never expects Account Net to move when a balance changes. All text goes through react-i18next.

**Blocked by:** 02 — Savings slice and pure savings utilities.

**Status:** todo

- [ ] The screen headlines Total Saved, computed with `totalSaved(month, pots, balances)` and rendered with the shared currency formatter — never stored.
- [ ] Total Saved updates immediately when a balance is committed or cleared, and when a pot is added or retired.
- [ ] No target, goal, progress bar, or month-over-month delta is present anywhere in the savings UI.
- [ ] The screen states (a short line or label) that savings does not affect income, outflows or Account Net, matching the wording used for other scope clarifications.
- [ ] `savings.total` and the scope line exist in both locales.
- [ ] Tests (Given/When/Then) cover: the total sums carried balances; retiring a pot removes its balance from the total; a pot with no record contributes nothing; clearing a balance falls back to the carried value in the total.
- [ ] Browser-verified via chrome-mcp: two pots with balances show the correct Total Saved, and retiring one drops the total by exactly its carried balance while Account Net elsewhere is unchanged.
- [ ] `npm run lint`, `npx tsc --noEmit`, and the relevant tests pass.

## Comments
