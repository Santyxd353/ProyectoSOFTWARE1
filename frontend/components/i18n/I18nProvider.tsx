'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { TranslationKey } from '@/lib/i18n/catalogs/en.ts';
import {
  formatLocalizedDate,
  LOCALE_STORAGE_KEY,
  normalizeLocale,
  persistLocale,
  translate,
} from '@/lib/i18n/core.ts';
import type { Locale, TranslationVariables } from '@/lib/i18n/types.ts';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, variables?: TranslationVariables) => string;
  formatDate: (value: Date | string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const syncLocale = useCallback((nextLocale: Locale) => {
    persistLocale(nextLocale, {
      storage: window.localStorage,
      root: document.documentElement,
      writeCookie: (value) => {
        document.cookie = value;
      },
    });
  }, []);

  useEffect(() => {
    const savedLocale = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
    if (savedLocale && savedLocale !== initialLocale) {
      setLocaleState(savedLocale);
      syncLocale(savedLocale);
      return;
    }
    document.documentElement.lang = initialLocale;
  }, [initialLocale, syncLocale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    syncLocale(nextLocale);
  }, [syncLocale]);

  const t = useCallback(
    (key: TranslationKey, variables?: TranslationVariables) =>
      translate(locale, key, variables),
    [locale],
  );
  const formatDate = useCallback(
    (value: Date | string) => formatLocalizedDate(locale, value),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, formatDate }),
    [formatDate, locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
