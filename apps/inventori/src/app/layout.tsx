import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { Providers } from './Providers'
import './globals.css'

export const metadata = {
  title: 'Inventaris Outlet — Sukashawarma',
  description: 'Pencatatan inventaris aset outlet oleh Area Manager',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const staff = parseStaffHeader((await headers()).get(STAFF_HEADER))
  return (
    <html lang="id">
      <body>
        <Providers initialStaff={staff}>{children}</Providers>
      </body>
    </html>
  )
}
