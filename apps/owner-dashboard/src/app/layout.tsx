import { AuthProvider } from '@/context/AuthContext'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import './globals.css'

export const metadata = {
  title: 'Dashboard Owner — Sukashawarma',
  description: 'Reporting hub dengan analytics outlet',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
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
