# 04 — Row-scoped merge writes, local wins

**What to build:** A save no longer rewrites a whole tab from the device's copy. When the debounced write fires, the app re-reads the id column of the affected tab(s) in one request, maps each Pending Change to its row, and writes only those rows' ranges in a single update request. New records are appended at the end of the tab; a deleted record's row is blanked in place so no other row shifts. Once the write succeeds the Pending Changes clear; if it fails they are kept and retried on the next pull or save. On a same-row collision the local Pending Change wins and is written. The PRD's risk-table row for concurrent edits is rewritten to this behavior in the same change, keeping README, CONTEXT and the ADRs in sync.

**Blocked by:** 02 — The pull side of the sync cycle.

**Status:** ready-for-agent

- [ ] A save writes only the changed rows' ranges, plus appends for new records and in-place blanks for deletes; untouched rows are never rewritten.
- [ ] Row addresses are resolved from a fresh id-column read taken as part of that save, not from the loaded snapshot.
- [ ] Deletes blank the row in place — no row shifts — and blank rows stay invisible to reads and to every list screen.
- [ ] New records append at the tab's end.
- [ ] Pending Changes clear only after a successful write and are retained across a failed write; the next pull or save retries them.
- [ ] Browser-verified via chrome-mcp with two clients on the same sheet: both edit different bills of the same month within the same second and both edits survive; a rename and a delete on different rows interleave without loss; a paid toggle on one row and an amount edit on another both survive.
- [ ] The PRD risk-table row for concurrent edits is rewritten, and README/CONTEXT/ADRs stay in sync (ADR-0008).
- [ ] `npm run lint`, `npx tsc --noEmit`, and relevant tests pass.
