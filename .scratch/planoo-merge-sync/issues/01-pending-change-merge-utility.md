# 01 — Pending Change model and pure merge utility

**What to build:** The shared vocabulary every other ticket depends on. A **Pending Change** is one record-level edit — create, update, or delete — that a member has made but that has not yet been written to the sheet. A pure utility takes the fresh rows of one tab and the device's Pending Changes for that tab and returns the merged rows: a Pending Change always wins over a fresh row with the same id, a Pending Change for an id absent from the fresh rows is added (upsert), a delete removes the row, blank rows are skipped, and rows untouched by Pending Changes pass through unchanged. No side effects, no dispatch, no Sheets calls — it is a derived operation, tested like the other derived-number utilities.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Pending Change types cover create, update, and delete per record, keyed by record id and grouped by tab.
- [x] The merge utility is pure, with no timeouts, dispatch, or I/O.
- [x] Unit tests (Given/When/Then) cover: upsert over a fresh row (local wins), create adds a row, delete removes a row, untouched fresh rows pass through, blank rows are skipped, and zero Pending Changes returns the fresh rows unchanged.
- [x] `npm run lint`, `npx tsc --noEmit`, and the new tests pass.

## Comments

- Added the Pending Change vocabulary to `src/types/index.ts`: `PendingChange<T>` (a discriminated `create`/`update`/`delete`, carrying the record for create/update and just the id for delete), `TabPendingChanges<T>` keyed by record id, and `PendingChanges` grouping every tab type-safely off `SheetKey`.
- Added `src/utils/mergePendingChanges.ts`: a pure `mergePendingChanges(freshRows, changes)` that replays one tab's changes over its fresh rows. Local wins on an id collision, absent ids are appended (create/upsert), deletes drop their row, blank-id rows are skipped, and untouched rows keep their order. No I/O, dispatch, or state.
- Added `src/utils/__tests__/mergePendingChanges.test.ts` (8 Given/When/Then cases) covering local-wins, create append, edit upsert, delete, untouched pass-through, blank rows, zero changes, no input mutation, and the tab-grouped type shape.
- No user-facing surface changed, so there is nothing to drive in the browser; verification is the ticket's own gate. `npx tsc --noEmit`, `npm run lint`, the new tests, the full suite (245 passed) and `npm run build` all pass. Confirmed the dev app still renders in chrome-mcp (no regression).
