# 03 — Card registry (Settings)

**What to build:** Settings manages the household's credit cards: add, rename, and remove — each change round-tripping to the sheet through the proven sync path. This is the first complete write loop and the input mechanism the plan screen's check-ins will use. Demo: manage cards in the app, see the rows in the sheet's cards tab.

**Blocked by:** 02 — Onboarding + Google Sheets foundation

**Status:** ready-for-agent

- [ ] Settings lists the registered cards
- [ ] Add / rename / remove a card, each persisted to the cards tab
- [ ] Removing a card does not corrupt historical months
- [ ] All user-facing text via i18n, pt-BR default
