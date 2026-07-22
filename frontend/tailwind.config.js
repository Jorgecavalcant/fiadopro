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
          50:  '#F0F3FD',
          100: '#E4E8F5',
          500: '#5967D8',
          600: '#4654C4',
          700: '#3D559C',
        },
        accent: {
          500: '#7252E2',
        },
        ice:    { 100: '#F0F3FD' },
        mist:   { 50: '#F8FAFF' },
        line:   { 200: '#CCD2E9' },
        slate:  { 500: '#65759D' },
        danger: {
          50:  '#fff1f2',
          100: '#ffe4e6',
          500: '#ef4444',
          600: '#dc2626',
        },
        success: {
          50:  '#EAF6F0',
          500: '#2E9D6F',
          600: '#25835D',
        },
        warning: {
          50: '#FBF3E4',
          500: '#DCA84A',
        },
      },
      fontFamily: {
        sans: ['Mulish', 'Inter', 'ui-sans-serif', 'system-ui'],
        data: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui'],
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
