export const en = {
  'common.welcome': 'Welcome, {name}',
  'common.loading': 'Loading…',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.close': 'Close',
  'language.label': 'Change language',
  'theme.toLight': 'Switch to light mode',
  'theme.toDark': 'Switch to dark mode',
} as const;

export type TranslationKey = keyof typeof en;
