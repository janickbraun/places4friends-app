/** @type {import('tailwindcss').Config} */
// Design tokens ported verbatim from the web app's src/app/globals.css so the
// mobile UI matches the web pixel-for-pixel. Brand green is #226622 with low-alpha
// variants for the 50–300 steps; 400–900 are the solid brand color.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#ffffff',
        foreground: '#0f172a', // slate-900
        'brand-green': {
          50: 'rgba(34, 102, 34, 0.05)',
          100: 'rgba(34, 102, 34, 0.10)',
          200: 'rgba(34, 102, 34, 0.20)',
          300: 'rgba(34, 102, 34, 0.30)',
          400: '#226622',
          500: '#226622',
          600: '#226622',
          700: '#226622',
          800: '#226622',
          900: '#226622',
        },
      },
      fontFamily: {
        sans: ['Inter', 'System', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
