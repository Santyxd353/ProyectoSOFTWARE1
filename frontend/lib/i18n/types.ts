export type Locale = 'en' | 'es';

export type TranslationVariables = Record<string, string | number>;

export interface LocalePersistenceTarget {
  storage: Pick<Storage, 'setItem'>;
  root: Pick<HTMLElement, 'lang'>;
  writeCookie: (value: string) => void;
}
