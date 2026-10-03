import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../store/hooks';
import { usePrivacyMode } from '../contexts/privacyMode';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  path: string;
  labelKey: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    path: '/plan',
    labelKey: 'navigation.plan',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  },
  {
    path: '/outflows',
    labelKey: 'navigation.outflows',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    path: '/income',
    labelKey: 'navigation.income',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    path: '/savings',
    labelKey: 'navigation.savings',
    icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
  },
];

/**
 * Top bar titles for the month-scoped screens, matched by route prefix. An
 * `addLabelKey` opts a screen into the top-bar "+", which opens the full-screen
 * editor for a new record of that month. Settings is not here: it is a
 * full-screen page with its own header.
 */
const SCREEN_TITLES: { prefix: string; labelKey: string; addLabelKey?: string }[] = [
  { prefix: '/plan', labelKey: 'plan.title', addLabelKey: 'plan.addBucket' },
  { prefix: '/outflows', labelKey: 'outflows.title', addLabelKey: 'outflows.addOutflow' },
  { prefix: '/income', labelKey: 'income.title', addLabelKey: 'income.addEntry' },
  // Savings has no top-bar "+" and no record editors: pots live in Settings.
  { prefix: '/savings', labelKey: 'savings.title' },
];

const BACK_ICON = 'M15 19l-7-7 7-7';
const ADD_ICON = 'M12 4v16m8-8H4';
const EYE_ICON =
  'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z';
const EYE_OFF_ICON =
  'M3 3l18 18 M10.584 10.587a2 2 0 002.828 2.83 M9.363 5.365A9.466 9.466 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.77 9.77 0 01-1.666 2.855 M6.228 6.228A9.77 9.77 0 002.458 12c1.274 4.057 5.064 7 9.542 7a9.47 9.47 0 003.332-.597';
const SETTINGS_ICON =
  'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z';

/**
 * The app shell: a contextual top bar, the scrollable content, and the fixed
 * bottom navigation. The top bar shows the current screen's name — Dashboard on
 * the home page — and adds the Settings shortcut on home or a back button
 * everywhere else. It also carries the app-wide Privacy Mode eye on every screen
 * it wraps, immediately left of the right-hand action (the "+" where a screen has
 * one, or Settings on home). Full-screen pages — Settings itself and the record
 * editors — do not use this shell, so they never show the eye, which is where
 * revealing a value to edit it is expected. The header and nav share the
 * content's `max-w-md` column so everything lines up on one axis.
 */
export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { masked, toggle } = usePrivacyMode();
  // Tabs carry the shared browsed month, so switching screens keeps the month
  // rather than resetting to the calendar month (see ADR-0004).
  const selectedMonth = useAppSelector((state) => state.app.selectedMonth);

  const isHome = location.pathname === '/';
  const screen = SCREEN_TITLES.find(({ prefix }) => location.pathname.startsWith(prefix));
  // The month-scoped screens carry it as their second path segment (e.g.
  // `/plan/2026-06`); the "+" only appears when there is a month to add into.
  const month = location.pathname.split('/').filter(Boolean)[1];

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          {!isHome && (
            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label={t('common.back')}
              className="-ml-2 rounded-lg p-2 transition-colors hover:bg-gray-100"
            >
              <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={BACK_ICON} />
              </svg>
            </button>
          )}

          <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-gray-900">
            {screen ? t(screen.labelKey) : t('home.title')}
          </h1>

          {/* Privacy Mode is app-wide, so it sits on every shelled screen. It is
              drawn with a distinct filled, slashed eye while engaged — the only
              cue that a remembered mode is on — immediately left of the screen's
              own action. */}
          <button
            type="button"
            onClick={toggle}
            aria-label={t(masked ? 'privacy.show' : 'privacy.hide')}
            aria-pressed={masked}
            className={`rounded-lg p-2 transition-colors ${
              masked
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={masked ? EYE_OFF_ICON : EYE_ICON}
              />
            </svg>
          </button>

          {screen?.addLabelKey && month && (
            <button
              type="button"
              onClick={() => navigate(`${screen.prefix}/new/${month}`)}
              aria-label={t(screen.addLabelKey)}
              className="rounded-lg bg-blue-600 p-2 text-white transition-colors hover:bg-blue-700"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ADD_ICON} />
              </svg>
            </button>
          )}

          {isHome && (
            <button
              type="button"
              onClick={() => navigate('/settings')}
              aria-label={t('navigation.settings')}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100"
            >
              <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={SETTINGS_ICON} />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* pb-24 clears the fixed bottom navigation so the last row is never hidden. */}
      <main className="flex-1 overflow-y-auto pb-24">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-md items-center justify-around px-4 py-3">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(`${item.path}/${selectedMonth}`)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 rounded-lg px-4 py-2 transition-colors ${
                  isActive ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                <span className="text-xs font-medium">{t(item.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
