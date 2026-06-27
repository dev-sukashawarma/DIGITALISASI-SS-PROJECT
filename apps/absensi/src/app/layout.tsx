import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { Providers } from './Providers'
import './globals.css'

export const metadata = {
  title: 'Absensi Outlet — Sukashawarma',
  description: 'Clock-in/out dengan face recognition untuk staff outlet',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Absensi',
  },
}

export const viewport = {
  themeColor: '#0a7d2c',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialStaff = parseStaffHeader((await headers()).get(STAFF_HEADER))
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased bg-slate-50 text-slate-900 selection:bg-suka-orange selection:text-white min-h-screen">
        <Providers initialStaff={initialStaff}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
