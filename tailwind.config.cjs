module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './app/components/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        moloch: {
          100: 'var(--moloch-100)',
          200: 'var(--moloch-200)',
          300: 'var(--moloch-300)',
          400: 'var(--moloch-400)',
          500: 'var(--moloch-500)',
          600: 'var(--moloch-600)',
          700: 'var(--moloch-700)',
          800: 'var(--moloch-800)'
        },
        scroll: {
          100: 'var(--scroll-100)',
          200: 'var(--scroll-200)',
          300: 'var(--scroll-300)',
          400: 'var(--scroll-400)',
          500: 'var(--scroll-500)',
          600: 'var(--scroll-600)',
          700: 'var(--scroll-700)',
          800: 'var(--scroll-800)'
        },
        neutral: {
          100: 'var(--neutral-100)',
          200: 'var(--neutral-200)',
          300: 'var(--neutral-300)',
          400: 'var(--neutral-400)',
          500: 'var(--neutral-500)',
          600: 'var(--neutral-600)',
          700: 'var(--neutral-700)',
          800: 'var(--neutral-800)',
          white: 'var(--neutral-white)',
          black: 'var(--neutral-black)'
        },
        brand: {
          bg: 'var(--bg)',
          fg: 'var(--fg)',
          surface: 'var(--surface)',
          muted: 'var(--muted)',
          accent: 'var(--accent)'
        }
      },
      fontFamily: {
        display: ['"Mazius Display"', 'EB Garamond', 'serif'],
        serif: ['EB Garamond', 'serif'],
        mono: ['"Ubuntu Mono"', 'ui-monospace', 'monospace']
      },
      borderRadius: {
        DEFAULT: 'var(--radius)'
      }
    },
  },
  plugins: [],
};
