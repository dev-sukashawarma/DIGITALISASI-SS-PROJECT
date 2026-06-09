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
    },
  },
  plugins: [],
} satisfies Config
