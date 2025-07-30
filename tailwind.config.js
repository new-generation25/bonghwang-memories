/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sepia: {
          50: 'rgb(var(--sepia-50) / <alpha-value>)',
          100: 'rgb(var(--sepia-100) / <alpha-value>)',
          200: 'rgb(var(--sepia-200) / <alpha-value>)',
          300: 'rgb(var(--sepia-300) / <alpha-value>)',
          400: 'rgb(var(--sepia-400) / <alpha-value>)',
          500: 'rgb(var(--sepia-500) / <alpha-value>)',
          600: 'rgb(var(--sepia-600) / <alpha-value>)',
          700: 'rgb(var(--sepia-700) / <alpha-value>)',
          800: 'rgb(var(--sepia-800) / <alpha-value>)',
          900: 'rgb(var(--sepia-900) / <alpha-value>)',
        },
        vintage: {
          brown: 'rgb(var(--vintage-brown) / <alpha-value>)',
          gold: 'rgb(var(--vintage-gold) / <alpha-value>)',
          cream: 'rgb(var(--vintage-cream) / <alpha-value>)',
        }
      },
      fontFamily: {
        handwriting: ['Noto Sans KR', 'sans-serif'],
        vintage: ['Noto Serif KR', 'serif'],
      },
      backgroundImage: {
        'vintage-paper': 'linear-gradient(145deg, rgb(244 241 232), rgb(240 230 210))',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'typing': 'typing 3.5s steps(40, end)',
        'blink': 'blink-caret .75s step-end infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        typing: {
          'from': { width: '0' },
          'to': { width: '100%' },
        },
        'blink-caret': {
          'from, to': { 'border-color': 'transparent' },
          '50%': { 'border-color': 'currentColor' },
        },
      },
    },
  },
  plugins: [],
}