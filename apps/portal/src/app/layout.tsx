import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Suka Shawarma — Portal',
  description: 'Login & app launcher',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  )
}
