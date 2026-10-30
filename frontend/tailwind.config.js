/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta Tech 42 — navy/cobalt/violet, regra 70/20/10
        ink:    { 900: '#10162F' },
        navy:   { 800: '#1C2446', 700: '#26315B' },
        blue:   { 600: '#3D559C' },
        primary: {
          50:  '#ECEDF7',
          100: '#ECEDF7',
          500: '#2B2F77',
          600: '#2B2F77',
          700: '#23265F',
        },
        indigo: {
          50: '#ECEDF7',
          100: '#ECEDF7',
          500: '#2B2F77',
          600: '#2B2F77',
          700: '#23265F',
          900: '#1A1A1A',
        },
        slate: {
          50: '#F6F6F4',
          100: '#EFEFEC',
          200: '#E6E6E2',
          400: '#5C5C5C',
          500: '#5C5C5C',
          900: '#1A1A1A',
        },
        red: { 600: '#B3261E', 700: '#B3261E' },
        emerald: { 600: '#1F7A4D', 700: '#1F7A4D' },
        green: { 600: '#1F7A4D', 700: '#1F7A4D' },
        accent: {
          500: '#2B2F77',
        },
        ice:    { 100: '#F0F3FD' },
        mist:   { 50: '#F8FAFF' },
        line:   { 200: '#CCD2E9' },
        slate:  { 500: '#65759D' },
        danger: {
          50:  '#F8E8E6',
          100: '#F8E8E6',
          500: '#B3261E',
          600: '#B3261E',
        },
        success: {
          50:  '#EAF6F0',
          500: '#1F7A4D',
          600: '#1F7A4D',
        },
        warning: {
          50: '#FFF6E5',
          500: '#5A3A00',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'Inter', 'Roboto', 'ui-sans-serif', 'system-ui'],
        data: ['-apple-system', 'Inter', 'Roboto', 'ui-sans-serif', 'system-ui'],
      },
      borderRadius: {
        t42sm: '8px',
        t42md: '14px',
        t42lg: '22px',
        t42xl: '28px',
      },
      boxShadow: {
        t42xs: '0 1px 2px rgba(16,22,47,0.05)',
        t42sm: '0 4px 16px rgba(16,22,47,0.07)',
        t42md: '0 14px 40px rgba(16,22,47,0.10)',
        t42cta: '0 12px 30px rgba(89,103,216,0.30)',
      },
    },
  },
  plugins: [],
}
