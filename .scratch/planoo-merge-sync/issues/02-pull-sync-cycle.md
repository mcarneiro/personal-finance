# 02 — The pull side of the sync cycle

**What to build:** Opening the app, and returning to it (window/app focus, throttled to at most one pull every ~30s), pulls the household's data and merges it into the working state without losing local edits. The pull reads every tab — headers and data — in a single Google Sheets request; a missing tab is still created with its header row, a tab whose header row has drifted is still re-headed without touching its data rows, and the legacy plan-sheet migration path is preserved. Fresh rows are merged into state by replaying the device's Pending Changes (ticket 01's rule: local wins), so an edit still inside the write debounce — or one whose write failed — survives the pull. A subtle "syncing" indicator shows only while a pull is in flight and never blocks the UI.

**Blocked by:** 01 — Pending Change model and pure merge utility.

**Status:** done

- [x] Headers and data for every tab arrive in a single Sheets request; the sheet-metadata/title call is made only when a tab turns out to be missing.
- [x] Missing tabs are still created with their header row and a drifted header row is still re-headed without touching data rows; legacy plan migration preserved.
- [x] A pull runs on app open and on focus, at most once per ~30s, and a rerun is ignored while one is already in flight.
- [x] The pull merges fresh rows replays Pending Changes, so a local edit not yet written (or whose write failed) is still visible after the pull.
- [x] A "syncing" indicator appears only while a pull is in flight.
- [x] Browser-verified via chrome-mcp with two clients on the same sheet: an edit in one appears in the other after refocusing it, and an edit typed in the other within its own debounce window survives that refresh.
- [x] `npm run lint`, `npx tsc --noEmit`, and relevant tests pass.

## Comments

- `GoogleSheetsService.pullAll` is the read side of the sync cycle: one `values:batchGet` for every tab's headers and data, aligned to `SHEET_CONFIGS` order. The sheet-metadata/title call now happens only when the read fails with a missing-range error (`isMissingTabError`); other failures (auth, network, quota) are rethrown instead of masquerading as a missing tab. Missing tabs are created with their header and the same single read is retried. Each tab's header is reconciled against the contract from the value already read (no extra header request), and the legacy plan migration runs on the pull path, now passing the header as-read so a stale wider trailing header cell is cleared in the same pull. All parse helpers are shared with the per-tab reads.
- `useDataSync` now owns the pull: on app open and on focus/visibility (throttled 30 s, ignored while a pull is in flight), it calls `pullAll`, replays the device's Pending Changes with `mergeSheetData` (local wins), and swaps the snapshot into the store. Only the first attempt of a session gates the UI; a failed first pull clears the gate and later focus retries stay background. The throttle is stamped when a pull starts, so failed pulls are throttled too.
- `pendingSlice` holds the device's Pending Changes keyed by tab and record id; `syncListener.ts` records a change on each user mutation (before the debounce) and drops the written snapshot after a successful save, so a pull racing the debounce — or an edit whose write failed — is replayed rather than lost. (`mergeSheetData` in `src/utils/mergePendingChanges.ts` is the pure per-tab wrapper.)
- A subtle, non-blocking `role="status"` "syncing" indicator (`App.tsx`, `appSlice.syncing`, pt-BR/en-US `common.syncing`) shows only while a pull is in flight, and never during the startup loading gate.
- Tests: new `pullAll` cases (single request; missing-tab create + retry; drifted header re-head without touching data; legacy plan migration; stale trailing header cleared; non-missing error rethrow), `mergeSheetData` cases, new `App.sync.test.tsx` cases (loading gate, pending replay, indicator, 30 s throttle, in-flight guard, no re-gate after a failed startup pull), and `pendingSlice` cases. `npm run lint`, `npx tsc --noEmit`, and the full suite (261 passed) all pass.
- Browser-verified via chrome-mcp with two clients on the same sheet (a second tab, temporarily persisted auth, restored afterwards): a bill created in client A appeared in client B after refocusing it; then, in B, toggling a bill within its debounce window and triggering a focus pull showed `syncing` in-flight and the local value retained through and after the pull, and it persisted to the sheet. The temporary test bill was deleted; the sheet was left clean.
- Docs: `prd.md` Data Sync and the concurrent-edit risk row now describe the batched pull on open/focus with local Pending Changes winning. Ticket 04 finalizes the row-scoped write wording per ADR-0008.
