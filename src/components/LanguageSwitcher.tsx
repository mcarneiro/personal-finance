import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'pt-BR', labelKey: 'settings.languagePtBR' },
  { code: 'en-US', labelKey: 'settings.languageEnUS' },
] as const;

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current =
    LANGUAGES.find((language) => i18n.language?.startsWith(language.code))?.code ?? 'pt-BR';

  return (
    <div className="mt-6">
      <label htmlFor="language" className="block text-sm font-medium text-gray-700">
        {t('settings.language')}
      </label>
      <select
        id="language"
        value={current}
        onChange={(event) => i18n.changeLanguage(event.target.value)}
        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
      >
        {LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {t(language.labelKey)}
          </option>
        ))}
      </select>
    </div>
  );
}
