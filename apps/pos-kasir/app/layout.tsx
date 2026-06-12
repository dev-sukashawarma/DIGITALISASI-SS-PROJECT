import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import KioskPresenceMount from '@/components/KioskPresenceMount'
import GlobalBlockerMount from '@/components/GlobalBlockerMount'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SHAWARMA — Self-Ordering Kiosk',
  description: 'Pesan shawarma favoritmu dengan mudah dan cepat',
}

import { BrandProvider } from '@/components/BrandContext'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body>
        <BrandProvider>
          <KioskPresenceMount />
          <GlobalBlockerMount />
          {children}
        </BrandProvider>
      </body>
    </html>
  )
}
