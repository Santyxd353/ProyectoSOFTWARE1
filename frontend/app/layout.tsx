import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
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
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
