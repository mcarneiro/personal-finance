import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

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
];

const BACK_ICON = 'M15 19l-7-7 7-7';
const ADD_ICON = 'M12 4v16m8-8H4';
const SETTINGS_ICON =
  'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z';

/**
 * The app shell: a contextual top bar, the scrollable content, and the fixed
 * bottom navigation. The top bar shows the current screen's name — Dashboard on
 * the home page — and adds the Settings shortcut on home or a back button
 * everywhere else. The header and nav share the content's `max-w-md` column so
 * everything lines up on one axis.
 */
export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

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
                onClick={() => navigate(item.path)}
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
