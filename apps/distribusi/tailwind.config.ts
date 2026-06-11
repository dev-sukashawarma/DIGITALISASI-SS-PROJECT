import type { Config } from 'tailwindcss'
import { COLORS, TYPOGRAPHY, SPACING } from '@suka/design-system'

export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
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
