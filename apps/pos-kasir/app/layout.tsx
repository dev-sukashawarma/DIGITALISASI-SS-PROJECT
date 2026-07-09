import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import KioskPresenceMount from '@/components/KioskPresenceMount'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import GlobalBlockerMount from '@/components/GlobalBlockerMount'
import AudioUnlockMount from '@/components/AudioUnlockMount'
import { Providers } from '@/components/Providers'
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SHAWARMA — Self-Ordering Kiosk',
  description: 'Pesan shawarma favoritmu dengan mudah dan cepat',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'POS Kasir',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a7d2c',
}

import { BrandProvider } from '@/components/BrandContext'
import { GlobalDialogs } from '@/components/GlobalDialogs'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <BrandProvider>
            <ServiceWorkerRegister />
            <KioskPresenceMount />
            <GlobalBlockerMount />
            <AudioUnlockMount />
            {children}
            <GlobalDialogs />
          </BrandProvider>
        </Providers>
      </body>
    </html>
  )
}
