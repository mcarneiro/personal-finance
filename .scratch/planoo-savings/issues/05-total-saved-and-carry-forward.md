# 05 — Total Saved headline and carry-forward display

**What to build:** The Savings screen's headline — **Total Saved** — computed live by ticket 02's `totalSaved` from the active pots' carried balances, and the surrounding display rules that make carry-forward legible. Total Saved is a derived number: it is never stored in state or the sheet, in line with every other Planyoo total (Plan Total, Account Net). The screen must present the whole-month arithmetic honestly: the total reflects carried values, and the individual rows already mark which values were carried (ticket 04). There is deliberately no target, no goal progress, and no month-over-month delta (ADR-0011) — do not add them. The screen must also make clear that savings is independent of the account ledger, so a member never expects Account Net to move when a balance changes. All text goes through react-i18next.

**Blocked by:** 02 — Savings slice and pure savings utilities.

**Status:** done

- [x] The screen headlines Total Saved, computed with `totalSaved(month, pots, balances)` and rendered with the shared currency formatter — never stored.
- [x] Total Saved updates immediately when a balance is committed or cleared, and when a pot is added or retired.
- [x] No target, goal, progress bar, or month-over-month delta is present anywhere in the savings UI.
- [x] The screen states (a short line or label) that savings does not affect income, outflows or Account Net, matching the wording used for other scope clarifications.
- [x] `savings.total` and the scope line exist in both locales.
- [x] Tests (Given/When/Then) cover: the total sums carried balances; retiring a pot removes its balance from the total; a pot with no record contributes nothing; clearing a balance falls back to the carried value in the total.
- [x] Browser-verified via chrome-mcp: two pots with balances show the correct Total Saved, and retiring one drops the total by exactly its carried balance while Account Net elsewhere is unchanged.
- [x] `npm run lint`, `npx tsc --noEmit`, and the relevant tests pass.

## Comments

Added the Total Saved headline and the account-ledger independence line.

- `src/features/savings/SavingsScreen.tsx`: computes `totalSaved(month, pots, balances)` on render (never stored), formats it with the shared `formatCurrency`, and renders a `savings.summary` card above the pot list headed by `savings.total` plus the scope line `savings.independent`. The pot list moves below the headline; the per-pot carry-forward markers are unchanged. No target, goal, progress bar or delta anywhere.
- Both locales gain `savings.summary` (section label) and `savings.independent` ("As poupanças não afetam a renda, as saídas nem o saldo da conta." / "Savings do not affect income, outflows or account net."). `savings.total` already existed from ticket 04.
- Tests: `SavingsScreen.test.tsx` gains a "Total Saved" describe (6 tests) covering two carried balances summing, a cleared month falling back to the carried value, a no-record pot contributing nothing and a typed balance moving the total, retiring a pot dropping the total, the scope line, and the absence of any progressbar/goal.
- Docs: `prd.md` (sections 8 and the screens list) and `README.md` already describe the Total Saved headline and savings independence accurately; no drift, no edit needed this ticket.
- Browser (chrome-mcp, page 1): created two pots in Settings, recorded Emergency `11000` and Retirement `40000` on `/savings/2026-06` — Total Saved showed `R$51.000,00`. Retired Retirement; `/savings/2026-06` reloaded from the sheet showing only Emergency and Total Saved `R$11.000,00` (down exactly `40000`). Account Net on `/outflows/2026-06` stayed `R$10.488,23` before and after. Cleared Emergency's balance — the total fell to `R$0,00` and the field emptied, persisting across reload. Console clean (no errors/warnings). The household sheet was returned to its original state (no pots, no balances; the empty-registry callout is back).
- Full suite 410 pass; `tsc --noEmit` and `npm run lint` clean.
