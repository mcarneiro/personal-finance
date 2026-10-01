# 03 — Startup paints from the cached Working Copy

**What to build:** The app no longer gates startup behind the network. Every successful pull and push persists the merged snapshot to a local cache keyed by the connected spreadsheet id and stamped with the sheet contract version. On startup the app paints that snapshot immediately, and the pull swaps in fresh data seconds later. A first-ever connect (cold cache) still shows the loading gate. A remembered cache also makes schema initialization skippable: when the stamp matches the connected sheet and the current sheet contract, the header checks are skipped; otherwise they run as a batched read. When a pull fails, the app shows last-saved data with an "offline — showing last saved data" hint instead of opening an empty app.

**Blocked by:** 02 — The pull side of the sync cycle.

**Status:** ready-for-agent

- [ ] Warm-cache startup paints content before any Sheets request settles; the pull then swaps it silently.
- [ ] A first-ever connect (cold cache) still shows the loading gate.
- [ ] The cache is keyed by spreadsheet id and is not reused across a Settings sheet change, nor across a sheet contract version change.
- [ ] Warm-cache startup skips schema initialization; a cold or version-mismatched cache runs the batched header check.
- [ ] A failed startup pull shows last-saved data with the offline hint; there is no empty-state app in which one edit could overwrite the sheet.
- [ ] Browser-verified via chrome-mcp: reload shows instant content then updates; offline shows last-saved data and the hint; changing the sheet in Settings never shows the previous sheet's data.
- [ ] `npm run lint`, `npx tsc --noEmit`, and relevant tests pass.
