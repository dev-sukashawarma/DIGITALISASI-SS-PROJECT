/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      boxShadow: {
        'soft':   '0 2px 15px -3px rgba(0,0,0,.07), 0 10px 20px -2px rgba(0,0,0,.04)',
        'card':   '0 1px 3px rgba(0,0,0,.05), 0 4px 12px rgba(0,0,0,.04)',
        'card-hover': '0 4px 20px rgba(0,0,0,.10)',
        'amber':  '0 4px 14px rgba(245,158,11,.35)',
        'inner-top': 'inset 0 1px 0 rgba(255,255,255,.15)',
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #1c1917 0%, #292524 50%, #1c1917 100%)',
        'amber-gradient': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        'card-shine': 'linear-gradient(135deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,0) 100%)',
      },
      animation: {
        'fade-up':    'fadeUp .4s ease forwards',
        'fade-in':    'fadeIn .3s ease forwards',
        'fade-out':   'fadeOut .3s ease forwards',
        'slide-in':   'slideIn .35s cubic-bezier(.16,1,.3,1) forwards',
        'scale-in':   'scaleIn .2s ease forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'spin-slow':  'spin 2s linear infinite',
      },
      keyframes: {
        fadeUp:     { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        fadeIn:     { from: { opacity: 0 }, to: { opacity: 1 } },
        fadeOut:    { from: { opacity: 1 }, to: { opacity: 0 } },
        slideIn:    { from: { opacity: 0, transform: 'translateX(20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        scaleIn:    { from: { opacity: 0, transform: 'scale(.95)' }, to: { opacity: 1, transform: 'scale(1)' } },
        pulseSoft:  { '0%,100%': { opacity: 1 }, '50%': { opacity: .5 } },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
