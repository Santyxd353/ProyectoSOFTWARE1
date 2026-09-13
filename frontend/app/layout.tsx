import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { LOCALE_COOKIE_KEY, resolveLocale } from '@/lib/i18n/core.ts';
import { THEME_STORAGE_KEY } from '@/lib/theme';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'UML Studio',
  description: 'Diseña y colabora en diagramas UML con asistencia de IA',
};

const themeScript = `
  (() => {
    try {
      const saved = localStorage.getItem('${THEME_STORAGE_KEY}');
      const theme = saved === 'light' || saved === 'dark'
        ? saved
        : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch (_) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialLocale = resolveLocale(
    cookies().get(LOCALE_COOKIE_KEY)?.value,
    headers().get('accept-language'),
  );

  return (
    <html lang={initialLocale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className}>
        <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
