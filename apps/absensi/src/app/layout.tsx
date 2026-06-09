import { AuthProvider } from '@/context/AuthContext'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import '@/app/globals.css'

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
      <body className="antialiased">
        <ErrorBoundary>
          <AuthProvider>{children}</AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
