# 07 — Income entries

**What to build:** The Income screen: entries with an amount and an optional source note, addable/editable/removable, the month total displayed, and the replicate-last-month button for the recurring salary. Demo: record salary plus extras, replicate them into next month with one tap.

**Blocked by:** 02 — Onboarding + Google Sheets foundation

**Status:** done

- [x] Income entries are addable/editable/removable per month, with an optional source note
- [x] The month total is displayed
- [x] Replicate-last-month button copies last month's entries; it is absent when last month is empty
- [x] Entries persist to the income tab through the sync path

## Comments

- Implemented 2026-09-27. The Income screen is now live:
  - `src/features/income/IncomeScreen.tsx`: the month total in a summary card (derived, never stored), the entry list with add/edit/remove, and the replicate-last-month button. Each row shows its source note (or **Sem fonte** when absent) and amount; edit is in place.
  - `src/features/income/IncomeEntryForm.tsx`: amount (required) + source note (optional) form, shared by add and edit. Only a parseable amount is submittable; a blank note is recorded as `source: undefined`.
  - `src/utils/incomeCopy.ts`: `copyIncomeEntries` — replicates amounts and notes into the target month with fresh ids (pure, unit-tested).
  - `src/utils/controlLoop.ts`: added `incomeTotal(month, income)` (pure) and refactored `accountNet` to call it. It is a sixth derived-number utility, justified by ticket 07's "month total is displayed" and ticket 08's "income total … displayed"; derived numbers stay out of state and the sheet.
  - `src/store/incomeSlice.ts` + `syncListener.ts`: added the bulk `addIncomeEntries` action and wired it into the debounced `writeIncome` path so a whole replicated month syncs as one write.
- **Replicate guard:** following ticket 05's review-mandated fix, the button is shown only when last month has entries **and** the browsed month is still empty, so it can never duplicate a whole list. This is a superset of the ticket's "absent when last month is empty" rule; the demo (replicate into the next month) works as specified.
- i18n: new pt-BR/en-US keys under `income` (summary, total, amount/source labels, add/save/cancel, edit/remove, no-source, replicate).
- Tests: `IncomeScreen.test.tsx` (13) on Seam B — real store + real debounced middleware, mocked sheets boundary — covering list/total, add with and without a note, invalid amount refused, edit, remove, replicate (including a fresh-id/one-write assertion), absent when last month is empty, no duplication into a non-empty month, and month navigation + replicate from the browsed month. Plus `incomeCopy.test.ts` (4) and 5 `incomeTotal` cases. Suite is 128 green; `npm run lint` and `npx tsc --noEmit` clean. `App.test.tsx`'s app store now includes the income reducer (the real app store always did).
- Browser verification (chrome-devtools): seeded auth + a stubbed Sheets boundary via `navigate_page`'s `initScript` (May income: Salário 12.000 + Freela 500), then drove the real UI. June rendered empty with total R$ 0,00 and the replicate button; tapping it produced Salário + Freela and **R$ 12.500,00** with the button gone. Adding Bônus 1.000 moved the total to R$ 13.500,00; editing Freela to 750/"Freela extra" → R$ 13.750,00; removing Bônus → R$ 12.750,00; an amount-only entry rendered **Sem fonte**. Navigating to July and replicating copied June (R$ 12.750,00); May showed no replicate button (April empty). Every mutation wrote the full `income` tab (clear A2:D + PUT with `[id, month, amount, source]`), console clean.
- `/code-review` (two axes, fixed point `81a2feb`) findings actioned: dropped the unnecessary `billsReducer` from the App test store (Speculative Generality). Judgement calls left as-is: `IncomeEntryForm`/`planCopy` shapes resemble their plan counterparts but encode different field rules (required name vs optional note) and domain semantics, so no shared abstraction was forced; `Income Total` was kept out of `CONTEXT.md` because the glossary does not define arithmetic totals (it defines neither Plan Total nor Account Net).
