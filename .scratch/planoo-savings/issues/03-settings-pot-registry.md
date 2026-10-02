# 03 — Savings pot registry in Settings

**What to build:** A fifth registry section on the Settings screen, managing Savings Pots (add / rename / remove), built on the shared `NameRegistry` component exactly like the payer and bank registries. A pot is a name and an id; renaming flows through to every month's balance because balances reference the pot by id. Removing a pot drops it from the registry only — its balance rows are left in the sheet, and the pot stops appearing and counting everywhere, including history (ADR-0011). This is a deliberately different removal semantic from Payers and Banks, and the Settings copy must say so: a removed pot retires, whereas a removed payer or bank still renders and still counts. All user-facing text goes through react-i18next (pt-BR primary, en-US).

**Blocked by:** 02 — Savings slice and pure savings utilities.

**Status:** todo

- [ ] `src/features/settings/SavingsPotRegistry.tsx` mirrors `PayerRegistry.tsx` / `BankRegistry.tsx`, wired to `savingsSlice` add/rename/remove.
- [ ] `SettingsScreen.tsx` renders it alongside the card, bank and payer registries; the connected-sheet control is unchanged.
- [ ] `savings.registries.pots.*` keys exist in both `pt-BR` and `en-US` translation files (title, empty, name label/placeholder, add, rename label), matching the existing registry key shape under `settings.registries`.
- [ ] The section explains that removing a pot retires it (stops counting in every month), distinct from the payer/bank removal behaviour.
- [ ] Tests (Given/When/Then, Testing Library) cover: adding a pot writes it to the registry; renaming updates it; removing drops it; and a `savings_balances` row for the removed pot is left untouched (asserted against the slice / written records, not the DOM only).
- [ ] Browser-verified via chrome-mcp against the running dev server: add a pot, rename it, remove it, confirming each round-trips to the sheet and no console errors.
- [ ] `npm run lint`, `npx tsc --noEmit`, and the relevant tests pass.

## Comments
