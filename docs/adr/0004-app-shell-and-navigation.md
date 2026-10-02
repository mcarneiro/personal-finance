# The app shell and navigation are shared across every screen

Planyoo uses one mobile-first shell for every signed-in screen: `src/components/Layout.tsx` renders a contextual top bar, a `max-w-md` content column, and a fixed bottom navigation with three tabs — Plan, Bills, Income. The Dashboard (`/`) is the entry point and the only place the Settings shortcut appears; every other screen's top bar shows a back button (to `/`) and that screen's name, and the name is not repeated in the content. Settings is a full-screen page with its own header and back button and no bottom navigation — it is never a tab.

Concretely, the shared conventions are:

- Screen components are named `<Feature>Screen` and live under `src/features/<feature>/`.
- The top bar, bottom navigation, and content share the same `mx-auto max-w-md px-4` column so they line up on one axis, and the scrollable content reserves space for the fixed bottom nav (`pb-24`).
- Cards use `rounded-lg bg-white shadow-sm` — a drop shadow, no border.

We chose one shell over per-screen chrome to keep the visual language identical across the app, and consistent with Stayoo, which the app is based on. A single contextual top bar also removes the title duplication that creeps in when each screen draws its own header, and keeping Settings out of the bottom bar leaves the three tabs for month-to-month work only.

## Amendment: the top bar carries an optional add action, and records are edited on full-screen pages

Some screens need a way to create a record in the month they are browsing. Rather than draw per-screen chrome, the shared top bar exposes at most one optional action: a screen opts in by declaring an `addLabelKey` next to its title in `Layout`'s `SCREEN_TITLES`, and the shell renders a blue "+" on the right that opens the full-screen editor for a new record of the *current* month (`/plan/new/:month`, `/bills/new/:month`, `/income/new/:month`). The action is shown only when the route carries a month segment and the screen opted in.

Creating and editing a record always happens on a **full-screen record editor** — its own `PageHeader` (back + title), no bottom navigation — exactly like Settings and Stayoo's `NewExpense`. Tapping a row on the Plan, Bills or Income list navigates to `/plan/edit/:id`, `/bills/edit/:id` or `/income/edit/:id`; the red Remove action lives there and always confirms in a modal before deleting, never inline in the list. The shell stays free of per-screen chrome while each screen still gets the actions it needs. `PageHeader` is shared by Settings and the editors so the full-screen header is defined once.
