import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const font = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Suka Monitor',
  description: 'On-demand live monitoring outlet Sukashawarma',
}

export const viewport: Viewport = { themeColor: '#f6f7f9' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="id"><body suppressHydrationWarning className={font.className}>{children}</body></html>
}
