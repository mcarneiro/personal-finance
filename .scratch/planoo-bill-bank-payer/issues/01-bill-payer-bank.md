# 01 — Bill payer + bank, and the by-payer summary

**What to build:** A Bill records a required **Payer** and **Bank**, chosen from registries maintained in Settings (like cards). Bills persist the references to the sheet, survive reload, and the Bills screen shows a by-payer spending summary (payer total, broken down by bank) for the browsed month.

**Blocked by:** none (extends the completed MVP).

**Status:** done

- [x] `Bank` and `Payer` registries in Settings (add / rename / remove), persisted to `banks` / `payers` tabs
- [x] Bill gains required `payerId` / `bankId`, chosen from the registries, on add and edit
- [x] Bill list shows the payer and bank; unset/removed references read as fallbacks
- [x] By-payer spending summary (payer groups with per-bank lines and totals), all bills of the month
- [x] Sheet contract extended; existing sheets backfill the `bills` header and gain the new tabs
- [x] Pure `billsByPayerAndBank` utility, fully tested
- [x] `CONTEXT.md` / `prd.md` updated; i18n in pt-BR and en-US

## Comments

- Implementation follows the decisions in `../spec.md`. `NameRegistry` was extracted from `CardRegistry` and now backs all three registries. `BillForm` replaces `NameAmountForm` on the Bills screen (name, amount, payer, bank). `billsByPayerAndBank` is the new derived number and is never stored.
- **Browser verification (Chrome DevTools MCP, pt-BR).** Seeded auth + a stubbed Sheets boundary via `navigate_page`'s `initScript` (cards; banks Itaú/Nubank; payers Marcelo/Guta; June bills + income), then drove the real UI. June rendered bills total R$ 3.189,00 / income R$ 12.000,00 / net R$ 8.811,00; rows read "Guta · Itaú", "Marcelo · Nubank"; the by-payer summary showed Marcelo R$ 290,00 (Nubank) and Guta R$ 2.899,00 (Itaú). Adding Água 90 / Marcelo / Itaú moved the total to R$ 3.279,00 and the summary to Marcelo R$ 380,00 split Itaú 90 + Nubank 290; the write-back cleared `bills!A2:G` and PUT `[id, month, name, amount, is_paid, payer_id, bank_id]`. Settings listed all three registries; adding Inter/Carlos wrote the `banks`/`payers` tabs; renaming Itaú → "Itaú Pessoas" flowed through to every bill row and summary line. Removing Nubank wrote only the `banks` tab and left the bills intact, falling back to "Banco removido" with the R$ 290,00 still counted. Console clean throughout.
- Tests: 173 green; `npx tsc --noEmit` clean; `npm run lint` clean.
