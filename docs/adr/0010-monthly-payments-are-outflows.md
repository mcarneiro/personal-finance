# The account-ledger payment concept is an Outflow

The concept formerly called **Bill** — a single expected payment out of a household account in a month, whether a utility bill, an investment contribution, a maintenance cost, or the card bill — is now named an **Outflow** (pt-BR **Saída/Saídas**). "Bill" read too narrowly: it excluded investments and maintenance costs, which have the same shape (a discrete amount, a payer, a bank, a paid flag, a final-value flag) and belong in the same ledger. The concept itself is unchanged; only the name changed, and the name now reaches every identifier, the route `/outflows/:month`, the `outflows` i18n namespace, and the sheet tab.

## Considered options

- **Expense** (pt-BR "Despesa") — rejected. This app reserves the spending word for *card spending*, tracked separately as per-card running totals under the Spending Plan (ADR-0002). Card Spending is deliberately **not** an Outflow: it is a control total, not a discrete payment, and the card bill is the one bridge between them. Naming the ledger side "expense" would blur that seam.
- **Keep "Bill"** as an umbrella term — rejected; it re-creates the narrowness being escaped.
- **A hierarchy** of Bill / Investment / Maintenance subtypes — rejected; no behaviour differs between them, so a single term is enough.

## Consequences

- The persisted Google Sheet tab is renamed `bills` → `outflows` **by hand, once, in each connected sheet** — no automatic migration or guard ships with the app. A sheet still holding a `bills` tab gets an empty `outflows` tab created on load and reads zero outflows (the old rows are not deleted, just orphaned), so the failure is silent rather than loud. This was accepted deliberately: the household had only two sheets, and the rename was done by the household at cutover. **Before any sheet the household cannot reach is connected, replace this with an in-place rename migration** (a `spreadsheets.get` for the title/sheetId plus a `batchUpdate` `updateSheetProperties`), which would remove the footgun entirely.
- ADRs 0003 and 0006 keep their filenames but their prose uses the new term. `.scratch/` history is left as written.
- The rename reached every identifier, route (`/outflows/:month`), Redux slice/actions, utility names (`outflowsByPayerAndBank`), i18n namespace (`outflows.*`), and both locale values (en *Outflows*, pt-BR *Saídas*). The sheet columns are unchanged, so the sheet contract version bumps on the tab name alone and every device's cached Working Copy is invalidated without a manual cache bump.
