'use client';

import { useI18n } from './I18nProvider';
import type { Locale } from '@/lib/i18n/types.ts';

const options: Locale[] = ['es', 'en'];

export default function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t('language.label')}
      className="inline-flex h-11 items-center rounded-md border border-border bg-card p-1 shadow-sm"
    >
      {options.map((option) => {
        const active = locale === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => setLocale(option)}
            className={`h-9 min-w-11 rounded px-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
              active
                ? 'border border-border bg-muted font-semibold text-foreground'
                : 'border border-transparent font-medium text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
