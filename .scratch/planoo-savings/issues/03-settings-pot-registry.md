# 03 — Savings pot registry in Settings

**What to build:** A fifth registry section on the Settings screen, managing Savings Pots (add / rename / remove), built on the shared `NameRegistry` component exactly like the payer and bank registries. A pot is a name and an id; renaming flows through to every month's balance because balances reference the pot by id. Removing a pot drops it from the registry only — its balance rows are left in the sheet, and the pot stops appearing and counting everywhere, including history (ADR-0011). This is a deliberately different removal semantic from Payers and Banks, and the Settings copy must say so: a removed pot retires, whereas a removed payer or bank still renders and still counts. All user-facing text goes through react-i18next (pt-BR primary, en-US).

**Blocked by:** 02 — Savings slice and pure savings utilities.

**Status:** done

- [x] `src/features/settings/SavingsPotRegistry.tsx` mirrors `PayerRegistry.tsx` / `BankRegistry.tsx`, wired to `savingsSlice` add/rename/remove.
- [x] `SettingsScreen.tsx` renders it alongside the card, bank and payer registries; the connected-sheet control is unchanged.
- [x] `savings.registries.pots.*` keys exist in both `pt-BR` and `en-US` translation files (title, empty, name label/placeholder, add, rename label), matching the existing registry key shape under `settings.registries`.
- [x] The section explains that removing a pot retires it (stops counting in every month), distinct from the payer/bank removal behaviour.
- [x] Tests (Given/When/Then, Testing Library) cover: adding a pot writes it to the registry; renaming updates it; removing drops it; and a `savings_balances` row for the removed pot is left untouched (asserted against the slice / written records, not the DOM only).
- [x] Browser-verified via chrome-mcp against the running dev server: add a pot, rename it, remove it, confirming each round-trips to the sheet and no console errors.
- [x] `npm run lint`, `npx tsc --noEmit`, and the relevant tests pass.

## Comments

Added the Savings Pots registry to Settings.

- `SavingsPotRegistry.tsx` mirrors `PayerRegistry`/`BankRegistry` on the shared `NameRegistry`, wired to `addSavingsPot` / `updateSavingsPot` / `deleteSavingsPot`. Rename keeps the pot's id, so every month's balance follows it; remove only drops the registry entry (the slice never touches `balances`).
- `SettingsScreen.tsx` renders `<SavingsPotRegistry />` after the payer registry; the connected-sheet control is unchanged.
- `NameRegistry` gained an optional `helperText` line under the title. `pots.retireNotice` uses it to spell out the distinct removal semantic: a removed pot retires and stops counting in every month, including history, unlike a removed payer or bank which still renders and still counts; recorded balances stay in the sheet. Existing registries pass no `helperText`, so their markup is unchanged.
- New `settings.registries.pots.*` keys in pt-BR and en-US (title, empty, name label, placeholder, add, rename label, retire notice), matching the existing registry key shape.
- Tests in `SettingsScreen.test.tsx` (5 new, Given/When/Then): lists pots; shows the retire notice; add writes `savings_pots` via the real sync middleware; rename writes the same id with the new name; remove writes a `savings_pots` delete, leaves `savings_balances` unwritten and the balance row intact in the slice. `App.test.tsx`'s partial store gained the savings reducer (Settings now reads `state.savings.items`). Full suite 391 tests pass; `tsc --noEmit` and `npm run lint` clean.
- Browser (chrome-mcp, page 1): on `/settings`, added a pot, reloaded — present from the sheet; renamed it, reloaded — new name present; removed it, reloaded — gone. Console showed only the Vite/React dev messages, no errors. The connected household sheet ended back in its original state (the test pot had no balances).

