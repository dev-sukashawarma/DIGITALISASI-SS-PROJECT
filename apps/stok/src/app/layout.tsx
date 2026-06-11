import { Providers } from './providers'
import './globals.css'

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
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
