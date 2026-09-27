# 02 — Onboarding + Google Sheets foundation

**What to build:** Stayoo's foundation ported wholesale: Google OAuth sign-in, the sheets service, the debounced sync middleware, and the startup data load — plus onboarding: paste a Google Sheet URL, validate it, auto-create the five tabs (cards, plan, card_spending, bills, income) with the correct headers, and allow changing the connected sheet in Settings. Demo: connect a real sheet and watch the tabs appear with headers.

**Blocked by:** 01 — App skeleton

**Status:** ready-for-agent

- [ ] Onboarding connects to a Google Sheet via OAuth from a pasted URL
- [ ] Missing tabs are auto-created with the spec's columns; existing sheet content is left untouched
- [ ] The sheet connection is remembered and can be changed in Settings
- [ ] Data loads on app start behind a loading state — no flash of empty data
- [ ] Mutations write back through the ported debounced sync middleware
