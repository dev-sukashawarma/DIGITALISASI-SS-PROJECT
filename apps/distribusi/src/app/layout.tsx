import { Providers } from './Providers'
import './globals.css'

export const metadata = {
  title: 'Distribusi — Sukashawarma',
  description: 'Surat Jalan & verifikasi penerimaan dari gudang',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
