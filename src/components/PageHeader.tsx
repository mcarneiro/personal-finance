import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface PageHeaderProps {
  title: string;
  /** Where the back button goes; defaults to the Dashboard. */
  onBack?: () => void;
}

/**
 * The full-screen page header: a back button and the page title, on the same
 * `max-w-md px-4 py-3` axis as the rest of the shell. Record editors and
 * Settings use it, which is why those pages carry no bottom navigation.
 */
export default function PageHeader({ title, onBack }: PageHeaderProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onBack ?? (() => navigate('/'))}
          aria-label={t('common.back')}
          className="-ml-2 rounded-lg p-2 transition-colors hover:bg-gray-100"
        >
          <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-gray-900">{title}</h1>
      </div>
    </header>
  );
}
