# 01 — Sheet contract and record types for savings

**What to build:** The persisted shape every other ticket depends on. Two new sheet tabs join the contract: `savings_pots` (`id, name`) — the household's registry of pots — and `savings_balances` (`id, month, pot_id, balance`) — one recorded balance per pot per month. Both are added to `SHEET_CONFIGS` in `src/config/google.ts` in the fixed `SHEET_KEYS` order (after `income`), which automatically bumps `SHEET_CONTRACT_VERSION` so every device's cached Working Copy invalidates (ADR-0007). Two record types, `SavingsPot` and `SavingsBalance`, join `src/types/index.ts` and the `SheetRecords` map, and `SheetData` gains `savingsPots` and `savingsBalances` arrays. The read path, write path, empty-sheet constant and store snapshot must all round-trip the new tabs so an unmodified app still reads and writes a sheet that now has two more tabs. `savings_balances.balance` is a number; `pot_id` references a `SavingsPot` by id (`''` never occurs — a balance row only exists against a real pot).

**Blocked by:** None — can start immediately.

**Status:** done

- [x] `SHEET_CONFIGS` gains `savings_pots` (`id, name`) and `savings_balances` (`id, month, pot_id, balance`), in `SHEET_KEYS` order, without disturbing the existing seven tabs' column order.
- [x] `SavingsPot` and `SavingsBalance` are defined in `src/types/index.ts`, join `SheetRecords`, and `SheetData` gains `savingsPots` / `savingsBalances` (`savingsBalances` carries `month` and `potId`).
- [x] `EMPTY_SHEET` (`src/hooks/useDataSync.ts`) and `selectSheetData` (`src/store/sheetData.ts`) include both new arrays.
- [x] `GoogleSheetsService` parses and writes both tabs (row mappers and parse helpers follow the existing per-tab pattern); a missing tab is created with its header row on pull, as for every other tab.
- [x] `SHEET_CONTRACT_VERSION` changes as a consequence of the config change (asserted, not hand-bumped).
- [x] The working-copy cache's full-snapshot validation accepts the new shape (all nine tabs are arrays) and rejects a cache missing them, falling back to a cold start.
- [x] Tests (Given/When/Then) cover: round-trip parse of a pot and a balance row; missing-tab creation for both; the contract-version change; and the cache validator accepting the new shape and rejecting a seven-tab legacy payload.
- [x] `npm run lint`, `npx tsc --noEmit`, the new tests and the full suite pass. No user-facing surface changed, so browser verification is the existing app still rendering (no regression).

## Comments

Implemented the savings sheet contract and record types.

- `SHEET_CONFIGS` gained `savings_pots(id,name)` and `savings_balances(id,month,pot_id,balance)` after `income`; `SHEET_KEYS` order, `tabRanges()`, `createMissingTabs()` and `initializeSheets()` all picked them up with no changes, so a missing tab is created with headers on pull.
- `SavingsPot` / `SavingsBalance` added to `src/types/index.ts`, joined `SheetRecords`, and `SheetData` gained `savingsPots` / `savingsBalances`. `SavingsBalance` carries `month` and `potId`; `balance` parses as a number (an explicit `0` survives).
- `GoogleSheetsService` gained `parseSavingsPotsRows` / `parseSavingsBalancesRows`, `toRow` cases, `readSavingsPots` / `readSavingsBalances`, and the `pullAll` return. `mergePendingChanges.ts`, `useDataSync.ts` (`EMPTY_SHEET`) and `workingCopyCache.ts` (nine-key validator) were extended.
- `selectSheetData` returns the two savings arrays as `[]` for now: the savings slice lands in ticket 02, so there is no store slice to read from yet. Noted in the function comment.
- `SHEET_CONTRACT_VERSION` moves because it is derived from the config; new tests assert the derivation, the nine-tab signature and that it differs from the seven-tab version.
- Tests: round-trip read/write of a pot and a balance, missing-tab creation for both savings tabs on pull, contract-version change, cache accepting nine tabs and rejecting a seven-tab legacy payload. `npx tsc --noEmit`, `npm run lint` and the full suite (362 tests) pass.
- Browser (chrome-mcp): reloaded `http://localhost:5173/`, Dashboard rendered and navigated to Outflows; no console errors/warnings. No user-facing surface changed.


