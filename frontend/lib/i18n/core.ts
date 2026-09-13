import { en, type TranslationKey } from './catalogs/en.ts';
import { es } from './catalogs/es.ts';
import type { Locale, LocalePersistenceTarget, TranslationVariables } from './types.ts';

export const LOCALE_STORAGE_KEY = 'uml-studio-locale';
export const LOCALE_COOKIE_KEY = 'uml-studio-locale';

const catalogs: Record<Locale, Record<TranslationKey, string>> = { en, es };

export function normalizeLocale(value: string | null | undefined): Locale | null {
  const language = value?.trim().toLowerCase();
  if (language === 'es' || language?.startsWith('es-')) return 'es';
  if (language === 'en' || language?.startsWith('en-')) return 'en';
  return null;
}

export function resolveLocale(
  savedLocale: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  const saved = normalizeLocale(savedLocale);
  if (saved) return saved;

  for (const preference of acceptLanguage?.split(',') ?? []) {
    const locale = normalizeLocale(preference.split(';')[0]);
    if (locale) return locale;
  }
  return 'en';
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  variables: TranslationVariables = {},
): string {
  const message = catalogs[locale]?.[key] ?? en[key];
  return message.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(variables, name)
      ? String(variables[name])
      : placeholder,
  );
}

export function formatLocalizedDate(locale: Locale, value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-BO' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function persistLocale(locale: Locale, target: LocalePersistenceTarget): void {
  target.storage.setItem(LOCALE_STORAGE_KEY, locale);
  target.root.lang = locale;
  target.writeCookie(
    `${LOCALE_COOKIE_KEY}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`,
  );
}
