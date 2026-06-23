import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Suka Shawarma — Portal',
  description: 'Login & app launcher',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full w-full overflow-hidden bg-suka-cream">
      <body className="h-full w-full overflow-hidden bg-suka-cream antialiased">{children}</body>
    </html>
  )
}
