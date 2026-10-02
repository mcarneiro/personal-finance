# Startup paints from a cached Working Copy

Loading Planyoo used to gate the whole app behind a loading screen while ~9 sequential Google Sheets round trips settled (one sheet-metadata call, seven sequential per-tab header checks, the plan-migration read, then the parallel full-tab reads), and nothing was cached locally. Now every successful pull and push persists the merged snapshot to a per-sheet local cache (keyed by spreadsheet id, stamped with the sheet contract version), and startup paints that snapshot immediately: a background pull — one `values:batchGet` for every tab (nine as of ADR-0011, when `savings_pots` and `savings_balances` were added) — merges fresh rows over it seconds later, replaying local Pending Changes so nothing typed during the swap is lost. The cache is a Working Copy; Google Sheets remains the only source of truth (ADR-0001).

## Considered alternatives

- **Faster spinner, no cache** (batch and parallelize the round trips, keep the gate): rejected — every reload still blocks on the network, and the failed-load path stays dangerous: today a failed initial load opens the app with empty slices, and one edit then overwrites the whole tab with "empty + your edit".
- **Lazy month loading** (registries + current + previous month at startup, older months on navigation): rejected — `batchGet` reads all tabs in one request anyway, so lazy loading saves bytes but not round trips; cross-month reads are first-class (copy-last-month on every list screen, the card bill originating from the previous month's Card Spending); and it would add sparse month-keyed state, per-month loading flags, and id-lookup fallbacks for record editors reached by deep link.

## Consequences

- Seconds of possibly outdated numbers on open are accepted, then a silent swap; a subtle indicator shows while a pull is in flight or when the last pull failed ("offline — showing last saved data").
- Offline self-healing: a failed write keeps its Pending Changes, and the next pull runs the sync cycle (pull → merge → push pending), so edits made offline retry on return.
- The failed-load wipe path dies: a failed pull now opens last-saved data instead of an empty app.
- Schema initialization is skipped when the cache stamps the schema as known-good for the connected sheet and current sheet contract; otherwise the header checks are batched into one read.
