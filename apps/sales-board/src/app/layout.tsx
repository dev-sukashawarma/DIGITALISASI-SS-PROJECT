import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const font = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
})

export const metadata: Metadata = {
  title: 'Papan Penjualan — Suka Shawarma',
  description: 'Live Command Center Monitoring Penjualan Outlet Suka Shawarma',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#0c0605',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${font.className} font-sans antialiased selection:bg-amber-500/20 selection:text-amber-400`}
      >
        {children}
      </body>
    </html>
  )
}
