# 01 — Outflows carry a Payment or Investment kind

**What to build:** An Outflow can be marked as an **Investment** instead of the
default **Payment**, all the way from the sheet to the screen. It is a marker
only: no total, no Account Net and no summary changes.

Domain (docs ship with the change — AGENTS.md):

- `CONTEXT.md`: add **Payment** and **Investment** as the two kinds an Outflow
  can be, each with a short entry; update the **Outflow** entry to name its
  kind; remove `payment` from the Outflow `_Avoid_` list (it now names a kind).
  Keep the glossary free of implementation detail.
- New `docs/adr/0013-outflows-are-payments-or-investments.md`, in the house ADR
  shape: an Outflow carries a Payment/Investment kind; it is display-only and
  never changes a total (mirroring ADR-0006); it copies on replicate, unlike
  `isFinal` which resets; and it explains why a category is allowed now where
  ADR-0010 rejected a Bill/Investment/Maintenance hierarchy — that rejection
  rested on "no behaviour differs", which no longer holds. Link it from `prd.md`
  and `AGENTS.md` the way the other ADRs are linked.
- `README.md` / `prd.md`: mention that an Outflow is a Payment or an Investment.

Types + creation sites:

- `src/types/index.ts`: `isInvestment: boolean` on `Outflow`, documented as
  defaulting to `false` (= Payment) wherever an outflow is created.
- Every creation site sets it: `OutflowEditor` create, `copyOutflows`, and any
  test fixture helper. `npx tsc --noEmit` is the proof none was missed.

Persistence:

- `src/config/google.ts`: append `is_investment` to
  `SHEET_CONFIGS.outflows.columns`.
- `src/services/GoogleSheetsService.ts`: write `TRUE`/`FALSE` in the outflows
  serializer; read the new cell in `parseOutflowsRows` with `parseBoolean`
  (blank ⇒ Payment, like the legacy default comment beside `isFinal`); widen the
  outflows read range to `A2:I`.
- `src/utils/outflowCopy.ts`: `copyOutflows` carries `isInvestment` (and still
  forces `isPaid: false` and `isFinal: false`); update its doc comment.
- The header-rewrite migration is automatic and needs no manual step: an
  existing sheet gains the column on its header row and its rows read back as
  Payment.

Form + editor:

- `src/features/outflows/OutflowForm.tsx`: add `isInvestment` to `OutflowDraft`,
  an `initialIsInvestment` prop (default `false`), and a second checkbox beside
  the not-final one, labelled `outflows.investmentLabel`; reset it on submit
  like the other fields.
- `src/features/outflows/OutflowEditor.tsx`: pass `initialIsInvestment` and let
  `{ ...draft }` carry the flag on both update and create.

Rows + i18n:

- `src/features/outflows/OutflowRow.tsx`: a small **Investment** tag beside the
  ⚠️ not-final flag (a compact text badge), so it shows on both the Outflows
  list and the Dashboard's open-outflows list — that is where the Dashboard's
  kind colour becomes attributable to rows.
- `outflows.investmentLabel` and any tag label in both
  `src/locales/pt-BR/translation.json` and `src/locales/en-US/translation.json`.

**Blocked by:** None.

**Status:** done

- [x] `Outflow` has `isInvestment`; every creation site sets it (`OutflowEditor` create, `copyOutflows`, test fixtures) and `npx tsc --noEmit` proves none was missed.
- [x] The sheet round-trips the flag: a saved Investment reads back `true`, a Payment reads `false`, and a row with a blank `is_investment` cell reads as a Payment. Covered by a `GoogleSheetsService` test for both serialize and parse.
- [x] `copyOutflows` carries `isInvestment` and still forces `isPaid: false` and `isFinal: false`.
- [x] The add form and the edit form both show the Investment checkbox, default off, and a saved Investment round-trips through the editor.
- [x] An Investment row shows the tag on both the Outflows list and the Dashboard's open-outflows list; a Payment row shows nothing extra.
- [x] `CONTEXT.md` has the Payment and Investment terms and no longer lists `payment` under Outflow's `_Avoid_`; ADR-0013 exists and is linked from `prd.md`; `prd.md` and `README.md` mention the kind.
- [x] New labels exist in both locale files (pt-BR and en-US).
- [x] Given/When/Then tests cover: the sheet round-trip and the blank default; `copyOutflows` carrying the flag and resetting paid/final; the form's default and toggle; the row tag's presence and absence.
- [x] Verified in the browser via chrome-mcp against the running dev server: mark an outflow as an Investment (add and edit) and see the tag on the list.
- [x] `npm run lint`, `npx tsc --noEmit`, and the tests pass.

## Comments

Implemented the Payment/Investment kind end to end as a display-only marker.

- `Outflow.isInvestment: boolean` on the type; `is_investment` appended to the `outflows` sheet contract. Serializer writes `TRUE`/`FALSE`, `parseOutflowsRows` reads it with `parseBoolean` (blank/legacy ⇒ Payment, beside the `isFinal` default) and `readOutflows` widens to `A2:I`.
- `copyOutflows` carries `isInvestment` (still forcing `isPaid: false`, `isFinal: false`); the doc comment explains why the kind travels where the workflow flags reset.
- `OutflowForm` gained `isInvestment` on `OutflowDraft`, an `initialIsInvestment` prop (default `false`) and a second checkbox labelled `outflows.investmentLabel`, reset on submit; `OutflowEditor` prefills it and `{ ...draft }` carries it on both create and update.
- `OutflowRow` renders a compact teal **Investimento/Investment** tag beside the ⚠️ not-final flag, so it shows on the Outflows list and the Dashboard's open-outflows list; new labels added to both locales.
- Docs same-change: `CONTEXT.md` gained **Payment** and **Investment**, Outflow now names its kind and drops `payment` from `_Avoid_`; new `docs/adr/0013-outflows-are-payments-or-investments.md` (display-only, copies on replicate, why a category is allowed where ADR-0010 rejected a hierarchy) linked from `AGENTS.md`, `prd.md` (type, sheet table, Outflows section) and `README.md`.
- Tests: sheet serialize/parse round-trip plus blank⇒Payment and legacy five-column⇒Payment; `copyOutflows` carrying the kind while resetting paid/final; editor default-off, tick, prefill and toggle; the row tag present on an Investment and absent on a Payment on both lists. Full suite 508 passing, `npx tsc --noEmit` and `npm run lint` clean.
- Browser verification (chrome-mcp, real October ledger; the dev session had expired so I re-authenticated via the Google account chooser): added `TEST investment` through the editor (both checkboxes shown, default off), saw the tag on the Outflows list and the Dashboard open-outflows list while a Payment row (`Luz`) showed none, reopened its editor to confirm the checkbox prefilled, toggled it off/on and watched the tag clear/return, and confirmed the row-scoped sheet write carried the 9th column `TRUE`. Removed exactly that test outflow (row-scoped blank write on its own row) and confirmed the ledger is back to its original 304 rows. No tokens, secrets or spreadsheet ids recorded.
