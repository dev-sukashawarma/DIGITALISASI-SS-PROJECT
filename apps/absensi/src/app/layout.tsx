import { Providers } from './Providers'
import './globals.css'

export const metadata = {
  title: 'Absensi Outlet — Sukashawarma',
  description: 'Clock-in/out dengan face recognition untuk staff outlet',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased bg-slate-50 text-slate-900 selection:bg-suka-orange selection:text-white min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
