# Planoo merge sync — spec

Tickets live in `issues/`, numbered in dependency order. Each is `ready-for-agent`.

## Problem

Loading Planoo gated the whole app behind ~9 sequential Google Sheets round trips with nothing cached locally, and every save cleared and rewrote the whole tab from the device's copy. A write from a stale **Working Copy** therefore silently dropped another member's edits — a **Lost Update**. The household edits the current month's Bills together at month start (copying last month, checking variable values), so those losses are a routine occurrence, not a rare race.

## Decisions

| Decision | Choice | ADR |
| --- | --- | --- |
| Startup | Paint instantly from a per-sheet cache; background pull swaps in seconds later (stale-while-revalidate) | 0007 |
| Reads | One `batchGet` for headers and all seven tabs; no lazy month loading | 0007 |
| Writes | Row-scoped by id: re-read the id column, write only the changed rows; appends for inserts; blank-clear for deletes | 0008 |
| Conflicts | The local **Pending Change** wins; an edit is never silently dropped | 0008 |
| Freshness | Pull on app open and on focus, throttled ~30s; no polling, no manual refresh | 0007 |

## Accepted residuals (documented, not bugs)

- Same-row, same-moment edits can still lose one edit; the members coordinate verbally.
- Truly simultaneous copy-last-month taps can double-replicate; the copy action re-reads and guards.
- Deletes leave blank rows; there is deliberately no compaction pass, because compaction rewrites the whole tab and re-imports the clobber.
- Appended rows land at the tab's tail, so a backfilled old month is cosmetically out of order; screens filter by month.
- Until every device runs the new protocol, an old build's whole-tab write still clobbers.

## Rejected (do not re-litigate)

Append-only journaling (kills the human-inspectable sheet ADR-0001 chose it for); month-scoped block writes (the real collision is same-month); whole-tab merge-before-write (still loses ~one edit per co-editing session); lazy month loading (`batchGet` is one request regardless); server-wins replay (re-creates the Lost Update); field-level merge (failure mode is silently mixed rows); interval polling and a manual refresh button.

## Domain language

Month, Working Copy, Pending Change, Lost Update — see `CONTEXT.md`.

## Tickets

01 merge utility → 02 pull cycle → 03 cached startup; 04 row-scoped writes and 05 copy guard both branch off 02.
