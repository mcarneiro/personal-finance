# Planoo — Bill payer + bank

Status: done

## Problem Statement

Bills record what is owed and whether it is paid, but not **who** will pay it or **which bank** it will be paid from. The household wants to know, at a glance, how much each person will spend and from which bank.

## Solution

A Bill gains two required references — a **Payer** and a **Bank** — chosen from registries maintained in Settings (mirroring the card registry). The Bills screen shows each bill's payer and bank, and a **by-payer spending summary** below everything: one group per payer (payer total, then a line per bank), for the browsed month.

## Decisions (resolved with the user before coding)

1. **Lists live in Settings** as two registries (`banks`, `payers`) with add / rename / remove, exactly like cards.
2. **Both fields are required** when adding or editing a bill.
3. **Summary layout**: per-payer groups with bank lines.
4. **Scope of the summary**: all bills in the month, paid or open.

Derived decisions, following existing precedent:

- **Reference by id**, not name, so renaming a registry entry flows through to its bills.
- **Removing a registry entry drops it from the registry only.** Bills keep their amount and fall back to a translated "removed" label; the summary still counts them. This mirrors ADR-0002 (removal must never corrupt history).
- **Legacy rows** (written before the columns existed) read back as unset, render as "Sem responsável / Sem banco", and still count in the totals. Editing them forces a valid choice.
- **Sheet contract**: two new tabs `banks`/`payers` (`id, name`); the `bills` tab extends to `id, month, name, amount, is_paid, payer_id, bank_id`. `initializeSheets` now backfills a drifted header row (never data), so an existing sheet gains the columns and missing tabs on the next load.

## Testing Decisions

- **Seam A** — `billsByPayerAndBank` pure utility: grouping, registry order, unset/removed fallbacks, month isolation, empty month.
- **Seam B** — Bills and Settings screens with a real store and mocked sheets boundary: required-field validation, list rendering, edit, summary grouping, removed-registry fallback, Settings registries writing `banks`/`payers` back.
- **Sheet round-trip**: reading/writing payer and bank references, legacy blank columns, and the header migration in `initializeSheets`.

## Further Notes

- Glossary: `CONTEXT.md` gained **Payer** and **Bank**; **Bill** now names them.
- Product spec: `prd.md` data model, sheet structure and Bills/Settings features updated.
