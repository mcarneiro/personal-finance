# Undo is a short-lived compensating write

Every record write now raises a single **Undo Entry** for six seconds: a toast at the bottom of the screen — “Alterado · Desfazer” for one record, “3 saídas replicadas · Desfazer” for a replicate — that reverses the change just made. The entry is the prior state of the record(s) the action touched, captured on this device before the action landed. Undoing dispatches the ordinary slice action that puts that state back (restore an edited record, delete a just-created one, re-create a just-deleted one with the same id), so it becomes a **Pending Change** and reaches the sheet exactly like a save the household made on purpose: row-scoped, local wins (ADR-0008). Nothing is added to the sheet and no schema changes.

The slot holds one entry. A newer change replaces it, a bulk replicate or copy occupies one entry for the whole batch, and an entry disappears after six seconds, on reload, or when the connected sheet changes. Hovering or focusing the toast pauses its clock. Saves that changed nothing raise no toast. Delete keeps its confirmation modal — undo is a second net, not the only one. There is no redo and no keyboard shortcut; native Ctrl/Cmd+Z inside a field stays native. Undo is device-local and one-way, so another member sees the mistaken value for a moment and then the compensating edit, never a “someone undid something” event.

This is deliberately not a history. The app autosaves without asking, so the realistic mistake is noticed within seconds — a wrong amount, a paid tap, a wrong month’s replicate. A sheet-side history would reinterpret the ledger ADR-0001 chose for human inspection, grow without bound, and reopen the Lost Update problem ADR-0008 closed.

## Considered alternatives

- **Append-only journal in the sheet, with tombstones and compaction** — rejected: the sheet stops being the inspectable ledger ADR-0001 chose, it grows unboundedly, and the single-writer compaction pass is exactly the whole-tab rewrite ADR-0008 removed.
- **A previous-value column per tab** — rejected: only one level, a schema migration for every tab, and it cannot express a bulk replicate as one action.
- **A per-record version history screen** — rejected for V1: a different feature with a picker, labels and much more UI and storage; the mistake undo targets is the one just made.
- **Snapshot the whole month before each save** — rejected: restoring it would clobber another member’s edits, the failure ADR-0008 exists to prevent.
- **Confirm before every save** — rejected: friction on every autosaved keystroke and tap, to prevent a mistake undo covers for free.
- **Undo that survives reload or reaches other devices** — rejected: needs persistence and a shared “whose change is this” model; six seconds is not worth either.
- **Redo** — rejected: doubles the slot and the UI for a rare need; making the change again is just an edit.
- **An app-level Ctrl/Cmd+Z** — rejected: it would fight the native undo inside the very fields where most mistakes are typed.

## Consequences

- Undo is a normal write, so a re-created record appends at the tab’s tail rather than returning to its old row (ADR-0008 already accepts position drift). The id is preserved, so references and history stay intact.
- A member can see the mistaken value for up to a second before the compensating write lands. Accepted at household scale.
- An undo can overwrite another member’s edit to the same row inside the same six seconds — the same accepted same-row collision as ADR-0008, now with a shorter window.
- Two rapid changes collapse: only the newest can be undone. A mistake found after the window is corrected by hand.
- A first card check-in for a month has no prior row, so undo writes 0 rather than deleting the row; the field and Total Spent read identically either way.
- The toast carries no amount, so Privacy Mode does not affect it; a bulk count reveals rows, not money.
