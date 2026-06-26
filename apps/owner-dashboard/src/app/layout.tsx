import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { Providers } from './Providers'
import { InstallPrompt, PwaUpdater } from '@suka/pwa'
import './globals.css'

export const metadata = {
  title: 'Dashboard Owner — Sukashawarma',
  description: 'Reporting hub dengan analytics outlet',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Owner',
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
      <body className="antialiased">
        <Providers initialStaff={initialStaff}>
          {children}
        </Providers>
        <InstallPrompt appName="Owner" />
        <PwaUpdater />
      </body>
    </html>
  )
}
