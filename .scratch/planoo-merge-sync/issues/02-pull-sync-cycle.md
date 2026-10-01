# 02 — The pull side of the sync cycle

**What to build:** Opening the app, and returning to it (window/app focus, throttled to at most one pull every ~30s), pulls the household's data and merges it into the working state without losing local edits. The pull reads every tab — headers and data — in a single Google Sheets request; a missing tab is still created with its header row, a tab whose header row has drifted is still re-headed without touching its data rows, and the legacy plan-sheet migration path is preserved. Fresh rows are merged into state by replaying the device's Pending Changes (ticket 01's rule: local wins), so an edit still inside the write debounce — or one whose write failed — survives the pull. A subtle "syncing" indicator shows only while a pull is in flight and never blocks the UI.

**Blocked by:** 01 — Pending Change model and pure merge utility.

**Status:** ready-for-agent

- [ ] Headers and data for every tab arrive in a single Sheets request; the sheet-metadata/title call is made only when a tab turns out to be missing.
- [ ] Missing tabs are still created with their header row and a drifted header row is still re-headed without touching data rows; legacy plan migration preserved.
- [ ] A pull runs on app open and on focus, at most once per ~30s, and a rerun is ignored while one is already in flight.
- [ ] The pull merges fresh rows replays Pending Changes, so a local edit not yet written (or whose write failed) is still visible after the pull.
- [ ] A "syncing" indicator appears only while a pull is in flight.
- [ ] Browser-verified via chrome-mcp with two clients on the same sheet: an edit in one appears in the other after refocusing it, and an edit typed in the other within its own debounce window survives that refresh.
- [ ] `npm run lint`, `npx tsc --noEmit`, and relevant tests pass.
