# 01 — Dashboard: cash, plan pace, and open bills

**What to build:** Opening `/` shows the real household Dashboard for the current month: a month label, the income/outcome bars with Account Net, the Spending Plan block with a paced bar and over-plan callout, and the list of open Bills you can mark paid. No month navigation (history stays on the month-scoped screens) and no app-shell change.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Dashboard replaces the placeholder at `/`, current month only, with the month label
- [x] Income/outcome block: Income Total vs Bills Total as horizontal bars on a shared scale + Account Net; income bar → `/income/:month`, bills bar → `/bills/:month`; hidden when both are 0
- [x] Spending Plan block: Plan Total + Total Spent, bar filled to `spend/plan` capped at 100%; green normally, yellow when `spend% − month% > 25pp` (callout = headroom), red when `Total Spent > Plan Total` (callout = overage); callouts + header link to `/plan/:month`; hidden when Plan Total = 0
- [x] Open Bills block: current month, `isPaid === false` only, same row content as `/bills/:month`; checkbox toggles paid and the row leaves immediately (no animation); row tap opens the editor; order final-first then alphabetical; header links to `/bills/:month`; always shown, empty state "Hooray! No more bills to pay! 🎉"
- [x] Pure, fully tested `planPace` utility with injectable `now`; month progress = elapsed days / days in month counting today, capped at 1
- [x] Dashboard component tests (hide rules, pace colours, ordering, paid toggle removes row, empty state)
- [x] i18n in pt-BR and en-US; `prd.md`, `README.md`, and ADR-0009 updated
- [x] Verified in the real browser via chrome-mcp

## Comments

- Cut from `../spec.md`. Implemented as a single vertical slice. New pure utility `src/utils/planPace.ts` (`monthProgress` + `planPace`, injectable `now`) with 10 table-driven tests; `DashboardScreen.tsx` rebuilt around it, reusing `controlLoop`, `orderBills`, `toggleBillPaid` and `getMonthName`. The bill row and the payer/bank labelling were extracted out of the Bills screen (`BillRow.tsx`, `useRegistryLabels`) so both screens render a bill identically rather than duplicating the markup. All Dashboard numbers are derived on the fly; nothing new is stored.
- No charting library: the bars are plain CSS (`role="progressbar"` with `aria-valuenow` for accessibility and testability). A thin marker on the plan bar shows the month's own progress, so the yellow "ahead of pace" state reads visually.
- **Browser verification (Chrome DevTools MCP, pt-BR).** The real session was left signed in, so the empty October plan (today is 02/10) was hidden as designed and the live sheet was first checked as-is: net R$ 13.481,48, 32 open bills. To exercise the pace block without writing to the real sheet, a throwaway sheet id (`demo-dashboard-sheet`) was seeded through `navigate_page`'s `initScript` stubbing the Sheets boundary (plan 10.000; card total varied), then the real session restored afterwards. Green (spent 1.000, bar 10%, no callout), yellow (spent 5.000, bar 50%, "R$ 5.000,00 restantes antes do teto do plano") and red (spent 11.000, bar 100% red, "R$ 1.000,00 acima do plano") all rendered. Open bills listed only the unpaid, final-first then alphabetical (Aluguel, Luz, ⚠️ Cartao guta); ticking Aluguel removed the row immediately; the income bar opened `/income/2026-10` and the plan header `/plan/2026-10`. Console clean.
- Tests: 343 green (34 files); `npx tsc --noEmit` clean; `npm run lint` clean.
