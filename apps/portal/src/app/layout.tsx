import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Suka Shawarma — Portal',
  description: 'Login & app launcher',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Portal',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a7d2c',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full w-full overflow-hidden bg-suka-cream">
      <body className={`${plusJakartaSans.className} h-full w-full overflow-hidden bg-suka-cream antialiased`}>
        {children}
      </body>
    </html>
  )
}
