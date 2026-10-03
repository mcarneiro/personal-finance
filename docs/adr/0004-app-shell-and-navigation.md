# The app shell and navigation are shared across every screen

Planyoo uses one mobile-first shell for every signed-in screen: `src/components/Layout.tsx` renders a contextual top bar, a `max-w-md` content column, and a fixed bottom navigation with four tabs — Plan, Outflows, Income, Savings. The Dashboard (`/`) is the entry point and the only place the Settings shortcut appears; every other screen's top bar shows a back button (to `/`) and that screen's name, and the name is not repeated in the content. Settings is a full-screen page with its own header and back button and no bottom navigation — it is never a tab.

Concretely, the shared conventions are:

- Screen components are named `<Feature>Screen` and live under `src/features/<feature>/`.
- The top bar, bottom navigation, and content share the same `mx-auto max-w-md px-4` column so they line up on one axis, and the scrollable content reserves space for the fixed bottom nav (`pb-24`).
- Cards use `rounded-lg bg-white shadow-sm` — a drop shadow, no border.
- The bottom nav holds every month-to-month ledger screen. Savings joins Plan, Outflows and Income as a tab because it too is browsed month by month (ADR-0011); Settings and the record editors stay out of it.

We chose one shell over per-screen chrome to keep the visual language identical across the app, and consistent with Stayoo, which the app is based on. A single contextual top bar also removes the title duplication that creeps in when each screen draws its own header, and keeping Settings out of the bottom bar leaves the tabs for month-to-month work only.

## Amendment: the top bar carries an optional add action, and records are edited on full-screen pages

Some screens need a way to create a record in the month they are browsing. Rather than draw per-screen chrome, the shared top bar exposes at most one optional action: a screen opts in by declaring an `addLabelKey` next to its title in `Layout`'s `SCREEN_TITLES`, and the shell renders a blue "+" on the right that opens the full-screen editor for a new record of the *current* month (`/plan/new/:month`, `/outflows/new/:month`, `/income/new/:month`). The action is shown only when the route carries a month segment and the screen opted in.

Creating and editing a record always happens on a **full-screen record editor** — its own `PageHeader` (back + title), no bottom navigation — exactly like Settings and Stayoo's `NewExpense`. Tapping a row on the Plan, Outflows or Income list navigates to `/plan/edit/:id`, `/outflows/edit/:id` or `/income/edit/:id`; the red Remove action lives there and always confirms in a modal before deleting, never inline in the list. The shell stays free of per-screen chrome while each screen still gets the actions it needs. `PageHeader` is shared by Settings and the editors so the full-screen header is defined once.

## Amendment: the browsed month is shared across the month-scoped tabs

The four month-scoped screens (Plan, Outflows, Income, Savings) browse the same month. Rather than each tab resetting to the calendar month when you switch, the app keeps one **shared browsed month** in Redux (`app.selectedMonth`): `App` syncs it from any `:month` route segment, the bottom nav links carry it, and the bare `/plan`, `/outflows`, `/income` and `/savings` redirects resolve to it. Browse September on Outflows and Plan, Income and Savings all open on September.

Returning to the Dashboard **resets** the shared month to the current month, because the Dashboard is the current-month home. The Dashboard deliberately stays current-month only and never reads `selectedMonth`; opening it (or any Dashboard block for the current month) re-syncs the shared month, so the tabs you open from the Dashboard match the month it just showed. The shared month is **session navigation state only**: it lives in memory, defaults to the current month on a fresh load, and is never written to the sheet or a device preference (ADR-0001). We chose a shared Redux value over carrying the month only in the tab links so that prev/next and Dashboard block links also update it, keeping one source of truth for "the month I am browsing".
