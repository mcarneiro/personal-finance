# 01 — Pending Change model and pure merge utility

**What to build:** The shared vocabulary every other ticket depends on. A **Pending Change** is one record-level edit — create, update, or delete — that a member has made but that has not yet been written to the sheet. A pure utility takes the fresh rows of one tab and the device's Pending Changes for that tab and returns the merged rows: a Pending Change always wins over a fresh row with the same id, a Pending Change for an id absent from the fresh rows is added (upsert), a delete removes the row, blank rows are skipped, and rows untouched by Pending Changes pass through unchanged. No side effects, no dispatch, no Sheets calls — it is a derived operation, tested like the other derived-number utilities.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Pending Change types cover create, update, and delete per record, keyed by record id and grouped by tab.
- [ ] The merge utility is pure, with no timeouts, dispatch, or I/O.
- [ ] Unit tests (Given/When/Then) cover: upsert over a fresh row (local wins), create adds a row, delete removes a row, untouched fresh rows pass through, blank rows are skipped, and zero Pending Changes returns the fresh rows unchanged.
- [ ] `npm run lint`, `npx tsc --noEmit`, and the new tests pass.
