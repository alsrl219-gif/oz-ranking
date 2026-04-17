/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#fff1f0',
          100: '#ffe4e2',
          200: '#ffccc7',
          300: '#ffa99f',
          400: '#ff7a6d',
          500: '#ff5043',
          600: '#ed2f22',
          700: '#c81f14',
          800: '#a41e14',
          900: '#881f17',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'card-hover': '0 4px 12px 0 rgb(0 0 0 / 0.08)',
      },
    },
  },
  plugins: [],
}
