# 08 — Bills + account net

**What to build:** The Bills screen: bills added fully manually (name, amount) — the card bill enters by hand as a regular bill with the real statement value — with paid toggles and edits/removals, plus the month's bills total, income total, and the account net (income − bills). Demo: the account-level picture in one glance.

**Blocked by:** 02 — Onboarding + Google Sheets foundation; 04 — Control-loop utilities; 07 — Income entries

**Status:** ready-for-agent

- [ ] Bills are addable/editable/removable per month — fully manual, no replicate, no auto-generation
- [ ] Paid toggles make open vs paid visible at a glance
- [ ] The card bill enters as a regular bill with the statement value; nothing installment-specific is modeled
- [ ] Bills total, income total, and account net are displayed, with the net computed by the control-loop utilities
- [ ] Bills persist to the bills tab through the sync path
