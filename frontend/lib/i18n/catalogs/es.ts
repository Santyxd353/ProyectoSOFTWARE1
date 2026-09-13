import type { TranslationKey } from './en.ts';

export const es = {
  'common.welcome': 'Bienvenido, {name}',
  'common.loading': 'Cargando…',
  'common.cancel': 'Cancelar',
  'common.save': 'Guardar',
  'common.delete': 'Eliminar',
  'common.close': 'Cerrar',
  'language.label': 'Cambiar idioma',
  'theme.toLight': 'Cambiar a modo claro',
  'theme.toDark': 'Cambiar a modo oscuro',
} as const satisfies Record<TranslationKey, string>;
