export type Theme = 'light' | 'dark';

type ThemeRoot = {
  classList: {
    toggle: (name: string, force?: boolean) => void;
  };
  dataset: Record<string, string | undefined>;
  style: {
    colorScheme?: string;
  };
};

export const THEME_STORAGE_KEY = 'uml-studio-theme';

export function resolveTheme(
  savedTheme: string | null,
  systemPrefersDark: boolean,
): Theme {
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }

  return systemPrefersDark ? 'dark' : 'light';
}

export function applyTheme(root: ThemeRoot, theme: Theme): void {
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}
