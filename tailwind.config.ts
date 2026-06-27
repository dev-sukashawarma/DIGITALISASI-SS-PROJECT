import type { Config } from 'tailwindcss'
import { COLORS, TYPOGRAPHY, SPACING } from '@suka/design-system'

export default {
  content: [
    './apps/**/{src,app}/**/*.{ts,tsx}',
    './packages/**/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: COLORS,
      fontFamily: TYPOGRAPHY.fontFamily,
      fontSize: TYPOGRAPHY.fontSize,
      spacing: SPACING,
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite linear',
      },
    },
  },
  plugins: [],
} satisfies Config
