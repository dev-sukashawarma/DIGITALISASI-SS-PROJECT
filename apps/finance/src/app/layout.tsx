import { headers } from 'next/headers'
import { Toaster } from 'sonner'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { Providers } from './Providers'
import { CashLayout } from '@/components/CashLayout'
import './globals.css'

export const metadata = {
  title: 'Suka Finance — Treasury',
  description: 'Perbendaharaan internal: arus kas, disbursement, rekonsiliasi',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Finance',
  },
}

export const viewport = {
  themeColor: '#701604',
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
      <body className="antialiased bg-suka-gray-50">
        <Providers initialStaff={initialStaff}>
          <CashLayout>{children}</CashLayout>
          <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  )
}
