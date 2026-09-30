import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import CardRegistry from './CardRegistry';
import BankRegistry from './BankRegistry';
import PayerRegistry from './PayerRegistry';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setSheetId } from '../../store/settingsSlice';
import { useGoogleAuth } from '../../contexts/GoogleAuthContext';
import { googleSheetsService, GoogleSheetsService } from '../../services/GoogleSheetsService';

/** Never render the full spreadsheet ID; show only enough to identify the sheet. */
function maskSheetId(sheetId: string): string {
  const suffix = sheetId.slice(-4);
  return `••••••${suffix}`;
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const sheetId = useAppSelector((state) => state.settings.sheetId);
  const { userEmail } = useGoogleAuth();

  const [sheetUrl, setSheetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const handleConnectSheet = async (event: FormEvent) => {
    event.preventDefault();

    const spreadsheetId = GoogleSheetsService.extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      setError(t('settings.invalidSheetUrl'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create any missing tabs with headers, leaving existing content untouched
      await googleSheetsService.initializeSheets(spreadsheetId);
      dispatch(setSheetId(spreadsheetId));
      setSheetUrl('');
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      console.error('Failed to connect the Google Sheet:', err);
      setError(t('settings.sheetConnectFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Full-screen page: its own header with a back button, no bottom navigation. */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label={t('common.back')}
            className="-ml-2 rounded-lg p-2 transition-colors hover:bg-gray-100"
          >
            <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-gray-900">
            {t('settings.title')}
          </h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md px-4 py-6">
        {userEmail && (
          <p className="mt-1 text-sm text-gray-500">
            {t('settings.signedInAs', { email: userEmail })}
          </p>
        )}

        <section className="mt-6 rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">{t('settings.connectedSheet')}</h2>

          {sheetId ? (
            <p className="mt-1 text-sm text-gray-600">
              {t('settings.connectedSheetHelper', { sheetId: maskSheetId(sheetId) })}
            </p>
          ) : (
            <p className="mt-1 text-sm text-gray-600">{t('settings.noSheet')}</p>
          )}

          <form onSubmit={handleConnectSheet} className="mt-4 space-y-3">
            <label
              htmlFor="sheetUrl"
              className="block text-sm font-medium text-gray-700"
            >
              {t('settings.sheetUrlLabel')}
            </label>
            <input
              type="text"
              id="sheetUrl"
              value={sheetUrl}
              onChange={(event) => setSheetUrl(event.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500">{t('settings.sheetIdHelper')}</p>

            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !sheetUrl.trim()}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {loading
                ? t('settings.settingUp')
                : sheetId
                  ? t('settings.changeSheet')
                  : t('settings.connectSheet')}
            </button>

            {isSaved && <p className="text-sm text-green-700">{t('settings.sheetSaved')}</p>}
          </form>
        </section>

        <CardRegistry />
        <BankRegistry />
        <PayerRegistry />

        <LanguageSwitcher />
      </div>
    </div>
  );
}
