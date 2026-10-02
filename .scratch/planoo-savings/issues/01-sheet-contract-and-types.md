# 01 — Sheet contract and record types for savings

**What to build:** The persisted shape every other ticket depends on. Two new sheet tabs join the contract: `savings_pots` (`id, name`) — the household's registry of pots — and `savings_balances` (`id, month, pot_id, balance`) — one recorded balance per pot per month. Both are added to `SHEET_CONFIGS` in `src/config/google.ts` in the fixed `SHEET_KEYS` order (after `income`), which automatically bumps `SHEET_CONTRACT_VERSION` so every device's cached Working Copy invalidates (ADR-0007). Two record types, `SavingsPot` and `SavingsBalance`, join `src/types/index.ts` and the `SheetRecords` map, and `SheetData` gains `savingsPots` and `savingsBalances` arrays. The read path, write path, empty-sheet constant and store snapshot must all round-trip the new tabs so an unmodified app still reads and writes a sheet that now has two more tabs. `savings_balances.balance` is a number; `pot_id` references a `SavingsPot` by id (`''` never occurs — a balance row only exists against a real pot).

**Blocked by:** None — can start immediately.

**Status:** todo

- [ ] `SHEET_CONFIGS` gains `savings_pots` (`id, name`) and `savings_balances` (`id, month, pot_id, balance`), in `SHEET_KEYS` order, without disturbing the existing seven tabs' column order.
- [ ] `SavingsPot` and `SavingsBalance` are defined in `src/types/index.ts`, join `SheetRecords`, and `SheetData` gains `savingsPots` / `savingsBalances` (`savingsBalances` carries `month` and `potId`).
- [ ] `EMPTY_SHEET` (`src/hooks/useDataSync.ts`) and `selectSheetData` (`src/store/sheetData.ts`) include both new arrays.
- [ ] `GoogleSheetsService` parses and writes both tabs (row mappers and parse helpers follow the existing per-tab pattern); a missing tab is created with its header row on pull, as for every other tab.
- [ ] `SHEET_CONTRACT_VERSION` changes as a consequence of the config change (asserted, not hand-bumped).
- [ ] The working-copy cache's full-snapshot validation accepts the new shape (all nine tabs are arrays) and rejects a cache missing them, falling back to a cold start.
- [ ] Tests (Given/When/Then) cover: round-trip parse of a pot and a balance row; missing-tab creation for both; the contract-version change; and the cache validator accepting the new shape and rejecting a seven-tab legacy payload.
- [ ] `npm run lint`, `npx tsc --noEmit`, the new tests and the full suite pass. No user-facing surface changed, so browser verification is the existing app still rendering (no regression).

## Comments
