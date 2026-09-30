# Planoo — Import (CSV ledger)

Status: needs-info — the open questions below must be resolved before coding.

## Problem Statement

The household's history lives in a legacy spreadsheet ledger with columns **Data, Executado, Conta, Valor pago, Responsável, Banco** (the `Página1` tab of their sheet). Today the only ways into Planoo are manual entry one record at a time, or out-of-band surgery on the sheet. A one-off migration of that ledger was done by hand in 2026-09 (304 bills across Jan–Oct 2026). There is no in-app way to backfill history, migrate to a new sheet, or seed a fresh sheet with data the household already has.

## Solution

An **Import** screen, opened from Settings, that reads a CSV file or pasted rows and writes typed records into the connected Google Sheet. V1 imports **Bills** (the ledger shape above). It maps columns, lets the user review a preview with per-month totals and row errors, then writes bills plus any new **Payer** and **Bank** registry entries in one confirmed action. The sheet stays the source of truth, and the import reuses the existing model: no new entity, no new tab.

## Proposed flow

1. **Input.** Upload a `.csv` file or paste rows. Comma and semicolon delimiters, quoted fields, CRLF line endings.
2. **Map columns.** Auto-guess from the header row, then let the user correct it. Suggested aliases:
   - date: `data`, `date`, `vencimento`, `due`
   - paid: `executado`, `pago`, `paid`, `status`
   - name: `conta`, `nome`, `descrição`, `name`
   - amount: `valor pago`, `valor`, `amount`
   - payer: `responsável`, `responsavel`, `payer`
   - bank: `banco`, `bank`
3. **Preview.** Show the parsed rows, per-month bill counts and totals, the payer and bank names found, and errors (missing date, unparseable amount, missing name). Nothing is written yet.
4. **Confirm.** Resolve new payers and banks, then write `bills`, `banks`, and `payers` through the typed service.

## Proposed decisions

- **Parse on the client.** No server, and the raw file is never uploaded anywhere.
- **Reuse the domain model.** `Bill`, `Payer`, and `Bank` only. No new persisted entity and no new sheet tab.
- **Amount.** Extend the currency helper into a tested BRL parser that accepts `R$ 1.811,86`, `1.811,86`, `1811.86`, blank, and `R$ 0,00`.
- **Date.** Accept `YYYY-MM-DD`, `DD/MM/YYYY`, and Google Sheets serial numbers (the ledger stores serials). The record's `month` is the date's month.
- **Paid.** Accept `TRUE/FALSE`, `sim/não`, `pago/em aberto`, `1/0`, and an unchecked checkbox. A missing paid column defaults to open.
- **Registries.** Resolve payer and bank by accent- and case-insensitive name, and auto-create the missing ones (generated ids) before the bills are written. Unknown or aliased names (for example `Inter/NB`, seen in the ledger) are surfaced in the preview so the user can point them at an existing entry.
- **Ids.** Deterministic `bill-<month>-<slug(name)>`, so an import is repeatable. Rows whose id already exists are skipped.
- **Merge, never replace.** An import adds rows and never deletes existing bills. This follows ADR-0001 (the sheet is the source of truth) and the removal rule in ADR-0002.
- **Derived numbers are never stored.** Preview counts and totals come from pure utilities.
- **Empty rows are ignored.**
- **i18n** pt-BR and en-US, mobile-first, on the same app shell as Settings.

## Open questions (need a decision)

1. **Scope.** Bills only in V1, or also Income and Plan?
2. **Duplicate rows.** Skip silently, skip with a count, or update in place?
3. **Registries.** Auto-create unknown payers and banks, or require them to exist and error on unknown names?
4. **Input.** Is paste-only enough for V1, or is file upload required?
5. **Preview editing.** Can the user fix a bad row before importing, or only fix the column mapping?

## Testing Decisions

- **Seam A — pure import utilities.** CSV tokenizer (delimiter, quotes, CRLF), amount parser (BRL, en-US, blank, zero), date parser (ISO, `DD/MM/YYYY`, serial), registry resolution and creation, deterministic ids, duplicate detection, and preview aggregation. Table-driven, using real ledger rows as fixtures, including the five blank trailing rows, the 21 `R$ 0,00` rows, the `Inter/NB` alias, and serial dates.
- **Seam B — Import screen** with a mocked Sheets boundary: mapping and auto-guess, preview totals and errors, unknown-registry auto-create, idempotent re-import, and the confirm step writing `bills`/`banks`/`payers`.

## Out of scope (V1)

- Importing Plan items, card spending, or income.
- Reading a tab directly from Google Sheets (the app has no cross-tab read beyond its own contract).
- `.xlsx` and other binary formats. CSV and pasted text only.
- Undo or rollback of an import.

## Further notes

- **Origin.** The 2026-09 one-off migration of the `Página1` ledger (304 bills, Jan–Oct 2026) is the reference case and the source of the fixtures above.
- **No sheet contract change.** The import writes the same `bills`, `banks`, and `payers` tabs the app already reads.
