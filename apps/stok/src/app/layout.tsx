import { Providers } from './providers'
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
  title: 'Stok Bahan Baku — Sukashawarma',
  description: 'Opname, ledger, monitoring stok bahan baku',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${plusJakarta.variable} ${lilita.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
