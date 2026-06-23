import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Suka Shawarma — Portal',
  description: 'Login & app launcher',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="bg-suka-cream">
      <body className="min-h-screen bg-suka-cream antialiased">{children}</body>
    </html>
  )
}
