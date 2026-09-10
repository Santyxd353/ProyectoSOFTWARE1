/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        gray: {
          50: "hsl(var(--background) / <alpha-value>)",
          100: "hsl(var(--muted) / <alpha-value>)",
          200: "hsl(var(--secondary) / <alpha-value>)",
          300: "hsl(var(--input) / <alpha-value>)",
          400: "hsl(var(--muted-foreground) / 0.58)",
          500: "hsl(var(--muted-foreground) / <alpha-value>)",
          600: "hsl(var(--neutral-action) / <alpha-value>)",
          700: "hsl(var(--neutral-action-strong) / <alpha-value>)",
          800: "hsl(var(--foreground) / <alpha-value>)",
          900: "hsl(var(--foreground) / <alpha-value>)",
        },
        blue: {
          100: "hsl(var(--primary-soft) / <alpha-value>)",
          500: "hsl(var(--ring) / <alpha-value>)",
          600: "hsl(var(--primary) / <alpha-value>)",
          700: "hsl(var(--primary-strong) / <alpha-value>)",
        },
        green: {
          50: "hsl(var(--success-soft) / <alpha-value>)",
          200: "hsl(var(--success-border) / <alpha-value>)",
          600: "hsl(var(--success) / <alpha-value>)",
          700: "hsl(var(--success-strong) / <alpha-value>)",
          800: "hsl(var(--success-foreground) / <alpha-value>)",
        },
        purple: {
          600: "hsl(var(--info) / <alpha-value>)",
          700: "hsl(var(--info-strong) / <alpha-value>)",
        },
        red: {
          50: "hsl(var(--danger-soft) / <alpha-value>)",
          100: "hsl(var(--danger-soft) / <alpha-value>)",
          200: "hsl(var(--danger-border) / <alpha-value>)",
          500: "hsl(var(--destructive) / <alpha-value>)",
          600: "hsl(var(--destructive) / <alpha-value>)",
          700: "hsl(var(--destructive-strong) / <alpha-value>)",
          800: "hsl(var(--danger-foreground) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
