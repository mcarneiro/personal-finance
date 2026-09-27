# 02 — Onboarding + Google Sheets foundation

**What to build:** Stayoo's foundation ported wholesale: Google OAuth sign-in, the sheets service, the debounced sync middleware, and the startup data load — plus onboarding: paste a Google Sheet URL, validate it, auto-create the five tabs (cards, plan, card_spending, bills, income) with the correct headers, and allow changing the connected sheet in Settings. Demo: connect a real sheet and watch the tabs appear with headers.

**Blocked by:** 01 — App skeleton

**Status:** done

- [x] Onboarding connects to a Google Sheet via OAuth from a pasted URL
- [x] Missing tabs are auto-created with the spec's columns; existing sheet content is left untouched
- [x] The sheet connection is remembered and can be changed in Settings
- [x] Data loads on app start behind a loading state — no flash of empty data
- [x] Mutations write back through the ported debounced sync middleware

## Comments

- Implemented 2026-09-27. Ported Stayoo's Sheets foundation (ADR-0001) and added the Planoo entity layer + onboarding.
  - `src/config/google.ts` — `GOOGLE_CONFIG` plus `SHEET_CONFIGS` for the five tabs (`cards`, `plan`, `card_spending`, `bills`, `income`); column names and order match `prd.md`.
  - `src/services/GoogleSheetsService.ts` — OAuth-token plumbing, `initializeSheets` (creates only missing tabs, writes their headers, never touches existing content), per-tab read/write, `extractSpreadsheetId`.
  - Slices: `cards`, `plan` (plan items + card spending), `bills`, `income`, `settings` (sheetId). Scope decision with the user: the four entity slices are built now, so the load + write-back path is real; tickets 03–08 add the screens/selectors on top.
  - `src/hooks/useDataSync.ts` loads all five tabs on start; `src/store/middleware/syncListener.ts` debounces mutations back to the sheet. Bulk `set*` actions dispatched by the load are excluded, so loading never echoes back.
  - `GoogleAuthContext` + `Onboarding` (`/onboarding`) + App auth/data gate + session-expired banner; `main.tsx` wraps `GoogleOAuthProvider` and `GoogleAuthProvider`.
  - Settings gains the connected-sheet control (masked ID; re-initializes tabs on change); the language switcher is unchanged.
  - Re-added the CSP meta in `index.html` (after the viewport so it never blocks Vite's dev preamble).
  - Added `@react-oauth/google@^0.12.2` and `.env.example`.
  - Tests: 27 green — `App.test.tsx` (7), `App.sync.test.tsx` (1), `Onboarding.test.tsx` (4), `SettingsScreen.test.tsx` (3), `GoogleSheetsService.test.ts` (3), `google.test.ts` (1), plus month/i18n (8). Seam B as specified: screens with a mocked sheets service.
  - `/code-review` (fixed point `643d194`) findings actioned: (1) the startup gate no longer deadlocks after a failed load (`setDataLoading(false)` in the catch); (2) sheet writes use `valueInputOption=RAW` so `YYYY-MM` months aren't coerced into dates and read back as serial numbers — regression test added; (3) sheet-setup errors are shown via i18n instead of raw service English.
  - Deliberate deviations, for review: kept a small `GoogleSheetsService` schema/round-trip test and the `SHEET_CONFIGS` contract test (the Planoo tab schema and string months are app-specific, not Stayoo-proven); removed the sync-middleware unit test to honour the spec's "the sync middleware is not a seam" line. The ported `GoogleAuthContext` still persists the access token in browser storage (Stayoo parity, ADR-0001), mitigated by the CSP; `sheetExists` swallowing errors is ported behavior.
  - Out of scope for this ticket (carried to `09-real-data-verification`): warning on unexpected columns in an existing sheet (PRD risk mitigation).
  - Follow-up fix from manual testing: an unconfigured build (`VITE_GOOGLE_CLIENT_ID` empty) went blank once the GSI script loaded — `useGoogleLogin` calls `initTokenClient` with an empty `client_id`, which Google throws on, unmounting the tree. The login client is now created by a `GoogleLoginBridge` that renders only when a client ID exists, so unconfigured builds show onboarding's config warning. Regression test in `GoogleAuthContext.test.tsx`.
