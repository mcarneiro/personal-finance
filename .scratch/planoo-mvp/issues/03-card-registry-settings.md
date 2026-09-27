# 03 — Card registry (Settings)

**What to build:** Settings manages the household's credit cards: add, rename, and remove — each change round-tripping to the sheet through the proven sync path. This is the first complete write loop and the input mechanism the plan screen's check-ins will use. Demo: manage cards in the app, see the rows in the sheet's cards tab.

**Blocked by:** 02 — Onboarding + Google Sheets foundation

**Status:** done

- [x] Settings lists the registered cards
- [x] Add / rename / remove a card, each persisted to the cards tab
- [x] Removing a card does not corrupt historical months
- [x] All user-facing text via i18n, pt-BR default

## Comments

- Implemented 2026-09-27. A `CardRegistry` section in Settings, backed by the existing `cardsSlice` → sync-middleware → `writeCards` path (no new sync code; this is the first UI onto that loop).
  - `src/features/settings/CardRegistry.tsx`: lists registered cards; add by name; rename in place (Save/Cancel); remove. Empty state, disabled submits for blank names, names trimmed, ids from `generateId()`.
  - `src/utils/id.ts`: `generateId()` wraps `crypto.randomUUID()`. Ids are opaque and never reused, so a re-added card can never inherit a removed card's spending history.
  - History safety: `deleteCard` only filters the registry. `card_spending` rows are never touched, so past months keep their per-card totals. Guarded by a test asserting the card_spending tab is never written on removal (ADR-0002).
  - i18n: all new strings in pt-BR (primary) and en-US.
  - Tests: 6 new (`id.test.ts` + 5 registry cases on the Seam B screen boundary with a real store, real sync middleware, mocked sheets service). Suite is 35 green; `npm run lint` and `npx tsc --noEmit` clean.
  - Browser verification (chrome-mcp): seeded auth + a stubbed Sheets boundary via `navigate_page`'s `initScript`, then drove the real UI — add "cc ml", rename "cc guta" → "cc guta visa", remove "cc uv". Observed the debounced write-back as a `clear` + `PUT` to `cards!A2` carrying the updated rows, and zero writes to `card_spending`.
- `/code-review` (fixed point `f38eaba`, before the amend) findings actioned: (1) new tests asserted Redux internals, which `spec.md` forbids ("asserts external behavior only … never slice shapes, store internals") — rewritten to assert rendered state plus the mocked write boundary; (2) dropped the speculative `randomUUID` fallback; (3) de-duplicated the ADR-0002 rationale (kept on the slice, referenced from the component).
- Judgement calls left as-is: add and rename share a small trim-guard shape (extracting it would obscure two distinct flows); the component owns list + both forms (cohesive, single feature); the middleware's silent write-failure handling is pre-existing Stayoo-ported behaviour, out of scope here.
- Carried to 06: a card removed mid-month still contributes to the current month's Total Spent via its `card_spending` row but has no registered input to overwrite it. Past months should render orphaned totals read-only; ticket 06 must decide how the current month surfaces this.
