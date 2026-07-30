import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { Providers } from './Providers'
import NextTopLoader from 'nextjs-toploader'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata = {
  title: 'Admin Dashboard — Sukashawarma',
  description: 'Administrasi staff, akun & sistem',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Admin',
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
    <html lang="id" suppressHydrationWarning className={inter.variable}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased font-sans bg-slate-50" suppressHydrationWarning>
        <NextTopLoader color="#ea580c" showSpinner={false} />
        <Providers initialStaff={initialStaff}>{children}</Providers>
      </body>
    </html>
  )
}
