import type { Config } from 'tailwindcss'
import { COLORS, TYPOGRAPHY, SPACING } from '../../packages/design-system/src/tokens'

export default {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/**/src/**/*.{ts,tsx}',
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
