# 06 — Card check-in + remaining estimates + projection

**What to build:** The live control loop on the plan screen: one current-total input per registered card, overwritten at each check-in with no history kept; Total Spent displayed and labeled "so far"; one remaining-estimate input per bucket, editable anytime; and the Projected Result headline — green when positive, red when negative — which becomes the Plan Result headline for past months. Demo: the full sobra loop, live against real numbers.

**Blocked by:** 03 — Card registry (Settings); 05 — Plan composition

**Status:** ready-for-agent

- [ ] Check-in: current total per card, overwritten at each update, no snapshot history
- [ ] Total Spent displayed, labeled "so far"
- [ ] Remaining estimate per spending bucket, editable anytime
- [ ] Projected Result headline is green/red and updates live on any input
- [ ] Past months show the Plan Result as the headline, not the projection
- [ ] Card spending persists to the card_spending tab through the sync path
