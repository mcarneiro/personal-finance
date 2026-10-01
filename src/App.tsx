import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';
import DashboardScreen from './features/dashboard/DashboardScreen';
import PlanScreen from './features/plan/PlanScreen';
import BucketEditor from './features/plan/BucketEditor';
import BillsScreen from './features/bills/BillsScreen';
import BillEditor from './features/bills/BillEditor';
import IncomeScreen from './features/income/IncomeScreen';
import IncomeEditor from './features/income/IncomeEditor';
import SettingsScreen from './features/settings/SettingsScreen';
import Onboarding from './features/onboarding/Onboarding';
import { useAppSelector } from './store/hooks';
import { useDataSync } from './hooks/useDataSync';
import { useGoogleAuth } from './contexts/GoogleAuthContext';
import { getCurrentMonth } from './utils/month';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const sheetId = useAppSelector((state) => state.settings.sheetId);
  const authInitialized = useAppSelector((state) => state.app.authInitialized);
  const dataLoading = useAppSelector((state) => state.app.dataLoading);
  const dataLoaded = useAppSelector((state) => state.app.dataLoaded);
  const syncing = useAppSelector((state) => state.app.syncing);
  const offline = useAppSelector((state) => state.app.offline);
  const { isSignedIn, sessionExpired, clearSessionExpired } = useGoogleAuth();

  // Load data from the connected sheet on start; writes go through the sync middleware.
  useDataSync();

  // Centralized navigation - single source of truth. This effect must run before
  // any early return (Rules of Hooks).
  useEffect(() => {
    if (!authInitialized) return;

    const isOnboarding = location.pathname === '/onboarding';
    const isAppReady = isSignedIn && sheetId;

    // Signed in with a sheet but sitting on onboarding → enter the app
    if (isAppReady && isOnboarding) {
      navigate('/', { replace: true });
      return;
    }

    // Needs setup (not signed in or no sheet) and not on onboarding → onboard
    if (!isAppReady && !isOnboarding) {
      navigate('/onboarding', { replace: true });
    }
  }, [authInitialized, isSignedIn, sheetId, location.pathname, navigate]);

  // Hold a loading screen while auth initializes and while the initial data load
  // settles, so the app never flashes empty data.
  if (!authInitialized || (isSignedIn && sheetId && !dataLoaded && dataLoading)) {
    return <LoadingScreen />;
  }

  const currentMonth = getCurrentMonth();

  return (
    <>
      {sessionExpired && (
        <div className="fixed left-0 right-0 top-0 z-50 bg-yellow-500 px-4 py-3 text-white shadow-lg">
          <div className="mx-auto flex max-w-md items-center justify-between">
            <div>
              <p className="font-semibold">{t('session.title')}</p>
              <p className="text-sm">{t('session.message')}</p>
            </div>
            <button
              onClick={clearSessionExpired}
              aria-label={t('session.dismiss')}
              className="text-white transition-colors hover:text-yellow-100"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {syncing && !dataLoading && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 top-16 z-40 -translate-x-1/2 rounded-full bg-gray-900/80 px-3 py-1 text-xs font-medium text-white shadow-sm"
        >
          {t('common.syncing')}
        </div>
      )}

      {offline && !dataLoading && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 top-16 z-40 -translate-x-1/2 rounded-full bg-amber-600/90 px-3 py-1 text-xs font-medium text-white shadow-sm"
        >
          {t('common.offline')}
        </div>
      )}

      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route
          path="/"
          element={
            <Layout>
              <DashboardScreen />
            </Layout>
          }
        />
        <Route path="/plan" element={<Navigate to={`/plan/${currentMonth}`} replace />} />
        <Route
          path="/plan/:month"
          element={
            <Layout>
              <PlanScreen />
            </Layout>
          }
        />
        {/* Record editors are full-screen pages: their own header, no bottom nav. */}
        <Route path="/plan/new/:month" element={<BucketEditor />} />
        <Route path="/plan/edit/:id" element={<BucketEditor />} />
        <Route path="/bills" element={<Navigate to={`/bills/${currentMonth}`} replace />} />
        <Route
          path="/bills/:month"
          element={
            <Layout>
              <BillsScreen />
            </Layout>
          }
        />
        <Route path="/bills/new/:month" element={<BillEditor />} />
        <Route path="/bills/edit/:id" element={<BillEditor />} />
        <Route path="/income" element={<Navigate to={`/income/${currentMonth}`} replace />} />
        <Route
          path="/income/:month"
          element={
            <Layout>
              <IncomeScreen />
            </Layout>
          }
        />
        <Route path="/income/new/:month" element={<IncomeEditor />} />
        <Route path="/income/edit/:id" element={<IncomeEditor />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
