import { AuthProvider } from '@/context/AuthContext'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Lilita_One, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const lilita = Lilita_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-lilita',
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
})

export const metadata = {
  title: 'Distribusi — Sukashawarma',
  description: 'Surat Jalan & verifikasi penerimaan dari gudang',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${plusJakarta.variable} ${lilita.variable} font-sans antialiased`}>
        <ErrorBoundary>
          <AuthProvider>{children}</AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
