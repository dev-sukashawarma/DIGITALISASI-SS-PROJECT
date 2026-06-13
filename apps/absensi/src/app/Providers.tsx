'use client'

import { useMemo } from 'react'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { AuthGuard } from '@/components/AuthGuard'
import { ToastProvider } from '@/lib/feedback/toast'

export function Providers({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  return (
    <ErrorBoundary>
      <AuthProvider supabase={supabase}>
        <ToastProvider>
          <AuthGuard>
            {children}
          </AuthGuard>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
