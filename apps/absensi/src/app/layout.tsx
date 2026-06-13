import { AuthProvider } from '@/context/AuthContext'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Navbar } from '@/components/Navbar'
import { AuthGuard } from '@/components/AuthGuard'
import { ToastProvider } from '@/lib/feedback/toast'
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
        <ErrorBoundary>
          <AuthProvider>
            <ToastProvider>
              <AuthGuard>
                {children}
              </AuthGuard>
            </ToastProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
