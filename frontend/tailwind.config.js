/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: { DEFAULT: '#FFD700', dark: '#C9A800', light: '#FFE55C' },
        ink:  { DEFAULT: '#080808', 50: '#0F0F0F', 100: '#141414', 200: '#1A1A1A', 300: '#222', 400: '#2A2A2A', 500: '#333', 600: '#555', 700: '#888', 800: '#AAA', 900: '#CCC' },
        cream: '#F5F0E8',
        rap: { red: '#E63946', green: '#2DC653', orange: '#FF6B00' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        mono:    ['var(--font-mono)',    'monospace'],
        body:    ['var(--font-body)',    'sans-serif'],
      },
      keyframes: {
        'fade-up':  { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'marquee':  { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        'pulse-gold': { '0%,100%': { boxShadow: '0 0 0 0 rgba(255,215,0,0.25)' }, '50%': { boxShadow: '0 0 24px 4px rgba(255,215,0,0.12)' } },
        'shimmer':  { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(200%)' } },
      },
      animation: {
        'fade-up':    'fade-up 0.4s ease forwards',
        'marquee':    'marquee 24s linear infinite',
        'pulse-gold': 'pulse-gold 2.5s ease-in-out infinite',
        'shimmer':    'shimmer 1.8s ease infinite',
      },
    },
  },
  plugins: [],
};
