import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setSheetId } from '../../store/settingsSlice';
import { useGoogleAuth } from '../../contexts/GoogleAuthContext';
import { googleSheetsService, GoogleSheetsService } from '../../services/GoogleSheetsService';
import { GOOGLE_CONFIG } from '../../config/google';

export default function Onboarding() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const existingSheetId = useAppSelector((state) => state.settings.sheetId);
  const { signIn, isSignedIn, userEmail, error: authError } = useGoogleAuth();

  const [sheetUrl, setSheetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if Client ID is configured
  const isConfigured = !!GOOGLE_CONFIG.CLIENT_ID;

  // If the user is signed in and already has a sheet, App.tsx handles navigation
  const hasExistingSetup = !!existingSheetId;

  const handleSignIn = () => {
    if (!isConfigured) {
      setError(t('onboarding.configRequired'));
      return;
    }

    setError('');
    signIn();
  };

  const handleSheetSetup = async () => {
    const spreadsheetId = GoogleSheetsService.extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      setError(t('onboarding.invalidSheetUrl'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create any missing tabs with headers, leaving existing content untouched
      await googleSheetsService.initializeSheets(spreadsheetId);

      // Remember the connection
      dispatch(setSheetId(spreadsheetId));

      navigate('/');
    } catch (err) {
      console.error('Failed to set up the Google Sheet:', err);
      setError(t('onboarding.setupFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">{t('onboarding.title')}</h1>
          <p className="text-gray-600">{t('onboarding.subtitle')}</p>
        </div>

        {!isConfigured && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="mb-2 text-sm font-semibold text-red-900">
              {t('onboarding.configRequired')}
            </p>
            <p className="text-xs text-red-800">{t('onboarding.configMessage')}</p>
          </div>
        )}

        {/* Step 1: Sign in with Google */}
        {!isSignedIn ? (
          <div className="space-y-6">
            <div>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                {hasExistingSetup ? t('onboarding.signInToContinue') : t('onboarding.step1')}
              </h2>
              <p className="mb-4 text-sm text-gray-600">
                {hasExistingSetup ? t('onboarding.sessionExpired') : t('onboarding.needAccess')}
              </p>

              {!hasExistingSetup && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="mb-2 text-xs font-semibold text-blue-900">
                    {t('onboarding.whatAccess')}
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-xs text-blue-800">
                    <li>{t('onboarding.accessItem1')}</li>
                    <li>{t('onboarding.accessItem2')}</li>
                    <li>{t('onboarding.accessItem3')}</li>
                  </ul>
                </div>
              )}
            </div>

            {(error || authError) && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">{error || authError}</p>
              </div>
            )}

            <button
              onClick={handleSignIn}
              disabled={loading || !isConfigured}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {loading ? t('onboarding.signingIn') : t('onboarding.signInButton')}
            </button>
          </div>
        ) : hasExistingSetup ? (
          /* User has an existing setup, show loading message while App.tsx navigates */
          <div className="space-y-6">
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm text-green-800">
                {t('onboarding.signedInAs', { email: userEmail })}
              </p>
            </div>
            <div className="py-8 text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
              <p className="text-gray-700">{t('onboarding.loadingData')}</p>
            </div>
          </div>
        ) : (
          /* Step 2: Google Sheet setup - only for new users */
          <div className="space-y-6">
            <div>
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-sm text-green-800">
                  {t('onboarding.signedInAs', { email: userEmail })}
                </p>
              </div>

              <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('onboarding.step2')}</h2>
              <p className="mb-4 text-sm text-gray-600">{t('onboarding.enterSheetUrl')}</p>

              <label htmlFor="sheetUrl" className="mb-2 block text-sm font-medium text-gray-700">
                {t('onboarding.sheetUrlLabel')}
              </label>
              <input
                type="text"
                id="sheetUrl"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                disabled={loading}
              />
              <p className="mt-2 text-xs text-gray-500">
                {t('onboarding.noSheet')}{' '}
                <a
                  href="https://sheets.new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {t('onboarding.createSheet')}
                </a>
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <button
              onClick={handleSheetSetup}
              disabled={loading || !sheetUrl.trim()}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {loading ? t('onboarding.settingUp') : t('onboarding.completeSetup')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
